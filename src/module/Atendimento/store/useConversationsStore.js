import { create } from 'zustand';
import { apiGet, apiPut } from '../services/apiClient';
import { joinUserRoom } from '../services/sse';

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
  socketStatus: 'online',          // estado da conexão com o socket
  setSocketStatus: (status) => set({ socketStatus: status }),

  setSettings: (data) => set({ settings: data }),
  getSettingValue: (key) => {
    const found = get().settings.find(s => s.key === key);
    return found ? found.value : null;
  },

  // Configura email e filas do usuário
  setUserInfo: ({ email, filas, name }) => set({ userEmail: email, userFilas: filas, agentName: name }),

  // Atualiza conversa selecionada, zera não lidas do atual e do anterior
  setSelectedUserId: async (userId) => {
    const previousId = get().selectedUserId;
    const now = new Date().toISOString();

    set({ selectedUserId: userId });

try { joinUserRoom(userId, previousId); } catch {}

    if (previousId && previousId !== userId) {
      get().resetUnread(previousId);
      get().clearNotified(previousId);
    }

    get().resetUnread(userId);
    get().clearNotified(userId);

    // Atualiza visualmente
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

    // Marcar como lido no backend
    try {
      await apiPut(`/api/v1/messages/read-status/${userId}`, {
        last_read: now,
      });

      // 🔁 Atualiza contagens do backend após marcar como lido
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

  appendMessage: (userId, msg) =>
  set((state) => {
    const prevConv = state.conversations[userId] || {};
    const prevMsgs = prevConv.messages || [];
    return {
      conversations: {
        ...state.conversations,
        [userId]: {
          ...prevConv,
          messages: [...prevMsgs, msg], // novo array -> dispara render
        },
      },
    };
  }),



  // Zera contagem de não lidas
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

  // Incrementa contagem de não lidas
  incrementUnread: (userId, messageTimestamp) => {
    const { lastRead, unreadCounts } = get();

    const last = lastRead[userId] ? new Date(lastRead[userId]) : null;
    const current = new Date(messageTimestamp);

    if (last && current <= last) {
      // Já foi lida
      return;
    }

    set({
      unreadCounts: {
        ...unreadCounts,
        [userId]: (unreadCounts[userId] || 0) + 1,
      },
    });
  },

  setClienteAtivo: (info) => set({ clienteAtivo: info }),

  // Adiciona ou atualiza dados de conversa
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

  // Retorna nome do contato ou ID
  getContactName: (userId) => get().conversations[userId]?.name || userId,

  // Carrega contagem de não lidas do servidor
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

  // Carrega timestamps de leitura do servidor
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

  // Filtra conversas ativas e atribuídas
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

}));

export default useConversationsStore;
