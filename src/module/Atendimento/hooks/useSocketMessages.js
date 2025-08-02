// hooks/useSocketMessages.js
import { useEffect, useCallback } from "react";
import { getSocket } from "../services/socket";

export default function useSocketMessages({ userId, onNew, onUpdate, onNotified }) {
  // Handlers de mensagem sempre frescos
  const handleNew = useCallback((msg) => {
    if (msg.user_id !== userId) return;
    onNew(msg);
    if (document.visibilityState !== "visible") {
      onNotified(msg);
    }
  }, [userId, onNew, onNotified]);

  const handleUpdate = useCallback((msg) => {
    if (msg.user_id !== userId) return;
    onUpdate(msg);
  }, [userId, onUpdate]);

  useEffect(() => {
    const socket = getSocket();
    socket.off('new_message', handleNew);
    socket.off('update_message', handleUpdate);
    socket.on('new_message', handleNew);
    socket.on('update_message', handleUpdate);

    return () => {
      socket.off('new_message', handleNew);
      socket.off('update_message', handleUpdate);
    };
  }, [handleNew, handleUpdate]);
}
