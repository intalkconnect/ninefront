import { create } from "zustand";
import { produce } from "immer";

const initialState = {
  selectedUserId: null,
  userEmail: "",
  userFilas: [],
  conversations: {},
  unreadCounts: {},
  lastReadTimes: {},
  notifiedConversations: {},
  socketStatus: "offline",
};

const useConversationsStore = create((set, get) => ({
  ...initialState,

  // Troca o usuário selecionado, reseta notificações/unread para anterior e novo
  setSelectedUserId: (userId) => set(produce((state) => {
    if (state.selectedUserId) {
      state.notifiedConversations[state.selectedUserId] = false;
      state.unreadCounts[state.selectedUserId] = 0;
    }
    state.selectedUserId = userId;
    if (userId) {
      state.notifiedConversations[userId] = false;
      state.unreadCounts[userId] = 0;
    }
  })),

  // Seta email e filas do usuário (só sobrescreve esses campos)
  setUserInfo: (info) =>
    set((state) => ({
      ...state,
      userEmail: info.email,
      userFilas: info.filas || [],
    })),

  // Atualiza uma conversa (merge inteligente)
  mergeConversation: (userId, newData) =>
    set(produce((state) => {
      if (!state.conversations[userId]) state.conversations[userId] = {};
      state.conversations[userId] = {
        ...state.conversations[userId],
        ...newData
      };
    })),

  // Soma unread, atualiza lastReadTime se enviado
  incrementUnread: (userId, timestamp) =>
    set(produce((state) => {
      if (!state.unreadCounts[userId]) state.unreadCounts[userId] = 0;
      state.unreadCounts[userId]++;
      if (timestamp) state.lastReadTimes[userId] = timestamp;
    })),

  // Marca conversa como notificada
  markNotified: (userId) =>
    set(produce((state) => {
      state.notifiedConversations[userId] = true;
    })),

  // Limpa notificação
  clearNotified: (userId) =>
    set(produce((state) => {
      state.notifiedConversations[userId] = false;
    })),

  // Zera unread de um usuário
  resetUnread: (userId) =>
    set(produce((state) => {
      state.unreadCounts[userId] = 0;
    })),
  clearUnread: (userId) => get().resetUnread(userId), // alias

  // Getter seguro para nome do contato
  getContactName: (userId) =>
    get().conversations[userId]?.name || userId,

  setSocketStatus: (status) =>
    set({ socketStatus: status }),

  // Async functions placeholders (implemente se quiser buscar do backend)
  loadUnreadCounts: async () => {},
  loadLastReadTimes: async () => {},
}));

export default useConversationsStore;
