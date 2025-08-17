import { create } from "zustand";
import { apiGet, apiPut } from "../services/apiClient";

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
    return [...list, { ...incoming }];
  }
  const next = [...list];
  next[idx] = { ...list[idx], ...incoming };
  return next;
}

// Função auxiliar para detectar tipo pelo conteúdo
function detectTypeFromContent(content) {
  console.debug("[store] detectTypeFromContent →", {
    typeof: typeof content,
    sample: typeof content === "string" ? content.slice(0, 200) : content,
  });

  if (!content) return null;

  if (typeof content === "string") {
    try {
      const j = JSON.parse(content);
      return detectTypeFromContent(j);
    } catch {
      return "text";
    }
  }

  if (typeof content === "object") {
    if (content.audio || content.voice) return "audio";
    if (content.image || content.photo) return "image";
    if (content.video) return "video";
    if (content.document || content.file) return "file";
    if (content.location) return "location";
    if (content.contact) return "contact";
    if (content.sticker) return "sticker";

    if (content.url) {
      const url = String(content.url).toLowerCase();
      if (/\.(mp3|wav|ogg|m4a)$/.test(url)) return "audio";
      if (/\.(jpg|jpeg|png|gif|webp)$/.test(url)) return "image";
      if (/\.(mp4|mov|avi|mkv)$/.test(url)) return "video";
      if (/\.(pdf|docx?|xlsx?|pptx?)$/.test(url)) return "file";
    }
  }

  return "text";
}

// gera o snippet do card a partir do último conteúdo (sempre string)
function contentToSnippet(content, type) {
  console.debug("[store] contentToSnippet (in)", {
    typeIn: type,
    typeofContent: typeof content,
    sample: typeof content === "string" ? content.slice(0, 200) : content,
  });

  // parse defensivo
  let parsed = content;
  if (typeof content === "string") {
    try {
      parsed = JSON.parse(content);
    } catch {
      parsed = content;
    }
  }

  const finalType = (type || detectTypeFromContent(parsed) || "text").toLowerCase();

  switch (finalType) {
    case "text":
      if (typeof parsed === "string") return parsed.slice(0, 40);
      if (typeof parsed === "object") {
        const text = parsed.body || parsed.text || parsed.caption || "";
        return (text || "[Texto]").slice(0, 40);
      }
      return "[Texto]";

    case "audio":
    case "voice":
      return "🎤 Áudio";

    case "image":
    case "photo":
      return "🖼️ Imagem";

    case "video":
      return "🎥 Vídeo";

    case "file":
    case "document":
      return "📄 Arquivo";

    case "template":
      return "📋 Template";

    case "location":
      return "📍 Localização";

    case "contact":
      return "👤 Contato";

    case "sticker":
      return "🌟 Figurinha";

    default:
      if (parsed?.url) {
        const url = String(parsed.url).toLowerCase();
        if (/\.(mp3|wav|ogg|m4a)$/.test(url)) return "🎤 Áudio";
        if (/\.(jpg|jpeg|png|gif|webp)$/.test(url)) return "🖼️ Imagem";
        if (/\.(mp4|mov|avi|mkv)$/.test(url)) return "🎥 Vídeo";
        if (/\.(pdf|docx?|xlsx?|pptx?)$/.test(url)) return "📄 Arquivo";
      }
      return "[Mensagem]";
  }
}

/** Helpers para blindar downgrade de snippet **/

// placeholders que não queremos que sobreponham um snippet melhor
function isPlaceholder(s) {
  if (typeof s !== "string") return false;
  const t = s.trim();
  return /^\[(mensagem|menssage|texto|arquivo)\]$/i.test(t);
}

// classifica “qualidade” do snippet: maior é melhor
// 0 = vazio/indefinido, 1 = placeholder [mensagem], 2 = label de mídia (🖼️/🎤/🎥/📄/...), 3 = texto de usuário
function snippetQuality(s) {
  if (!s || typeof s !== "string") return 0;
  const t = s.trim();
  if (!t) return 0;
  if (isPlaceholder(t)) return 1;
  if (/^(🖼️|🎤|🎥|📄|📋|📍|👤|🌟)/.test(t)) return 2;
  return 3;
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
  socketStatus: "online",
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
      console.error("Erro ao marcar como lido:", err);
    }
  },

  // Define/merge conversa (não toca em messages) — BLINDADO contra downgrade
  mergeConversation: (userId, data = {}) =>
    set((state) => {
      const prev = state.conversations[userId] || {};

      if ("content" in data || "type" in data) {
        console.warn("[store] mergeConversation recebendo content/type → normalizando", {
          userId,
          from: typeof data.content,
          sample: typeof data.content === "string" ? data.content.slice(0, 200) : data.content,
          typeIn: data.type,
        });
      }

      let { content, type, timestamp } = data;
      const hasContentField = Object.prototype.hasOwnProperty.call(data, "content");
      const hasTypeField = Object.prototype.hasOwnProperty.call(data, "type");

      // normaliza entrada -> snippet
      let incomingType = prev.type;
      let incomingSnippet = prev.content;

      if (hasContentField || hasTypeField) {
        const detectedType = (type || detectTypeFromContent(content) || prev.type || "text").toLowerCase();
        const computed = contentToSnippet(content, detectedType);
        incomingType = detectedType;
        incomingSnippet = computed;
      }

      const prevSnippet = prev.content;
      const prevScore = snippetQuality(prevSnippet);
      const newScore = snippetQuality(incomingSnippet);

      let nextSnippet = prevSnippet;
      let nextType = prev.type;

      // regra: só troca se o novo for de qualidade >= anterior
      if ((hasContentField || hasTypeField) && newScore >= prevScore) {
        nextSnippet = incomingSnippet;
        nextType = incomingType;
      } else if (!(hasContentField || hasTypeField)) {
        // sem atualização de content/type, mantém o anterior
        nextSnippet = prevSnippet;
        nextType = prev.type;
      } else {
        // tentativa de downgrade bloqueada
        console.info("[store] mergeConversation: downgrade de snippet bloqueado", {
          prev: { snippet: prevSnippet, score: prevScore, type: prev.type },
          incoming: { snippet: incomingSnippet, score: newScore, type: incomingType },
        });
      }

      // timestamp: mantém o mais novo se chegou um novo
      const nextTs =
        timestamp && (!prev.timestamp || new Date(timestamp) > new Date(prev.timestamp))
          ? timestamp
          : prev.timestamp;

      return {
        conversations: {
          ...state.conversations,
          [userId]: {
            ...prev,
            ...data,
            content: nextSnippet,     // SEMPRE string pronta pro card
            type: nextType,
            timestamp: nextTs,
          },
        },
      };
    }),

  // Define/merge conversa (imutável) – legado
  setConversation: (userId, newData) =>
    set((state) => {
      const current = state.conversations[userId] || {};
      const next = { ...current, ...newData };
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
      // também atualiza snippet/tipo/timestamp a partir da última mensagem
      const last = msgs.length ? msgs[msgs.length - 1] : null;
      const lastType = last ? (last.type || detectTypeFromContent(last.content) || "text").toLowerCase() : conv.type;
      const snippet = last ? contentToSnippet(last.content, lastType) : conv.content;
      const timestamp = last?.timestamp || last?.created_at || conv.timestamp;

      return {
        conversations: {
          ...state.conversations,
          [userId]: {
            ...conv,
            messages: [...msgs],
            content: snippet,
            type: lastType,
            timestamp,
          },
        },
      };
    }),

  // Adiciona/atualiza 1 mensagem (imutável) e atualiza snippet
  appendOrUpdateMessage: (userId, msg) =>
    set((state) => {
      console.groupCollapsed("%c[store] appendOrUpdateMessage", "color:#2196f3");
      console.log("userId:", userId);
      console.log("msg in:", msg);

      const conv = state.conversations[userId] || {};
      const prev = Array.isArray(conv.messages) ? conv.messages : [];
      const nextMessages = upsertMessage(prev, msg);

      const last = nextMessages[nextMessages.length - 1] || msg;
      const lastContent = last?.content;
      const lastType = (last?.type || detectTypeFromContent(lastContent) || "text").toLowerCase();
      const snippet = contentToSnippet(lastContent, lastType);

      console.log("last picked for card:", { lastType, lastContent, snippet });
      console.groupEnd();

      return {
        conversations: {
          ...state.conversations,
          [userId]: {
            ...conv,
            messages: nextMessages,
            content: snippet, // sempre string
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
        return { ...m, ...partial };
      });

      if (!changed) return state;

      const last = next[next.length - 1] || null;
      const lastType = last?.type || detectTypeFromContent(last?.content) || conv.type || "text";
      const snippet = last ? contentToSnippet(last.content, lastType) : conv.content;

      return {
        conversations: {
          ...state.conversations,
          [userId]: {
            ...conv,
            messages: next,
            content: snippet,
            type: (lastType || "text").toLowerCase(),
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

  getContactName: (userId) => get().conversations[userId]?.name || userId,

  loadUnreadCounts: async () => {
    try {
      const data = await apiGet("/messages/unread-counts");
      const counts = data.reduce((acc, item) => {
        acc[item.user_id] = item.unread_count;
        return acc;
      }, {});
      set({ unreadCounts: counts });
    } catch (error) {
      console.error("Erro ao carregar unreadCounts:", error);
    }
  },

  loadLastReadTimes: async () => {
    try {
      const data = await apiGet("/messages/read-status");
      const lastReadAcc = data.reduce((acc, item) => {
        acc[item.user_id] = item.last_read;
        return acc;
      }, {});
      set({ lastRead: lastReadAcc });
    } catch (error) {
      console.error("Erro ao carregar lastReadTimes:", error);
    }
  },

  getFilteredConversations: () => {
    const { conversations, userEmail, userFilas } = get();
    return Object.fromEntries(
      Object.entries(conversations).filter(([_, conv]) =>
        conv.status === "open" &&
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
