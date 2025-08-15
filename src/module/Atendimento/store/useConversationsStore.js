import { create } from 'zustand';
import { apiGet, apiPut } from '../services/apiClient';

function snapshotContentFromMsg(msg = {}) {
  const t = (msg.type || '').toLowerCase();
  const c = msg.content;

  // Texto puro
  if (t === 'text') {
    if (typeof c === 'string') return c;
    if (c && typeof c === 'object') return c.body || c.text || c.caption || '';
    return '';
  }

  // Áudio
  if (t === 'audio') {
    // Sinaliza "Áudio" pro snippet (voz/filename/url ajudam a detectar)
    return {
      type: 'audio',
      voice: (c && (c.voice === true)) || undefined,
      filename: c?.filename || 'audio.ogg',
      url: c?.url,
    };
  }

  // Imagem
  if (t === 'image') {
    return {
      type: 'image',
      filename: c?.filename || 'image.jpg',
      url: c?.url,
      caption: c?.caption,
    };
  }

  // Documento
  if (t === 'document') {
    return {
      type: 'document',
      filename: c?.filename || 'arquivo.pdf',
      url: c?.url,
      caption: c?.caption,
    };
  }

  // Vídeo
  if (t === 'video') {
    return {
      type: 'video',
      filename: c?.filename || 'video.mp4',
      url: c?.url,
      caption: c?.caption,
    };
  }

  // Fallback
  return typeof c === 'string' ? c : (c?.body || c?.text || c?.caption || c?.filename || c?.url || '[mensagem]');
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
  setUserInfo: ({ email, filas, name }) => set({ userEmail: email, userFilas: filas, agentName: name }),

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

    // Atualiza visualmente
    set((state) => ({
      lastRead: { ...state.lastRead, [userId]: now },
      unreadCounts: { ...state.unreadCounts, [userId]: 0 },
    }));

    // Marcar como lido no backend
    try {
      await apiPut(`/messages/read-status/${userId}`, { last_read: now });
      await get().loadUnreadCounts();
    } catch (err) {
      console.error('Erro ao marcar como lido:', err);
    }
  },

  // Mantida (merge imutável)
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

  // Mantida (merge imutável)
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

  // ✅ NOVO: adiciona mensagem de forma imutável e atualiza snapshot do card
  appendMessage: (userId, msg) =>
    set((state) => {
      const prevConv = state.conversations[userId] || { user_id: userId, messages: [] };
      const prevMsgs = Array.isArray(prevConv.messages) ? prevConv.messages : [];
      const nextMsgs = [...prevMsgs, msg];

      const nextConv = {
        ...prevConv,
        messages: nextMsgs,
        content: snapshotContentFromMsg(msg), // <- snippet do card
        timestamp: msg.timestamp || Date.now(), // <- ordenação do card
        channel: prevConv.channel || msg.channel, // mantém canal
      };

      return {
        conversations: {
          ...state.conversations,
          [userId]: nextConv,
        },
      };
    }),

  // ✅ NOVO: atualiza status/ids da mensagem (immutável) sem perder snapshot
  updateMessageStatus: (userId, messageIdOrTempId, patch) =>
    set((state) => {
      const prevConv = state.conversations[userId];
      if (!prevConv) return {};

      const nextMsgs = (prevConv.messages || []).map((m) => {
        const same =
          m.id === messageIdOrTempId ||
          m.message_id === messageIdOrTempId ||
          m.whatsapp_message_id === messageIdOrTempId ||
          m.telegram_message_id === messageIdOrTempId ||
          m.provider_id === messageIdOrTempId;
        return same ? { ...m, ...patch } : m;
      });

      // Mantém snapshot atual (ele já foi atualizado no appendMessage). Se quiser
      // garantir que o snapshot siga SEMPRE a última mensagem real:
      const lastMsg = nextMsgs[nextMsgs.length - 1] || null;
      const nextConv = {
        ...prevConv,
        messages: nextMsgs,
        ...(lastMsg
          ? {
              content: snapshotContentFromMsg(lastMsg),
              timestamp: lastMsg.timestamp || prevConv.timestamp || Date.now(),
            }
          : {}),
      };

      return {
        conversations: {
          ...state.conversations,
          [userId]: nextConv,
        },
      };
    }),

  // Zera contagem de não lidas
  resetUnread: (userId) =>
    set((state) => ({
      unreadCounts: { ...state.unreadCounts, [userId]: 0 },
      lastRead: { ...state.lastRead, [userId]: new Date().toISOString() },
    })),

  // Incrementa contagem de não lidas (respeita lastRead)
  incrementUnread: (userId, messageTimestamp) => {
    const { lastRead, unreadCounts } = get();
    const last = lastRead[userId] ? new Date(lastRead[userId]) : null;
    const current = new Date(messageTimestamp);
    if (last && current <= last) return;

    set({
      unreadCounts: { ...unreadCounts, [userId]: (unreadCounts[userId] || 0) + 1 },
    });
  },

  setClienteAtivo: (info) => set({ clienteAtivo: info }),

  // Retorna nome do contato ou ID
  getContactName: (userId) => get().conversations[userId]?.name || userId,

  // Carrega contagem de não lidas do servidor
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

  // Carrega timestamps de leitura do servidor
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

  // Filtra conversas ativas e atribuídas
  getFilteredConversations: () => {
    const { conversations, userEmail, userFilas } = get();
    return Object.fromEntries(
      Object.entries(conversations).filter(
        ([_, conv]) =>
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
