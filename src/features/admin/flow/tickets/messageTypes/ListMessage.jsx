// src/components/ChatWindow/messageTypes/ListMessage.jsx
import React from 'react';
import './styles/ListMessage.css';

/**
 * Aceita as props:
 * - listData  (preferida)
 * - data      (compat)
 * - quickData (compat legado)
 */
export default function ListMessage(props) {
  const listData = props.listData || props.data || props.quickData || {};
  const small = props.small;

  if (small) {
    // Mostra apenas um resumo textual (modo reply)
    return (
      <div className="list-preview">
        📋 {listData?.header?.text || listData?.body?.text || '[Lista]'}
      </div>
    );
  }

  const sections = listData?.action?.sections ?? [];

  return (
    <div className="list-container">
      {listData?.header?.text ? (
        <h4 style={{ margin: 0, fontSize: '14px', color: '#111b21' }}>
          {listData.header.text}
        </h4>
      ) : null}

      {listData?.body?.text ? (
        <p className="list-body-text">{listData.body.text}</p>
      ) : null}

      {sections.map((section, i) => (
        <div key={i} className="list-section">
          {section?.title ? (
            <div className="list-section-title">{section.title}</div>
          ) : null}

          {(section?.rows ?? []).map((row) => (
            <div key={row?.id ?? `${i}-row`} className="list-row">
              <div className="list-row-title">{row?.title ?? '—'}</div>
              {row?.description ? (
                <div className="list-row-description">{row.description}</div>
              ) : null}
            </div>
          ))}
        </div>
      ))}

      {listData?.footer?.text ? (
        <div className="list-footer">{listData.footer.text}</div>
      ) : null}
    </div>
  );
}
