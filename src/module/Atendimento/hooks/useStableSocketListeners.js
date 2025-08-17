import { useEffect, useRef } from "react";
import { getSocket } from "../services/socket";

// Handlers fora do componente (sempre atualizados por ref)
export function useStableSocketListeners({ userId, onNew, onUpdate }) {
  const onNewRef = useRef(onNew);
  const onUpdateRef = useRef(onUpdate);

  useEffect(() => { onNewRef.current = onNew; }, [onNew]);
  useEffect(() => { onUpdateRef.current = onUpdate; }, [onUpdate]);

  useEffect(() => {
    const socket = getSocket();
    if (!socket) return;

    const handleNew = (msg) => {
      if (msg.user_id === userId) onNewRef.current(msg);
    };
    const handleUpdate = (msg) => {
      if (msg.user_id === userId) onUpdateRef.current(msg);
    };

    socket.on("new_message", handleNew);
    socket.on("update_message", handleUpdate);

    const refreshListeners = () => {
      socket.off("new_message", handleNew);
      socket.off("update_message", handleUpdate);
      socket.on("new_message", handleNew);
      socket.on("update_message", handleUpdate);
    };
    const onFocus = () => refreshListeners();
    const onVis = () => { if (document.visibilityState === "visible") refreshListeners(); };

    window.addEventListener("focus", onFocus);
    document.addEventListener("visibilitychange", onVis);
    socket.on("connect", refreshListeners);

    return () => {
      socket.off("new_message", handleNew);
      socket.off("update_message", handleUpdate);
      window.removeEventListener("focus", onFocus);
      document.removeEventListener("visibilitychange", onVis);
      socket.off("connect", refreshListeners);
    };
  }, [userId]);
}
