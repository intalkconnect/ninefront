// src/hooks/useSendMessage.js
import { useState } from 'react';
import { toast } from 'react-toastify';
import { apiPost } from '../../../shared/apiClient';
import { uploadFileAndGetURL, validateFile } from '../utils/fileUtils';
import useConversationsStore from '../store/useConversationsStore';

/* ================= helpers de canal/id ================= */
const getChannelFromUserId = (userId) => {
  if (!userId) return 'webchat';
  if (userId.endsWith('@w.msgcli.net')) return 'whatsapp';
  if (userId.endsWith('@t.msgcli.net')) return 'telegram';
  return 'webchat';
};
const extractRawUserId = (userId) => userId.replace(/@[wt]\.msgcli\.net$/, '');
const getTypeFromFile = (file) => {
  if (!file) return 'text';
  const mt = (file.type || '').toLowerCase();
  if (mt.startsWith('image/')) return 'image';
  if (mt.startsWith('audio/')) return 'audio';
  if (mt.startsWith('video/')) return 'video';
  return 'document';
};

/* ================= helpers de reply ================= */
function normalizeReplyContent(raw) {
  if (!raw) return {};
  if (typeof raw === 'string') return { body: raw };

  const c = { ...(raw || {}) };
  if (typeof c.body === 'string' && c.body.trim()) return { body: c.body };
  if (typeof c.text === 'string' && c.text.trim()) return { body: c.text };
  if (typeof c.caption === 'string' && c.caption.trim()) return { body: c.caption };

  return {
    ...(c.url ? { url: c.url } : {}),
    ...(c.filename ? { filename: c.filename } : {}),
    ...(c.voice ? { voice: true } : {})
  };
}
function makeReplySnapshot(replyToFull) {
  if (!replyToFull || typeof replyToFull !== 'object') return null;
  const replyId =
    replyToFull.message_id ||
    replyToFull.whatsapp_message_id ||
    replyToFull.telegram_message_id ||
    replyToFull.provider_id ||
    replyToFull.id ||
    null;

  return {
    message_id: replyId || undefined,
    direction: replyToFull.direction,
    name: replyToFull.name || replyToFull.sender_name || undefined,
    type: replyToFull.type,
    content: normalizeReplyContent(replyToFull.content),
  };
}

/* =========== helper para atualizar o “card” (Sidebar) =========== */
function updateConversationCard(userId, patch) {
  const store = useConversationsStore.getState();
  store.setConversation(userId, patch);
}

/* ========================= hook ========================= */
export function useSendMessage() {
  const [isSending, setIsSending] = useState(false);

  const sendMessage = async (
    {
      text,
      file,
      userId,
      replyTo,      // id da msg original (message_id)
      replyToFull,  // objeto completo da msg original (para preview)
    },
    onMessageAdded
  ) => {
    const channel = getChannelFromUserId(userId);
    const to = extractRawUserId(userId || '');

    if (!text?.trim() && !file) {
      toast.warn('Digite algo ou anexe um arquivo antes de enviar.', {
        position: 'bottom-right',
        autoClose: 2000,
      });
      return;
    }

    // pega flow_id da conversa atual (se houver)
    const store = useConversationsStore.getState();
    const flowId = store?.conversations?.[userId]?.flow_id || null;

    // client_id fixo para ligar a otimista às atualizações subsequentes
    const clientId = `c_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;

    const now = new Date();
    const provisionalType = file ? getTypeFromFile(file) : 'text';
    const replySnapshot  = makeReplySnapshot(replyToFull);

    // preview local para imagem
    let localUrl;
    if (file && provisionalType === 'image') {
      try { localUrl = URL.createObjectURL(file); } catch {}
    }

    /* ---------- Mensagem OTIMISTA ---------- */
    const provisionalMessage = {
      // não use id temporário; use apenas client_id para evitar colisão
      id: null,
      client_id: clientId,
      direction: 'outgoing',
      timestamp: now.getTime(),
      readableTime: now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      status: 'pending',                      // <— padronizado
      type: provisionalType,
      content: (() => {
        if (!file) return text?.trim() || '';
        if (provisionalType === 'image' && localUrl) {
          return {
            url: localUrl,
            filename: file.name,
            ...(text?.trim() ? { caption: text.trim() } : {}),
          };
        }
        return { filename: file.name };
      })(),
      channel,
      ...(flowId ? { flow_id: flowId } : {}),
      ...(replyTo ? { reply_to: replyTo } : {}),
      ...(replySnapshot ? { replyTo: replySnapshot } : {}),
    };
    if (typeof onMessageAdded === 'function') onMessageAdded(provisionalMessage);

    /* ---------- Atualização do CARD (Sidebar) ---------- */
    updateConversationCard(userId, {
      content: provisionalMessage.content,
      type: provisionalType,
      timestamp: now.toISOString(),
      channel,
      ...(flowId ? { flow_id: flowId } : {}),
    });

    setIsSending(true);

    let uploadedContent = null;

    try {
      /* ---------- Monta payload ---------- */
      const payload = {
        to,
        channel,
        type: provisionalType,
        content: {},
        ...(flowId ? { flow_id: flowId } : {}),     // <— envia flow_id
        // importante: envie o client_id para o backend ecoar se for possível
        client_id: clientId,
      };

      if (file) {
        const { valid, errorMsg } = validateFile(file);
        if (!valid) throw new Error(errorMsg || 'Arquivo inválido');

        // upload do arquivo
        const fileUrl = await uploadFileAndGetURL(file);
        if (!fileUrl) throw new Error('Falha no upload do arquivo');

        uploadedContent = {
          url: fileUrl,
          ...(provisionalType !== 'audio' && file.name ? { filename: file.name } : {}),
          ...(text?.trim() ? { caption: text.trim() } : {}),
          ...(provisionalType === 'audio' && file?._isVoice ? { voice: true } : {}),
        };

        // atualiza a otimista com a URL definitiva (MANTENDO client_id)
        if (typeof onMessageAdded === 'function') {
          onMessageAdded({
            ...provisionalMessage,
            content: uploadedContent,
            status: 'pending',
            client_id: clientId,
          });
        }

        updateConversationCard(userId, {
          content: uploadedContent,
          type: provisionalType,
          timestamp: now.toISOString(),
          ...(flowId ? { flow_id: flowId } : {}),
        });

        payload.content = uploadedContent;
      } else {
        payload.content = { body: text.trim() };
      }

      if (replyTo) payload.context = { message_id: replyTo };

      /* ---------- Envia ---------- */
      const response = await apiPost('/messages/send', payload);
      const saved = response?.message || response; // compatível se sua API retorna direto

      // atualiza a mesma mensagem OTIMISTA com id real + message_id + status=sent
      if (typeof onMessageAdded === 'function') {
        onMessageAdded({
          ...provisionalMessage,
          status: 'sent',
          content: uploadedContent || provisionalMessage.content,
          client_id: clientId,                 // <— chave para unir ao item existente
          id: saved?.id || null,               // <— id REAL do banco
          message_id: saved?.message_id,       // <— wamid/telegram id
          provider_id: saved?.provider_id,     // se existir
          flow_id: saved?.flow_id || flowId || null,
          serverResponse: response,
        });
      }

      updateConversationCard(userId, {
        content: uploadedContent || provisionalMessage.content,
        type: provisionalType,
        timestamp: now.toISOString(),
        ...(flowId ? { flow_id: flowId } : {}),
      });

      marcarMensagensAntesDoTicketComoLidas(userId);
    } catch (err) {
      console.error('[❌ Erro ao enviar mensagem]', err);

      if (typeof onMessageAdded === 'function') {
        onMessageAdded({
          ...provisionalMessage,
          content: uploadedContent || provisionalMessage.content,
          status: 'failed',          // <— padronizado
          client_id: clientId,
          errorMessage:
            err?.response?.data?.error ||
            err?.response?.data?.details ||
            err?.message ||
            'Erro desconhecido',
        });
      }

      updateConversationCard(userId, {
        content: uploadedContent || provisionalMessage.content,
        type: provisionalType,
        timestamp: now.toISOString(),
        ...(flowId ? { flow_id: flowId } : {}),
      });

      const platformError = err?.response?.data;
      if (
        platformError?.error?.toString?.().toLowerCase?.().includes('24h') ||
        platformError?.error === 'Message outside 24h window'
      ) {
        toast.warn('Fora da janela de 24h no WhatsApp. Envie um template.', {
          position: 'bottom-right', autoClose: 5000,
        });
      } else if (platformError?.error === 'Recipient not in allowed list' || platformError?.error?.code === 131030) {
        toast.error('Número não permitido no WhatsApp. Use um número de teste cadastrado.', {
          position: 'bottom-right', autoClose: 5000,
        });
      } else if (platformError?.error === 'Message text cannot be empty') {
        toast.error('Mensagem vazia no Telegram.', {
          position: 'bottom-right', autoClose: 3000,
        });
      } else {
        toast.error(`Erro ao enviar mensagem: ${err.message}`, {
          position: 'bottom-right', autoClose: 3000,
        });
      }
    } finally {
      setIsSending(false);
      if (localUrl) { try { URL.revokeObjectURL(localUrl); } catch {} }
    }
  };

  return { isSending, sendMessage };
}

/* ===================== marcar como lidas ===================== */
export function marcarMensagensAntesDoTicketComoLidas(userId, mensagens) {
  const store = useConversationsStore.getState();
  const conversation = store.conversations[userId] || {};

  if (!mensagens) mensagens = conversation.messages || [];

  const systemIndex = mensagens.findIndex((m) => m.type === 'system');
  if (systemIndex === -1) return;

  const updatedMessages = mensagens.map((msg, idx) =>
    idx < systemIndex ? { ...msg, status: 'read' } : msg
  );

  store.setConversation(userId, {
    ...conversation,
    messages: updatedMessages,
  });
}
