// src/services/socket.js
import { io } from 'socket.io-client';

const SOCKET_URL = import.meta.env.VITE_SOCKET_URL || 'http://localhost:3000'; // fallback URL

// Create socket instance only if not already created
let socket;

export function getSocket() {
  if (!socket) {
    if (!SOCKET_URL) {
      throw new Error('Socket URL is not defined. Please set VITE_SOCKET_URL in your environment variables.');
    }
    
    socket = io(SOCKET_URL, {
      autoConnect: true,
      reconnectionAttempts: 3,
      transports: ['websocket']
    });

    // Add basic error logging
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

  // Only add these listeners once
  if (!socket.hasListeners) {
    socket.on('connect', () => {
      console.log('[socket] Connected with ID:', socket.id);
      if (userId) {
        socket.emit('join_room', userId);
      }
    });

    socket.hasListeners = true; // Mark that we've added the listeners
  }

  return socket;
}

export { socket };
