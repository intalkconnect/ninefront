// src/hooks/useStableSocketListeners.js
import { useEffect, useRef } from "react";
import { getSocket } from "../services/socket";

export function useStableSocketListeners({ userId, onNew, onUpdate }) {
  const onNewRef = useRef(onNew);
  const onUpdateRef = useRef(onUpdate);

  useEffect(() => { onNewRef.current = onNew }, [onNew]);
  useEffect(() => { onUpdateRef.current = onUpdate }, [onUpdate]);

  useEffect(() => {
    const socket = getSocket();

    function handleNew(msg) {
      if (msg.user_id === userId) onNewRef.current(msg);
    }
    function handleUpdate(msg) {
      if (msg.user_id === userId) onUpdateRef.current(msg);
    }

    function refreshListeners() {
      socket.off('new_message', handleNew);
      socket.off('update_message', handleUpdate);
      socket.on('new_message', handleNew);
      socket.on('update_message', handleUpdate);
    }

    // registra
    socket.on('new_message', handleNew);
    socket.on('update_message', handleUpdate);
    socket.on('connect', refreshListeners);

    const onVisibility = () => {
      if (document.visibilityState === "visible") refreshListeners();
    };
    window.addEventListener('focus', refreshListeners);
    document.addEventListener('visibilitychange', onVisibility);

    return () => {
      socket.off('new_message', handleNew);
      socket.off('update_message', handleUpdate);
      socket.off('connect', refreshListeners);
      window.removeEventListener('focus', refreshListeners);
      document.removeEventListener('visibilitychange', onVisibility);
    };
  }, [userId]);
}
