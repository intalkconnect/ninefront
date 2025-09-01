import React, { useMemo, useRef, useState } from 'react';
import styles from './styles/Campaigns.module.css';
import { X as XIcon, Upload, Calendar, Clock, Send } from 'lucide-react';

/**
 * Modal de criação/envio de campanha
 *
 * Props:
 * - isOpen: boolean
 * - onClose: () => void
 * - onCreated: (payload) => void   // chamado com o JSON retornado pelo POST
 *
 * Observação:
 * - Faz POST multipart em "/campaigns" com:
 *   - file: CSV
 *   - meta: JSON string { name, start_at?, template: { name, language: { code }, components? } }
 */
export default function CampaignCreateModal({ isOpen, onClose, onCreated }) {
  const [name, setName] = useState('');
  const [templateName, setTemplateName] = useState('');
  const [languageCode, setLanguageCode] = useState('pt_BR');
  const [componentsStr, setComponentsStr] = useState(''); // JSON opcional
  const [mode, setMode] = useState('now'); // 'now' | 'schedule'
  const [startAt, setStartAt] = useState(''); // datetime-local
  const [file, setFile] = useState(null);

  const [submitting, setSubmitting] = useState(false);
  const [err, setErr] = useState(null);

  const fileInputRef = useRef(null);

  const isValid = useMemo(() => {
    if (!name.trim()) return false;
    if (!templateName.trim()) return false;
    if (!languageCode.trim()) return false;
    if (!file) return false;
    if (mode === 'schedule' && !startAt) return false;
    // valida JSON (components) se preenchido
    if (componentsStr.trim()) {
      try { JSON.parse(componentsStr); } catch { return false; }
    }
    return true;
  }, [name, templateName, languageCode, file, mode, startAt, componentsStr]);

  function toIso(dtLocal) {
    // dtLocal formato "YYYY-MM-DDTHH:mm"
    if (!dtLocal) return null;
    const d = new Date(dtLocal);
    if (Number.isNaN(d.getTime())) return null;
    return d.toISOString();
  }

  async function handleSubmit(e) {
    e.preventDefault();
    if (!isValid || submitting) return;

    setSubmitting(true);
    setErr(null);
    try {
      const meta = {
        name: name.trim(),
        start_at: mode === 'schedule' ? toIso(startAt) : null,
        template: {
          name: templateName.trim(),
          language: { code: languageCode.trim() }
        }
      };

      if (componentsStr.trim()) {
        try {
          meta.template.components = JSON.parse(componentsStr);
        } catch {
          throw new Error('Components inválido: informe um JSON válido.');
        }
      }

      const fd = new FormData();
      fd.append('file', file, file.name);
      fd.append('meta', JSON.stringify(meta));

      // Usa o mesmo caminho base do seu apiGet('/campaigns').
      // Se sua API estiver em /api/v1/campaigns, ajuste essa URL.
      const res = await fetch('/campaigns', {
        method: 'POST',
        body: fd,
        credentials: 'include'
      });
      if (!res.ok) {
        const txt = await res.text().catch(() => '');
        throw new Error(txt || `Falha ao criar campanha (HTTP ${res.status})`);
      }
      const payload = await res.json();

      // limpa estado e fecha
      setName('');
      setTemplateName('');
      setLanguageCode('pt_BR');
      setComponentsStr('');
      setMode('now');
      setStartAt('');
      setFile(null);
      if (fileInputRef.current) fileInputRef.current.value = '';

      onCreated?.(payload);
      onClose?.();
    } catch (e) {
      setErr(e?.message || 'Erro ao criar campanha.');
    } finally {
      setSubmitting(false);
    }
  }

  if (!isOpen) return null;

  return (
    <div className={styles.modalOverlay} onClick={onClose}>
      <div className={styles.modal} onClick={(e) => e.stopPropagation()} role="dialog" aria-modal="true">
        <div className={styles.modalHeader}>
          <h2 className={styles.modalTitle}>Nova campanha</h2>
          <button className={styles.alertClose} onClick={onClose} aria-label="Fechar">
            <XIcon size={16}/>
          </button>
        </div>

        <form onSubmit={handleSubmit}>
          <div className={styles.modalBody}>
            <div className={styles.formGrid}>
              {/* Nome */}
              <div className={styles.field}>
                <label className={styles.label} htmlFor="cmp-name">Nome da campanha</label>
                <input
                  id="cmp-name"
                  className={styles.input}
                  placeholder="Ex.: Black Friday 2025 - Lote 1"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                />
                <div className={styles.inputHelper}>Um rótulo para identificar esta campanha.</div>
              </div>

              {/* Template + idioma */}
              <div className={styles.field}>
                <label className={styles.label} htmlFor="cmp-template">Template (nome)</label>
                <input
                  id="cmp-template"
                  className={styles.input}
                  placeholder="Ex.: hello_world"
                  value={templateName}
                  onChange={(e) => setTemplateName(e.target.value)}
                />
              </div>

              <div className={styles.field}>
                <label className={styles.label} htmlFor="cmp-lang">Idioma (language_code)</label>
                <input
                  id="cmp-lang"
                  className={styles.input}
                  placeholder="Ex.: pt_BR"
                  value={languageCode}
                  onChange={(e) => setLanguageCode(e.target.value)}
                />
              </div>

              {/* Components (JSON) opcional */}
              <div className={styles.fieldWide}>
                <label className={styles.label} htmlFor="cmp-components">Components (JSON) — opcional</label>
                <textarea
                  id="cmp-components"
                  className={styles.textarea}
                  rows={4}
                  placeholder='Ex.: [{"type":"body","parameters":[{"type":"text","text":"{nome}"}]}]'
                  value={componentsStr}
                  onChange={(e) => setComponentsStr(e.target.value)}
                />
                <div className={styles.inputHelper}>
                  Deixe vazio se o template não exigir variáveis. Use JSON válido.
                </div>
              </div>

              {/* CSV */}
              <div className={styles.fieldWide}>
                <label className={styles.label}>Arquivo CSV</label>
                <div className={styles.fileRow}>
                  <input
                    ref={fileInputRef}
                    className={styles.fileInput}
                    type="file"
                    accept=".csv,text/csv"
                    onChange={(e) => setFile(e.target.files?.[0] || null)}
                  />
                  <span className={styles.fileBadge}>
                    <Upload size={16} /> {file?.name || 'Selecione um arquivo…'}
                  </span>
                </div>
                <div className={styles.inputHelper}>
                  O CSV deve ter a coluna <strong>to</strong> (E.164) e, opcionalmente, colunas com variáveis usadas nos components.
                </div>
              </div>

              {/* Modo: imediata x agendada */}
              <div className={styles.fieldWide}>
                <div className={styles.label}>Disparo</div>
                <div className={styles.radioRow} role="radiogroup" aria-label="Modo de envio">
                  <label className={styles.opt}>
                    <input
                      type="radio"
                      name="cmp-mode"
                      value="now"
                      checked={mode === 'now'}
                      onChange={() => setMode('now')}
                    />
                    <span><Send size={14}/> Imediata</span>
                  </label>
                  <label className={styles.opt}>
                    <input
                      type="radio"
                      name="cmp-mode"
                      value="schedule"
                      checked={mode === 'schedule'}
                      onChange={() => setMode('schedule')}
                    />
                    <span><Calendar size={14}/> Agendada</span>
                  </label>
                </div>

                {mode === 'schedule' && (
                  <div className={styles.inlineRow}>
                    <div className={styles.field}>
                      <label className={styles.label} htmlFor="cmp-start">Data e hora</label>
                      <div className={styles.inputIconWrap}>
                        <input
                          id="cmp-start"
                          className={styles.input}
                          type="datetime-local"
                          value={startAt}
                          onChange={(e) => setStartAt(e.target.value)}
                        />
                        <Clock className={styles.inputIcon} size={16}/>
                      </div>
                      <div className={styles.inputHelper}>
                        O scheduler disparará no horário definido (UTC do servidor).
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </div>

            {err && <div className={styles.alertErr} role="alert">⚠️ {err}</div>}
          </div>

          <div className={styles.modalActions}>
            <button type="button" className={styles.btn} onClick={onClose}>
              <XIcon size={14}/> Cancelar
            </button>
            <button type="submit" className={styles.btnPrimary} disabled={!isValid || submitting}>
              {submitting ? 'Enviando…' : 'Criar campanha'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
