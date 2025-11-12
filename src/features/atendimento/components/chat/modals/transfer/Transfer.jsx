// src/app/features/chat/components/modals/transfer/Transfer.jsx
import React, { useEffect, useState } from 'react';
import { apiGet, apiPost } from '../../../../../../shared/apiClient';
import './styles/Transfer.css';
import useConversationsStore from '../../../../store/useConversationsStore';

function withFlow(url, flowId) {
  if (!flowId) return url;
  return url.includes('?')
    ? `${url}&flow_id=${encodeURIComponent(flowId)}`
    : `${url}?flow_id=${encodeURIComponent(flowId)}`;
}

export default function TransferModal({ userId, flowId, onClose }) {
  const {
    userEmail,
    mergeConversation,
    setSelectedUserId,
    getSettingValue
  } = useConversationsStore();

  const permiteAtendente = getSettingValue('permitir_transferencia_atendente') === 'true';

  const [filas, setFilas] = useState([]);
  const [filaSelecionada, setFilaSelecionada] = useState('');
  const [responsavel, setResponsavel] = useState('');
  const [atendentes, setAtendentes] = useState([]);

  // 1) Listar filas do FLOW
  useEffect(() => {
    (async () => {
      try {
        const data = await apiGet(withFlow('/queues', flowId));
        setFilas(Array.isArray(data) ? data : []);
      } catch (err) {
        console.error('Erro ao buscar filas:', err);
        alert('Erro ao carregar filas disponíveis.');
        onClose();
      }
    })();
  }, [flowId, onClose]);

  // 2) Se permitido e se uma fila foi escolhida, carrega atendentes online da fila
  useEffect(() => {
    (async () => {
      if (!permiteAtendente || !filaSelecionada) {
        setAtendentes([]);
        return;
      }
      const fila = filas.find(f => String(f.id) === String(filaSelecionada));
      const filaNome = fila?.nome;
      if (!filaNome) {
        setAtendentes([]);
        return;
      }
      try {
        const resp = await apiGet(withFlow(`/queues/agents/${encodeURIComponent(filaNome)}`, flowId));
        const lista = Array.isArray(resp?.atendentes) ? resp.atendentes : (Array.isArray(resp) ? resp : []);
        setAtendentes(lista.filter(a => a.email !== userEmail));
      } catch (err) {
        console.error('Erro ao buscar atendentes:', err);
        setAtendentes([]);
      }
    })();
  }, [filaSelecionada, filas, permiteAtendente, userEmail, flowId]);

  // 3) Confirmar transferência (manda flow_id no body)
  const confirmarTransferencia = async () => {
    if (!filaSelecionada) {
      alert('Selecione uma fila para transferir.');
      return;
    }
    const fila = filas.find(f => String(f.id) === String(filaSelecionada));
    const filaNome = fila?.nome;
    if (!filaNome) {
      alert('Fila inválida selecionada.');
      return;
    }
    try {
      const body = {
        from_user_id: userId,
        to_fila: filaNome,
        to_assigned_to: permiteAtendente ? (responsavel || null) : null,
        transferido_por: userEmail,
        ...(flowId ? { flow_id: flowId } : {})
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

  return (
    <div className="modal-overlay">
      <div className="modal">
        <h2>Transferir Atendimento</h2>

        <label>
          Fila:
          <select
            value={filaSelecionada}
            onChange={(e) => { setFilaSelecionada(e.target.value); setResponsavel(''); }}
          >
            <option value="">Selecione uma fila</option>
            {filas.map((f) => (
              <option key={f.id} value={f.id}>{f.nome}</option>
            ))}
          </select>
        </label>

        {permiteAtendente && filaSelecionada && (
          <label>
            Atribuir para (opcional):
            {atendentes.length === 0 ? (
              <div className="info-text">Nenhum atendente disponível nesta fila.</div>
            ) : (
              <select value={responsavel} onChange={(e) => setResponsavel(e.target.value)}>
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
