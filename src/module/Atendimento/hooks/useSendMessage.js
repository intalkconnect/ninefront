// src/hooks/useSendMessage.js
import { useState } from 'react';
import { toast } from 'react-toastify';
import { apiPost } from '../services/apiClient';
import { uploadFileAndGetURL, validateFile } from '../utils/fileUtils';
import useConversationsStore from '../store/useConversationsStore';

// Canal pelo sufixo
const getChannelFromUserId = (userId) => {
  if (!userId) return 'webchat';
  if (userId.endsWith('@w.msgcli.net')) return 'whatsapp';
  if (userId.endsWith('@t.msgcli.net')) return 'telegram';
  return 'webchat';
};

// Remove @w.@t
const extractRawUserId = (userId) => userId.replace(/@[wt]\.msgcli\.net$/, '');

// Deduza type pelo file
const getTypeFromFile = (file) => {
  if (!file) return 'text';
  const mt = (file.type || '').toLowerCase();
  if (mt.startsWith('image/')) return 'image';
  if (mt.startsWith('audio/')) return 'audio';
  if (mt.startsWith('video/')) return 'video';
  return 'document';
};

// Normaliza conteúdo de reply para preview
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

// Snapshot seguro da msg respondida
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

export function useSendMessage() {
  const [isSending, setIsSending] = useState(false);

  const sendMessage = async (
    {
      text,
      file,
      userId,       // <- sempre o ID "cheio", com sufixo
      replyTo,      // id da msg original na plataforma
      replyToFull,  // objeto da msg original (para preview imediato)
    },
    onMessageAdded
  ) => {
    const channel = getChannelFromUserId(userId);
    const to = extractRawUserId(userId || '');

    // validação básica
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
    const replySnapshot = makeReplySnapshot(replyToFull);

    // Mensagem provisória (sem URL ainda quando é mídia)
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

    // Adiciona no store (preferencial) ou usa callback legado
    const store = useConversationsStore.getState();
    const alreadyExists =
      store.conversations[userId]?.messages?.some(
        (m) => m.id === tempId || m.message_id === tempId
      ) || false;

    if (!alreadyExists) {
      if (typeof store.appendMessage === 'function') {
        store.appendMessage(userId, provisionalMessage);
      } else if (typeof onMessageAdded === 'function') {
        onMessageAdded(provisionalMessage);
      }
    }

    setIsSending(true);

    let uploadedContent = null;

    try {
      // Monta payload
      const payload = {
        to,
        channel, // 'whatsapp' | 'telegram'
        type: provisionalType, // 'text' | 'image' | 'audio' | 'video' | 'document'
        content: {},
      };

      if (file) {
        // valida e sobe arquivo
        const { valid, errorMsg } = validateFile(file);
        if (!valid) throw new Error(errorMsg || 'Arquivo inválido');

        const fileUrl = await uploadFileAndGetURL(file);
        if (!fileUrl) throw new Error('Falha no upload do arquivo');

        uploadedContent = {
          url: fileUrl,
          ...(provisionalType !== 'audio' && file.name ? { filename: file.name } : {}),
          ...(text?.trim() ? { caption: text.trim() } : {}),
          // se gravador marcou como voz, já mandamos flag
          ...(provisionalType === 'audio' && file?._isVoice ? { voice: true } : {}),
        };

        // Atualiza a provisória com a URL para render imediato
        if (typeof store.updateMessageStatus === 'function') {
          store.updateMessageStatus(userId, tempId, { content: uploadedContent });
        } else if (typeof onMessageAdded === 'function') {
          onMessageAdded({ ...provisionalMessage, content: uploadedContent, status: 'sending' });
        }

        payload.content = uploadedContent;
      } else {
        payload.content = { body: text.trim() };
      }

      if (replyTo) payload.context = { message_id: replyTo };

      // Envia ao backend
      const response = await apiPost('/messages/send', payload);
      const saved = response?.message;

      // Marca como sent no store (preferencial) ou callback
      if (typeof store.updateMessageStatus === 'function') {
        store.updateMessageStatus(userId, tempId, {
          status: 'sent',
          message_id: saved?.message_id,
          // mantém o content já atualizado se era mídia
          ...(uploadedContent ? { content: uploadedContent } : {}),
        });
      } else if (typeof onMessageAdded === 'function') {
        onMessageAdded({
          ...provisionalMessage,
          status: 'sent',
          message_id: saved?.message_id,
          content: uploadedContent || provisionalMessage.content,
          serverResponse: response,
        });
      }

      // Conveniência: marca mensagens anteriores como lidas
      marcarMensagensAntesDoTicketComoLidas(userId);
    } catch (err) {
      console.error('[❌ Erro ao enviar mensagem]', err);

      const errorPatch = {
        status: 'error',
        errorMessage:
          err?.response?.data?.error ||
          err?.response?.data?.details ||
          err?.message ||
          'Erro desconhecido',
        ...(uploadedContent ? { content: uploadedContent } : {}),
      };

      if (typeof store.updateMessageStatus === 'function') {
        store.updateMessageStatus(userId, tempId, errorPatch);
      } else if (typeof onMessageAdded === 'function') {
        onMessageAdded({ ...provisionalMessage, ...errorPatch });
      }

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

// Auxiliar: marca mensagens como lidas antes do primeiro "system"
export function marcarMensagensAntesDoTicketComoLidas(userId, mensagens) {
  const store = useConversationsStore.getState();
  const conversation = store.conversations[userId] || {};

  if (!mensagens) mensagens = conversation.messages || [];

  const systemIndex = mensagens.findIndex((m) => m.type === 'system');
  if (systemIndex === -1) return;

  const updatedMessages = mensagens.map((msg, idx) =>
    idx < systemIndex ? { ...msg, status: 'read' } : msg
  );

  if (typeof store.setConversation === 'function') {
    store.setConversation(userId, {
      ...conversation,
      messages: updatedMessages,
    });
  }
}
