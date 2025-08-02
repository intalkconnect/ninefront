// src/hooks/useSendMessage.js

import { useState } from 'react';
import { toast } from 'react-toastify';
import { apiPost } from '../services/apiClient';
import { uploadFileAndGetURL, validateFile } from '../utils/fileUtils';

/**
 * Hook que encapsula a lógica de envio de mensagens para o backend.
 */
export function useSendMessage() {
  const [isSending, setIsSending] = useState(false);

  const sendMessage = async ({ text, file, userId, replyTo }, onMessageAdded) => {
    console.log('📨 useSendMessage recebeu:', { text, file, userId, replyTo });

    if (!text.trim() && !file) {
      toast.warn('Digite algo ou grave áudio antes de enviar.', {
        position: 'bottom-right',
        autoClose: 2000,
      });
      return;
    }

    setIsSending(true);

    try {
      const to = userId.replace('@w.msgcli.net', '');
      const payload = { to };

      if (file) {
        const { valid, errorMsg } = validateFile(file);
        if (!valid) {
          toast.error(errorMsg);
          return;
        }

        const fileUrl = await uploadFileAndGetURL(file);
        if (!fileUrl) throw new Error('Não foi possível obter URL do arquivo.');

        const isAudio = file.type.startsWith('audio/');
        const isImage = file.type.startsWith('image/');

        if (isAudio) {
          payload.type = 'audio';
          payload.content = { url: fileUrl, voice: true };
        } else {
          const caption = text.trim() || file.name;
          payload.type = isImage ? 'image' : 'document';
          payload.content = {
            url: fileUrl,
            filename: file.name,
            caption,
          };
        }
      } else {
        payload.type = 'text';
        if (replyTo) payload.context = { message_id: replyTo };
        payload.content = { body: text.trim() };
      }

      console.log('🚀 Payload FINAL enviado para o servidor:', payload);
      const serverData = await apiPost('/messages/send', payload);

      // Não adiciona mensagem localmente - espera socket entregar via handleNewMessage
      // Mas pode emitir callback para rastrear o status do envio
      if (typeof onMessageAdded === 'function') {
        onMessageAdded({
          id: `provisional-${Date.now()}`,
          status: 'sent',
          serverResponse: serverData,
        });
      }

    } catch (err) {
      console.error('[❌ Erro ao enviar mensagem]', err);
      toast.error('Erro ao enviar mensagem');
      if (typeof onMessageAdded === 'function') {
        onMessageAdded({
          id: `provisional-${Date.now()}`,
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
