// src/services/socket.js
import { io } from 'socket.io-client';

const SOCKET_URL = import.meta.env.VITE_SOCKET_URL || 'http://localhost:3000';

let socket; // singleton

export function getSocket() {
  if (!socket) {
    if (!SOCKET_URL) throw new Error('Socket URL is not defined.');
    socket = io(SOCKET_URL, {
      path: '/socket.io',
      autoConnect: true,
      reconnection: true,
      reconnectionAttempts: Infinity,
      reconnectionDelay: 500,
      reconnectionDelayMax: 5000,
      transports: ['websocket', 'polling'],
    });

    socket.on('connect_error', (err) => {
      console.error('Socket connection error:', err?.message || err);
    });

    // debug opcional (não duplica)
    if (!socket.__debugOnce) {
      socket.__debugOnce = true;
      socket.onAny((event, ...args) => {
        if (process?.env?.NODE_ENV !== 'production') {
          // console.log('[SOCKET]', event, args?.[0]?.user_id || '', args);
        }
      });
    }
  }
  return socket;
}

export function connectSocket(roomId) {
  const socket = getSocket();
  if (!socket.connected) {
    console.log('[socket] Connecting to', SOCKET_URL);
    socket.connect();
  }

  if (!socket.__baseListeners) {
    socket.on('connect', () => {
      // console.log('[socket] Connected', socket.id);
      if (roomId) socket.emit('join_room', roomId);
    });
    socket.__baseListeners = true;
  }

  return socket;
}
