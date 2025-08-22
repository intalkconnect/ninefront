// src/pages/QuickReplies/QuickReplyModal.jsx
import React, { useEffect, useState, useCallback } from 'react';
import { Save as SaveIcon, X as XIcon, AlertCircle } from 'lucide-react';
import { apiPost } from '../../../shared/apiClient';
import styles from './styles/QuickReplies.module.css';

export default function QuickReplyModal({ isOpen, onClose, onCreated }) {
  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);

  const escClose = useCallback((e) => { if (e.key === 'Escape') onClose?.(); }, [onClose]);
  useEffect(() => {
    if (!isOpen) return;
    document.addEventListener('keydown', escClose);
    return () => document.removeEventListener('keydown', escClose);
  }, [isOpen, escClose]);

  useEffect(() => {
    if (isOpen) { setTitle(''); setContent(''); setError(null); setSaving(false); }
  }, [isOpen]);

  const submit = async (e) => {
    e.preventDefault();
    const t = title.trim(); const c = content.trim();
    if (!t || !c) { setError('Por favor, preencha o título e o conteúdo.'); return; }
    if (t.length > 100) { setError('O título deve ter no máximo 100 caracteres.'); return; }

    setSaving(true); setError(null);
    try {
      await apiPost('/quickReplies', { title: t, content: c });
      onCreated?.();
      onClose?.();
    } catch (err) {
      console.error(err);
      setError('Erro ao criar resposta. Tente novamente.');
    } finally { setSaving(false); }
  };

  if (!isOpen) return null;

  return (
    <div className={styles.modalOverlay} onMouseDown={onClose}>
      <div className={styles.modal} role="dialog" aria-modal="true" aria-labelledby="qr-create-title"
           onMouseDown={(e) => e.stopPropagation()}>
        <div className={styles.modalHeader}>
          <h2 id="qr-create-title" className={styles.modalTitle}>Nova resposta rápida</h2>
          <button type="button" className={`${styles.btn} ${styles.iconOnly}`} onClick={onClose} aria-label="Fechar">
            <XIcon size={16} />
          </button>
        </div>

        {error && (
          <div className={styles.alertErr} role="alert" aria-live="assertive" style={{ margin: '0 22px' }}>
            <span className={styles.alertIcon} aria-hidden="true"><AlertCircle size={16} /></span>
            <span>{error}</span>
          </div>
        )}

        <form onSubmit={submit}>
          <div className={styles.formInner} style={{ paddingTop: 22 }}>
            <div className={styles.inputGroup}>
              <label htmlFor="qr-title" className={styles.label}>Título *</label>
              <input
                id="qr-title"
                className={styles.input}
                placeholder="Ex.: Saudação inicial"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                maxLength={100}
                autoFocus
              />
              <div className={styles.inputHelper}>{title.length}/100 caracteres</div>
            </div>

            <div className={styles.inputGroup}>
              <label htmlFor="qr-content" className={styles.label}>Conteúdo *</label>
              <textarea
                id="qr-content"
                className={styles.textarea}
                rows={5}
                placeholder="Digite o conteúdo da resposta rápida…"
                value={content}
                onChange={(e) => setContent(e.target.value)}
              />
              <div className={styles.inputHelper}>{content.length} caracteres</div>
            </div>
          </div>

          <div className={styles.modalActions}>
            <button type="button" className={styles.btn} onClick={onClose}>Cancelar</button>
            <button type="submit" className={styles.btnPrimary} disabled={saving}>
              <SaveIcon size={16} />
              {saving ? 'Salvando…' : 'Salvar'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
