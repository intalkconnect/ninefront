
// src/components/ChatWindow/messageTypes/ListMessage.jsx
import React from 'react';
import './ListMessage.css';

export default function ListMessage({ listData, small }) {
  if (small) {
    // Mostra apenas um resumo textual (modo reply)
    return (
      <div className="list-preview">
        📋 {listData?.header?.text || listData?.body?.text || '[Lista]'}
      </div>
    );
  }

  return (
    <div className="list-container">
      {listData.header?.text && (
  <h4 style={{ margin: 0, fontSize: '14px', color: '#111b21' }}>
    {listData.header.text}
  </h4>
)}

      {listData.body?.text && <p className="list-body-text">{listData.body.text}</p>}

      {listData.action.sections.map((section, i) => (
        <div key={i} className="list-section">
          {section.title && <div className="list-section-title">{section.title}</div>}
          {section.rows.map((row) => (
            <div key={row.id} className="list-row">
              <div className="list-row-title">{row.title}</div>
              {row.description && (
                <div className="list-row-description">{row.description}</div>
              )}
            </div>
          ))}
        </div>
      ))}

      {listData.footer?.text && <div className="list-footer">{listData.footer.text}</div>}
    </div>
  );
}
