// src/module/Atendimento/hooks/useStableSocketListeners.js
import { useEffect } from "react";
import { on } from "../services/sse";

/**
 * Hook para registrar handlers estáveis no SSE.
 * Passe um objeto com os handlers que você precisa.
 *
 * Ex:
 * useStableSocketListeners({
 *   new_message: handleNewMessage,
 *   message_status: handleStatus,
 *   typing: handleTyping,
 * });
 */
export default function useStableSocketListeners(handlers = {}) {
  useEffect(() => {
    const offs = [];

    for (const [eventName, fn] of Object.entries(handlers)) {
      if (typeof fn === "function") {
        offs.push(on(eventName, fn));
      }
    }

    // sempre tenha um "message" se quiser capturar genéricos
    if (typeof handlers.message === "function") {
      offs.push(on("message", handlers.message));
    }

    return () => {
      for (const off of offs) try { off && off(); } catch {}
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    handlers.new_message,
    handlers.message_status,
    handlers.typing,
    handlers.presence,
    handlers.ready,
    handlers.message,
  ]);
}
