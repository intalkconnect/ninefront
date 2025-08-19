import React, { useEffect, useMemo, useState, useCallback } from 'react';
import { Pause, Clock, X, AlertTriangle } from 'lucide-react';
import { apiGet, apiPost, apiPatch } from '../../../../shared/apiClient';
import './PauseModal.css';

export default function PauseModal({ email, open, onClose, onPaused, onResumed }) {
  const [motivos, setMotivos] = useState([]);
  const [selectedId, setSelectedId] = useState('');         // UUID string
  const [loading, setLoading] = useState(false);
  const [startedAt, setStartedAt] = useState(null);
  const [currentSessionId, setCurrentSessionId] = useState(null);
  const [tick, setTick] = useState(0);
  const [error, setError] = useState('');

  // Carrega motivos de pausa (apenas ativos)
  useEffect(() => {
    if (!open) return;

    const loadMotivos = async () => {
      try {
        setError('');
        const list = await apiGet('/pausas?active=true');
        setMotivos(Array.isArray(list) ? list : []);
      } catch (e) {
        console.error('[PauseModal] erro ao carregar motivos', e);
        setError('Erro ao carregar motivos de pausa');
        setMotivos([]);
      }
    };

    loadMotivos();
  }, [open]);

  // Timer para contador
  useEffect(() => {
    if (!startedAt) return;
    const timer = setInterval(() => setTick(x => x + 1), 1000);
    return () => clearInterval(timer);
  }, [startedAt]);

  // Reset ao fechar
  useEffect(() => {
    if (!open) {
      setSelectedId('');
      setError('');
      setStartedAt(null);
      setCurrentSessionId(null);
    }
  }, [open]);

  // Tempo decorrido
  const elapsed = useMemo(() => {
    if (!startedAt) return '00:00:00';
    const diff = Math.max(0, Math.floor((Date.now() - new Date(startedAt).getTime()) / 1000));
    const h = String(Math.floor(diff / 3600)).padStart(2, '0');
    const m = String(Math.floor((diff % 3600) / 60)).padStart(2, '0');
    const s = String(diff % 60).padStart(2, '0');
    return `${h}:${m}:${s}`;
  }, [startedAt, tick]);

  // Motivo selecionado (comparando como string — UUID)
  const selectedMotivo = useMemo(() => {
    return motivos.find(m => String(m.id) === String(selectedId));
  }, [motivos, selectedId]);

  // Excedeu tempo máximo?
  const isOverTime = useMemo(() => {
    if (!startedAt || !selectedMotivo?.max_minutes) return false;
    const diffMinutes = Math.floor((Date.now() - new Date(startedAt).getTime()) / 60000);
    return diffMinutes > Number(selectedMotivo.max_minutes);
  }, [startedAt, selectedMotivo, tick]);

  const handleClose = useCallback(() => {
    if (loading) return;
    onClose?.();
  }, [loading, onClose]);

  const onConfirmPause = async () => {
    if (!email || !selectedId || loading) return;

    setLoading(true);
    setError('');

    try {
      const response = await apiPost(`/pausas/atendentes/${email}/start`, {
        // reason_id agora é UUID string — enviar sem Number()
        reason_id: selectedId,
      });

      setStartedAt(response?.started_at ?? new Date().toISOString());
      setCurrentSessionId(response?.id ?? null);
      onPaused?.();
    } catch (e) {
      console.error('[PauseModal] erro ao pausar', e);
      const errorMsg = e?.response?.data?.error || 'Erro ao aplicar pausa. Tente novamente.';
      setError(errorMsg);
    } finally {
      setLoading(false);
    }
  };

  const onResume = async () => {
    if (!email || !currentSessionId || loading) return;

    setLoading(true);
    setError('');

    try {
      await apiPatch(`/pausas/atendentes/${email}/${currentSessionId}/end`);
      setStartedAt(null);
      setCurrentSessionId(null);
      onResumed?.();
      onClose?.();
    } catch (e) {
      console.error('[PauseModal] erro ao retomar', e);
      const errorMsg = e?.response?.data?.error || 'Erro ao retomar. Tente novamente.';
      setError(errorMsg);
    } finally {
      setLoading(false);
    }
  };

  const handleBackdropClick = (e) => {
    if (e.target === e.currentTarget) handleClose();
  };

  const handleKeyDown = useCallback((e) => {
    if (e.key === 'Escape' && !loading) {
      handleClose();
    } else if (e.key === 'Enter' && !startedAt && selectedId && !loading) {
      onConfirmPause();
    }
  }, [loading, startedAt, selectedId, handleClose]);

  useEffect(() => {
    if (open) {
      document.addEventListener('keydown', handleKeyDown);
      return () => document.removeEventListener('keydown', handleKeyDown);
    }
  }, [open, handleKeyDown]);

  if (!open) return null;

  return (
    <div className="pause-modal-backdrop" onClick={handleBackdropClick}>
      <div className="pause-modal" onClick={e => e.stopPropagation()}>
        <div className="pause-modal-header">
          <h3 className="pause-modal-title">
            {!startedAt ? (
              <>
                <Pause className="title-icon" />
                Iniciar Pausa
              </>
            ) : (
              <>
                <Clock className="title-icon" />
                Em Pausa
              </>
            )}
          </h3>
          <button className="pause-modal-close" onClick={handleClose} disabled={loading}>
            <X size={16} />
          </button>
        </div>

        <div className="pause-modal-content">
          {error && (
            <div className="pause-error">
              <AlertTriangle size={16} />
              {error}
            </div>
          )}

          {!startedAt ? (
            <>
              <div className="pause-form-group">
                <label className="pause-label">Motivo da pausa *</label>
                <select
                  className="pause-select"
                  value={selectedId}
                  onChange={(e) => setSelectedId(e.target.value)}
                  disabled={loading || motivos.length === 0}
                  autoFocus
                >
                  <option value="">{motivos.length ? 'Selecione um motivo...' : 'Sem motivos disponíveis'}</option>
                  {motivos.map((m) => (
                    <option key={m.id} value={String(m.id)}>
                      {m.label} {m.code ? `(${m.code})` : ''}
                      {m.max_minutes ? ` — máx. ${m.max_minutes} min` : ''}
                    </option>
                  ))}
                </select>
              </div>

              <div className="pause-actions">
                <button className="btn btn-secondary" onClick={handleClose} disabled={loading}>
                  Cancelar
                </button>
                <button
                  className="btn btn-primary"
                  onClick={onConfirmPause}
                  disabled={loading || !selectedId}
                >
                  {loading ? 'Iniciando...' : 'Iniciar Pausa'}
                </button>
              </div>
            </>
          ) : (
            <>
              <div className="pause-info">
                <strong>Motivo:</strong> {selectedMotivo?.label || 'N/A'}
              </div>

              <div className={`pause-counter ${isOverTime ? 'over-time' : ''}`}>
                <div className="counter-time">
                  {elapsed}
                  {isOverTime && (
                    <span className="over-time-indicator">
                      <AlertTriangle size={14} />
                      Excedido
                    </span>
                  )}
                </div>
              </div>

              <div className="pause-actions">
                <button
                  className={`btn ${isOverTime ? 'btn-warning' : 'btn-success'}`}
                  onClick={onResume}
                  disabled={loading}
                >
                  {loading ? 'Retomando...' : 'Retomar'}
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
