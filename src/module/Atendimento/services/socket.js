import { io } from "socket.io-client";
import { getRuntimeConfig } from "./runtimeConfig";

// ====== SINGLETON ======
let socket = null;
let hasBaseListeners = false;

function ensureSocket() {
  if (socket) return socket;

  const { socketUrl } = getRuntimeConfig();

  socket = io(socketUrl, {
    path: "/socket.io",
    transports: ["websocket"],      // força WS
    autoConnect: true,
    reconnection: true,
    reconnectionAttempts: Infinity,
    reconnectionDelay: 1000,
    timeout: 20000,
    // IMPORTANTE: sem auth e sem query — tenant vem do host no backend
  });

  socket.on("connect_error", (err) => {
    console.error("[socket] connect_error:", err?.message || err);
  });

  return socket;
}

/** Obtém o singleton do socket (cria se necessário). */
export function getSocket() {
  return ensureSocket();
}

/** Conecta e registra listeners base (uma única vez). */
export function connectSocket(userId) {
  const s = ensureSocket();

  if (!s.connected) {
    console.log("[socket] Connecting to", s.io.uri || "same-origin");
    s.connect();
  }

  if (!hasBaseListeners) {
    s.on("connect", () => {
      console.log("[socket] Connected:", s.id);
    });
    hasBaseListeners = true;
  }

  // compat: entrar em sala específica ao conectar
  if (userId) {
    const onConnect = () => s.emit("join_room", userId);
    if (s.connected) onConnect();
    s.off("connect", onConnect);
    s.on("connect", onConnect);
  }

  return s;
}
