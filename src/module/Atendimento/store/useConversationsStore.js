import { create } from 'zustand';
import { apiGet, apiPut } from '../services/apiClient';

// ————— helpers p/ derivar snippet do card —————
function normalizePreviewContent(raw) {
  if (raw == null) return '';
  if (typeof raw === 'string') {
    const s = raw.trim();
    if (s.startsWith('{') || s.startsWith('[')) {
      try {
        const j = JSON.parse(s);
        if (j && typeof j === 'object') {
          return j.body || j.text || j.caption || j.filename || j.url || '';
        }
      } catch {}
    }
    return raw;
  }
  if (typeof raw === 'number' || typeof raw === 'boolean') return String(raw);
  if (typeof raw === 'object') {
    return raw.body || raw.text || raw.caption || raw.filename || raw.url || '';
  }
  return String(raw);
}

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

  // Configura email e filas do usuário
  setUserInfo: ({ email, filas, name }) =>
    set({ userEmail: email, userFilas: filas, agentName: name }),

  // Atualiza conversa selecionada, zera não lidas do atual e do anterior
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
      await apiPut(`/messages/read-status/${userId}`, { last_read: now });
      await get().loadUnreadCounts();
    } catch (err) {
      console.error('Erro ao marcar como lido:', err);
    }
  },

  /**
   * ✅ setConversation: continua genérico, mas
   *    SE receber `messages`, já atualiza o preview (content/type/timestamp).
   */
  setConversation: (userId, newData) =>
    set((state) => {
      const prev = state.conversations[userId] || {};
      const next = { ...prev, ...newData };

      if (Array.isArray(newData?.messages)) {
        // garante novo array p/ re-render
        next.messages = [...newData.messages];

        const last = pickLastNonSystem(newData.messages);
        if (last) {
          next.content = normalizePreviewContent(last.content);
          next.type = last.type;
          next.timestamp = last.timestamp || Date.now();
        } else {
          // sem não-system -> mantém o que já tinha
          next.content = typeof next.content === 'undefined' ? (prev.content || '') : next.content;
          next.type = typeof next.type === 'undefined' ? prev.type : next.type;
          next.timestamp = typeof next.timestamp === 'undefined'
            ? (prev.timestamp || Date.now())
            : next.timestamp;
        }
      }

      return {
        conversations: {
          ...state.conversations,
          [userId]: next,
        },
      };
    }),

  /**
   * ✅ Opcional: quando você tiver o array completo de mensagens
   *    e quiser salvar + atualizar preview de uma vez.
   */
  setMessages: (userId, messages = []) =>
    set((state) => {
      const prev = state.conversations[userId] || {};
      const last = pickLastNonSystem(messages);
      const previewContent = last ? normalizePreviewContent(last.content) : prev.content || '';
      const previewType = last ? last.type : prev.type;
      const previewTs = last ? (last.timestamp || Date.now()) : (prev.timestamp || Date.now());

      return {
        conversations: {
          ...state.conversations,
          [userId]: {
            ...prev,
            messages: [...messages],
            content: previewContent,
            type: previewType,
            timestamp: previewTs,
          },
        },
      };
    }),

  /**
   * ✅ Opcional: ao receber 1 mensagem (envio local ou socket),
   *    adiciona e já atualiza preview.
   */
  appendMessage: (userId, message) =>
    set((state) => {
      const prev = state.conversations[userId] || {};
      const oldList = Array.isArray(prev.messages) ? prev.messages : [];
      const newList = [...oldList, message];

      let content = prev.content;
      let type = prev.type;
      let ts = prev.timestamp || Date.now();

      const isSystem = message?.type === 'system' || message?.direction === 'system';
      if (!isSystem) {
        content = normalizePreviewContent(message?.content);
        type = message?.type;
        ts = message?.timestamp || Date.now();
      }

      return {
        conversations: {
          ...state.conversations,
          [userId]: {
            ...prev,
            messages: newList,
            content,
            type,
            timestamp: ts,
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
    if (last && current <= last) return;

    set({
      unreadCounts: {
        ...unreadCounts,
        [userId]: (unreadCounts[userId] || 0) + 1,
      },
    });
  },

  setClienteAtivo: (info) => set({ clienteAtivo: info }),

  // Atualizações genéricas
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

  // Nome do contato
  getContactName: (userId) => get().conversations[userId]?.name || userId,

  // Unread do servidor
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

  // last_read do servidor
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

  // Conversas ativas atribuídas
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
