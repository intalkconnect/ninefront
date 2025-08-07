// ✅ Versão final do useSendMessage.js (sempre garante sufixo no user_id)

import { useState } from 'react';
import { toast } from 'react-toastify';
import { apiPost } from '../services/apiClient';
import { uploadFileAndGetURL, validateFile } from '../utils/fileUtils';
import useConversationsStore from '../store/useConversationsStore';

// Map de sufixos por canal
const CHANNEL_SUFFIX = {
  whatsapp: '@w.msgcli.net',
  telegram: '@telegram',
  instagram: '@instagram',
  facebook: '@facebook',
  messenger: '@messenger',
};

// Helpers
const normalize = (s) => String(s || '').trim();
const normalizeChannel = (raw) => normalize(raw).toLowerCase();

// Retorna { id, suffix, channelGuess }
const parseUserIdWithSuffix = (userId) => {
  const s = normalize(userId);
  const at = s.lastIndexOf('@');
  if (at === -1) return { id: s, suffix: '', channelGuess: '' };
  const id = s.slice(0, at);
  const suffix = s.slice(at); // inclui '@'
  // tenta deduzir canal a partir do sufixo
  const channelGuess =
    Object.keys(CHANNEL_SUFFIX).find((k) => CHANNEL_SUFFIX[k] === suffix) || '';
  return { id, suffix, channelGuess };
};

// Garante "<id>@<sufixoDoCanal>"
const makeFullUserId = (id, channel) => {
  const ch = normalizeChannel(channel);
  const suffix = CHANNEL_SUFFIX[ch];
  if (!suffix) throw new Error(`Canal não suportado: ${channel}`);
  return `${normalize(id)}${suffix}`;
};

export function useSendMessage() {
  const [isSending, setIsSending] = useState(false);

  const sendMessage = async ({ text = '', file, userId, channel, replyTo }, onMessageAdded) => {
    console.log('📨 Enviando mensagem:', { text, file, userId, channel, replyTo });

    if (!userId) {
      toast.error('Usuário não identificado.');
      return;
    }

    // 1) Descobre id/sufixo atuais e canal
    let { id: rawId, suffix, channelGuess } = parseUserIdWithSuffix(userId);
    let ch = normalizeChannel(channel || channelGuess || useConversationsStore.getState().conversations[userId]?.channel);

    if (!ch) {
      toast.error('Canal não informado e não foi possível inferir pelo userId.');
      return;
    }
    if (!CHANNEL_SUFFIX[ch]) {
      toast.error(`Canal não suportado: ${ch}`);
      return;
    }

    // 2) Garante user_id com sufixo correto
    const fullUserId = suffix ? makeFullUserId(rawId, ch) : makeFullUserId(rawId, ch);
    const to = rawId; // "to" sempre cru (sem sufixo)

    // 3) Mensagem provisória (UI otimista)
    const now = new Date();
    const tempId = now.getTime();
    const readableTime = now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

    let provisionalMessage = {
      id: tempId,
      direction: 'outgoing',
      timestamp: now.getTime(),
      readableTime,
      status: 'sending',
      type: 'text',
      content: text.trim(),
      user_id: fullUserId, // ✅ sempre com sufixo
      channel: ch,
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
      // 4) Payload padronizado para o back
      const payload = {
        to,                 // id cru
        channel: ch,        // canal explícito
        user_id: fullUserId // ✅ SEMPRE com sufixo
      };

      if (file) {
        const fileUrl = await uploadFileAndGetURL(file);
        if (!fileUrl) throw new Error('Erro ao gerar URL do arquivo.');

        const isAudio = file.type?.startsWith('audio/');
        const isImage = file.type?.startsWith('image/');

        payload.type = isAudio ? 'audio' : isImage ? 'image' : 'document';
        payload.content = isAudio
          ? { url: fileUrl, voice: true } // se o back usar PTT no WA
          : {
              url: fileUrl,
              filename: file.name,
              caption: provisionalMessage.content?.caption || (text.trim() || file.name),
            };
      } else {
        if (!text.trim()) {
          throw new Error('Mensagem vazia.');
        }
        payload.type = 'text';
        payload.content = { body: text.trim() };
        if (replyTo) payload.context = { message_id: replyTo };
      }

      const response = await apiPost('/messages/send', payload);

      // 5) Extrai message_id (cobre WhatsApp/Telegram)
      const messageId =
        response?.messages?.[0]?.id ||
        response?.data?.messages?.[0]?.id ||
        response?.data?.result?.message_id ||
        response?.data?.message_id ||
        response?.result?.message_id ||
        response?.message_id ||
        null;

      if (typeof onMessageAdded === 'function') {
        onMessageAdded({
          ...provisionalMessage,
          status: 'sent',
          message_id: messageId,
          serverResponse: response,
        });
      }

      // Marca como lidas visualmente (se usar)
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
