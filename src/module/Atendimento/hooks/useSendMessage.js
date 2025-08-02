// src/hooks/useSendMessage.js

import { useState } from 'react';
import { toast } from 'react-toastify';
import { apiPost } from '../services/apiClient';
import { uploadFileAndGetURL, validateFile } from '../utils/fileUtils';

/**
 * Hook que encapsula a lógica de “montar payload e chamar POST /messages/send”.
 *
 * - Expondo:
 *   • isSending (boolean)
 *   • sendMessage({ text, file, userId }, onMessageAdded)
 *
 * Chame sendMessage() quando quiser disparar o envio.
 */
export function useSendMessage() {
  const [isSending, setIsSending] = useState(false);


  const sendMessage = async ({ text, file, userId, replyTo }, onMessageAdded) => {
    console.log('📨 useSendMessage recebeu:', { text, file, userId, replyTo , onMessageAdded });

    if (!text.trim() && !file) {
      toast.warn('Digite algo ou grave áudio antes de enviar.', {
        position: 'bottom-right',
        autoClose: 2000,
      });
      return;
    }

    // Monta a mensagem provisória (id temporário, timestamp, etc.)
    const tempId = Date.now();
    const now = new Date();
    const timestamp = now.toLocaleTimeString([], {
      hour: '2-digit',
      minute: '2-digit',
    });

    let provisionalMessage;
    if (file) {
      if (file.type.startsWith('audio/')) {
        provisionalMessage = {
          id: tempId,
          type: 'audio',
          content: { url: null },
          status: 'sending',
          timestamp,
        };
      } else {
        const realFileName = file.name;
        const captionText = text.trim() !== '' ? text.trim() : realFileName;
        provisionalMessage = {
          id: tempId,
          type: file.type.startsWith('image/') ? 'image' : 'document',
          content: {
            url: null,
            filename: realFileName,
            caption: captionText,
          },
          status: 'sending',
          timestamp,
        };
      }
    } else {
      provisionalMessage = {
        id: tempId,
        type: 'text',
        content: text.trim(),
        status: 'sending',
        timestamp,
      };
    }

    if (typeof onMessageAdded === 'function') {
      onMessageAdded(provisionalMessage);
    }

    setIsSending(true);

    try {
  const to = userId.replace('@w.msgcli.net', '');
  const payload = { to };

  if (file) {
    const { valid, errorMsg } = validateFile(file);
    if (!valid) {
      setIsSending(false);
      return;
    }
    const fileUrl = await uploadFileAndGetURL(file);
    if (!fileUrl) throw new Error('Não foi possível obter URL.');

    const isAudioFile = file.type.startsWith('audio/');
    const isImage = file.type.startsWith('image/');
    if (isAudioFile) {
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
    if (replyTo) {
      payload.context = { message_id: replyTo };
    }
    payload.content = { body: text.trim() };
  }

  console.log('🚀 Payload FINAL enviado para o servidor:', payload);

  const serverData = await apiPost('/messages/send', payload);

  if (typeof onMessageAdded === 'function') {
    onMessageAdded({
      id: tempId,
      status: 'sent',
      serverResponse: serverData,
    });
  }

} catch (err) {
  console.error('[❌ Erro ao enviar]', err);
  if (typeof onMessageAdded === 'function') {
    onMessageAdded({
      id: tempId,
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
