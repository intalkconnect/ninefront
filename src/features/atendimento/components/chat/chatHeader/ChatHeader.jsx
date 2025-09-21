import React, { useState } from 'react';
import { Share2, CheckCircle } from 'lucide-react';
import useConversationsStore from '../../../store/useConversationsStore';
import { apiPut } from '../../../../shared/apiClient';
import { getSocket } from '../../services/socket';        // ⬅️ importa o socket
import TransferModal from './modals/TransferModal';
import './ChatHeader.css';

export default function ChatHeader({ userIdSelecionado }) {
  const [showTransferModal, setShowTransferModal] = useState(false);
  const clienteAtivo       = useConversationsStore((state) => state.clienteAtivo);
  const mergeConversation  = useConversationsStore((state) => state.mergeConversation);
  const setSelectedUserId  = useConversationsStore((state) => state.setSelectedUserId);

  if (!clienteAtivo) return null;

  const {
    name = 'Cliente',
    ticket_number = '000000',
    user_id = userIdSelecionado,
  } = clienteAtivo;

  const finalizarAtendimento = async () => {
    const confirm = window.confirm('Deseja finalizar este atendimento?');
    if (!confirm) return;

    try {
      // fecha ticket no backend
      await apiPut(`/tickets/${user_id}`, { status: 'closed' });

      // atualiza a conversa localmente
      mergeConversation(user_id, { status: 'closed' });

      // sai da sala no realtime
      const socket = getSocket();
      if (socket?.connected) {
        socket.emit('leave_room', user_id);
      }

      // (opcional) avisa o app para remover este room dos "já ingressados"
      try {
        window.dispatchEvent(new CustomEvent('room-closed', { detail: { userId: user_id } }));
      } catch {}

      // limpa seleção
      setSelectedUserId(null);
    } catch (err) {
      console.error('Erro ao finalizar ticket:', err);
      alert('Erro ao finalizar atendimento.');
    }
  };

  return (
    <>
      <div className="chat-header">
        <div className="chat-header-left">
          <div className="nome-e-telefone">
            <span className="chat-header-nome">{name}</span>
            {clienteAtivo?.phone && (
              <span className="chat-header-phone">{clienteAtivo.phone}</span>
            )}
          </div>
        </div>

        <div className="chat-header-center">
          <span className="ticket-numero">#{ticket_number}</span>
        </div>

        <div className="chat-header-right">
          <button className="btn-transferir" onClick={() => setShowTransferModal(true)}>
            <Share2 size={14} />
            <span>Transferir</span>
          </button>
          <button className="btn-finalizar" onClick={finalizarAtendimento}>
            <CheckCircle size={14} />
            <span>Finalizar</span>
          </button>
        </div>
      </div>

      {showTransferModal && (
        <TransferModal
          userId={user_id}
          onClose={() => setShowTransferModal(false)}
        />
      )}
    </>
  );
}

