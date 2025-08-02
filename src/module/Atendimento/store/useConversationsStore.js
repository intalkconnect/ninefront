import create from "zustand";
import produce from "immer";

const initialState = {
  selectedUserId: null,
  userEmail: "",
  userFilas: [],
  conversations: {},
  unreadCounts: {},
  lastReadTimes: {},
  notifiedConversations: {},
  socketStatus: "offline"
};

const useConversationsStore = create((set, get) => ({
  ...initialState,

  setSelectedUserId: (userId) => set(produce((state) => {
    // limpa notified/unread do anterior
    if (state.selectedUserId) {
      state.notifiedConversations[state.selectedUserId] = false;
      state.unreadCounts[state.selectedUserId] = 0;
    }
    state.selectedUserId = userId;
    // limpa também do novo
    if (userId) {
      state.notifiedConversations[userId] = false;
      state.unreadCounts[userId] = 0;
    }
  })),

  setUserInfo: (info) =>
    set((state) => ({
      userEmail: info.email,
      userFilas: info.filas,
    })),

  mergeConversation: (userId, newData) =>
    set(produce((state) => {
      state.conversations[userId] = {
        ...state.conversations[userId],
        ...newData
      };
    })),

  incrementUnread: (userId, timestamp) =>
    set(produce((state) => {
      if (!state.unreadCounts[userId]) state.unreadCounts[userId] = 0;
      state.unreadCounts[userId]++;
      state.lastReadTimes[userId] = timestamp;
    })),

  loadUnreadCounts: async () => {}, // deve ser implementado com backend se precisar

  loadLastReadTimes: async () => {},

  getContactName: (userId) => get().conversations[userId]?.name || userId,

  markNotified: (userId) =>
    set(produce((state) => {
      state.notifiedConversations[userId] = true;
    })),

  clearNotified: (userId) =>
    set(produce((state) => {
      state.notifiedConversations[userId] = false;
    })),

  resetUnread: (userId) =>
    set(produce((state) => {
      state.unreadCounts[userId] = 0;
    })),
  clearUnread: (userId) => get().resetUnread(userId), // alias para compatibilidade

  setSocketStatus: (status) =>
    set({ socketStatus: status }),
}));

export default useConversationsStore;
