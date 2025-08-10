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
 transports: ['websocket', 'polling'], // deixa fallback se necessário
    });

    socket.on('connect_error', (err) => {
      console.error('Socket connection error:', err);
    });
  }
  return socket;
}

export function connectSocket(userId) {
  const socket = getSocket();
  if (!socket.connected) {
    console.log('[socket] Connecting to server at', SOCKET_URL);
    socket.connect();
  }

  // Só adiciona listener uma vez!
  if (!socket.hasListeners) {
    socket.on('connect', () => {
      console.log('[socket] Connected with ID:', socket.id);
      if (userId) {
        socket.emit('join_room', userId);
      }
    });
    socket.hasListeners = true;
  }

  return socket;
}

// NÃO export { socket }!

