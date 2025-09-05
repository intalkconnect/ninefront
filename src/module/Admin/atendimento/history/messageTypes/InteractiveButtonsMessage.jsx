import React, { useMemo } from 'react';
import './styles/ButtonsMessage.css';

function normalizeInteractiveButtons(content) {
  // WhatsApp Cloud:
  // { type:'button', body:{text}, footer:{text}, action:{ buttons:[{type:'reply', reply:{id,title}}] } }
  const body   = content?.body?.text || content?.text || '';
  const footer = content?.footer?.text || '';
  const buttons = Array.isArray(content?.action?.buttons) ? content.action.buttons : [];
  const items = buttons.map(b => ({
    id: b?.reply?.id || b?.id || '',
    title: b?.reply?.title || b?.title || ''
  })).filter(x => x.title);
  return { body, footer, items };
}

export default function InteractiveButtonsMessage({ content }) {
  const { body, footer, items } = useMemo(() => normalizeInteractiveButtons(content), [content]);

  if (!items.length && !body) {
    return <div className="btns-wrap"><div className="btns-body">Conteúdo indisponível.</div></div>;
  }

  return (
    <div className="btns-wrap">
      {body && <div className="btns-body">{body}</div>}
      <div className="btns-stack">
        {items.map((b, i) => (
          <div key={b.id || i} className="btns-item" role="button" tabIndex={0}>{b.title}</div>
        ))}
      </div>
      {footer && <div className="btns-footer">{footer}</div>}
    </div>
  );
}
