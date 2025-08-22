// src/pages/Queues/QueueModal.jsx
import React, { useEffect, useMemo, useState, useCallback } from 'react';
import { Save as SaveIcon, Palette, RefreshCw, X as XIcon, AlertCircle } from 'lucide-react';
import { apiPost } from '../../../shared/apiClient';
import styles from './styles/Queues.module.css';

export default function QueueModal({ isOpen, onClose, onCreated }) {
  const [nome, setNome] = useState('');
  const [descricao, setDescricao] = useState('');
  const [color, setColor] = useState('');
  const [saving, setSaving] = useState(false);
  const [erro, setErro] = useState(null);

  // helpers (iguais aos do Queues original)
  const normalizeHexColor = (input) => {
    if (!input) return null;
    let c = String(input).trim();
    if (!c) return null;
    if (!c.startsWith('#')) c = `#${c}`;
    if (/^#([0-9a-fA-F]{3})$/.test(c)) {
      c = '#' + c.slice(1).split('').map(ch => ch + ch).join('');
    }
    return /^#([0-9a-fA-F]{6})$/.test(c) ? c.toUpperCase() : null;
  };
  const hslToHex = (h, s, l) => {
    s /= 100; l /= 100;
    const k = (n) => (n + h / 30) % 12;
    const a = s * Math.min(l, 1 - l);
    const f = (n) => l - a * Math.max(-1, Math.min(k(n) - 3, Math.min(9 - k(n), 1)));
    const toHex = (x) => Math.round(255 * x).toString(16).padStart(2, '0');
    return `#${toHex(f(0))}${toHex(f(8))}${toHex(f(4))}`.toUpperCase();
  };
  const randomPastelHex = () => {
    const h = Math.floor(Math.random() * 360);
    const s = 50 + Math.floor(Math.random() * 16);
    const l = 78 + Math.floor(Math.random() * 8);
    return hslToHex(h, s, l);
  };

  const previewColor = normalizeHexColor(color) || null;

  // fecha no ESC
  const onKeyDown = useCallback((e) => {
    if (e.key === 'Escape') onClose?.();
  }, [onClose]);

  useEffect(() => {
    if (!isOpen) return;
    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, [isOpen, onKeyDown]);

  // limpa campos ao abrir/fechar
  useEffect(() => {
    if (isOpen) {
      setNome('');
      setDescricao('');
      setColor('');
      setErro(null);
    }
  }, [isOpen]);

  const handleSortearCor = () => setColor(randomPastelHex());
  const handleLimparCor = () => setColor('');

  const submit = async (e) => {
    e.preventDefault();
    if (!nome.trim() || saving) return;
    setErro(null);
    try {
      setSaving(true);
      const payload = { nome: nome.trim() };
      const d = descricao.trim();
      if (d) payload.descricao = d;
      const norm = normalizeHexColor(color);
      if (norm) payload.color = norm;

      await apiPost('/filas', payload);
      onCreated?.();           // avisa o pai pra recarregar lista/toast
      onClose?.();             // fecha modal
    } catch (err) {
      console.error(err);
      setErro('Erro ao criar fila.');
    } finally {
      setSaving(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className={styles.modalOverlay} onMouseDown={onClose}>
      <div
        className={styles.modal}
        role="dialog"
        aria-modal="true"
        aria-labelledby="criar-fila-title"
        onMouseDown={(e) => e.stopPropagation()} // impede fechar ao clicar dentro
      >
        <div className={styles.modalHeader}>
          <h2 id="criar-fila-title" className={styles.modalTitle}>Nova fila</h2>
          <button className={`${styles.btn} ${styles.iconOnly}`} onClick={onClose} aria-label="Fechar">
            <XIcon size={16} />
          </button>
        </div>

        {erro && (
          <div className={styles.alertErr} role="alert" aria-live="assertive" style={{ margin: '0 22px' }}>
            <span className={styles.alertIcon} aria-hidden="true"><AlertCircle size={16} /></span>
            <span>{erro}</span>
          </div>
        )}

        <form onSubmit={submit}>
          <div className={styles.formInner}>
            <div className={styles.inputGroup}>
              <label className={styles.label} htmlFor="modal-nome">
                Nome da fila <span className={styles.req}>*</span>
              </label>
              <input
                id="modal-nome"
                className={styles.input}
                placeholder="Ex.: Suporte, Comercial, Financeiro…"
                value={nome}
                onChange={(e) => setNome(e.target.value)}
                autoFocus
              />
            </div>

            <div className={styles.inputGroup}>
              <label className={styles.label} htmlFor="modal-descricao">Descrição (opcional)</label>
              <textarea
                id="modal-descricao"
                className={styles.textarea}
                placeholder="Breve descrição da fila…"
                value={descricao}
                onChange={(e) => setDescricao(e.target.value)}
              />
            </div>

            <div className={styles.inputGroup}>
              <label className={styles.label} htmlFor="modal-color">Cor (opcional)</label>
              <div className={styles.colorRow}>
                <input
                  id="modal-color"
                  className={`${styles.input} ${styles.colorField}`}
                  placeholder="#RRGGBB (ex.: #4682B4)"
                  value={color}
                  onChange={(e) => setColor(e.target.value)}
                />
                <span className={styles.colorChip} title={previewColor || 'Aleatória ao salvar'}>
                  <span className={styles.colorSwatch} style={{ background: previewColor || '#ffffff' }} aria-hidden="true" />
                  <Palette size={16} aria-hidden="true" />
                  <span className={styles.hex}>{previewColor || 'aleatória'}</span>
                </span>
                <button type="button" className={styles.btnSecondary} onClick={handleSortearCor} title="Sortear cor">
                  <RefreshCw size={16} aria-hidden="true" />
                  Sortear cor
                </button>
                {color && (
                  <button type="button" className={styles.btn} onClick={handleLimparCor} title="Limpar cor informada">
                    <XIcon size={16} aria-hidden="true" />
                    Limpar
                  </button>
                )}
              </div>
            </div>
          </div>

          <div className={styles.modalActions}>
            <button type="button" className={styles.btn} onClick={onClose}>Cancelar</button>
            <button className={styles.btnPrimary} type="submit" disabled={!nome.trim() || saving}>
              <SaveIcon size={16} aria-hidden="true" />
              {saving ? 'Salvando…' : 'Salvar'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
