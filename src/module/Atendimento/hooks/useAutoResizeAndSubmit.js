// src/hooks/useAutoResizeAndSubmit.js
import { useEffect } from 'react';

/**
 * @param textareaRef => ref para o elemento <textarea>
 * @param onSubmit => função a chamar quando o usuário apertar Enter sem Shift
 * @param [deps] => array opcional de dependências para reexecutar o resize
 */
export function useAutoResizeAndSubmit(textareaRef, onSubmit, deps = []) {
  // 1) Auto‐resize: toda vez que deps mudarem (normalmente o valor do texto), ajusta height
  useEffect(() => {
    const ta = textareaRef.current;
    if (!ta) return;
    ta.style.height = 'auto';
    ta.style.height = `${ta.scrollHeight}px`;
  }, deps);

  // 2) KeyDown handler: Enter vs Shift+Enter
  useEffect(() => {
    const ta = textareaRef.current;
    if (!ta) return;

    const handleKeyDown = (e) => {
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        if (typeof onSubmit === 'function') {
          onSubmit(e);
        }
      }
    };

    ta.addEventListener('keydown', handleKeyDown);
    return () => {
      ta.removeEventListener('keydown', handleKeyDown);
    };
  }, [onSubmit]);
}
