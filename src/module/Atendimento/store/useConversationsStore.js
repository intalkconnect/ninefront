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
  agentName: null,
  settings: [],
  socketStatus: 'online',

  setSocketStatus: (status) => set({ socketStatus: status }),

  setSettings: (data) => set({ settings: data }),
  getSettingValue: (key) => {
    const found = get().settings.find(s => s.key === key);
    return found ? found.value : null;
  },

  setUserInfo: ({ email, filas, name }) =>
    set({ userEmail: email, userFilas: filas, agentName: name }),

  // troca de chat + zera não lidas
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

    // otimiza UI
    set((state) => ({
      lastRead: { ...state.lastRead, [userId]: now },
      unreadCounts: { ...state.unreadCounts, [userId]: 0 },
    }));

    // backend
    try {
      await apiPut(`/messages/read-status/${userId}`, { last_read: now });
      await get().loadUnreadCounts();
    } catch (err) {
      console.error('Erro ao marcar como lido:', err);
    }
  },

  // merge de conversa
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

  // ✅ upsert de mensagem — força re-render confiável
  addOrUpdateMessage: (userId, message) =>
    set((state) => {
      const conv = state.conversations[userId] || {};
      const list = Array.isArray(conv.messages) ? [...conv.messages] : [];

      const keyOf = (m) =>
        m?.message_id ||
        m?.whatsapp_message_id ||
        m?.telegram_message_id ||
        m?.provider_id ||
        m?.id;

      const k = keyOf(message);
      let idx = -1;
      if (k) idx = list.findIndex((m) => keyOf(m) === k);

      if (idx >= 0) {
        list[idx] = { ...list[idx], ...message };
      } else {
        list.push(message);
      }

      return {
        conversations: {
          ...state.conversations,
          [userId]: { ...conv, messages: list },
        },
      };
    }),

  // ✅ atualiza o “card” (snippet) de forma consistente
  updateConversationCard: (userId, { content, type, timestamp, channel, name }) =>
    set((state) => ({
      conversations: {
        ...state.conversations,
        [userId]: {
          ...(state.conversations[userId] || {}),
          ...(name ? { name } : {}),
          ...(channel ? { channel } : {}),
          ...(content !== undefined ? { content } : {}),
          ...(type ? { type } : {}),
          ...(timestamp ? { timestamp } : {}),
        },
      },
    })),

  // não lidas
  resetUnread: (userId) =>
    set((state) => ({
      unreadCounts: { ...state.unreadCounts, [userId]: 0 },
      lastRead: { ...state.lastRead, [userId]: new Date().toISOString() },
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
      Object.entries(conversations).filter(
        ([_, conv]) =>
          conv.status === 'open' &&
          conv.assigned_to === userEmail &&
          (!conv.fila || userFilas.includes(conv.fila))
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
