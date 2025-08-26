import React from 'react';
import styles from './styles/Templates.module.css';
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

export default function TemplatePreviewModal({ isOpen, template, onClose }) {
  if (!isOpen || !template) return null;

  const btns = parseButtons(template.buttons);
  const isMediaHeader =
    template.header_type &&
    template.header_type !== 'NONE' &&
    template.header_type !== 'TEXT';

  return (
    <div className={styles.modalOverlay} role="dialog" aria-modal="true" aria-label="Prévia do template" onClick={onClose}>
      <div className={styles.modal} onClick={(e)=>e.stopPropagation()}>
        <div className={styles.modalHeader}>
          <h3 className={styles.modalTitle}>Prévia — {template.name}</h3>
          <button className={styles.alertClose} onClick={onClose} aria-label="Fechar">
            <XIcon size={16} />
          </button>
        </div>

        <div className={styles.modalBody}>
          {/* PHONE / CARD */}
          <div className={styles.waCard}>
            <div className={styles.waTopBar}>Seu modelo</div>
            <div className={styles.waScreen}>
              {/* (opcional) mídia no cabeçalho */}
              {isMediaHeader && (
                <div className={styles.waAttachment}>
                  {template.header_type === 'IMAGE'    && '📷 Imagem'}
                  {template.header_type === 'VIDEO'    && '🎬 Vídeo'}
                  {template.header_type === 'DOCUMENT' && '📄 Documento'}
                </div>
              )}

              {/* bolha da mensagem */}
              <div className={styles.waBubble}>
                {template.header_type === 'TEXT' && template.header_text && (
                  <div className={styles.waHeader}>{template.header_text}</div>
                )}

                <div className={styles.waBody}>
                  {(template.body_text || '—').split('\n').map((line, i) => (
                    <div key={i}>{line || <>&nbsp;</>}</div>
                  ))}
                </div>

                {template.footer_text && (
                  <div className={styles.waFooter}>
                    {template.footer_text}
                  </div>
                )}

                <div className={styles.waTime}>{fmtTime()}</div>
              </div>

              {/* botões do template */}
              {btns.length > 0 && (
                <div className={styles.waButtons}>
                  {btns.map((b, i) => (
                    <button
                      key={i}
                      type="button"
                      className={
                        (b?.type || '').toUpperCase() === 'QUICK_REPLY'
                          ? styles.waBtnReply
                          : styles.waBtnCta
                      }
                      title={b?.type || 'BUTTON'}
                      onClick={(e)=>e.preventDefault()}
                    >
                      {b?.text || b?.title || 'Botão'}
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>

        <div className={styles.modalActions}>
          <button className={styles.pill} onClick={onClose}><XIcon size={14}/> Fechar</button>
        </div>
      </div>
    </div>
  );
}
