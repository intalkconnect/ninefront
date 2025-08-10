import { create } from 'zustand';
import { apiGet, apiPut } from '../services/apiClient';
import { joinUserRoom, on } from '../services/sse';

const useConversationsStore = create((set, get) => ({
  conversations: {},
  lastRead: {},
  unreadCounts: {},
  clienteAtivo: null,
  selectedUserId: null,
  userEmail: null,
  userFilas: [],
  agentName: null,
  settings: [],
  socketStatus: 'online',
  
  // 🆕 NOVO: Cache de mensagens por usuário (para sincronizar com ChatWindow)
  messagesCache: {},
  
  // 🆕 NOVO: Versão para forçar re-renders
  messageVersion: 0,
  
  // 🆕 NOVO: Listeners SSE
  sseListeners: [],

  setSocketStatus: (status) => set({ socketStatus: status }),
  setSettings: (data) => set({ settings: data }),
  
  getSettingValue: (key) => {
    const found = get().settings.find(s => s.key === key);
    return found ? found.value : null;
  },

  setUserInfo: ({ email, filas, name }) => {
    set({ userEmail: email, userFilas: filas, agentName: name });
    
    // 🆕 Configurar listeners SSE quando temos as informações do usuário
    if (email && filas?.length > 0) {
      get().setupSSEListeners();
    }
  },

  // 🆕 NOVO: Configurar listeners SSE globais
  setupSSEListeners: () => {
    const { sseListeners, handleSSEMessage } = get();
    
    // Evitar listeners duplicados
    if (sseListeners.length > 0) {
      console.log('🔌 [Store] SSE listeners já configurados');
      return;
    }

    console.log('🔌 [Store] Configurando listeners SSE globais');

    const newListeners = [
      on('new_message', handleSSEMessage),
      on('message_status', handleSSEMessage),
      on('update_message', handleSSEMessage),
    ];

    set({ sseListeners: newListeners });
  },

  // 🆕 NOVO: Handler central para mensagens SSE
  handleSSEMessage: (messageData) => {
    console.log('📨 [Store] Mensagem SSE recebida:', messageData);
    
    if (!messageData || !messageData.user_id) {
      console.log('❌ [Store] Mensagem SSE inválida');
      return;
    }

    const { userEmail, userFilas, selectedUserId } = get();
    const userId = String(messageData.user_id);

    // Verificar se a mensagem é para este agente
    const conv = get().conversations[userId];
    const assignedToMe = messageData.assigned_to 
      ? messageData.assigned_to === userEmail
      : (conv?.assigned_to ? conv.assigned_to === userEmail : false);
      
    const inMyQueue = messageData.fila 
      ? userFilas.includes(messageData.fila)
      : (conv?.fila ? userFilas.includes(conv.fila) : false);

    if (!assignedToMe || !inMyQueue) {
      console.log('❌ [Store] Mensagem não é para este agente');
      return;
    }

    // Atualizar conversa
    get().mergeConversation(userId, {
      content: typeof messageData.content === 'string' 
        ? messageData.content 
        : (messageData.content?.text ?? ''),
      timestamp: messageData.timestamp,
      channel: messageData.channel,
      assigned_to: messageData.assigned_to,
      fila: messageData.fila,
    });

    // 🆕 Adicionar mensagem ao cache
    get().addMessageToCache(userId, messageData);

    // Incrementar não lidas se não for a conversa ativa
    if (messageData.direction !== 'outgoing' && userId !== selectedUserId) {
      get().incrementUnread(userId, messageData.timestamp);
    }

    console.log('✅ [Store] Mensagem SSE processada');
  },

  // 🆕 NOVO: Adicionar mensagem ao cache
  addMessageToCache: (userId, message) => {
    set((state) => {
      const currentMessages = state.messagesCache[userId] || [];
      const messageId = message.id || message.message_id;
      
      // Evitar duplicatas
      const exists = currentMessages.find(m => 
        (m.id && m.id === messageId) || 
        (m.message_id && m.message_id === messageId)
      );
      
      if (exists) {
        console.log('🔄 [Store] Atualizando mensagem existente');
        return {
          messagesCache: {
            ...state.messagesCache,
            [userId]: currentMessages.map(m => 
              ((m.id && m.id === messageId) || (m.message_id && m.message_id === messageId))
                ? { ...m, ...message }
                : m
            ),
          },
          messageVersion: state.messageVersion + 1,
        };
      }

      console.log('🆕 [Store] Adicionando nova mensagem ao cache');
      const updatedMessages = [...currentMessages, message]
        .sort((a, b) => new Date(a.timestamp || 0) - new Date(b.timestamp || 0));

      return {
        messagesCache: {
          ...state.messagesCache,
          [userId]: updatedMessages,
        },
        messageVersion: state.messageVersion + 1,
      };
    });
  },

  // 🆕 NOVO: Obter mensagens do cache
  getMessagesFromCache: (userId) => {
    return get().messagesCache[userId] || [];
  },

  // 🆕 NOVO: Definir mensagens no cache (para sincronizar com ChatWindow)
  setMessagesInCache: (userId, messages) => {
    set((state) => ({
      messagesCache: {
        ...state.messagesCache,
        [userId]: messages,
      },
      messageVersion: state.messageVersion + 1,
    }));
  },

  // 🔄 MELHORADO: setSelectedUserId com notificação SSE
  setSelectedUserId: async (userId) => {
    const previousId = get().selectedUserId;
    const now = new Date().toISOString();

    set({ selectedUserId: userId });

    try { 
      joinUserRoom(userId, previousId); 
      console.log('🏠 [Store] Room SSE atualizada para:', userId);
    } catch (err) {
      console.error('❌ [Store] Erro ao atualizar room SSE:', err);
    }

    if (previousId && previousId !== userId) {
      get().resetUnread(previousId);
      get().clearNotified(previousId);
    }

    get().resetUnread(userId);
    get().clearNotified(userId);

    set((state) => ({
      lastRead: {
        ...state.lastRead,
        [userId]: now,
      },
      unreadCounts: {
        ...state.unreadCounts,
        [userId]: 0,
      },
    }));

    try {
      await apiPut(`/api/v1/messages/read-status/${userId}`, {
        last_read: now,
      });
      await get().loadUnreadCounts();
    } catch (err) {
      console.error('Erro ao marcar como lido:', err);
    }
  },

  setConversation: (userId, newData) =>
    set((state) => ({
      conversations: {
        ...state.conversations,
        [userId]: {
          ...(state.conversations[userId] || {}),
          ...newData,
        },
      },
    })),

  // 🔄 MELHORADO: appendMessage agora atualiza o cache também
  appendMessage: (userId, msg) => {
    console.log('📝 [Store] appendMessage chamado para:', userId);
    
    set((state) => {
      const prevConv = state.conversations[userId] || {};
      const prevMsgs = prevConv.messages || [];
      
      return {
        conversations: {
          ...state.conversations,
          [userId]: {
            ...prevConv,
            messages: [...prevMsgs, msg],
          },
        },
      };
    });

    // 🆕 Também adicionar ao cache
    get().addMessageToCache(userId, msg);
  },

  resetUnread: (userId) =>
    set((state) => ({
      unreadCounts: {
        ...state.unreadCounts,
        [userId]: 0,
      },
      lastRead: {
        ...state.lastRead,
        [userId]: new Date().toISOString(),
      },
    })),

  incrementUnread: (userId, messageTimestamp) => {
    const { lastRead, unreadCounts } = get();
    const last = lastRead[userId] ? new Date(lastRead[userId]) : null;
    const current = new Date(messageTimestamp);

    if (last && current <= last) return;

    set({
      unreadCounts: {
        ...unreadCounts,
        [userId]: (unreadCounts[userId] || 0) + 1,
      },
    });
  },

  setClienteAtivo: (info) => set({ clienteAtivo: info }),

  mergeConversation: (userId, data) =>
    set((state) => ({
      conversations: {
        ...state.conversations,
        [userId]: {
          ...(state.conversations[userId] || {}),
          ...data,
        },
      },
    })),

  getContactName: (userId) => get().conversations[userId]?.name || userId,

  loadUnreadCounts: async () => {
    try {
      const data = await apiGet('/api/v1/messages/unread-counts');
      const counts = data.reduce((acc, item) => {
        acc[item.user_id] = item.unread_count;
        return acc;
      }, {});
      set({ unreadCounts: counts });
    } catch (error) {
      console.error('Erro ao carregar unreadCounts:', error);
    }
  },

  loadLastReadTimes: async () => {
    try {
      const data = await apiGet('/api/v1/messages/read-status');
      const lastReadAcc = data.reduce((acc, item) => {
        acc[item.user_id] = item.last_read;
        return acc;
      }, {});
      set({ lastRead: lastReadAcc });
    } catch (error) {
      console.error('Erro ao carregar lastReadTimes:', error);
    }
  },

  getFilteredConversations: () => {
    const { conversations, userEmail, userFilas } = get();
    return Object.fromEntries(
      Object.entries(conversations).filter(([_, conv]) =>
        conv.status === 'open' &&
        conv.assigned_to === userEmail &&
        userFilas.includes(conv.fila)
      )
    );
  },

  notifiedConversations: {},

  markNotified: (userId) =>
    set((state) => ({
      notifiedConversations: {
        ...state.notifiedConversations,
        [userId]: true,
      },
    })),

  clearNotified: (userId) =>
    set((state) => {
      const updated = { ...state.notifiedConversations };
      delete updated[userId];
      return { notifiedConversations: updated };
    }),

  // 🆕 NOVO: Cleanup ao desmontar
  cleanup: () => {
    const { sseListeners } = get();
    console.log('🧹 [Store] Limpando listeners SSE');
    
    sseListeners.forEach(unsubscribe => {
      try {
        if (typeof unsubscribe === 'function') {
          unsubscribe();
        }
      } catch (err) {
        console.error('Erro ao limpar listener:', err);
      }
    });

    set({ sseListeners: [] });
  },
}));

export default useConversationsStore;
