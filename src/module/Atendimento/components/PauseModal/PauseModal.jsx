import React, { useEffect, useMemo, useState } from 'react';
import { apiGet, apiPut } from '../../../../shared/apiClient';
import './PauseModal.css';

export default function PauseModal({ email, open, onClose, onPaused, onResumed }) {
  const [motivos, setMotivos] = useState([]);
  const [selectedId, setSelectedId] = useState('');
  const [loading, setLoading] = useState(false);
  const [startedAt, setStartedAt] = useState(null); // para contador
  const [tick, setTick] = useState(0); // re-render

  useEffect(() => {
    if (!open) return;
    (async () => {
      try {
        const list = await apiGet('/pausas');
        setMotivos(list || []);
      } catch (e) {
        console.error('[PauseModal] erro ao carregar motivos', e);
        setMotivos([]);
      }
    })();
  }, [open]);

  useEffect(() => {
    if (!startedAt) return;
    const t = setInterval(() => setTick((x) => x + 1), 1000);
    return () => clearInterval(t);
  }, [startedAt]);

  const elapsed = useMemo(() => {
    if (!startedAt) return '00:00:00';
    const diff = Math.max(0, Math.floor((Date.now() - new Date(startedAt).getTime()) / 1000));
    const h = String(Math.floor(diff / 3600)).padStart(2, '0');
    const m = String(Math.floor((diff % 3600) / 60)).padStart(2, '0');
    const s = String(diff % 60).padStart(2, '0');
    return `${h}:${m}:${s}`;
  }, [startedAt, tick]);

  const onConfirmPause = async () => {
    if (!email || !selectedId) return;
    setLoading(true);
    try {
      await apiPut(`/atendentes/pause/${email}`, { reason_id: selectedId });
      // começa contador agora
      const now = new Date().toISOString();
      setStartedAt(now);
      onPaused?.(); // avisa o pai pra setar status = 'pausado'
    } catch (e) {
      console.error('[PauseModal] erro ao pausar', e);
      alert('Erro ao aplicar pausa');
    } finally {
      setLoading(false);
    }
  };

  const onResume = async () => {
    if (!email) return;
    setLoading(true);
    try {
      await apiPut(`/atendentes/resume/${email}`, {});
      setStartedAt(null);
      onResumed?.(); // avisa o pai pra setar status = 'online'
      onClose?.();
    } catch (e) {
      console.error('[PauseModal] erro ao retomar', e);
      alert('Erro ao retomar');
    } finally {
      setLoading(false);
    }
  };

  if (!open) return null;

  return (
    <div className="pause-modal-backdrop" onClick={onClose}>
      <div className="pause-modal" onClick={(e) => e.stopPropagation()}>
        <h3>Pausa</h3>

        {!startedAt ? (
          <>
            <label>Motivo:</label>
            <select
              className="pause-select"
              value={selectedId}
              onChange={(e) => setSelectedId(e.target.value)}
            >
              <option value="">Selecione...</option>
              {motivos.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.nome}{m.max_minutes ? ` (até ${m.max_minutes} min)` : ''}
                </option>
              ))}
            </select>

            <div className="pause-actions">
              <button className="btn" onClick={onClose} disabled={loading}>Cancelar</button>
              <button className="btn primary" onClick={onConfirmPause} disabled={loading || !selectedId}>
                Iniciar pausa
              </button>
            </div>
          </>
        ) : (
          <>
            <div className="pause-counter">
              <div>Em pausa: <strong>{elapsed}</strong></div>
            </div>
            <div className="pause-actions">
              <button className="btn" onClick={onClose} disabled={loading}>Minimizar</button>
              <button className="btn success" onClick={onResume} disabled={loading}>
                Retomar
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
