// ✅ Versão final do useSendMessage.js

import { useState } from 'react';
import { toast } from 'react-toastify';
import { apiPost } from '../services/apiClient';
import { uploadFileAndGetURL, validateFile } from '../utils/fileUtils';
import useConversationsStore from '../store/useConversationsStore';

// Mapas de sufixo/canal
const CHANNEL_TO_SUFFIX = {
  whatsapp: '@w.msgcli.net',
  telegram: '@telegram',
  instagram: '@instagram',
  facebook: '@facebook',
  messenger: '@messenger',
};
const SUFFIX_TO_CHANNEL = Object.fromEntries(
  Object.entries(CHANNEL_TO_SUFFIX).map(([k, v]) => [v, k])
);

const normalize = (s) => String(s || '').trim();
const normalizeChannel = (s) => normalize(s).toLowerCase();

// Lê o canal pelo sufixo do userId e devolve { to, channel, fullUserId }
function parseIdentity(userId) {
  const s = normalize(userId);
  const at = s.lastIndexOf('@');

  if (at === -1) {
    // Sem sufixo (não deveria acontecer), tenta descobrir pelo store
    const state = useConversationsStore.getState();
    const chFromStore = state.conversations[s]?.channel;
    const channel = normalizeChannel(chFromStore || 'whatsapp');
    const suffix = CHANNEL_TO_SUFFIX[channel] || '@w.msgcli.net';
    return { to: s, channel, fullUserId: `${s}${suffix}` };
  }

  const to = s.slice(0, at);
  const suffix = s.slice(at); // inclui '@'
  const guessedChannel = SUFFIX_TO_CHANNEL[suffix];

  // Se não reconheceu o sufixo, tenta pelo store; se não, assume whatsapp
  const state = useConversationsStore.getState();
  const chFromStore = state.conversations[s]?.channel;
  const channel = normalizeChannel(guessedChannel || chFromStore || 'whatsapp');

  // Garante que o sufixo do fullUserId seja o mapeado do canal
  const fixedSuffix = CHANNEL_TO_SUFFIX[channel] || suffix;
  const fullUserId = `${to}${fixedSuffix}`;

  return { to, channel, fullUserId };
}

export function useSendMessage() {
  const [isSending, setIsSending] = useState(false);

  const sendMessage = async ({ text, file, userId, replyTo }, onMessageAdded) => {
    console.log('📨 Enviando mensagem:', { text, file, userId, replyTo });

    if (!userId) {
      toast.error('Usuário não identificado.');
      return;
    }

    if (!normalize(text) && !file) {
      toast.warn('Digite algo ou grave áudio antes de enviar.', {
        position: 'bottom-right',
        autoClose: 2000,
      });
      return;
    }

    // ➜ Identity padronizada (to cru, channel em minúsculo, user_id com sufixo)
    const { to, channel, fullUserId } = parseIdentity(userId);

    const tempId = Date.now();
    const now = new Date();
    const readableTime = now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

    // Mensagem otimista (mantida conforme sua base)
    let provisionalMessage = {
      id: tempId,
      direction: 'outgoing',
      timestamp: now.getTime(),
      readableTime,
      status: 'sending',
      type: 'text',
      content: normalize(text),
    };

    if (file) {
      const { valid, errorMsg } = validateFile(file);
      if (!valid) {
        toast.error(errorMsg || 'Arquivo inválido.');
        return;
      }

      const isAudio = file.type?.startsWith('audio/');
      const isImage = file.type?.startsWith('image/');
      const captionText = normalize(text) || file.name;

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
      // Payload para o back: to (cru), channel e user_id (com sufixo)
      const payload = { to, channel, user_id: fullUserId };

      if (file) {
        const fileUrl = await uploadFileAndGetURL(file);
        if (!fileUrl) throw new Error('Erro ao gerar URL do arquivo.');

        const isAudio = file.type?.startsWith('audio/');
        const isImage = file.type?.startsWith('image/');

        payload.type = isAudio ? 'audio' : isImage ? 'image' : 'document';
        payload.content = isAudio
          ? { url: fileUrl, voice: true } // PTT no WA se o back usar isso
          : {
              url: fileUrl,
              filename: file.name,
              caption: provisionalMessage.content?.caption || (normalize(text) || file.name),
            };
      } else {
        payload.type = 'text';
        payload.content = { body: normalize(text) };
        if (replyTo) payload.context = { message_id: replyTo };
      }

      const response = await apiPost('/messages/send', payload);

      // Extrai id da mensagem (WhatsApp/Telegram – cobre variações comuns)
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
          whatsapp_message_id: messageId, // ⚠ mantém nome usado pela sua UI
          serverResponse: response,
        });
      }

      // Marca como lidas visualmente (usa o userId recebido)
      marcarMensagensAntesDoTicketComoLidas(userId);
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
