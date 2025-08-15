// src/hooks/useSendMessage.js
import { useState } from 'react';
import { toast } from 'react-toastify';
import { apiPost } from '../services/apiClient';
import { uploadFileAndGetURL, validateFile } from '../utils/fileUtils';
import useConversationsStore from '../store/useConversationsStore';

// --------- helpers de canal/id ---------
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

// --------- helpers de reply ---------
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

// --------- helper: atualizar “card” no store (Sidebar) ---------
function updateConversationCard(userId, patch) {
  const store = useConversationsStore.getState();
  store.setConversation(userId, patch);
}

// ----------------------------------------------------------------
export function useSendMessage() {
  const [isSending, setIsSending] = useState(false);

  const sendMessage = async (
    {
      text,
      file,
      userId,
      replyTo,      // id da msg original
      replyToFull,  // objeto completo da msg original (para preview imediato)
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

    const tempId = Date.now();
    const now = new Date();
    const provisionalType = file ? getTypeFromFile(file) : 'text';
    const replySnapshot  = makeReplySnapshot(replyToFull);

    // ---------- Mensagem provisória (ChatWindow) ----------
    const provisionalMessage = {
      id: tempId,
      direction: 'outgoing',
      timestamp: now.getTime(),
      readableTime: now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      status: 'sending',
      type: provisionalType,
      content: text?.trim() || (file ? { filename: file.name } : ''),
      channel,
      ...(replyTo ? { reply_to: replyTo } : {}),
      ...(replySnapshot ? { replyTo: replySnapshot } : {}),
    };
    if (typeof onMessageAdded === 'function') onMessageAdded(provisionalMessage);

    // ---------- Atualização OTIMISTA do CARD (Sidebar) ----------
    // Mostra imediatamente o snippet correto (texto/áudio/imagem/documento)
    updateConversationCard(userId, {
      // Mantém dados já existentes e apenas atualiza estes campos
      content: provisionalMessage.content,
      type: provisionalType,
      timestamp: now.toISOString(),
      channel, // por segurança
    });

    setIsSending(true);

    let uploadedContent = null;

    try {
      // ---------- Monta payload do backend ----------
      const payload = {
        to,
        channel,                    // 'whatsapp' | 'telegram'
        type: provisionalType,      // 'text' | 'image' | 'audio' | 'video' | 'document'
        content: {},
      };

      if (file) {
        const { valid, errorMsg } = validateFile(file);
        if (!valid) throw new Error(errorMsg || 'Arquivo inválido');

        // Sobe o arquivo e ATUALIZA a mensagem provisória + card com a URL
        const fileUrl = await uploadFileAndGetURL(file);
        if (!fileUrl) throw new Error('Falha no upload do arquivo');

        uploadedContent = {
          url: fileUrl,
          ...(provisionalType !== 'audio' && file.name ? { filename: file.name } : {}),
          ...(text?.trim() ? { caption: text.trim() } : {}),
          ...(provisionalType === 'audio' && file?._isVoice ? { voice: true } : {}),
        };

        // ChatWindow: atualiza a bolha provisória com URL (player/imagem já renderizam)
        if (typeof onMessageAdded === 'function') {
          onMessageAdded({
            ...provisionalMessage,
            content: uploadedContent,
            status: 'sending',
          });
        }

        // Sidebar: atualiza o card com URL (snippet muda para Ícone Áudio/Imagem etc.)
        updateConversationCard(userId, {
          content: uploadedContent,
          type: provisionalType,
          timestamp: now.toISOString(),
        });

        payload.content = uploadedContent;
      } else {
        payload.content = { body: text.trim() };
      }

      if (replyTo) payload.context = { message_id: replyTo };

      // ---------- Envia ----------
      const response = await apiPost('/messages/send', payload);
      const saved = response?.message;

      // ChatWindow: marca como sent (mantendo conteúdo já mostrado)
      if (typeof onMessageAdded === 'function') {
        onMessageAdded({
          ...provisionalMessage,
          status: 'sent',
          content: uploadedContent || provisionalMessage.content,
          message_id: saved?.message_id,
          serverResponse: response,
        });
      }

      // Sidebar: garante que o card permaneça com o último conteúdo e horário
      updateConversationCard(userId, {
        content: uploadedContent || provisionalMessage.content,
        type: provisionalType,
        timestamp: now.toISOString(),
      });

      marcarMensagensAntesDoTicketComoLidas(userId);
    } catch (err) {
      console.error('[❌ Erro ao enviar mensagem]', err);

      if (typeof onMessageAdded === 'function') {
        onMessageAdded({
          ...provisionalMessage,
          content: uploadedContent || provisionalMessage.content,
          status: 'error',
          errorMessage:
            err?.response?.data?.error ||
            err?.response?.data?.details ||
            err?.message ||
            'Erro desconhecido',
        });
      }

      // Mesmo em erro, mantenha o card com o último conteúdo para o snippet
      updateConversationCard(userId, {
        content: uploadedContent || provisionalMessage.content,
        type: provisionalType,
        timestamp: now.toISOString(),
      });

      const platformError = err?.response?.data;
      if (platformError?.error?.toString?.().toLowerCase?.().includes('24h') ||
          platformError?.error === 'Message outside 24h window') {
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
    }
  };

  return { isSending, sendMessage };
}

// Marca mensagens como lidas antes do primeiro "system"
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
