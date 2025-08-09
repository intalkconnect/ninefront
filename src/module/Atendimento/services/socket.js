import { io } from 'socket.io-client';

const SOCKET_URL = import.meta.env.VITE_SOCKET_URL || 'http://localhost:8080';

let socket; // singleton

export function getSocket() {
  if (!socket) {
    if (!SOCKET_URL) throw new Error('Socket URL is not defined.');

    // >>> NÃO redeclare "const socket" aqui! Use a variável de cima:
    socket = io(SOCKET_URL, {
      path: '/socket.io',                 // path do servidor
      transports: ['websocket', 'polling'], // permite fallback via proxy
      reconnectionAttempts: 3,
      autoConnect: true,
    });

    socket.on('connect_error', (err) => {
      console.error('Socket connection error:', err);
    });
  }
  return socket;
}

export function connectSocket(userId) {
  const s = getSocket();
  console.log('[socket] Connecting to server at', SOCKET_URL);

  if (!s.connected) s.connect();

  // Só adiciona listeners uma vez
  if (!s.hasListeners) {
    s.on('connect', () => {
      console.log('[socket] Connected with ID:', s.id);
      if (userId) s.emit('join_room', userId);
    });
    s.hasListeners = true;
  }

  return s;
}

// utilidades opcionais
export function joinRoom(userId) { const s = getSocket(); s.emit('join_room', userId); }
export function leaveRoom(userId) { const s = getSocket(); s.emit('leave_room', userId); }
export function disconnectSocket() { if (socket) socket.disconnect(); }
