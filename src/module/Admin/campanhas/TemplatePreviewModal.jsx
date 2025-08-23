import React from 'react';
import styles from './styles/Templates.module.css';
import { X as XIcon } from 'lucide-react';

function Row({ k, v }) {
  return (
    <div style={{display:'grid', gridTemplateColumns:'160px 1fr', gap:'8px', alignItems:'start'}}>
      <div style={{color:'#6b7280', fontWeight:700}}>{k}</div>
      <div>{v ?? '—'}</div>
    </div>
  );
}

export default function TemplatePreviewModal({ isOpen, template, onClose }) {
  if (!isOpen || !template) return null;

  return (
    <div className={styles.modalOverlay} role="dialog" aria-modal="true" aria-label="Prévia do template">
      <div className={styles.modal}>
        <div className={styles.modalHeader}>
          <h3 className={styles.modalTitle}>Prévia — {template.name}</h3>
          <button className={styles.btn} onClick={onClose} aria-label="Fechar">
            <XIcon size={16} />
          </button>
        </div>

        <div className={styles.formGrid}>
          <Row k="Categoria" v={template.category} />
          <Row k="Idioma" v={template.language_code} />
          <Row k="Status" v={template.status} />
          <Row k="Score" v={template.score} />
          {template.provider_id ? <Row k="provider_id" v={template.provider_id} /> : null}

          <div className={styles.preview}>
            {template.header_type && template.header_type !== 'NONE' && template.header_text
              ? <div className={styles.previewHeader}>[HEADER] {template.header_text}</div>
              : null}
            <pre className={styles.code}>{template.body_text || '—'}</pre>
            {template.footer_text
              ? <div className={styles.previewFooter}>[FOOTER] {template.footer_text}</div>
              : null}
          </div>
        </div>

        <div className={styles.modalActions}>
          <button className={styles.btn} onClick={onClose}>Fechar</button>
        </div>
      </div>
    </div>
  );
}
