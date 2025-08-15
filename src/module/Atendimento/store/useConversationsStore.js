import { create } from 'zustand';
import { apiGet, apiPut } from '../services/apiClient';

// gera uma chave estável para comparar mensagens
function msgKey(m) {
  return (
    m?.message_id ||
    m?.whatsapp_message_id ||
    m?.telegram_message_id ||
    m?.provider_id ||
    m?.id ||
    null
  );
}

// merge imutável de uma mensagem na lista
function upsertMessage(list, incoming) {
  const keyIn = msgKey(incoming);
  if (!Array.isArray(list)) return [incoming];

  const idx = list.findIndex((m) => {
    const k = msgKey(m);
    return k && keyIn && String(k) === String(keyIn);
  });

  if (idx === -1) {
    // append imutável
    return [...list, { ...incoming }];
  }
  // replace imutável (NÃO muta o objeto existente)
  const next = [...list];
  next[idx] = { ...list[idx], ...incoming };
  return next;
}

// gera o snippet do card a partir do último conteúdo
function contentToSnippet(c) {
  if (c == null) return '';
  if (typeof c === 'string') {
    // tenta JSON “de leve”
    const s = c.trim();
    if (s.startsWith('{') || s.startsWith('[')) {
      try {
        const j = JSON.parse(s);
        return contentToSnippet(j);
      } catch {
        return s.length > 40 ? s.slice(0, 37) + '...' : s;
      }
    }
    return s.length > 40 ? s.slice(0, 37) + '...' : s;
  }
  if (typeof c === 'object') {
    const url = String(c.url || '').toLowerCase();
    const filename = String(c.filename || '').toLowerCase();
    const txt = c.body || c.text || c.caption || '';

    if (txt) return txt.length > 40 ? txt.slice(0, 37) + '...' : txt;
    if (c.voice || c.type === 'audio' || /\.(ogg|oga|mp3|wav|m4a)$/i.test(url) || /\.(ogg|oga|mp3|wav|m4a)$/i.test(filename)) {
      return '[Áudio]';
    }
    if (/\.(jpg|jpeg|png|gif|webp|svg|bmp)$/i.test(url) || /\.(jpg|jpeg|png|gif|webp|svg|bmp)$/i.test(filename)) {
      return '[Imagem]';
    }
    if (filename.endsWith('.pdf')) return '[Arquivo]';
    if (c.url || c.filename) return '[Arquivo]';
    return '';
  }
  return String(c);
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
    const found = get().settings.find((s) => s.key === key);
    return found ? found.value : null;
  },

  setUserInfo: ({ email, filas, name }) =>
    set({ userEmail: email, userFilas: filas, agentName: name }),

  // Seleciona chat e marca como lido
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

  // Define/merge conversa (imutável)
  setConversation: (userId, newData) =>
    set((state) => {
      const current = state.conversations[userId] || {};
      const next = { ...current, ...newData };

      // se vierem mensagens e for a mesma referência, clona para garantir re-render
      if (newData?.messages) {
        const sameRef = current.messages === newData.messages;
        next.messages = sameRef ? [...newData.messages] : newData.messages;
      }

      return {
        conversations: {
          ...state.conversations,
          [userId]: next,
        },
      };
    }),

  // Seta a lista inteira de mensagens (garantindo nova ref)
  setMessages: (userId, msgs = []) =>
    set((state) => {
      const conv = state.conversations[userId] || {};
      return {
        conversations: {
          ...state.conversations,
          [userId]: {
            ...conv,
            messages: [...msgs], // nova referência sempre
          },
        },
      };
    }),

  // Adiciona/atualiza 1 mensagem (imutável) e atualiza snippet
  appendOrUpdateMessage: (userId, msg) =>
    set((state) => {
      const conv = state.conversations[userId] || {};
      const prev = Array.isArray(conv.messages) ? conv.messages : [];
      const nextMessages = upsertMessage(prev, msg);

      // último para o snippet do card
      const last = nextMessages[nextMessages.length - 1] || msg;
      const lastContent = last?.content;
      const snippet = contentToSnippet(lastContent);

      return {
        conversations: {
          ...state.conversations,
          [userId]: {
            ...conv,
            messages: nextMessages, // NOVA referência
            content: snippet,
            type: last?.type || conv.type,
            timestamp: last?.timestamp || conv.timestamp,
          },
        },
      };
    }),

  // Atualiza apenas status/provedor de uma já existente (por emitUpdateMessage do back)
  updateMessageStatus: (userId, partial) =>
    set((state) => {
      const conv = state.conversations[userId] || {};
      const prev = Array.isArray(conv.messages) ? conv.messages : [];

      // procura por tempId/message_id/provider_id
      const keyIn =
        partial?.message_id ||
        partial?.provider_id ||
        partial?.id ||
        null;

      let changed = false;
      const next = prev.map((m) => {
        const match =
          (keyIn && (m.message_id === keyIn || m.id === keyIn || m.provider_id === keyIn)) ||
          false;
        if (!match) return m;
        changed = true;
        return { ...m, ...partial }; // imutável
      });

      if (!changed) return state; // nada pra fazer

      // snippet normalmente não muda aqui, mas mantemos consistência:
      const last = next[next.length - 1] || null;
      const snippet = last ? contentToSnippet(last.content) : conv.content;

      return {
        conversations: {
          ...state.conversations,
          [userId]: {
            ...conv,
            messages: next,
            content: snippet,
            type: last?.type || conv.type,
            timestamp: last?.timestamp || conv.timestamp,
          },
        },
      };
    }),

  // Zera contagem de não lidas
  resetUnread: (userId) =>
    set((state) => ({
      unreadCounts: { ...state.unreadCounts, [userId]: 0 },
      lastRead: { ...state.lastRead, [userId]: new Date().toISOString() },
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

  // Merge “cabeçalho” da conversa (não toca em messages)
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
