// src/components/ChatThread.jsx
import React from 'react';

function fmtDateTime(iso) {
  if (!iso) return '—';
  try {
    const d = new Date(iso);
    return d.toLocaleString('pt-BR', {
      day: '2-digit', month: '2-digit', year: '2-digit',
      hour: '2-digit', minute: '2-digit'
    });
  } catch {
    return '—';
  }
}

/**
 * messages: Array<{
 *   id: string|number,
 *   from_agent?: boolean,
 *   sender_name?: string,
 *   text?: string,
 *   created_at?: string
 * }>
 */
export default function ChatThread({ messages = [] }) {
  if (!messages.length) {
    return <div style={{ color: '#6b7280' }}>Sem mensagens.</div>;
  }

  return (
    <div style={{ display: 'grid', gap: 12 }}>
      {messages.map((m) => {
        const isAgent = Boolean(m.from_agent);
        return (
          <div
            key={m.id}
            style={{
              display: 'grid',
              gap: 6,
              padding: '10px 12px',
              borderRadius: 12,
              background: isAgent ? '#f1f5f9' : '#fff',
              border: '1px solid #e5e7eb',
              justifySelf: isAgent ? 'end' : 'start',
              maxWidth: 'min(680px, 100%)'
            }}
          >
            <div style={{ fontSize: 12, color: '#64748b' }}>
              {(m.sender_name || (isAgent ? 'Atendente' : 'Cliente'))} • {fmtDateTime(m.created_at)}
            </div>
            <div style={{ whiteSpace: 'pre-wrap', lineHeight: 1.4 }}>
              {m.text || '—'}
            </div>
          </div>
        );
      })}
    </div>
  );
}
