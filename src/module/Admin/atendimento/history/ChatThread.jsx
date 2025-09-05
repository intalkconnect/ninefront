// src/components/ChatThread.jsx
import React from 'react';
import styles from './styles/ChatThread.module.css';

function fmtDateTime(iso) {
  if (!iso) return '—';
  try {
    const d = new Date(iso);
    return d.toLocaleString('pt-BR', {
      day: '2-digit', month: '2-digit', year: '2-digit',
      hour: '2-digit', minute: '2-digit'
    });
  } catch { return '—'; }
}

/**
 * messages: Array<{
 *   id: string, direction: 'incoming'|'outgoing'|'system', type?: string,
 *   text: string, created_at: string, from_agent?: boolean, sender_name?: string
 * }>
 */
export default function ChatThread({ messages = [] }) {
  if (!messages.length) {
    return <div className={styles.empty}>Sem mensagens.</div>;
  }

  return (
    <div className={styles.thread}>
      {messages.map((m) => {
        const cls =
          m.direction === 'outgoing' ? styles.agent :
          m.direction === 'system'   ? styles.system : styles.client;

        return (
          <div key={m.id} className={`${styles.msg} ${cls}`}>
            <div className={styles.meta}>
              <span className={styles.sender}>{m.sender_name || (m.from_agent ? 'Atendente' : 'Cliente')}</span>
              <span className={styles.dot}>•</span>
              <span className={styles.time}>{fmtDateTime(m.created_at)}</span>
            </div>
            <div className={styles.body}>{m.text || '—'}</div>
          </div>
        );
      })}
    </div>
  );
}
