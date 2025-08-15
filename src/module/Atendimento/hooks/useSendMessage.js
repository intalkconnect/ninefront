// src/hooks/useSendMessage.js
import { useState } from 'react';
import { toast } from 'react-toastify';
import { apiPost } from '../services/apiClient';
import { uploadFileAndGetURL, validateFile } from '../utils/fileUtils';
import useConversationsStore from '../store/useConversationsStore';

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

// Helpers de store p/ adicionar/alterar msg e atualizar snippet da sidebar
function computePreview(msg) {
  if (msg.type === 'text') {
    if (typeof msg.content === 'string') return msg.content;
    return msg.content?.body || msg.content?.text || msg.content?.caption || '';
  }
  const c = msg.content || {};
  return {
    ...(c.url ? { url: c.url } : {}),
    ...(c.filename ? { filename: c.filename } : {}),
    ...(c.caption ? { caption: c.caption } : {}),
    ...(c.voice ? { voice: true } : {}),
    ...(msg.type ? { type: msg.type } : {}),
  };
}
function appendMsg(userId, newMsg) {
  const store = useConversationsStore.getState();
  const conv = store.conversations[userId] || { user_id: userId, messages: [] };
  const messages = Array.isArray(conv.messages) ? conv.messages.slice() : [];
  messages.push(newMsg);
  store.setConversation(userId, {
    ...conv,
    messages,
    content: computePreview(newMsg),
    timestamp: newMsg.timestamp || Date.now(),
  });
}
function patchMsg(userId, matchId, patch) {
  const store = useConversationsStore.getState();
  const conv = store.conversations[userId];
  if (!conv) return;
  const messages = Array.isArray(conv.messages) ? conv.messages.slice() : [];
  const i = messages.findIndex(m => m?.id === matchId || m?.message_id === matchId);
  if (i === -1) return;
  messages[i] = { ...messages[i], ...patch };
  store.setConversation(userId, {
    ...conv,
    messages,
    content: computePreview(messages[i]),
    timestamp: messages[i].timestamp || conv.timestamp || Date.now(),
  });
}
// remap quando o backend devolver outro message_id
function remapMsgId(userId, oldId, newId) {
  const store = useConversationsStore.getState();
  const conv = store.conversations[userId];
  if (!conv) return;
  const messages = (conv.messages || []).map(m =>
    (m.id === oldId || m.message_id === oldId) ? { ...m, id: newId, message_id: newId } : m
  );
  store.setConversation(userId, { ...conv, messages });
}

// Marca lidas antes do primeiro "system"
export function marcarMensagensAntesDoTicketComoLidas(userId, mensagens) {
  const store = useConversationsStore.getState();
  const conversation = store.conversations[userId] || {};
  if (!mensagens) mensagens = conversation.messages || [];
  const systemIndex = mensagens.findIndex((m) => m.type === 'system');
  if (systemIndex === -1) return;
  const updated = mensagens.map((m, idx) => (idx < systemIndex ? { ...m, status: 'read' } : m));
  store.setConversation(userId, { ...conversation, messages: updated });
}

export function useSendMessage() {
  const [isSending, setIsSending] = useState(false);

  const sendMessage = async ({ text, file, userId, replyTo, replyToFull }, onMessageAdded) => {
    const channel = getChannelFromUserId(userId);
    const to = extractRawUserId(userId || '');

    if (!text?.trim() && !file) {
      toast.warn('Digite algo ou anexe um arquivo antes de enviar.', { position: 'bottom-right' });
      return;
    }

    // 🔴 tempId único e usado em tudo
    const tempId = `tmp_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
    const now = Date.now();
    const type = file ? getTypeFromFile(file) : 'text';

    // provisória
    const provisional = {
      id: tempId,
      message_id: tempId,          // <- CRÍTICO p/ casar com o worker/DB
      direction: 'outgoing',
      timestamp: now,
      readableTime: new Date(now).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      status: 'sending',
      type,
      content: text?.trim() || (file ? { filename: file.name } : ''),
      channel,
      ...(replyTo ? { reply_to: replyTo } : {}),
      ...(replyToFull ? { replyTo: {
        message_id:
          replyToFull.message_id ||
          replyToFull.whatsapp_message_id ||
          replyToFull.telegram_message_id ||
          replyToFull.provider_id || replyToFull.id,
        direction: replyToFull.direction,
        type: replyToFull.type,
        content: (() => {
          const c = replyToFull.content || {};
          return typeof c === 'string' ? { body: c } :
                 c.body ? { body: c.body } :
                 c.text ? { body: c.text } :
                 c.caption ? { body: c.caption } :
                 { ...(c.url ? { url: c.url } : {}), ...(c.filename ? { filename: c.filename } : {}), ...(c.voice ? { voice: true } : {}) };
        })(),
      }} : {}),
    };

    appendMsg(userId, provisional);
    if (onMessageAdded) onMessageAdded(provisional);
    setIsSending(true);

    let uploadedContent = null;

    try {
      // payload p/ API — manda tempId
      const payload = { tempId, to, channel, type, content: {} };

      if (file) {
        const { valid, errorMsg } = validateFile(file);
        if (!valid) throw new Error(errorMsg || 'Arquivo inválido');
        const url = await uploadFileAndGetURL(file);
        if (!url) throw new Error('Falha no upload do arquivo');

        uploadedContent = {
          url,
          ...(type !== 'audio' && file.name ? { filename: file.name } : {}),
          ...(text?.trim() ? { caption: text.trim() } : {}),
          ...(type === 'audio' && file?._isVoice ? { voice: true } : {}),
        };

        // Atualiza a provisória com a URL para tocar/mostrar já
        patchMsg(userId, tempId, { content: uploadedContent, status: 'sending' });

        payload.content = uploadedContent;
      } else {
        payload.content = { body: text.trim() };
      }

      if (replyTo) payload.context = { message_id: replyTo };

      // envia
      const resp = await apiPost('/messages/send', payload);
      const saved = resp?.message;

      // Se o backend salvar com outro message_id, remapeia para não quebrar os updates
      if (saved?.message_id && saved.message_id !== tempId) {
        remapMsgId(userId, tempId, saved.message_id);
      }

      patchMsg(userId, saved?.message_id || tempId, {
        status: 'sent',
        provider_id: saved?.provider_id || saved?.whatsapp_message_id || saved?.telegram_message_id,
        content: uploadedContent || provisional.content,
      });

      marcarMensagensAntesDoTicketComoLidas(userId);
    } catch (err) {
      console.error('[sendMessage] erro:', err);
      patchMsg(userId, tempId, {
        status: 'error',
        content: uploadedContent || provisional.content,
        errorMessage:
          err?.response?.data?.error ||
          err?.response?.data?.details ||
          err?.message || 'Erro desconhecido',
      });

      const e = err?.response?.data;
      if (e?.error?.toString?.().toLowerCase?.().includes('24h') || e?.error === 'Message outside 24h window') {
        toast.warn('Fora da janela de 24h no WhatsApp. Envie um template.', { position: 'bottom-right' });
      } else if (e?.error === 'Recipient not in allowed list' || e?.error?.code === 131030) {
        toast.error('Número não permitido no WhatsApp. Use um número de teste cadastrado.', { position: 'bottom-right' });
      } else if (e?.error === 'Message text cannot be empty') {
        toast.error('Mensagem vazia no Telegram.', { position: 'bottom-right' });
      } else {
        toast.error(`Erro ao enviar mensagem: ${err.message}`, { position: 'bottom-right' });
      }
    } finally {
      setIsSending(false);
    }
  };

  return { isSending, sendMessage };
}
