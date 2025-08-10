// src/module/Atendimento/services/socket.js
import { io } from 'socket.io-client';

const SOCKET_URL = import.meta.env.VITE_SOCKET_URL || 'http://localhost:3000';

let socket; // singleton

export function getSocket() {
  if (!socket) {
    if (!SOCKET_URL) throw new Error('Socket URL is not defined.');

    socket = io(SOCKET_URL, {
      path: '/socket.io',                 // ajuste se seu backend usar outro path
      autoConnect: true,
      reconnection: true,
      reconnectionAttempts: Infinity,
      reconnectionDelay: 500,
      reconnectionDelayMax: 5000,
      transports: ['websocket', 'polling'], // deixa fallback
    });

    // ---- TAP GLOBAL DE DEBUG (executa 1x) ----
    if (!socket.__debugTap) {
      socket.__debugTap = true;

      // Expor no console para testes manuais: window.__socket.emit('join_room', '123')
      if (typeof window !== 'undefined') {
        window.__socket = socket;
        console.log('[SOCKET] URL:', SOCKET_URL);
      }

      // Loga conexão/desconexão/erros
      socket.on('connect', () => {
        console.log('[SOCKET] connect => id:', socket.id, 'connected?', socket.connected);
      });
      socket.on('disconnect', (reason) => {
        console.log('[SOCKET] disconnect =>', reason);
      });
      socket.on('reconnect_attempt', (n) => {
        console.log('[SOCKET] reconnect_attempt', n);
      });
      socket.on('reconnect', (n) => {
        console.log('[SOCKET] reconnect OK (attempt', n, ')');
      });
      socket.on('connect_error', (err) => {
        console.log('[SOCKET] connect_error =>', err?.message || err);
      });

      // Loga **todos** os eventos recebidos (nome + 1º payload)
      socket.onAny((event, ...args) => {
        const first = args?.[0];
        const uid = first && (first.user_id ?? first.userId ?? first.uid);
        console.log('[SOCKET ANY<=]', event, 'user:', uid, 'payload:', first, 'args:', args);
      });

      // Loga **todos** os emits (eventos enviados)
      const _emit = socket.emit.bind(socket);
      socket.emit = (event, ...args) => {
        console.log('[SOCKET =>EMIT]', event, 'args:', args);
        return _emit(event, ...args);
      };

      // Guard: bloqueia `off('evento')` sem handler (evita matar listeners alheios)
      const _off = socket.off.bind(socket);
      socket.off = (event, handler) => {
        if (handler === undefined) {
          console.warn('[SOCKET GUARD] off() sem handler BLOQUEADO para evento:', event);
          try {
            const listeners = socket.listeners?.(event) || [];
            console.warn('[SOCKET GUARD] listeners ativos para', event, listeners.length);
          } catch {}
          return socket;
        }
        return _off(event, handler);
      };
    }
  }
  return socket;
}

export function connectSocket(roomId) {
  const s = getSocket();

  if (!s.connected) {
    console.log('[socket] Connecting to server at', SOCKET_URL);
    s.connect();
  }

  // Base listeners apenas uma vez
  if (!s.__baseOnce) {
    s.__baseOnce = true;

    s.on('connect', () => {
      console.log('[socket] Connected with ID:', s.id);
      // se quiser juntar uma sala base aqui, normalize o id para string
      if (roomId != null) {
        s.emit('join_room', String(roomId));
      }
    });
  }

  return s;
}

// NÃO export { socket }!
