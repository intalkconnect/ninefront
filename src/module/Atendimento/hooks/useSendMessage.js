// ✅ Versão final (universal) do useSendMessage.js
import { useState } from 'react';
import { toast } from 'react-toastify';
import { apiPost } from '../services/apiClient';
import { uploadFileAndGetURL, validateFile } from '../utils/fileUtils';
import useConversationsStore from '../store/useConversationsStore';

function ensureUserIdWithSuffix(userId) {
  // fallback: se vier sem sufixo, assume WhatsApp
  return userId.includes('@') ? userId : `${userId}@w.msgcli.net`;
}

export function useSendMessage() {
  const [isSending, setIsSending] = useState(false);

  const sendMessage = async ({ text, file, userId, replyTo }, onMessageAdded) => {
    console.log('📨 Enviando mensagem:', { text, file, userId, replyTo });

    const safeText = (text || '').trim();
    if (!safeText && !file) {
      toast.warn('Digite algo ou grave áudio antes de enviar.', {
        position: 'bottom-right',
        autoClose: 2000,
      });
      return;
    }

    const tempId = Date.now();
    const now = new Date();
    const readableTime = now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

    let provisionalMessage = {
      id: tempId,
      direction: 'outgoing',
      timestamp: now.getTime(),
      readableTime,
      status: 'sending',
      type: 'text',
      content: safeText,
    };

    if (file) {
      const { valid, errorMsg } = validateFile(file);
      if (!valid) {
        toast.error(errorMsg || 'Arquivo inválido.');
        return;
      }

      const isAudio = file.type.startsWith('audio/');
      const isImage = file.type.startsWith('image/');
      const captionText = safeText || file.name;

      provisionalMessage.type = isAudio ? 'audio' : isImage ? 'image' : 'document';
      provisionalMessage.content = {
        url: null,
        filename: file.name,
        caption: captionText,
      };
    }

    if (typeof onMessageAdded === 'function') {
      onMessageAdded(provisionalMessage);
    }

    setIsSending(true);

    try {
      // 🔑 Agora enviamos SEMPRE user_id com sufixo
      const user_id = ensureUserIdWithSuffix(userId);
      const payload = { user_id };

      if (file) {
        const fileUrl = await uploadFileAndGetURL(file);
        if (!fileUrl) throw new Error('Erro ao gerar URL do arquivo.');

        const isAudio = file.type.startsWith('audio/');
        const isImage = file.type.startsWith('image/');

        payload.type = isAudio ? 'audio' : isImage ? 'image' : 'document';
        payload.content = isAudio
          ? { url: fileUrl, voice: true } // WA usa voice:true; no TG é ignorado sem quebrar
          : {
              url: fileUrl,
              filename: file.name,
              caption: safeText || file.name,
            };
      } else {
        payload.type = 'text';
        payload.content = { body: safeText };
        if (replyTo) payload.context = { message_id: replyTo };
      }

      // 🔗 Endpoint permanece o mesmo
      const response = await apiPost('/messages/send', payload);

      // 🆔 Compat: WA ou TG
      const messageId =
        response?.messages?.[0]?.id ||      // WhatsApp Cloud
        response?.result?.message_id ||     // Telegram (se vier assim)
        response?.message_id ||             // fallback
        null;

      if (typeof onMessageAdded === 'function') {
        onMessageAdded({
          ...provisionalMessage,
          status: 'sent',
          message_id: messageId,
          serverResponse: response,
        });
      }

      // ✅ Marca como lidas visualmente
      marcarMensagensAntesDoTicketComoLidas(user_id);
    } catch (err) {
      console.error('[❌ Erro ao enviar mensagem]', err);
      if (typeof onMessageAdded === 'function') {
        onMessageAdded({
          ...provisionalMessage,
          status: 'error',
          errorMessage: err?.message || 'Falha ao enviar',
        });
      }
    } finally {
      setIsSending(false);
    }
  };

  return { isSending, sendMessage };
}

export function marcarMensagensAntesDoTicketComoLidas(userId, mensagens) {
  if (!mensagens || !Array.isArray(mensagens)) return;

  const systemIndex = mensagens.findIndex((m) => m.type === 'system');
  if (systemIndex === -1) return;

  const novasMsgs = mensagens.map((msg, idx) => {
    if (idx < systemIndex) {
      return { ...msg, status: 'read' };
    }
    return msg;
  });

  useConversationsStore.getState().setConversation(userId, {
    ...(useConversationsStore.getState().conversations[userId] || {}),
    messages: novasMsgs,
  });
}
