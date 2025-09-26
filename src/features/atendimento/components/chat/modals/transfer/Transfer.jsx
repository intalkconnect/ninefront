import React, { useEffect, useState } from 'react';
import { apiGet, apiPost } from '../../../../../../shared/apiClient';
import './styles/Transfer.css';
import useConversationsStore from '../../../../store/useConversationsStore';

export default function TransferModal({ userId, onClose }) {
  const {
    userEmail,
    mergeConversation,
    setSelectedUserId,
    settings,
    getSettingValue
  } = useConversationsStore();

  /* ──────────────────────── Permissões globais ──────────────────────── */
  const permiteAtendente =
    getSettingValue('permitir_transferencia_atendente') === 'true';

  /* ────────────────────────── States locais ─────────────────────────── */
  const [filas, setFilas] = useState([]);
  const [filaSelecionada, setFilaSelecionada] = useState('');
  const [responsavel, setResponsavel] = useState('');
  const [atendentes, setAtendentes] = useState([]);

  /* ───────────────── Carrega filas onde usuário pode transferir ───────────────── */
  useEffect(() => {
    (async () => {
      try {
        const data = await apiGet(`/queues/queues-permissoes/${userEmail}`);
        setFilas(data);
      } catch (err) {
        console.error('Erro ao buscar filas:', err);
        alert('Erro ao carregar filas disponíveis.');
        onClose();
      }
    })();
  }, [userEmail, onClose]);

  /* ─────────── Carrega atendentes da fila (se permitido & selecionada) ─────────── */
  useEffect(() => {
    (async () => {
      if (!filaSelecionada || !permiteAtendente) {
        setAtendentes([]);
        return;
      }

      const filaNome = filas.find(f => f.id.toString() === filaSelecionada)?.nome;
      if (!filaNome) {
        setAtendentes([]);
        return;
      }

      try {
        const resp = await apiGet(`/queues/agents/${filaNome}`);
        const lista = Array.isArray(resp.atendentes) ? resp.atendentes : resp;
        setAtendentes(lista.filter(a => a.email !== userEmail)); // remove próprio usuário
      } catch (err) {
        console.error('Erro ao buscar atendentes:', err);
        setAtendentes([]);
      }
    })();
  }, [filaSelecionada, filas, permiteAtendente, userEmail]);

  /* ─────────────────────────── Confirmar transferência ─────────────────────────── */
  const confirmarTransferencia = async () => {
    if (!filaSelecionada) {
      alert('Selecione uma fila para transferir.');
      return;
    }

    const filaNome = filas.find(f => f.id.toString() === filaSelecionada)?.nome;
    if (!filaNome) {
      alert('Fila inválida selecionada.');
      return;
    }

    try {
      const body = {
        from_user_id: userId,
        to_fila: filaNome,                         // nome da fila
        to_assigned_to: permiteAtendente ? (responsavel || null) : null,
        transferido_por: userEmail
      };

      await apiPost('/tickets/transferir', body);

      mergeConversation(userId, { status: 'closed' });
      setSelectedUserId(null);
      onClose();
    } catch (err) {
      console.error('Erro ao transferir:', err);
      alert('Erro ao transferir atendimento.');
    }
  };

  /* ─────────────────────────────── JSX ──────────────────────────────── */
  return (
    <div className="modal-overlay">
      <div className="modal">
        <h2>Transferir Atendimento</h2>

        {/* Seleção de Fila */}
        <label>
          Fila:
          <select
            value={filaSelecionada}
            onChange={(e) => {
              setFilaSelecionada(e.target.value);
              setResponsavel('');
            }}
          >
            <option value="">Selecione uma fila</option>
            {filas.map((f) => (
              <option key={f.id} value={f.id}>{f.nome}</option>
            ))}
          </select>
        </label>

        {/* Seleção de Atendente (somente se permitido e após fila escolhida) */}
        {permiteAtendente && filaSelecionada && (
          <label>
            Atribuir para (opcional):
            {atendentes.length === 0 ? (
              <div className="info-text">
                Nenhum atendente disponível nesta fila.
              </div>
            ) : (
              <select
                value={responsavel}
                onChange={(e) => setResponsavel(e.target.value)}
              >
                <option value="">-- Qualquer atendente --</option>
                {atendentes.map((a) => (
                  <option key={a.email} value={a.email}>
                    {a.name} {a.lastname} ({a.email})
                  </option>
                ))}
              </select>
            )}
          </label>
        )}

        <div className="modal-actions">
          <button onClick={confirmarTransferencia}>Transferir</button>
          <button className="btn-cancelar" onClick={onClose}>Cancelar</button>
        </div>
      </div>
    </div>
  );
}
