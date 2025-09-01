import React, { useEffect, useMemo, useRef, useState } from 'react';
import styles from './styles/Campaigns.module.css';
import { X as XIcon, Upload, Calendar, Clock, Send } from 'lucide-react';
import { apiGet } from '../../../shared/apiClient';

export default function CampaignCreateModal({ isOpen, onClose, onCreated }) {
  const [name, setName] = useState('');
  const [templates, setTemplates] = useState([]);
  const [tplId, setTplId] = useState('');
  const [mode, setMode] = useState('now'); // now | schedule
  const [startAt, setStartAt] = useState('');
  const [file, setFile] = useState(null);

  const [submitting, setSubmitting] = useState(false);
  const [err, setErr] = useState(null);

  const fileInputRef = useRef(null);

  // carrega templates aprovados quando abrir
  useEffect(() => {
    if (!isOpen) return;
    (async () => {
      try {
        const data = await apiGet('/templates?status=approved');
        const list = Array.isArray(data) ? data : [];
        setTemplates(list);
        // seleciona o primeiro por padrão (se existir)
        if (list.length && !tplId) setTplId(String(list[0].id || list[0].name));
      } catch (e) {
        console.warn('Falha ao carregar templates aprovados:', e?.message || e);
        setTemplates([]);
      }
    })();
  }, [isOpen]); // eslint-disable-line react-hooks/exhaustive-deps

  const selectedTemplate = useMemo(() => {
    // tenta achar por id; se backend não devolver id, cai para name
    return (
      templates.find(t => String(t.id) === String(tplId)) ||
      templates.find(t => String(t.name) === String(tplId)) ||
      null
    );
  }, [templates, tplId]);

  const languageCode = selectedTemplate?.language_code || selectedTemplate?.language?.code || '';

  const isValid = useMemo(() => {
    if (!name.trim()) return false;
    if (!selectedTemplate) return false;
    if (!file) return false;
    if (mode === 'schedule' && !startAt) return false;
    return true;
  }, [name, selectedTemplate, file, mode, startAt]);

  function toIso(dtLocal) {
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
          name: selectedTemplate.name,
          language: { code: languageCode }
        }
        // sem components — virá do CSV
      };

      const fd = new FormData();
      fd.append('file', file, file.name);
      fd.append('meta', JSON.stringify(meta));

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

      // reset
      setName('');
      setTplId(templates[0]?.id ? String(templates[0].id) : '');
      setMode('now');
      setStartAt('');
      setFile(null);
      if (fileInputRef.current) fileInputRef.current.value = '';

      onCreated?.(payload);
      onClose?.();
    } catch (e2) {
      setErr(e2?.message || 'Erro ao criar campanha.');
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

              {/* Template (listbox com aprovados) */}
              <div className={styles.field}>
                <label className={styles.label} htmlFor="cmp-template">Template aprovado</label>
                <select
                  id="cmp-template"
                  className={styles.select}
                  value={tplId}
                  onChange={(e) => setTplId(e.target.value)}
                >
                  {templates.map(t => {
                    const key = String(t.id ?? t.name);
                    const lang = t.language_code || t.language?.code || '';
                    return (
                      <option key={key} value={key}>
                        {t.name}{lang ? ` — ${lang}` : ''}
                      </option>
                    );
                  })}
                  {templates.length === 0 && (
                    <option value="">Nenhum template aprovado</option>
                  )}
                </select>
                {selectedTemplate && (
                  <div className={styles.inputHelper}>
                    Idioma do template: <strong>{languageCode || '—'}</strong>
                  </div>
                )}
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
                  O CSV deve ter a coluna <strong>to</strong> (E.164) e colunas com variáveis usadas no template.
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
