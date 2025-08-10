// src/module/Atendimento/components/SocketDisconnectedModal.jsx
import { useEffect, useState } from "react";
import useConversationsStore from "../store/useConversationsStore";
import { connectSSE, onStatusChange } from "../services/sse";

export default function SocketDisconnectedModal() {
  const socketStatus = useConversationsStore((s) => s.socketStatus);
  const setSocketStatus = useConversationsStore((s) => s.setSocketStatus);
  const selectedUserId = useConversationsStore((s) => s.selectedUserId);

  const [open, setOpen] = useState(false);

  // manter o estado em sincronia com SSE (online/offline)
  useEffect(() => {
    const sub = (st) => {
      setSocketStatus(st);
      setOpen(st === "offline");
    };
    onStatusChange(sub);
    return () => onStatusChange(null);
  }, [setSocketStatus]);

  // reconectar manualmente
  const reconectar = () => {
    const rooms = ["broadcast"];
    if (selectedUserId) rooms.push(`chat-${String(selectedUserId)}`);
    connectSSE(rooms);
  };

  if (!open) return null;

  return (
    <div className="socket-modal">
      <div className="socket-modal__card">
        <h3>Conexão em tempo real perdida</h3>
        <p>Não estamos recebendo eventos do servidor agora.</p>
        <div className="socket-modal__actions">
          <button onClick={reconectar}>Tentar reconectar</button>
          <button onClick={() => setOpen(false)}>Fechar</button>
        </div>
        <small>Status: {socketStatus}</small>
      </div>
      <style jsx>{`
        .socket-modal {
          position: fixed; inset: 0; display: grid; place-items: center;
          background: rgba(0,0,0,.4); z-index: 10000;
        }
        .socket-modal__card {
          background: #fff; padding: 16px 20px; border-radius: 12px;
          width: 100%; max-width: 460px; box-shadow: 0 10px 30px rgba(0,0,0,.15);
        }
        .socket-modal__actions { display: flex; gap: 8px; margin-top: 12px; }
        .socket-modal__actions button { padding: 8px 12px; border-radius: 8px; border: 1px solid #ddd; }
      `}</style>
    </div>
  );
}
