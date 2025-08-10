// src/module/Atendimento/services/socket.js
import { io } from 'socket.io-client';

const URL  = import.meta.env.VITE_SOCKET_URL || 'http://localhost:8080';
const PATH = import.meta.env.VITE_SOCKET_PATH || '/socket.io';

let socket;

export function getSocket() {
  if (!socket) {
    socket = io(URL, {
      path: PATH,
      autoConnect: true,
      reconnection: true,
      reconnectionAttempts: Infinity,
      reconnectionDelay: 500,
      reconnectionDelayMax: 5000,
      transports: ['websocket', 'polling'],
      withCredentials: true,
    });

    // debug 1x
    if (!socket.__tap) {
      socket.__tap = true;
      if (typeof window !== 'undefined') window.__socket = socket;

      socket.on('connect', () => console.log('[SOCKET] connect', socket.id));
      socket.on('disconnect', (r) => console.log('[SOCKET] disconnect', r));
      socket.on('connect_error', (e) => console.log('[SOCKET] connect_error', e?.message || e));
      socket.onAny((event, ...args) => {
        const first = args?.[0];
        const uid = first && (first.user_id ?? first.userId ?? first.uid);
        console.log('[SOCKET ANY<=]', event, 'user:', uid, 'payload:', first);
      });

      // loga todos os emits do front
      const _emit = socket.emit.bind(socket);
      socket.emit = (ev, ...args) => {
        console.log('[SOCKET =>EMIT]', ev, 'args:', args);
        return _emit(ev, ...args);
      };

      // guard: evita off sem handler
      const _off = socket.off.bind(socket);
      socket.off = (ev, handler) => {
        if (handler === undefined) {
          console.warn('[SOCKET GUARD] off() sem handler bloqueado para', ev);
          return socket;
        }
        return _off(ev, handler);
      };
    }
  }
  return socket;
}

export function connectSocket(roomId) {
  const s = getSocket();
  if (!s.connected) {
    console.log('[socket] Connecting to', URL, 'path:', PATH);
    s.connect();
  }
  if (!s.__baseOnce) {
    s.__baseOnce = true;
    s.on('connect', () => {
      if (roomId != null) s.emit('join_room', String(roomId));
    });
  }
  return s;
}

// no final do arquivo, exporte este helper
export function joinUserRoom(userId, prevUserId) {
  const s = getSocket();
  if (!s) return;
  const next = userId == null ? null : String(userId);
  const prev = prevUserId == null ? null : String(prevUserId);

  if (prev && prev !== next) {
    s.emit('leave_room', prev);
  }
  if (next) {
    s.emit('join_room', next);
  }
}
