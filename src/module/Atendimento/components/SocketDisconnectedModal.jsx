import React, { useEffect } from 'react';
import './SocketDisconnectedModal.css';
import { getSocket } from '../services/socket';
import { apiPut } from '../../../shared/apiClient';
import useConversationsStore from '../store/useConversationsStore';

export default function SocketDisconnectedModal() {
  const socketStatus = useConversationsStore(s => s.socketStatus);
  const setSocketStatus = useConversationsStore(s => s.setSocketStatus);

  // Atualiza status do atendente pelo sessionId em vez do email
const waitForSessionAndUpdate = (sessionId, status) => {
  const interval = setInterval(() => {
    const isReady = window.sessionStorage.getItem("sessionReady") === "true";
    if (isReady && sessionId) {
      clearInterval(interval);
      apiPut(`/atendentes/status/${sessionId}`, { status })
        .then(() => console.log(`[status] sessão ${sessionId} → ${status}`))
        .catch((err) => console.error("Erro ao atualizar status:", err));
    }
  }, 300); // Checa a cada 300ms
};

  useEffect(() => {
    const socket = getSocket();
    if (!socket) return;

    const handleConnect = () => {
      setSocketStatus('online');
      waitForSessionAndUpdate(getSocket()?.id, "online");
    };

    const handleDisconnect = () => {
      setSocketStatus('offline');
      waitForSessionAndUpdate(getSocket()?.id, "offline");
    };

    socket.on('connect', handleConnect);
    socket.on('disconnect', handleDisconnect);

    // Se não conectar em 3s, considera offline
    const timeout = setTimeout(() => {
      if (!socket.connected) {
        setSocketStatus('offline');
        waitForSessionAndUpdate(getSocket()?.id, "offline");
      }
    }, 3000);

    // Limpeza
    return () => {
      socket.off('connect', handleConnect);
      socket.off('disconnect', handleDisconnect);
      clearTimeout(timeout);
    };
  }, [setSocketStatus]);

  const reconectar = () => {
    const socket = getSocket();
    if (!socket.connected) {
      socket.connect();
      socket.emit('join_room', socket.id);
    }
  };

  if (socketStatus !== 'offline') return null;

  return (
    <div className="socket-modal-overlay">
      <div className="socket-modal">
        <h2>Conexão Perdida</h2>
        <p>Não foi possível se comunicar com o servidor.</p>
        <button onClick={reconectar}>Tentar reconectar</button>
      </div>
    </div>
  );
}
