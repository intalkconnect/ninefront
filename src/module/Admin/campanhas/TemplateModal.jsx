import React, { useMemo, useState } from 'react';
import { apiPost } from '../../../shared/apiClient';
import styles from './styles/Templates.module.css';
import { X as XIcon, Save as SaveIcon, Type, Image as ImgIcon, FileText, Film } from 'lucide-react';

const CATEGORIES = [
  { value: 'UTILITY', label: 'Utility' },
  { value: 'MARKETING', label: 'Marketing' },
  { value: 'AUTHENTICATION', label: 'Authentication' },
];

const HEADER_TYPES = [
  { value: 'TEXT', label: 'Texto', icon: Type },
  { value: 'IMAGE', label: 'Imagem', icon: ImgIcon },
  { value: 'DOCUMENT', label: 'Documento', icon: FileText },
  { value: 'VIDEO', label: 'Vídeo', icon: Film },
];

export default function TemplateModal({ isOpen, onClose, onCreated }) {
  const [name, setName] = useState('');
  const [language, setLanguage] = useState('pt_BR');
  const [category, setCategory] = useState('UTILITY');

  const [headerType, setHeaderType] = useState('TEXT');
  const [headerText, setHeaderText] = useState('');     // usado para header TEXT

  const [bodyText, setBodyText] = useState('');
  const [footerText, setFooterText] = useState('');

  // Avançado (opcional)
  const [buttonsJson, setButtonsJson] = useState('');
  const [exampleJson, setExampleJson] = useState('');

  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState(null);

  const canSave = useMemo(() => {
    if (!name.trim()) return false;
    if (!bodyText.trim()) return false;
    if (headerType === 'TEXT' && !headerText.trim()) return false;
    return true;
  }, [name, bodyText, headerType, headerText]);

  async function handleSave(e) {
    e.preventDefault();
    if (!canSave || saving) return;
    setSaving(true);
    setErr(null);

    try {
      let buttons = null;
      let example = null;
      if (buttonsJson.trim()) {
        try { buttons = JSON.parse(buttonsJson); }
        catch { throw new Error('JSON inválido em "Buttons".'); }
      }
      if (exampleJson.trim()) {
        try { example = JSON.parse(exampleJson); }
        catch { throw new Error('JSON inválido em "Exemplo".'); }
      }

      const payload = {
        name: name.trim(),
        language_code: language.trim() || 'pt_BR',
        category,
        header_type: headerType,                         // TEXT/IMAGE/DOCUMENT/VIDEO
        header_text: headerType === 'TEXT' ? headerText.trim() : null,
        body_text: bodyText.trim(),
        footer_text: footerText.trim() || null,
        buttons,
        example,
      };

      await apiPost('/templates', payload);
      onCreated?.();
    } catch (e) {
      console.error('Erro ao criar template:', e);
      setErr(e?.message || 'Falha ao criar template.');
    } finally {
      setSaving(false);
    }
  }

  if (!isOpen) return null;

  return (
    <div className={styles.modalOverlay} role="dialog" aria-modal="true" aria-label="Criar template">
      <div className={styles.modal}>
        <div className={styles.modalHeader}>
          <h3 className={styles.modalTitle}>Novo modelo de mensagem</h3>
          <button className={styles.btn} onClick={onClose} aria-label="Fechar">
            <XIcon size={16} />
          </button>
        </div>

        <form onSubmit={handleSave}>
          <div className={styles.formGrid}>

            {err && <div className={styles.alertErr}>{err}</div>}

            <div className={styles.inputGroup}>
              <label className={styles.label} htmlFor="tpl-name">Nome do modelo *</label>
              <input
                id="tpl-name"
                className={styles.input}
                placeholder="use letras minúsculas, números ou underscore"
                value={name}
                onChange={(e) => setName(e.target.value)}
                autoFocus
                required
              />
            </div>

            <div className={styles.inputGroup}>
              <label className={styles.label} htmlFor="tpl-category">Categoria *</label>
              <select
                id="tpl-category"
                className={`${styles.input} ${styles.select}`}
                value={category}
                onChange={(e) => setCategory(e.target.value)}
                required
              >
                {CATEGORIES.map(c => <option key={c.value} value={c.value}>{c.label}</option>)}
              </select>
            </div>

            <div className={styles.inputGroup}>
              <label className={styles.label} htmlFor="tpl-language">Idioma *</label>
              <input
                id="tpl-language"
                className={styles.input}
                placeholder="pt_BR"
                value={language}
                onChange={(e) => setLanguage(e.target.value)}
                required
              />
              <div className={styles.inputHelper}>Formato: pt_BR, en_US, es_ES…</div>
            </div>

            {/* Tipo de header (tabs) */}
            <div className={styles.inputGroup}>
              <label className={styles.label}>Cabeçalho</label>
              <div className={styles.headerTabs}>
                {HEADER_TYPES.map(h => {
                  const Icon = h.icon;
                  const active = headerType === h.value;
                  return (
                    <button
                      key={h.value}
                      type="button"
                      className={`${styles.headerTab} ${active ? styles.headerTabActive : ''}`}
                      onClick={() => setHeaderType(h.value)}
                    >
                      <Icon size={18} /> {h.label}
                    </button>
                  );
                })}
              </div>
              {headerType === 'TEXT' && (
                <input
                  className={styles.input}
                  placeholder="Texto do cabeçalho (opcional, mas recomendado)"
                  value={headerText}
                  onChange={(e) => setHeaderText(e.target.value)}
                />
              )}
            </div>

            <div className={styles.inputGroup}>
              <label className={styles.label} htmlFor="tpl-body">Corpo *</label>
              <textarea
                id="tpl-body"
                className={styles.textarea}
                placeholder="Olá {{1}}, seu pedido {{2}} foi enviado…"
                rows={6}
                value={bodyText}
                onChange={(e) => setBodyText(e.target.value)}
                required
              />
              <div className={styles.inputHelper}>
                Use placeholders <code>{"{{1}}"}</code>, <code>{"{{2}}"}</code>… conforme necessário.
              </div>
            </div>

            <div className={styles.inputGroup}>
              <label className={styles.label} htmlFor="tpl-footer">Rodapé (opcional)</label>
              <input
                id="tpl-footer"
                className={styles.input}
                placeholder="Mensagem do rodapé"
                value={footerText}
                onChange={(e) => setFooterText(e.target.value)}
              />
            </div>

            {/* Avançado */}
            <div className={styles.inputGroup}>
              <label className={styles.label}>Botões (JSON opcional)</label>
              <textarea
                className={styles.textarea}
                rows={4}
                placeholder='Ex.: [{"type":"URL","text":"Ver pedido","url":"https://exemplo.com/{{1}}"}]'
                value={buttonsJson}
                onChange={(e) => setButtonsJson(e.target.value)}
              />
            </div>

            <div className={styles.inputGroup}>
              <label className={styles.label}>Exemplo (JSON opcional)</label>
              <textarea
                className={styles.textarea}
                rows={4}
                placeholder='Estrutura Meta "example" (opcional)'
                value={exampleJson}
                onChange={(e) => setExampleJson(e.target.value)}
              />
            </div>
          </div>

          <div className={styles.modalActions}>
            <button type="button" className={styles.btn} onClick={onClose}>Cancelar</button>
            <button type="submit" className={styles.btnPrimary} disabled={!canSave || saving}>
              <SaveIcon size={16} /> {saving ? 'Salvando…' : 'Enviar para avaliação'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
