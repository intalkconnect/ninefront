// ✅ Versão final do useSendMessage.js

import { useState } from 'react';
import { toast } from 'react-toastify';
import { apiPost } from '../services/apiClient';
import { uploadFileAndGetURL, validateFile } from '../utils/fileUtils';
import useConversationsStore from '../store/useConversationsStore';

export function useSendMessage() {
  const [isSending, setIsSending] = useState(false);

  const sendMessage = async ({ text, file, userId, replyTo }, onMessageAdded) => {
    console.log('📨 Enviando mensagem:', { text, file, userId, replyTo });

    if (!text.trim() && !file) {
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
      content: text.trim(),
    };

    if (file) {
      const { valid, errorMsg } = validateFile(file);
      if (!valid) {
        toast.error(errorMsg || 'Arquivo inválido.');
        return;
      }

      const isAudio = file.type.startsWith('audio/');
      const isImage = file.type.startsWith('image/');
      const captionText = text.trim() || file.name;

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
      const payload = { to: userId.replace('@w.msgcli.net', '') };

      if (file) {
        const fileUrl = await uploadFileAndGetURL(file);
        if (!fileUrl) throw new Error('Erro ao gerar URL do arquivo.');

        const isAudio = file.type.startsWith('audio/');
        const isImage = file.type.startsWith('image/');

        payload.type = isAudio ? 'audio' : isImage ? 'image' : 'document';
        payload.content = isAudio
          ? { url: fileUrl, voice: true }
          : {
              url: fileUrl,
              filename: file.name,
              caption: text.trim() || file.name,
            };
      } else {
        payload.type = 'text';
        payload.content = { body: text.trim() };
        if (replyTo) payload.context = { message_id: replyTo };
      }

      const response = await apiPost('/messages/send', payload);
      const messageId = response?.messages?.[0]?.id;

      if (typeof onMessageAdded === 'function') {
        onMessageAdded({
          ...provisionalMessage,
          status: 'sent',
          message_id: messageId,
          serverResponse: response,
        });
      }

      // ✅ Marca como lidas visualmente
      marcarMensagensAntesDoTicketComoLidas(userId);
    } catch (err) {
      console.error('[❌ Erro ao enviar mensagem]', err);
      if (typeof onMessageAdded === 'function') {
        onMessageAdded({
          ...provisionalMessage,
          status: 'error',
          errorMessage: err.message,
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
