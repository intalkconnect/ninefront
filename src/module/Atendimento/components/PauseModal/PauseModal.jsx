import React, { useEffect, useMemo, useState, useCallback } from 'react';
import { apiGet, apiPut } from '../../../../shared/apiClient';
import './PauseModal.css';

export default function PauseModal({ email, open, onClose, onPaused, onResumed }) {
  const [motivos, setMotivos] = useState([]);
  const [selectedId, setSelectedId] = useState('');
  const [loading, setLoading] = useState(false);
  const [startedAt, setStartedAt] = useState(null);
  const [tick, setTick] = useState(0);
  const [error, setError] = useState('');
  const [isClosing, setIsClosing] = useState(false);

  // Carrega motivos de pausa
  useEffect(() => {
    if (!open) return;
    
    const loadMotivos = async () => {
      try {
        setError('');
        const list = await apiGet('/pausas');
        setMotivos(list || []);
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

  // Reset estados ao fechar
  useEffect(() => {
    if (!open) {
      setSelectedId('');
      setError('');
      setIsClosing(false);
    }
  }, [open]);

  // Calcula tempo decorrido
  const elapsed = useMemo(() => {
    if (!startedAt) return '00:00:00';
    
    const diff = Math.max(0, Math.floor((Date.now() - new Date(startedAt).getTime()) / 1000));
    const h = String(Math.floor(diff / 3600)).padStart(2, '0');
    const m = String(Math.floor((diff % 3600) / 60)).padStart(2, '0');
    const s = String(diff % 60).padStart(2, '0');
    
    return `${h}:${m}:${s}`;
  }, [startedAt, tick]);

  // Motivo selecionado
  const selectedMotivo = useMemo(() => {
    return motivos.find(m => m.id === selectedId);
  }, [motivos, selectedId]);

  // Verifica se excedeu tempo máximo
  const isOverTime = useMemo(() => {
    if (!startedAt || !selectedMotivo?.max_minutes) return false;
    
    const diffMinutes = Math.floor((Date.now() - new Date(startedAt).getTime()) / 60000);
    return diffMinutes > selectedMotivo.max_minutes;
  }, [startedAt, selectedMotivo, tick]);

  const handleClose = useCallback(() => {
    if (loading) return;
    setIsClosing(true);
    setTimeout(() => {
      onClose?.();
    }, 150);
  }, [loading, onClose]);

  const onConfirmPause = async () => {
    if (!email || !selectedId || loading) return;
    
    setLoading(true);
    setError('');
    
    try {
      await apiPut(`/atendentes/pause/${email}`, { reason_id: selectedId });
      
      const now = new Date().toISOString();
      setStartedAt(now);
      onPaused?.();
      
    } catch (e) {
      console.error('[PauseModal] erro ao pausar', e);
      setError('Erro ao aplicar pausa. Tente novamente.');
    } finally {
      setLoading(false);
    }
  };

  const onResume = async () => {
    if (!email || loading) return;
    
    setLoading(true);
    setError('');
    
    try {
      await apiPut(`/atendentes/resume/${email}`, {});
      
      setStartedAt(null);
      onResumed?.();
      handleClose();
      
    } catch (e) {
      console.error('[PauseModal] erro ao retomar', e);
      setError('Erro ao retomar. Tente novamente.');
    } finally {
      setLoading(false);
    }
  };

  const handleBackdropClick = (e) => {
    if (e.target === e.currentTarget) {
      handleClose();
    }
  };

  const handleKeyDown = useCallback((e) => {
    if (e.key === 'Escape' && !loading) {
      handleClose();
    } else if (e.key === 'Enter' && !startedAt && selectedId && !loading) {
      onConfirmPause();
    }
  }, [loading, startedAt, selectedId, handleClose]);

  // Keyboard events
  useEffect(() => {
    if (open) {
      document.addEventListener('keydown', handleKeyDown);
      return () => document.removeEventListener('keydown', handleKeyDown);
    }
  }, [open, handleKeyDown]);

  if (!open) return null;

  return (
    <div 
      className={`pause-modal-backdrop ${isClosing ? 'closing' : ''}`}
      onClick={handleBackdropClick}
    >
      <div 
        className={`pause-modal ${isClosing ? 'closing' : ''}`}
        onClick={e => e.stopPropagation()}
      >
        <div className="pause-modal-header">
          <h3 className="pause-modal-title">
            {!startedAt ? '⏸️ Iniciar Pausa' : '⏱️ Em Pausa'}
          </h3>
          <button 
            className="pause-modal-close"
            onClick={handleClose}
            disabled={loading}
            aria-label="Fechar"
          >
            ✕
          </button>
        </div>

        <div className="pause-modal-content">
          {error && (
            <div className="pause-error">
              <span className="error-icon">⚠️</span>
              {error}
            </div>
          )}

          {!startedAt ? (
            <>
              <div className="pause-form-group">
                <label className="pause-label">
                  Motivo da pausa <span className="required">*</span>
                </label>
                <select
                  className={`pause-select ${!selectedId && error ? 'error' : ''}`}
                  value={selectedId}
                  onChange={(e) => setSelectedId(e.target.value)}
                  disabled={loading}
                  autoFocus
                >
                  <option value="">Selecione um motivo...</option>
                  {motivos.map((m) => (
                    <option key={m.id} value={m.id}>
                      {m.nome}
                      {m.max_minutes ? ` (máx. ${m.max_minutes} min)` : ''}
                    </option>
                  ))}
                </select>
                {selectedMotivo?.max_minutes && (
                  <div className="pause-hint">
                    ⏰ Tempo máximo: {selectedMotivo.max_minutes} minutos
                  </div>
                )}
              </div>

              <div className="pause-actions">
                <button 
                  className="btn btn-secondary" 
                  onClick={handleClose}
                  disabled={loading}
                >
                  Cancelar
                </button>
                <button 
                  className="btn btn-primary" 
                  onClick={onConfirmPause}
                  disabled={loading || !selectedId}
                >
                  {loading ? (
                    <>
                      <span className="spinner"></span>
                      Iniciando...
                    </>
                  ) : (
                    'Iniciar Pausa'
                  )}
                </button>
              </div>
            </>
          ) : (
            <>
              <div className="pause-info">
                <div className="pause-motivo">
                  <strong>Motivo:</strong> {selectedMotivo?.nome || 'N/A'}
                </div>
              </div>

              <div className={`pause-counter ${isOverTime ? 'over-time' : ''}`}>
                <div className="counter-label">Tempo em pausa:</div>
                <div className="counter-time">
                  {elapsed}
                  {isOverTime && (
                    <span className="over-time-indicator">
                      ⚠️ Tempo excedido
                    </span>
                  )}
                </div>
                {selectedMotivo?.max_minutes && (
                  <div className="counter-limit">
                    Limite: {selectedMotivo.max_minutes} min
                  </div>
                )}
              </div>

              <div className="pause-actions">
                <button 
                  className="btn btn-secondary" 
                  onClick={handleClose}
                  disabled={loading}
                >
                  Minimizar
                </button>
                <button 
                  className={`btn ${isOverTime ? 'btn-warning' : 'btn-success'}`}
                  onClick={onResume}
                  disabled={loading}
                >
                  {loading ? (
                    <>
                      <span className="spinner"></span>
                      Retomando...
                    </>
                  ) : (
                    'Retomar Trabalho'
                  )}
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
