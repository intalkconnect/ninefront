import { create } from 'zustand';
import { apiGet, apiPut } from '../services/apiClient';

const useConversationsStore = create((set, get) => ({
  conversations: {},
  lastRead: {},
  unreadCounts: {},
  clienteAtivo: null,
  selectedUserId: null,
  userEmail: null,
  userFilas: [],
  agentName: '',
  settings: [],
  socketStatus: 'online',
  notifiedConversations: {},

  setSocketStatus: (status) => set({ socketStatus: status }),

  setAgentName: (name) => set({ agentName: name }),        
  getAgentName: () => get().agentName,                   

  setSettings: (data) => set({ settings: data }),
  getSettingValue: (key) => {
    const found = get().settings.find(s => s.key === key);
    return found ? found.value : null;
  },

  setUserInfo: ({ email, filas }) => set({ userEmail: email, userFilas: filas }),

  setSelectedUserId: async (userId) => {
    const previousId = get().selectedUserId;
    const now = new Date().toISOString();

    set({ selectedUserId: userId });

    if (previousId && previousId !== userId) {
      get().resetUnread(previousId);
      get().clearNotified(previousId);
    }

    get().resetUnread(userId);
    get().clearNotified(userId);

    set((state) => ({
      lastRead: { ...state.lastRead, [userId]: now },
      unreadCounts: { ...state.unreadCounts, [userId]: 0 }
    }));

    try {
      await apiPut(`/messages/read-status/${userId}`, { last_read: now });
      await get().loadUnreadCounts();
    } catch (err) {
      console.error('Erro ao marcar como lido:', err);
    }
  },

  resetUnread: (userId) =>
    set((state) => ({
      unreadCounts: { ...state.unreadCounts, [userId]: 0 },
      lastRead: { ...state.lastRead, [userId]: new Date().toISOString() }
    })),

  incrementUnread: (userId, messageTimestamp) => {
    const { lastRead, unreadCounts } = get();
    const last = lastRead[userId] ? new Date(lastRead[userId]) : null;
    const current = new Date(messageTimestamp);

    if (last && current <= last) return;
    set({
      unreadCounts: {
        ...unreadCounts,
        [userId]: (unreadCounts[userId] || 0) + 1
      }
    });
  },

  setClienteAtivo: (info) => set({ clienteAtivo: info }),

mergeConversation: (userId, data) =>
  set((state) => {
    const prevConv = state.conversations[userId] || {};
    const prevMsgs = prevConv.messages || [];

    // Se 'data' vier com messages (array), faz merge; senão, adiciona 'data' como nova mensagem.
    let newMessages;
    if (Array.isArray(data.messages)) {
      newMessages = [...prevMsgs, ...data.messages];
    } else if (data.type || data.content) {
      newMessages = [...prevMsgs, data]; // data é uma mensagem individual
    } else {
      newMessages = prevMsgs;
    }

    return {
      conversations: {
        ...state.conversations,
        [userId]: {
          ...prevConv,
          ...data,
          messages: newMessages,
        }
      }
    };
  }),


  getContactName: (userId) =>
    get().conversations[userId]?.name || userId,

  loadUnreadCounts: async () => {
    try {
      const data = await apiGet('/messages/unread-counts');
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
      const data = await apiGet('/messages/read-status');
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

  markNotified: (userId) =>
    set((state) => ({
      notifiedConversations: { ...state.notifiedConversations, [userId]: true }
    })),

  clearNotified: (userId) =>
    set((state) => {
      const updated = { ...state.notifiedConversations };
      delete updated[userId];
      return { notifiedConversations: updated };
    }),
}));

export default useConversationsStore;
