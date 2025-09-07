// src/module/Admin/monitoring/TransferModal.jsx
import React, { useEffect, useMemo, useState } from 'react';
import { apiGet, apiPost } from '../../../shared/apiClient';
import './styles/TransferModal.css';

export default function TransferModal({
  userId,
  currentFila = '',
  currentAssigned = '',
  userEmail = '',
  permiteAtendente = false,
  onClose,
  onDone,
}) {
  const [filas, setFilas] = useState([]);                 // [{id, nome}, ...] (GET /filas)
  const [filaDestinoNome, setFilaDestinoNome] = useState(''); // nome da fila destino
  const [atendentes, setAtendentes] = useState([]);       // [{id, name, lastname, email, status}, ...]
  const [respMsg, setRespMsg] = useState('');             // mensagem opcional do backend
  const [responsavel, setResponsavel] = useState('');     // email do atendente destino
  const [loading, setLoading] = useState(false);

  // Fila alvo efetiva (se não escolher, mantém a atual)
  const filaAlvoEfetiva = useMemo(
    () => (filaDestinoNome || currentFila || ''),
    [filaDestinoNome, currentFila]
  );

  /* Carrega TODAS as filas (GET /filas) */
  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const data = await apiGet('/filas');
        if (!alive) return;
        const list = Array.isArray(data) ? data : (Array.isArray(data?.rows) ? data.rows : []);
        setFilas(list);
      } catch (err) {
        console.error('Erro ao buscar filas:', err);
        alert('Erro ao carregar filas disponíveis.');
        onClose();
      }
    })();
    return () => { alive = false; };
  }, [onClose]);

  /* Carrega ATENDENTES ONLINE da fila alvo (GET /atendentes/:fila_nome) */
  useEffect(() => {
    (async () => {
      if (!permiteAtendente) {
        setAtendentes([]);
        setRespMsg('');
        return;
      }
      const alvo = filaAlvoEfetiva;
      if (!alvo) {
        setAtendentes([]);
        setRespMsg('');
        return;
      }
      try {
        const resp = await apiGet(`/atendentes/${encodeURIComponent(alvo)}`);
        const lista = Array.isArray(resp?.atendentes) ? resp.atendentes : [];
        setAtendentes(lista.filter(a => a.email !== userEmail)); // não listar o próprio usuário
        setRespMsg(typeof resp?.message === 'string' ? resp.message : '');
      } catch (err) {
        console.error('Erro ao buscar atendentes online:', err);
        setAtendentes([]);
        setRespMsg('Erro ao buscar atendentes desta fila.');
      }
    })();
    // limpar atendente ao trocar a fila alvo
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [permiteAtendente, filaAlvoEfetiva, userEmail]);

  /* Validação do que será alterado */
  const validarMudanca = () => {
    const finalFila = filaAlvoEfetiva;                     // obrigatório para o POST
    const finalResp = permiteAtendente ? (responsavel || '') : '';

    if (!finalFila) {
      alert('Defina a fila de destino (ou mantenha a atual).');
      return null;
    }
    const mudouFila = finalFila !== (currentFila || '');
    const mudouResp = !!finalResp && finalResp !== (currentAssigned || '');
    if (!mudouFila && !mudouResp) {
      alert('Selecione ao menos uma mudança (fila e/ou atendente).');
      return null;
    }
    if (!userEmail) {
      alert('Usuário atual não identificado (userEmail ausente).');
      return null;
    }
    return { finalFila, finalResp };
  };

  /* Confirmar transferência (POST /tickets/transferir) */
  const confirmarTransferencia = async () => {
    const sel = validarMudanca();
    if (!sel) return;

    const body = {
      from_user_id: userId,                  // obrigatório
      to_fila: sel.finalFila,                // NOME da fila (obrigatório)
      to_assigned_to: sel.finalResp || null, // opcional
      transferido_por: userEmail,            // obrigatório
    };

    try {
      setLoading(true);
      await apiPost('/tickets/transferir', body);
      onDone?.(); // pai pode recarregar a grade
      onClose();
    } catch (err) {
      console.error('Erro ao transferir atendimento:', err);
      alert('Erro ao transferir atendimento.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="modal-overlay" role="dialog" aria-modal="true">
      <div className="modal">
        <h2>Transferir Atendimento</h2>

        {/* Contexto atual */}
        <div className="context">
          <div><strong>Fila atual:</strong> {currentFila || '—'}</div>
          <div><strong>Responsável atual:</strong> {currentAssigned || '—'}</div>
        </div>

        {/* Seleção de Fila (sempre precisamos de um nome de fila no POST) */}
        <label>
          Fila destino:
          <select
            value={filaDestinoNome}
            onChange={(e) => { setFilaDestinoNome(e.target.value); setResponsavel(''); }}
          >
            <option value="">— manter fila atual —</option>
            {filas.map((f) => (
              <option key={f.id} value={f.nome}>{f.nome}</option>
            ))}
          </select>
        </label>

        {/* Seleção de Atendente (opcional) */}
        {permiteAtendente && (
          <label>
            Atribuir para (opcional):
            {atendentes.length === 0 ? (
              <div className="info-text">
                {respMsg || `Nenhum atendente online disponível na fila “${filaAlvoEfetiva || '—'}”.`}
              </div>
            ) : (
              <select value={responsavel} onChange={(e) => setResponsavel(e.target.value)}>
                <option value="">— não definir —</option>
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
          <button onClick={confirmarTransferencia} disabled={loading}>
            {loading ? 'Transferindo...' : 'Transferir'}
          </button>
          <button className="btn-cancelar" onClick={onClose} disabled={loading}>
            Cancelar
          </button>
        </div>
      </div>
    </div>
  );
}
