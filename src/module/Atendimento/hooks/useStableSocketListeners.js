import { useEffect, useRef } from "react";
import { getSocket } from "../../services/socket";

// Handlers fora do componente (sempre atualizados por ref)
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

    // Sempre limpa antes de adicionar!
    socket.off('new_message', handleNew);
    socket.off('update_message', handleUpdate);

    socket.on('new_message', handleNew);
    socket.on('update_message', handleUpdate);

    // Refaz isso ao cada volta ao foco ou reconexão!
    function refreshListeners() {
      socket.off('new_message', handleNew);
      socket.off('update_message', handleUpdate);
      socket.on('new_message', handleNew);
      socket.on('update_message', handleUpdate);
    }
    window.addEventListener('focus', refreshListeners);
    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === "visible") refreshListeners();
    });
    socket.on('connect', refreshListeners);

    return () => {
      socket.off('new_message', handleNew);
      socket.off('update_message', handleUpdate);
      window.removeEventListener('focus', refreshListeners);
      document.removeEventListener('visibilitychange', refreshListeners);
      socket.off('connect', refreshListeners);
    };
  }, [userId]);
}
