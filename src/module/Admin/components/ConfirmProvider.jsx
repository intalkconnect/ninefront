import React, { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';

const ConfirmCtx = createContext(null);
export function useConfirm() {
  const ctx = useContext(ConfirmCtx);
  if (!ctx) throw new Error('useConfirm deve ser usado dentro de <ConfirmProvider>');
  return ctx.confirm;
}

/**
 * options:
 * - title: string
 * - description?: string | ReactNode
 * - confirmText?: string (default: Confirmar)
 * - cancelText?: string (default: Cancelar)
 * - tone?: 'danger' | 'success' | 'warning' | 'info' | 'default'
 * - destructive?: boolean (alias de tone='danger')
 */
export function ConfirmProvider({ children }) {
  const [queue, setQueue] = useState([]);        // múltiplas chamadas viram fila
  const current = queue[0] || null;
  const resolverRef = useRef(null);
  const overlayRef = useRef(null);
  const confirmBtnRef = useRef(null);

  const confirm = useCallback((options) => {
    return new Promise((resolve) => {
      setQueue((q) => [...q, options || {}]);
      resolverRef.current = resolve;
    });
  }, []);

  // trava scroll do body quando aberto
  useEffect(() => {
    if (current) {
      const prev = document.body.style.overflow;
      document.body.style.overflow = 'hidden';
      return () => { document.body.style.overflow = prev; };
    }
  }, [current]);

  // foco inicial no botão confirmar
  useEffect(() => {
    if (current && confirmBtnRef.current) {
      setTimeout(() => confirmBtnRef.current?.focus(), 0);
    }
  }, [current]);

  const close = (result) => {
    const resolve = resolverRef.current;
    resolverRef.current = null;
    setQueue((q) => q.slice(1));
    resolve?.(result);
  };

  const onKeyDown = (e) => {
    if (e.key === 'Escape') close(false);
    if (e.key === 'Tab') {
      // simples foco cíclico: mantém o foco dentro do modal
      const focusables = overlayRef.current?.querySelectorAll(
        'button,[href],input,select,textarea,[tabindex]:not([tabindex="-1"])'
      );
      if (!focusables || focusables.length === 0) return;
      const list = Array.from(focusables);
      const first = list[0];
      const last = list[list.length - 1];
      if (e.shiftKey && document.activeElement === first) {
        last.focus(); e.preventDefault();
      } else if (!e.shiftKey && document.activeElement === last) {
        first.focus(); e.preventDefault();
      }
    }
  };

  const tone = (current?.destructive && 'danger') || current?.tone || 'default';

  return (
    <ConfirmCtx.Provider value={{ confirm }}>
      {children}

      {current &&
        createPortal(
          <div
            className="confirm-overlay"
            role="dialog"
            aria-modal="true"
            aria-labelledby="confirm-title"
            onKeyDown={onKeyDown}
          >
            <div className={`confirm-dialog tone-${tone}`} ref={overlayRef}>
              <div className="confirm-header">
                <div className={`confirm-icon tone-${tone}`} aria-hidden>!</div>
                <h3 id="confirm-title" className="confirm-title">
                  {current.title || 'Confirmar ação'}
                </h3>
              </div>

              {current.description && (
                <div className="confirm-description">
                  {current.description}
                </div>
              )}

              <div className="confirm-actions">
                <button
                  type="button"
                  className="btn btn-ghost"
                  onClick={() => close(false)}
                >
                  {current.cancelText || 'Cancelar'}
                </button>
                <button
                  type="button"
                  className={`btn btn-solid ${tone === 'danger' ? 'btn-danger' : ''}`}
                  onClick={() => close(true)}
                  ref={confirmBtnRef}
                >
                  {current.confirmText || 'Confirmar'}
                </button>
              </div>
            </div>
          </div>,
          document.body
        )}
    </ConfirmCtx.Provider>
  );
}
