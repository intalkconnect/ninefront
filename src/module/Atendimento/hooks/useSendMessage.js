import { useState } from 'react';
import { toast } from 'react-toastify';
import { apiPost } from '../services/apiClient';
import { uploadFileAndGetURL, validateFile } from '../utils/fileUtils';

/**
 * Hook que encapsula a lógica de “montar payload e chamar POST /messages/send”.
 *
 * - Expondo:
 *   • isSending (boolean)
 *   • sendMessage({ text, file, userId, replyTo }, onMessageAdded)
 *
 * Chame sendMessage() quando quiser disparar o envio.
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

    const tempId = Date.now();
    const now = new Date();
    const timestamp = now.toLocaleTimeString([], {
      hour: '2-digit',
      minute: '2-digit',
    });

    let provisionalMessage = {
      id: tempId,
      timestamp,
      status: 'sending',
    };

    // Preenche os dados da mensagem provisória
    if (file) {
      if (file.type.startsWith('audio/')) {
        provisionalMessage.type = 'audio';
        provisionalMessage.content = { url: null };
      } else {
        const realFileName = file.name;
        const captionText = text.trim() !== '' ? text.trim() : realFileName;
        provisionalMessage.type = file.type.startsWith('image/') ? 'image' : 'document';
        provisionalMessage.content = {
          url: null,
          filename: realFileName,
          caption: captionText,
        };
      }
    } else {
      provisionalMessage.type = 'text';
      provisionalMessage.content = text.trim();
    }

    // Exibe a mensagem provisória
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
          toast.error(errorMsg || 'Arquivo inválido.');
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

      // Atualiza a mensagem como enviada com sucesso
      if (typeof onMessageAdded === 'function') {
        onMessageAdded({
          ...provisionalMessage,
          status: 'sent',
          serverResponse: serverData,
        });
      }
    } catch (err) {
      console.error('[❌ Erro ao enviar]', err);

      // Atualiza a mensagem com erro e salva o payload original para reenvio
      if (typeof onMessageAdded === 'function') {
        onMessageAdded({
          ...provisionalMessage,
          status: 'error',
          errorMessage: err.message,
          originalPayload: { text, file, userId, replyTo },
        });
      }

      toast.error('Erro ao enviar mensagem. Tente novamente.');
    } finally {
      setIsSending(false);
    }
  };

  return { isSending, sendMessage };
}
