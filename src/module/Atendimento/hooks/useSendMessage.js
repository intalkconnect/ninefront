import { useState } from 'react';
import { toast } from 'react-toastify';
import { apiPost } from '../services/apiClient';
import { uploadFileAndGetURL, validateFile } from '../utils/fileUtils';
import useConversationsStore from '../store/useConversationsStore';

// Helper: identifica o canal pelo userId completo
const getChannelFromUserId = (userId) => {
  if (!userId) return 'webchat';
  if (userId.endsWith('@w.msgcli.net')) return 'whatsapp';
  if (userId.endsWith('@t.msgcli.net')) return 'telegram';
  return 'webchat';
};

// Helper: remove sufixo @w.msgcli.net / @t.msgcli.net
const extractRawUserId = (userId) => userId.replace(/@[wt]\.msgcli\.net$/, '');

// Helper: deduz o "type" a partir do arquivo
const getTypeFromFile = (file) => {
  if (!file) return 'text';
  const mt = (file.type || '').toLowerCase();
  if (mt.startsWith('image/')) return 'image';
  if (mt.startsWith('audio/')) return 'audio';
  if (mt.startsWith('video/')) return 'video';
  return 'document';
};

// Normaliza content da msg referenciada para preview
function normalizeReplyContent(raw) {
  if (!raw) return {};
  if (typeof raw === 'string') return { body: raw };

  const c = { ...(raw || {}) };
  // já favorece body/text/caption
  if (typeof c.body === 'string' && c.body.trim()) return { body: c.body };
  if (typeof c.text === 'string' && c.text.trim()) return { body: c.text };
  if (typeof c.caption === 'string' && c.caption.trim()) return { body: c.caption };

  // mantém url/filename/voice p/ dedução de snippet no componente
  return {
    ...(c.url ? { url: c.url } : {}),
    ...(c.filename ? { filename: c.filename } : {}),
    ...(c.voice ? { voice: true } : {})
  };
}

// Cria um snapshot seguro da mensagem sendo respondida
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
    // usado pelo MessageList para achar alvo também
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
      userId,
      replyTo,      // (string) id da msg original
      replyToFull,  // (objeto) msg original completa -> NOVO para preview imediato
    },
    onMessageAdded
  ) => {
    const channel = getChannelFromUserId(userId);
    const to = extractRawUserId(userId || '');

    // log bonitinho pra debug
    console.log('📨 Enviando mensagem:', {
      channel,
      userId,
      to,
      text: text?.trim(),
      file: file?.name,
      replyTo,
      replyToFull,
    });

    // validação básica
    if (!text?.trim() && !file) {
      toast.warn('Digite algo ou anexe um arquivo antes de enviar.', {
        position: 'bottom-right',
        autoClose: 2000,
      });
      return;
    }

    // cria mensagem provisória (feedback instantâneo na UI)
    const tempId = Date.now();
    const now = new Date();

    const provisionalType = file ? getTypeFromFile(file) : 'text';
    const replySnapshot = makeReplySnapshot(replyToFull); // <- snapshot p/ render imediata

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

    if (typeof onMessageAdded === 'function') {
      onMessageAdded(provisionalMessage);
    }

    setIsSending(true);

    try {
      // monta payload do JEITO QUE O BACKEND ESPERA
      const payload = {
        to,
        channel, // 'whatsapp' | 'telegram'
        type: provisionalType, // 'text' | 'image' | 'audio' | 'video' | 'document'
        content: {},
      };

      if (file) {
        // valida e sobe o arquivo pra obter URL
        const { valid, errorMsg } = validateFile(file);
        if (!valid) throw new Error(errorMsg || 'Arquivo inválido');

        const fileUrl = await uploadFileAndGetURL(file);
        if (!fileUrl) throw new Error('Falha no upload do arquivo');

        // WhatsApp/Telegram no seu backend esperam { url, caption?, filename? }
        payload.content = {
          url: fileUrl,
          ...(provisionalType !== 'audio' && file.name ? { filename: file.name } : {}),
          ...(text?.trim() ? { caption: text.trim() } : {}),
        };
      } else {
        // texto simples: { body }
        payload.content = { body: text.trim() };
      }

      if (replyTo) {
        payload.context = { message_id: replyTo }; // mantém referência real para a plataforma
      }

      console.log('📤 Payload de envio:', payload);
      const response = await apiPost('/messages/send', payload);
      // Sua rota retorna: { success: true, message: savedMessage, channel }
      const saved = response?.message;

      if (typeof onMessageAdded === 'function') {
        onMessageAdded({
          ...provisionalMessage,
          status: 'sent',
          message_id: saved?.message_id,
          serverResponse: response,
        });
      }

      // marca como lidas (abaixo tem helper)
      marcarMensagensAntesDoTicketComoLidas(userId);
    } catch (err) {
      console.error('[❌ Erro ao enviar mensagem]', err);

      // atualiza provisória como erro
      if (typeof onMessageAdded === 'function') {
        onMessageAdded({
          ...provisionalMessage,
          status: 'error',
          errorMessage:
            err?.response?.data?.error ||
            err?.response?.data?.details ||
            err?.message ||
            'Erro desconhecido',
        });
      }

      // mensagens específicas
      const platformError = err?.response?.data;

      if (platformError?.error?.toString?.().toLowerCase?.().includes('24h')) {
        toast.warn('Fora da janela de 24h no WhatsApp. Envie um template.', {
          position: 'bottom-right',
          autoClose: 5000,
        });
      } else if (platformError?.error === 'Message outside 24h window') {
        toast.warn('Fora da janela de 24h no WhatsApp. Envie um template.', {
          position: 'bottom-right',
          autoClose: 5000,
        });
      } else if (platformError?.error === 'Recipient not in allowed list' || platformError?.error?.code === 131030) {
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

  if (!mensagens) {
    mensagens = conversation.messages || [];
  }

  const systemIndex = mensagens.findIndex((m) => m.type === 'system');
  if (systemIndex === -1) return;

  const updatedMessages = mensagens.map((msg, idx) =>
    idx < systemIndex ? { ...msg, status: 'read' } : msg
  );

  store.setConversation(userId, {
    ...conversation,
    messages: updatedMessages,
  });
}
