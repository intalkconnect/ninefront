// src/hooks/useSendMessage.js
import { useState } from 'react';
import { toast } from 'react-toastify';
import { apiPost } from '../services/apiClient';
import { uploadFileAndGetURL, validateFile } from '../utils/fileUtils';
import useConversationsStore from '../store/useConversationsStore';

// -------- Helpers de canal/ids --------
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

// -------- Helpers de reply --------
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
    ...(c.voice ? { voice: true } : {}),
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

// -------- Helpers de store (append/patch + preview do sidebar) --------
function computeConversationPreviewFromMessage(msg) {
  // Retorna algo que o Sidebar sabe transformar em snippet
  if (msg.type === 'text') {
    if (typeof msg.content === 'string') return msg.content;
    if (msg.content?.body) return msg.content.body;
    if (msg.content?.text) return msg.content.text;
    if (msg.content?.caption) return msg.content.caption;
    return '';
  }

  // Para mídia, devolvemos objeto (url/filename/caption/voice), o Sidebar já detecta Ícone/Áudio/Imagem
  const c = msg.content || {};
  return {
    ...(c.url ? { url: c.url } : {}),
    ...(c.filename ? { filename: c.filename } : {}),
    ...(c.caption ? { caption: c.caption } : {}),
    ...(c.voice ? { voice: true } : {}),
    ...(msg.type ? { type: msg.type } : {}),
  };
}

function appendMessageToConversation(userId, newMsg) {
  const store = useConversationsStore.getState();
  const conv = store.conversations[userId] || { user_id: userId, messages: [] };
  const messages = Array.isArray(conv.messages) ? conv.messages.slice() : [];
  messages.push(newMsg);

  const preview = computeConversationPreviewFromMessage(newMsg);
  store.setConversation(userId, {
    ...conv,
    messages,
    content: preview,                 // atualiza snippet
    timestamp: newMsg.timestamp || Date.now(), // atualiza ordering no sidebar
  });
}

function patchMessageInConversation(userId, tempIdOrMsgId, patch = {}) {
  const store = useConversationsStore.getState();
  const conv = store.conversations[userId];
  if (!conv) return;

  const messages = Array.isArray(conv.messages) ? conv.messages.slice() : [];
  const idx = messages.findIndex(
    (m) => m?.id === tempIdOrMsgId || m?.message_id === tempIdOrMsgId
  );
  if (idx === -1) return;

  const updated = { ...messages[idx], ...patch };
  messages[idx] = updated;

  // Se veio conteúdo novo (ex: URL após upload) ou status/sent, também reflete no preview do sidebar
  const shouldRefreshPreview = patch.content || patch.status || patch.readableTime || patch.timestamp;
  const next = {
    ...conv,
    messages,
    ...(shouldRefreshPreview
      ? {
          content: computeConversationPreviewFromMessage(updated),
          timestamp: updated.timestamp || conv.timestamp || Date.now(),
        }
      : {}),
  };

  store.setConversation(userId, next);
}

export function useSendMessage() {
  const [isSending, setIsSending] = useState(false);

  const sendMessage = async (
    { text, file, userId, replyTo, replyToFull },
    onMessageAdded // opcional/legado
  ) => {
    const channel = getChannelFromUserId(userId);
    const to = extractRawUserId(userId || '');

    // validação
    if (!text?.trim() && !file) {
      toast.warn('Digite algo ou anexe um arquivo antes de enviar.', {
        position: 'bottom-right',
        autoClose: 2000,
      });
      return;
    }

    // Mensagem provisória
    const tempId = Date.now();
    const now = Date.now();
    const provisionalType = file ? getTypeFromFile(file) : 'text';
    const replySnapshot = makeReplySnapshot(replyToFull);

    const provisionalMessage = {
      id: tempId,
      direction: 'outgoing',
      timestamp: now,
      readableTime: new Date(now).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      status: 'sending',
      type: provisionalType,
      content: text?.trim() || (file ? { filename: file.name } : ''),
      channel,
      ...(replyTo ? { reply_to: replyTo } : {}),
      ...(replySnapshot ? { replyTo: replySnapshot } : {}),
    };

    // Inserir no store IMEDIATAMENTE
    appendMessageToConversation(userId, provisionalMessage);
    if (typeof onMessageAdded === 'function') onMessageAdded(provisionalMessage); // compat

    setIsSending(true);

    let uploadedContent = null;

    try {
      // Monta payload
      const payload = {
        to,
        channel, // 'whatsapp' | 'telegram'
        type: provisionalType,
        content: {},
      };

      if (file) {
        const { valid, errorMsg } = validateFile(file);
        if (!valid) throw new Error(errorMsg || 'Arquivo inválido');

        const fileUrl = await uploadFileAndGetURL(file);
        if (!fileUrl) throw new Error('Falha no upload do arquivo');

        uploadedContent = {
          url: fileUrl,
          ...(provisionalType !== 'audio' && file.name ? { filename: file.name } : {}),
          ...(text?.trim() ? { caption: text.trim() } : {}),
          ...(provisionalType === 'audio' && file?._isVoice ? { voice: true } : {}),
        };

        // PATCH imediato para render (ex: player de áudio)
        patchMessageInConversation(userId, tempId, {
          content: uploadedContent,
          status: 'sending',
        });

        payload.content = uploadedContent;
      } else {
        payload.content = { body: text.trim() };
      }

      if (replyTo) payload.context = { message_id: replyTo };

      // Chama backend
      const response = await apiPost('/messages/send', payload);
      const saved = response?.message;

      // Marca como sent no store
      patchMessageInConversation(userId, tempId, {
        status: 'sent',
        message_id: saved?.message_id,
        ...(uploadedContent ? { content: uploadedContent } : {}),
      });

      // Conveniência: marcar antigas como lidas
      marcarMensagensAntesDoTicketComoLidas(userId);
    } catch (err) {
      console.error('[❌ Erro ao enviar mensagem]', err);

      patchMessageInConversation(userId, tempId, {
        status: 'error',
        ...(uploadedContent ? { content: uploadedContent } : {}),
        errorMessage:
          err?.response?.data?.error ||
          err?.response?.data?.details ||
          err?.message ||
          'Erro desconhecido',
      });

      // toasts específicos
      const platformError = err?.response?.data;
      if (
        platformError?.error?.toString?.().toLowerCase?.().includes('24h') ||
        platformError?.error === 'Message outside 24h window'
      ) {
        toast.warn('Fora da janela de 24h no WhatsApp. Envie um template.', {
          position: 'bottom-right',
          autoClose: 5000,
        });
      } else if (
        platformError?.error === 'Recipient not in allowed list' ||
        platformError?.error?.code === 131030
      ) {
        toast.error('Número não permitido no WhatsApp. Use um número de teste cadastrado.', {
          position: 'bottom-right',
          autoClose: 5000,
        });
      } else if (platformError?.error === 'Message text cannot be empty') {
        toast.error('Mensagem vazia no Telegram.', {
          position: 'bottom-right',
          autoClose: 3000,
        });
      } else {
        toast.error(`Erro ao enviar mensagem: ${err.message}`, {
          position: 'bottom-right',
          autoClose: 3000,
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
