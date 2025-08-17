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
// gera o snippet do card a partir do último conteúdo
function contentToSnippet(content, type) {
  console.debug('[store] contentToSnippet (in)', {
    typeIn: type,
    typeofContent: typeof content,
    sample: typeof content === 'string' ? content.slice(0,200) : content
  });
  // Tenta parsear o conteúdo se for string
  let parsedContent = content;
  if (typeof content === 'string') {
    try {
      parsedContent = JSON.parse(content);
    } catch {
      parsedContent = content;
    }
  }

  // Determina o tipo baseado no content se o type não estiver disponível
  const detectedType = detectTypeFromContent(parsedContent);
  const finalType = type || detectedType;

  switch (finalType?.toLowerCase()) {
    case 'text':
      if (typeof parsedContent === 'string') {
        return parsedContent.slice(0, 40);
      }
      if (typeof parsedContent === 'object') {
        const text = parsedContent.body || parsedContent.text || parsedContent.caption || '';
        return text.slice(0, 40);
      }
      return '[Texto]';

    case 'audio':
    case 'voice':
      return '🎤 Áudio';

    case 'image':
    case 'photo':
      return '🖼️ Imagem';

    case 'video':
      return '🎥 Vídeo';

    case 'file':
    case 'document':
      return '📄 Arquivo';

    case 'template':
      return '📋 Template';

    case 'location':
      return '📍 Localização';

    case 'contact':
      return '👤 Contato';

    case 'sticker':
      return '🌟 Figurinha';

    default:
      // Tenta inferir pelo conteúdo se o type não for reconhecido
      if (parsedContent?.url) {
        const url = parsedContent.url.toLowerCase();
        if (url.match(/\.(mp3|wav|ogg|m4a)$/)) return '🎤 Áudio';
        if (url.match(/\.(jpg|jpeg|png|gif|webp)$/)) return '🖼️ Imagem';
        if (url.match(/\.(mp4|mov|avi|mkv)$/)) return '🎥 Vídeo';
        if (url.match(/\.(pdf|docx?|xlsx?|pptx?)$/)) return '📄 Arquivo';
      }
      return '[Mensagem]';
  }
}

// Função auxiliar para detectar tipo pelo conteúdo
function detectTypeFromContent(content) {
    console.debug('[store] detectTypeFromContent →', {
    typeof: typeof content,
    sample: typeof content === 'string' ? content.slice(0,200) : content
  });
  if (!content) return null;
  
  if (typeof content === 'object') {
    if (content.audio || content.voice) return 'audio';
    if (content.image || content.photo) return 'image';
    if (content.video) return 'video';
    if (content.document || content.file) return 'file';
    if (content.location) return 'location';
    if (content.contact) return 'contact';
    if (content.sticker) return 'sticker';
    
    // Verifica por URLs
    if (content.url) {
      const url = content.url.toLowerCase();
      if (url.match(/\.(mp3|wav|ogg|m4a)$/)) return 'audio';
      if (url.match(/\.(jpg|jpeg|png|gif|webp)$/)) return 'image';
      if (url.match(/\.(mp4|mov|avi|mkv)$/)) return 'video';
      if (url.match(/\.(pdf|docx?|xlsx?|pptx?)$/)) return 'file';
    }
  }
  
  return 'text'; // Default para texto
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
// Adiciona/atualiza 1 mensagem (imutável) e atualiza snippet
appendOrUpdateMessage: (userId, msg) =>
  set((state) => {
        console.groupCollapsed('%c[store] appendOrUpdateMessage', 'color:#2196f3');
    console.log('userId:', userId);
   console.log('msg in:', msg);
    const conv = state.conversations[userId] || {};
    const prev = Array.isArray(conv.messages) ? conv.messages : [];
    const nextMessages = upsertMessage(prev, msg);

    // último para o snippet do card
    const last = nextMessages[nextMessages.length - 1] || msg;
    const lastContent = last?.content;
    const lastType = (last?.type || detectTypeFromContent(lastContent) || 'text').toLowerCase();

    const snippet = contentToSnippet(lastContent, lastType);

        console.log('last picked for card:', { lastType, lastContent, snippet });
    console.groupEnd();
    
    return {
      conversations: {
        ...state.conversations,
        [userId]: {
          ...conv,
          messages: nextMessages,
          content: snippet,
          type: lastType,
          timestamp: last?.timestamp || last?.created_at || conv.timestamp,
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
      const lastType = last?.type || detectTypeFromContent(last?.content) || conv.type;
      const snippet = last ? contentToSnippet(last.content, lastType) : conv.content;

      return {
        conversations: {
          ...state.conversations,
          [userId]: {
            ...conv,
            messages: next,
            content: snippet,
            type: (lastType || 'text').toLowerCase(),
            timestamp: last?.timestamp || last?.created_at || conv.timestamp,
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
mergeConversation: (userId, data = {}) =>
    set((state) => {
      const prev = state.conversations[userId] || {};
            if ('content' in data || 'type' in data) {
        console.warn('[store] mergeConversation recebendo content/type → normalizando', {
          userId,
          from: typeof data.content,
          sample: typeof data.content === 'string' ? data.content.slice(0,200) : data.content,
          typeIn: data.type,
        });
      }

      // Se vierem 'content' e/ou 'type', sempre normalize para snippet string
      let { content, type, timestamp } = data;
      const hasContentField = Object.prototype.hasOwnProperty.call(data, 'content');
      const hasTypeField    = Object.prototype.hasOwnProperty.call(data, 'type');

      if (hasContentField || hasTypeField) {
        const detectedType = (type || detectTypeFromContent(content) || prev.type || 'text').toLowerCase();
        const snippet      = contentToSnippet(content, detectedType);
        type               = detectedType;
        content            = snippet; // <- SEMPRE string para o card
      } else {
        // preserva os anteriores se não veio atualização de conteúdo/tipo
        content = prev.content;
        type    = prev.type;
      }

      return {
        conversations: {
          ...state.conversations,
          [userId]: {
            ...prev,
            ...data,
            content,                             // já como snippet
            type,
            timestamp: timestamp || prev.timestamp,
          },
        },
      };
    }),

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
