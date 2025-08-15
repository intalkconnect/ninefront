import { create } from 'zustand';
import { apiGet, apiPut } from '../services/apiClient';

// ----- helpers para derivar preview -----
function pickLastNonSystem(messages = []) {
  for (let i = messages.length - 1; i >= 0; i -= 1) {
    const m = messages[i];
    if (!m) continue;
    const isSystem = m.type === 'system' || m.direction === 'system';
    if (isSystem) continue;
    return m;
  }
  return null;
}

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

  // Configura email/filas do usuário
  setUserInfo: ({ email, filas, name }) =>
    set({ userEmail: email, userFilas: filas, agentName: name }),

  // Seleciona conversa e marca como lida
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
      unreadCounts: { ...state.unreadCounts, [userId]: 0 },
    }));

    try {
      await apiPut(`/messages/read-status/${userId}`, { last_read: now });
      await get().loadUnreadCounts();
    } catch (err) {
      console.error('Erro ao marcar como lido:', err);
    }
  },

  /**
   * setConversation:
   * - continua genérico
   * - SE chegar {messages}, recalcula preview (content/type/timestamp) baseado
   *   na última mensagem não-system. Mantém `content` como o OBJETO/valor da mensagem.
   */
  setConversation: (userId, newData) =>
    set((state) => {
      const prev = state.conversations[userId] || {};
      const next = { ...prev, ...newData };

      if (Array.isArray(newData?.messages)) {
        const msgs = [...newData.messages]; // novo array p/ disparar render
        next.messages = msgs;

        const last = pickLastNonSystem(msgs);
        if (last) {
          next.type = last.type;
          next.content = last.content ?? last.text ?? last.caption ?? last.body ?? '';
          next.timestamp = last.timestamp || Date.now();
        }
      }

      return { conversations: { ...state.conversations, [userId]: next } };
    }),

  /**
   * setMessages:
   * - util direto para quando você já tem o array completo.
   */
  setMessages: (userId, messages = []) =>
    set((state) => {
      const prev = state.conversations[userId] || {};
      const msgs = [...messages];
      const last = pickLastNonSystem(msgs);

      return {
        conversations: {
          ...state.conversations,
          [userId]: {
            ...prev,
            messages: msgs,
            type: last ? last.type : prev.type,
            content: last
              ? (last.content ?? last.text ?? last.caption ?? last.body ?? '')
              : (prev.content ?? ''),
            timestamp: last ? (last.timestamp || Date.now()) : (prev.timestamp || Date.now()),
          },
        },
      };
    }),

  /**
   * appendMessage:
   * - adiciona 1 msg e atualiza preview se não for "system".
   */
  appendMessage: (userId, message) =>
    set((state) => {
      const prev = state.conversations[userId] || {};
      const list = Array.isArray(prev.messages) ? prev.messages : [];
      const newList = [...list, message];

      let content = prev.content;
      let type = prev.type;
      let ts = prev.timestamp || Date.now();

      const isSystem = message?.type === 'system' || message?.direction === 'system';
      if (!isSystem) {
        type = message?.type;
        content = message?.content ?? message?.text ?? message?.caption ?? message?.body ?? '';
        ts = message?.timestamp || Date.now();
      }

      return {
        conversations: {
          ...state.conversations,
          [userId]: { ...prev, messages: newList, content, type, timestamp: ts },
        },
      };
    }),

  // Unreads
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
    set({ unreadCounts: { ...unreadCounts, [userId]: (unreadCounts[userId] || 0) + 1 } });
    },

  setClienteAtivo: (info) => set({ clienteAtivo: info }),

  // Atualização genérica
  mergeConversation: (userId, data) =>
    set((state) => ({
      conversations: {
        ...state.conversations,
        [userId]: { ...(state.conversations[userId] || {}), ...data },
      },
    })),

  getContactName: (userId) => get().conversations[userId]?.name || userId,

  // server helpers
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

  // filtros
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

  // notificação visual
  notifiedConversations: {},
  markNotified: (userId) =>
    set((state) => ({
      notifiedConversations: { ...state.notifiedConversations, [userId]: true },
    })),
  clearNotified: (userId) =>
    set((state) => {
      const updated = { ...state.notifiedConversations };
      delete updated[userId];
      return { notifiedConversations: updated };
    }),
}));

export default useConversationsStore;
