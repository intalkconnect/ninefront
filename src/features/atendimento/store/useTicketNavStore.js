// store/useTicketNavStore.js
import { create } from 'zustand';

const useTicketNavStore = create((set) => ({
  target: null, // { userId, ticket_number, nonce }
  goToTicket: (userId, ticket_number) =>
    set({ target: { userId, ticket_number, nonce: Date.now() } }),
  clearTarget: () => set({ target: null }),
}));

export default useTicketNavStore;
