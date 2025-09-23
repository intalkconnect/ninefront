import React, { useEffect, useMemo, useRef, useState } from 'react';
import styles from './styles/TemplatePreview.module.css';
import { X as XIcon } from 'lucide-react';

function parseButtons(raw) {
  try {
    if (!raw) return [];
    if (Array.isArray(raw)) return raw;
    if (typeof raw === 'string') return JSON.parse(raw);
    if (typeof raw === 'object' && Array.isArray(raw.buttons)) return raw.buttons;
    return [];
  } catch { return []; }
}

function fmtTime(d = new Date()) {
  return d.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
}

function extractVars(str = '') {
  const set = new Set();
  String(str).replace(/\{\{\s*(\d+)\s*\}\}/g, (_m, n) => set.add(Number(n)));
  return Array.from(set).sort((a,b)=>a-b);
}

function applyVars(str = '', values = {}) {
  return String(str).replace(/\{\{\s*(\d+)\s*\}\}/g, (_m, n) => {
    const v = values[n];
    return (v === 0 || v) ? String(v) : `{{${n}}}`;
  });
}

export default function TemplatePreviewModal({ isOpen, template, onClose }) {
  const overlayRef = useRef(null);
  const closeBtnRef = useRef(null);

  // guarda valores para substituir {{n}}
  const varKeys = useMemo(() => {
    const h = extractVars(template?.header_text);
    const b = extractVars(template?.body_text);
    return Array.from(new Set([...h, ...b]));
  }, [template]);

  const [vars, setVars] = useState({});
  const [dark, setDark] = useState(false);

  const btns = parseButtons(template?.buttons);
  const isMediaHeader =
    template?.header_type &&
    template.header_type !== 'NONE' &&
    template.header_type !== 'TEXT';

  useEffect(() => {
    if (!isOpen) return;
    // foco acessível
    closeBtnRef.current?.focus();
    const onKey = (e) => { if (e.key === 'Escape') onClose?.(); };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [isOpen, onClose]);

  useEffect(() => {
    // reset vars quando trocar de template
    const next = {};
    varKeys.forEach(k => { next[k] = vars[k] ?? ''; });
    setVars(next);
  }, [varKeys]); // eslint-disable-line react-hooks/exhaustive-deps

  if (!isOpen || !template) return null;

  // strings com variáveis aplicadas
  const headerText = applyVars(template.header_text, vars);
  const bodyText   = applyVars(template.body_text, vars);
  const footerText = template.footer_text;

  // mídia de cabeçalho (preview simples por URL)
  const mediaUrl = template.header_media_url || template.header_media || '';

  return (
    <div
      className={styles.tpOverlay}
      role="dialog"
      aria-modal="true"
      aria-label={`Prévia do template ${template.name}`}
      onClick={(e) => { if (e.target === overlayRef.current) onClose?.(); }}
      ref={overlayRef}
    >
      <div className={styles.tpModal} onClick={(e)=>e.stopPropagation()}>
        {/* Cabeçalho */}
        <div className={styles.tpHeader}>
          <div className={styles.tpHeaderLeft}>
            <h3 className={styles.tpTitle}>Prévia — {template.name}</h3>
            <div className={styles.metaChips}>
              {!!template.language_code && <span className={styles.chip}>{template.language_code}</span>}
              {!!template.category && <span className={styles.chipSec}>{template.category}</span>}
              {!!template.status && <span className={styles.chipMuted}>{template.status}</span>}
            </div>
          </div>

          <div className={styles.tpHeaderRight}>
            <label className={styles.themeToggle}>
              <input type="checkbox" checked={dark} onChange={(e)=>setDark(e.target.checked)} />
              <span>{dark ? 'Escuro' : 'Claro'}</span>
            </label>
            <button className={styles.tpClose} onClick={onClose} aria-label="Fechar" ref={closeBtnRef}>
              <XIcon size={16} />
            </button>
          </div>
        </div>

        {/* Área central: Controles + Telefone */}
        <div className={styles.tpBody}>
          {/* painel lateral de variáveis (aparece só se houver {{n}}) */}
          {varKeys.length > 0 && (
            <aside className={styles.varsPanel} aria-label="Valores de variáveis">
              <div className={styles.varsTitle}>Variáveis</div>
              <div className={styles.varsList}>
                {varKeys.map(k => (
                  <label key={k} className={styles.varRow}>
                    <span className={styles.varTag}>{`{{${k}}}`}</span>
                    <input
                      className={styles.varInput}
                      placeholder={`Ex.: valor ${k}`}
                      value={vars[k] ?? ''}
                      onChange={(e)=>setVars(v => ({ ...v, [k]: e.target.value }))}
                    />
                  </label>
                ))}
              </div>
              <div className={styles.varsHint}>Edite para ver a substituição ao vivo.</div>
            </aside>
          )}

          {/* PHONE / CARD */}
          <div className={`${styles.waCard} ${dark ? styles.dark : ''}`}>
            <div className={styles.waTopBar}>Seu modelo</div>
            <div className={styles.waScreen}>
              {/* mídia no cabeçalho */}
              {isMediaHeader && (
                <div className={styles.waAttachment} data-kind={template.header_type}>
                  {mediaUrl ? (
                    template.header_type === 'IMAGE' ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={mediaUrl} alt="Imagem do cabeçalho" className={styles.mediaImg} />
                    ) : template.header_type === 'VIDEO' ? (
                      <video src={mediaUrl} className={styles.mediaVid} controls />
                    ) : (
                      <div className={styles.mediaDoc}>📄 Documento</div>
                    )
                  ) : (
                    <div className={styles.mediaPlaceholder}>
                      {template.header_type === 'IMAGE' && '📷 Imagem'}
                      {template.header_type === 'VIDEO' && '🎬 Vídeo'}
                      {template.header_type === 'DOCUMENT' && '📄 Documento'}
                    </div>
                  )}
                </div>
              )}

              {/* bolha da mensagem */}
              <div className={styles.waBubble}>
                {template.header_type === 'TEXT' && headerText && (
                  <div className={styles.waHeader}>{headerText}</div>
                )}

                <div className={styles.waBody}>
                  {(bodyText || '—').split('\n').map((line, i) => (
                    <div key={i}>{line || <>&nbsp;</>}</div>
                  ))}
                </div>

                {footerText && <div className={styles.waFooter}>{footerText}</div>}

                <div className={styles.waTime}>{fmtTime()}</div>
              </div>

              {/* botões do template */}
              {btns.length > 0 && (
                <div className={styles.waButtons}>
                  {btns.map((b, i) => {
                    const t = (b?.type || '').toUpperCase();
                    const text = b?.text || b?.title || 'Botão';
                    return (
                      <button
                        key={i}
                        type="button"
                        className={t === 'QUICK_REPLY' ? styles.waBtnReply : styles.waBtnCta}
                        title={b?.type || 'BUTTON'}
                        onClick={(e)=>e.preventDefault()}
                        disabled
                      >
                        {text}
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Rodapé */}
        <div className={styles.tpFooter}>
          <button className={styles.btnPrimary} onClick={onClose}>Fechar</button>
        </div>
      </div>
    </div>
  );
}
