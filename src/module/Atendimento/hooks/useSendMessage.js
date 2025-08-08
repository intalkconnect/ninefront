// hooks/useSendMessage.js
import { useState } from 'react';
import { toast } from 'react-toastify';
import { apiPost } from '../services/apiClient';
import { uploadFileAndGetURL, validateFile } from '../utils/fileUtils';
import useConversationsStore from '../store/useConversationsStore';

// Helper para identificar o canal pelo userId
const getChannelFromUserId = (userId) => {
  if (!userId) return 'webchat';
  if (userId.endsWith('@w.msgcli.net')) return 'whatsapp';
  if (userId.endsWith('@t.msgcli.net')) return 'telegram';
  return 'webchat';
};

// Helper para extrair o ID puro (remove sufixos @w.msgcli.net ou @t.msgcli.net)
const extractRawUserId = (userId) => {
  return userId.replace(/@[wt]\.msgcli\.net$/, '');
};

export function useSendMessage() {
  const [isSending, setIsSending] = useState(false);

  const sendMessage = async ({ text, file, userId, replyTo }, onMessageAdded) => {
    const channel = getChannelFromUserId(userId);
    console.log('📨 Enviando mensagem:', { 
      channel,
      userId,
      text: text?.trim(),
      file: file?.name 
    });

    // Validação básica
    if (!text?.trim() && !file) {
      toast.warn('Digite algo ou anexe um arquivo antes de enviar.', {
        position: 'bottom-right',
        autoClose: 2000,
      });
      return;
    }

    // Cria mensagem temporária para feedback instantâneo
    const tempId = Date.now();
    const now = new Date();
    
    const provisionalMessage = {
      id: tempId,
      direction: 'outgoing',
      timestamp: now.getTime(),
      readableTime: now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      status: 'sending',
      type: file ? (file.type.startsWith('audio/') ? 'audio' : 
                   file.type.startsWith('image/') ? 'image' : 'document') : 'text',
      content: text?.trim() || (file ? { filename: file.name } : ''),
      channel
    };

    if (typeof onMessageAdded === 'function') {
      onMessageAdded(provisionalMessage);
    }

    setIsSending(true);

    try {
      // Prepara payload base
      const payload = {
        to: extractRawUserId(userId),
        channel,
        type: provisionalMessage.type,
        content: {}
      };

      // Tratamento para arquivos
      if (file) {
        const { valid, errorMsg } = validateFile(file);
        if (!valid) {
          throw new Error(errorMsg || 'Arquivo inválido');
        }

        const fileUrl = await uploadFileAndGetURL(file);
        if (!fileUrl) throw new Error('Falha no upload do arquivo');

        payload.content = {
          url: fileUrl,
          ...(file.type.startsWith('audio/') ? {} : { filename: file.name }),
          ...(text?.trim() ? { caption: text.trim() } : {})
        };
      } 
      // Mensagem de texto simples
      else {
        payload.content = { body: text.trim() };
      }

      // Adiciona contexto de resposta se existir
      if (replyTo) {
        payload.context = { message_id: replyTo };
      }

      console.log('📤 Payload de envio:', payload);
      const response = await apiPost('/messages/send', payload);

      // Atualiza mensagem temporária com resposta do servidor
      if (typeof onMessageAdded === 'function') {
        onMessageAdded({
          ...provisionalMessage,
          status: 'sent',
          message_id: response?.message_id || response?.messages?.[0]?.id,
          serverResponse: response,
        });
      }

      // Atualiza status de leitura
      marcarMensagensAntesDoTicketComoLidas(userId);

    } catch (err) {
      console.error('[❌ Erro ao enviar mensagem]', err);
      
      if (typeof onMessageAdded === 'function') {
        onMessageAdded({
          ...provisionalMessage,
          status: 'error',
          errorMessage: err.response?.data?.error?.message || err.message,
        });
      }

      // Tratamento específico para erro de WhatsApp
      if (err.response?.data?.error?.code === 131030) {
        toast.error('Número não permitido no WhatsApp. Use um número de teste cadastrado.', {
          position: 'bottom-right',
          autoClose: 5000,
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

// Função auxiliar para marcar mensagens como lidas
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
    messages: updatedMessages
  });
}
