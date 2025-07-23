import React, { useEffect } from 'react';
import './SocketDisconnectedModal.css';
import { getSocket } from '../services/socket';
import { apiPut } from '../services/apiClient';
import useConversationsStore from '../store/useConversationsStore';

export default function SocketDisconnectedModal() {
  const socketStatus = useConversationsStore(s => s.socketStatus);
  const setSocketStatus = useConversationsStore(s => s.setSocketStatus);

  // Atualiza status do atendente pelo sessionId em vez do email
const waitForSessionAndUpdate = async (sessionId, status, attempt = 0) => {
  const isReady = window.sessionStorage.getItem("sessionReady") === "true";

  if (!sessionId || sessionId === "undefined" || !isReady) {
    if (attempt < 5) {
      return setTimeout(() => waitForSessionAndUpdate(getSocket()?.id, status, attempt + 1), 3000);
    } else {
      console.warn("Socket ID ou sessão inválida mesmo após tentativas.");
      return;
    }
  }

  try {
    await apiPut(`/atendentes/status/${sessionId}`, { status });
    console.log(`[status] sessão ${sessionId} → ${status}`);
  } catch (err) {
    console.error("Erro ao atualizar status do atendente:", err);
  }
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
