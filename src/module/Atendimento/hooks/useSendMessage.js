// ✅ Versão final do useSendMessage.js

import { useState } from 'react';
import { toast } from 'react-toastify';
import { apiPost } from '../services/apiClient';
import { uploadFileAndGetURL, validateFile } from '../utils/fileUtils';
import useConversationsStore from '../store/useConversationsStore';

// Helpers de identidade
const normalizeChannel = (raw) => String(raw || '').toLowerCase().trim();
const parseUserId = (userId) => {
  const s = String(userId || '');
  const at = s.lastIndexOf('@');
  if (at === -1) return { id: s, channel: '' };
  return { id: s.slice(0, at), channel: s.slice(at + 1) };
};
const makeUserId = (id, channel) => `${String(id).trim()}@${normalizeChannel(channel)}`;

export function useSendMessage() {
  const [isSending, setIsSending] = useState(false);

  const sendMessage = async ({ text = '', file, userId, replyTo }, onMessageAdded) => {
    console.log('📨 Enviando mensagem:', { text, file, userId, replyTo });

    if (!userId) {
      toast.error('Usuário não identificado.');
      return;
    }

    if (!text.trim() && !file) {
      toast.warn('Digite algo ou anexe um arquivo antes de enviar.', {
        position: 'bottom-right',
        autoClose: 2000,
      });
      return;
    }

    // Extrai id e canal do userId vindo da conversa (ex.: "12345@telegram")
    let { id: toId, channel } = parseUserId(userId);
    channel = normalizeChannel(channel || 'whatsapp'); // fallback seguro
    const fullUserId = makeUserId(toId, channel);

    const now = new Date();
    const tempId = now.getTime();
    const readableTime = now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

    // Mensagem provisória (UI otimista)
    let provisionalMessage = {
      id: tempId,
      direction: 'outgoing',
      timestamp: now.getTime(),
      readableTime,
      status: 'sending',
      type: 'text',
      content: text.trim(),
      user_id: fullUserId,
      channel,
    };

    if (file) {
      const { valid, errorMsg } = validateFile(file);
      if (!valid) {
        toast.error(errorMsg || 'Arquivo inválido.');
        return;
      }
      const isAudio = file.type?.startsWith('audio/');
      const isImage = file.type?.startsWith('image/');
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
      // Payload PADRONIZADO: sempre manda to, channel e user_id
      const payload = {
        to: toId,                 // id sem sufixo
        channel,                  // 'whatsapp' | 'telegram' | ...
        user_id: fullUserId,      // "<id>@<channel>"
      };

      if (file) {
        const fileUrl = await uploadFileAndGetURL(file);
        if (!fileUrl) throw new Error('Erro ao gerar URL do arquivo.');

        const isAudio = file.type?.startsWith('audio/');
        const isImage = file.type?.startsWith('image/');

        payload.type = isAudio ? 'audio' : isImage ? 'image' : 'document';
        payload.content = isAudio
          ? { url: fileUrl, voice: true } // voice=true para PTT no WhatsApp
          : {
              url: fileUrl,
              filename: file.name,
              caption: provisionalMessage.content?.caption || (text.trim() || file.name),
            };
      } else {
        payload.type = 'text';
        payload.content = { body: text.trim() };
        if (replyTo) payload.context = { message_id: replyTo };
      }

      const response = await apiPost('/messages/send', payload);

      // Tenta extrair um message_id do retorno (WA/Telegram)
      const messageId =
        response?.messages?.[0]?.id ||                   // WhatsApp (Graph "puro")
        response?.data?.messages?.[0]?.id ||             // WhatsApp (alguns adapters)
        response?.data?.result?.message_id ||            // Telegram (Bot API proxied)
        response?.data?.message_id ||                    // Telegram (variação)
        response?.result?.message_id ||                  // Telegram (variação)
        response?.message_id ||                          // Telegram (variação)
        null;

      if (typeof onMessageAdded === 'function') {
        onMessageAdded({
          ...provisionalMessage,
          status: 'sent',
          message_id: messageId,
          serverResponse: response,
        });
      }

      // ✅ Marca como lidas visualmente (mantido)
      marcarMensagensAntesDoTicketComoLidas(fullUserId);
    } catch (err) {
      console.error('[❌ Erro ao enviar mensagem]', err);
      if (typeof onMessageAdded === 'function') {
        onMessageAdded({
          ...provisionalMessage,
          status: 'error',
          errorMessage: err?.message || 'Falha ao enviar.',
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
