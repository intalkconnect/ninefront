import React, { useMemo } from 'react';
import './styles/ListMessage.css';

function normalizeInteractiveList(content) {
  // WhatsApp Cloud:
  // { type: 'list', body:{text}, footer:{text}, action:{ sections:[{title, rows:[{id,title,description}]}] } }
  const body   = content?.body?.text || content?.text || '';
  const footer = content?.footer?.text || '';
  const sections = Array.isArray(content?.action?.sections) ? content.action.sections : [];
  const rows = sections.flatMap(s => (s?.rows || []).map(r => ({
    id: r.id || r.row_id || r.key || '',
    title: r.title || r.text || '',
    description: r.description || r.subtitle || ''
  })));
  return { body, footer, rows };
}

export default function InteractiveListMessage({ content }) {
  const { body, footer, rows } = useMemo(() => normalizeInteractiveList(content), [content]);

  if (!rows.length && !body) {
    return <div className="list-container"><div className="list-body-text">Conteúdo indisponível.</div></div>;
  }

  return (
    <div className="list-container">
      {body && <p className="list-body-text">{body}</p>}
      <div className="list-section" role="list">
        {rows.map((r, i) => (
          <div key={r.id || i} className="list-row" role="button" tabIndex={0}>
            <div className="list-row-title">{r.title}</div>
            {/* descrição e preview ocultos por CSS, permanecem aqui se quiser reativar depois */}
            {r.description && <div className="list-row-description">{r.description}</div>}
          </div>
        ))}
      </div>
      {footer && <div className="list-footer">{footer}</div>}
    </div>
  );
}
