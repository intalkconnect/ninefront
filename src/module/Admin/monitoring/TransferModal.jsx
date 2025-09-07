// src/module/Admin/monitoring/TransferModal.jsx
import React, { useEffect, useMemo, useState } from 'react';
import { apiGet, apiPost } from '../../../shared/apiClient';
import './styles/TransferModal.css';

export default function TransferModal({
  userId,
  currentFila = '',
  currentAssigned = '',
  userEmail = '',                  // opcional: se vier, vai como transferido_por
  permiteAtendente = true,         // opcional: se quiser esconder o campo de atendente, passe false
  onClose,
  onDone,                          // opcional: pai pode dar fetchAll após sucesso
}) {
  const [filas, setFilas] = useState([]);           // [{id, nome}, ...] (GET /filas)
  const [filaDestinoNome, setFilaDestinoNome] = useState('');   // nome da fila
  const [atendentes, setAtendentes] = useState([]); // [{id, name, lastname, email, status}]
  const [atendentesMsg, setAtendentesMsg] = useState('');
  const [responsavel, setResponsavel] = useState('');           // email do atendente
  const [loading, setLoading] = useState(false);
  const [loadingAgents, setLoadingAgents] = useState(false);

  // Fila alvo efetiva (se não escolher, mantém a atual)
  const filaAlvoEfetiva = useMemo(
    () => (filaDestinoNome || currentFila || ''),
    [filaDestinoNome, currentFila]
  );

  // houve ao menos uma mudança?
  const mudouAlgo = useMemo(() => {
    const mudouFila = !!filaAlvoEfetiva && filaAlvoEfetiva !== (currentFila || '');
    const mudouResp = !!responsavel && responsavel !== (currentAssigned || '');
    return mudouFila || mudouResp;
  }, [filaAlvoEfetiva, currentFila, responsavel, currentAssigned]);

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
        setAtendentesMsg('');
        return;
      }
      const alvo = filaAlvoEfetiva;
      if (!alvo) {
        setAtendentes([]);
        setAtendentesMsg('');
        return;
      }
      try {
        setLoadingAgents(true);
        const resp = await apiGet(`/filas/atendentes/${encodeURIComponent(alvo)}`);
        const lista = Array.isArray(resp?.atendentes) ? resp.atendentes : [];
        setAtendentes(lista);
        setAtendentesMsg(typeof resp?.message === 'string' ? resp.message : '');
      } catch (err) {
        console.error('Erro ao buscar atendentes online:', err);
        setAtendentes([]);
        setAtendentesMsg('Erro ao buscar atendentes desta fila.');
      } finally {
        setLoadingAgents(false);
      }
    })();
    // limpa atendente escolhido ao trocar a fila alvo
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [permiteAtendente, filaAlvoEfetiva]);

  const confirmarTransferencia = async () => {
    if (!filaAlvoEfetiva) {
      alert('Defina a fila de destino (ou mantenha a atual).');
      return;
    }
    if (!mudouAlgo) {
      alert('Selecione ao menos uma mudança (fila e/ou atendente).');
      return;
    }

    const body = {
      from_user_id: userId,
      to_fila: filaAlvoEfetiva,                // obrigatório: nome da fila
      to_assigned_to: responsavel || null,     // opcional
      // transferido_por é opcional aqui; só envia se veio
      ...(userEmail ? { transferido_por: userEmail } : {}),
    };

    try {
      setLoading(true);
      await apiPost('/tickets/transferir', body);
      onDone?.();
      onClose();
    } catch (err) {
      console.error('Erro ao transferir atendimento:', err);
      const msg = err?.response?.data?.error || 'Erro ao transferir atendimento.';
      alert(msg);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="tm-overlay" role="dialog" aria-modal="true">
      <div className="tm-modal">
        <div className="tm-header">
          <h3 className="tm-title">Transferir Atendimento</h3>
          <button className="tm-close" onClick={onClose} aria-label="Fechar">×</button>
        </div>

        <div className="tm-content">
          <p className="tm-hint">Escolha a <strong>fila</strong> e/ou um <strong>atendente</strong>. Pelo menos um deles.</p>

          <div className="tm-context">
            <div><span className="tm-label">Fila atual:</span> {currentFila || '—'}</div>
            <div><span className="tm-label">Responsável atual:</span> {currentAssigned || '—'}</div>
          </div>

          {/* Fila */}
          <div className="tm-row">
            <label className="tm-fieldLabel">Fila destino</label>
            <select
              className="tm-select"
              value={filaDestinoNome}
              onChange={(e) => { setFilaDestinoNome(e.target.value); setResponsavel(''); }}
            >
              <option value="">— manter fila atual —</option>
              {filas.map((f) => (
                <option key={f.id} value={f.nome}>{f.nome}</option>
              ))}
            </select>
            <div className="tm-caption">Deixe “manter fila atual” se quiser mudar apenas o atendente.</div>
          </div>

          {/* Atendente (opcional) */}
          {permiteAtendente && (
            <div className="tm-row">
              <label className="tm-fieldLabel">Atribuir para (opcional)</label>

              {loadingAgents ? (
                <div className="tm-skeleton" />
              ) : atendentes.length === 0 ? (
                <div className="tm-muted">
                  {atendentesMsg || `Nenhum atendente online em “${filaAlvoEfetiva || '—'}”.`}
                </div>
              ) : (
                <select
                  className="tm-select"
                  value={responsavel}
                  onChange={(e) => setResponsavel(e.target.value)}
                >
                  <option value="">— não definir —</option>
                  {atendentes.map(a => (
                    <option key={a.email} value={a.email}>
                      {a.name} {a.lastname} ({a.email})
                    </option>
                  ))}
                </select>
              )}

              <div className="tm-caption">
                Você pode definir apenas o atendente para a fila atual, ou escolher fila + atendente.
              </div>
            </div>
          )}
        </div>

        <div className="tm-actions">
          <button
            className="tm-btn tm-btnPrimary"
            onClick={confirmarTransferencia}
            disabled={loading || !mudouAlgo || !filaAlvoEfetiva}
          >
            {loading ? 'Transferindo…' : 'Transferir'}
          </button>
          <button className="tm-btn tm-btnGhost" onClick={onClose} disabled={loading}>
            Cancelar
          </button>
        </div>
      </div>
    </div>
  );
}
