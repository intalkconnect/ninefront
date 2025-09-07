import React, { useEffect, useMemo, useState } from 'react';
import { apiGet, apiPost } from '../../../shared/apiClient';
import './styles/TransferModal.css';
import useConversationsStore from '../../../store/useConversationsStore';

export default function TransferModal({
  userId,
  currentFila,       // nome da fila atual (string)
  currentAssigned,   // e-mail do responsável atual (string ou "")
  onClose,
}) {
  const {
    userEmail,
    mergeConversation,
    setSelectedUserId,
    getSettingValue,
  } = useConversationsStore();

  // Permite escolher atendente?
  const permiteAtendente =
    getSettingValue('permitir_transferencia_atendente') === 'true';

  // Estado local
  const [filas, setFilas] = useState([]);    // [{id, nome}, ...] vindo de GET /filas
  const [filaDestinoNome, setFilaDestinoNome] = useState(''); // NOME da fila (a API exige nome)
  const [atendentes, setAtendentes] = useState([]);           // [{email, name, lastname}, ...]
  const [responsavel, setResponsavel] = useState('');         // email do atendente destino
  const [loading, setLoading] = useState(false);

  // Fila alvo efetiva (se nada for escolhido, manter a atual)
  const filaAlvoEfetiva = useMemo(
    () => (filaDestinoNome || currentFila || ''),
    [filaDestinoNome, currentFila]
  );

  /* Carrega TODAS as filas (sua rota GET /filas) */
  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const data = await apiGet('/filas'); // GET /filas → rows completos
        if (!alive) return;
        const list = Array.isArray(data) ? data : (Array.isArray(data?.rows) ? data.rows : []);
        setFilas(list);

        // Pré-seleciona a fila atual, se existir na lista (apenas para UI; no POST usamos filaAlvoEfetiva)
        const match = list.find(f => f?.nome === currentFila);
        if (match) setFilaDestinoNome(''); // manter a atual por padrão
      } catch (err) {
        console.error('Erro ao buscar filas:', err);
        alert('Erro ao carregar filas disponíveis.');
        onClose();
      }
    })();
    return () => { alive = false; };
  }, [currentFila, onClose]);

  /* Carrega atendentes da fila de destino (se permitido e houver um nome de fila alvo) */
  useEffect(() => {
    (async () => {
      if (!permiteAtendente) {
        setAtendentes([]);
        return;
      }
      const alvo = filaAlvoEfetiva;
      if (!alvo) {
        setAtendentes([]);
        return;
      }
      try {
        // Se sua API tiver /filas/atendentes/:nome, mantemos:
        const resp = await apiGet(`/filas/atendentes/${encodeURIComponent(alvo)}`);
        const lista = Array.isArray(resp?.atendentes) ? resp.atendentes : (Array.isArray(resp) ? resp : []);
        setAtendentes(lista.filter(a => a.email !== userEmail));
      } catch (err) {
        console.error('Erro ao buscar atendentes:', err);
        setAtendentes([]);
      }
    })();
    // limpamos atendente ao trocar a fila alvo
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [permiteAtendente, filaAlvoEfetiva, userEmail]);

  /* Validação das mudanças selecionadas */
  const validarMudanca = () => {
    const finalFila = filaAlvoEfetiva; // obrigatório para a rota
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

    return { finalFila, finalResp };
  };

  /* Confirmar transferência */
  const confirmarTransferencia = async () => {
    const sel = validarMudanca();
    if (!sel) return;

    const body = {
      from_user_id: userId,            // obrigatório
      to_fila: sel.finalFila,          // NOME da fila (obrigatório)
      to_assigned_to: sel.finalResp || null, // opcional
      transferido_por: userEmail,      // obrigatório
    };

    try {
      setLoading(true);
      await apiPost('/tickets/transferir', body);

      // Atualiza store local (se seu store usar userId como chave)
      try { mergeConversation?.(userId, { status: 'closed' }); } catch {}
      try { setSelectedUserId?.(null); } catch {}

      onClose(); // o pai recarrega a grade
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
            onChange={(e) => {
              setFilaDestinoNome(e.target.value); // nome da fila
              setResponsavel('');                 // limpar atendente ao trocar fila
            }}
          >
            <option value="">— manter fila atual —</option>
            {filas.map((f) => (
              <option key={f.id} value={f.nome}>
                {f.nome}
              </option>
            ))}
          </select>
        </label>

        {/* Seleção de Atendente (opcional, se permitido) */}
        {permiteAtendente && (
          <label>
            Atribuir para (opcional):
            {atendentes.length === 0 ? (
              <div className="info-text">
                Nenhum atendente disponível na fila “{filaAlvoEfetiva || '—'}”.
              </div>
            ) : (
              <select
                value={responsavel}
                onChange={(e) => setResponsavel(e.target.value)}
              >
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
