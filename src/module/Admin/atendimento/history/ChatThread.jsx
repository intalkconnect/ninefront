import React, { useMemo, useState } from 'react';
import { Check, CheckCheck, AlertCircle } from 'lucide-react';

import AudioMessage from './messageTypes/AudioMessage';
import ImageMessage from './messageTypes/ImageMessage';
import DocumentMessage from './messageTypes/DocumentMessage';
import ContactsMessage from './messageTypes/ContactsMessage';
import InteractiveListMessage from './messageTypes/InteractiveListMessage';
import InteractiveButtonsMessage from './messageTypes/InteractiveButtonsMessage';

import styles from './styles/ChatThread.module.css';

function fmtTime(iso) {
  try { return new Date(iso).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }); }
  catch { return '—'; }
}
function dayLabel(iso) {
  const d = new Date(iso);
  const today = new Date(); today.setHours(0,0,0,0);
  const that = new Date(d); that.setHours(0,0,0,0);
  const diff = Math.round((that - today) / 86400000);
  if (diff === 0) return 'Hoje';
  if (diff === -1) return 'Ontem';
  return d.toLocaleDateString('pt-BR', { weekday: 'long', day: '2-digit', month: '2-digit' });
}
function buildTimeline(messages) {
  const out = []; let lastDay = '';
  for (const m of messages) {
    const d = (m.created_at || m.timestamp || '').slice(0,10);
    if (d && d !== lastDay) { out.push({ kind: 'divider', id: `div-${d}-${out.length}`, label: dayLabel(m.created_at || m.timestamp) }); lastDay = d; }
    out.push({ kind: 'msg', data: m });
  }
  return out;
}

// Decide “que componente usar”
function detectKind(msg) {
  const type = String(msg.type || '').toLowerCase();
  const c = msg.content || {};
  const url = String(c?.url || '');
  const mime = String(c?.mime_type || '');

  if (type === 'interactive') {
    const t = String(c?.type || '').toLowerCase();
    if (t === 'list') return 'interactive_list';
    if (t === 'button' || t === 'buttons') return 'interactive_buttons';
  }
  if (type === 'contacts') return 'contacts';

  const isImage = type === 'image' || mime.startsWith('image/') || /\.(jpe?g|png|gif|webp|bmp|svg)$/i.test(url);
  if (isImage) return 'image';

  const isAudio = type === 'audio' || c?.voice || mime.startsWith('audio/') || /\.(ogg|mp3|wav|m4a|opus)$/i.test(url);
  if (isAudio) return 'audio';

  const isVideo = type === 'video' || mime.startsWith('video/') || /\.(mp4|mov|webm)$/i.test(url);
  if (isVideo) return 'document'; // histórico: trata vídeo como card de arquivo

  if (type === 'document' || c?.filename || c?.url) return 'document';

  return 'text';
}

export default function ChatThread({ messages = [] }) {
  const [lightbox, setLightbox] = useState(null); // se quiser ampliar imagem depois
  const timeline = useMemo(() => buildTimeline(messages), [messages]);

  if (!messages.length) return <div className={styles.empty}>Sem mensagens.</div>;

  return (
    <>
      {/* classe global 'messages-list' permite as regras :has() do ListMessage.css */}
      <div className={`${styles.thread} messages-list`}>
        {timeline.map((item) => {
          if (item.kind === 'divider') {
            return <div key={item.id} className={styles.divider}><span>{item.label}</span></div>;
          }
          const m = item.data;
          const isAgent = m.direction === 'outgoing';
          const isSystem = m.direction === 'system';
          const kind = detectKind(m);
          const bubbleClass = [
            styles.msg,
            isSystem ? styles.system : isAgent ? styles.agent : styles.client,
            (kind === 'interactive_list' || kind === 'interactive_buttons') ? 'bubble--list' : ''
          ].join(' ');

          const c = m.content || {};
          const text = typeof m.content === 'string' ? m.content : (c.text || c.body || c.caption || m.text || '');

          return (
            <div key={m.id} className={bubbleClass}>
              {(isAgent || isSystem) && (
                <div className={styles.meta}>
                  <span className={styles.sender}>{m.sender_name || (isSystem ? 'Sistema' : '')}</span>
                </div>
              )}

              {/* BODY */}
              {kind === 'interactive_list'    && <InteractiveListMessage content={c} /> }
              {kind === 'interactive_buttons' && <InteractiveButtonsMessage content={c} /> }
              {kind === 'contacts'            && <ContactsMessage data={c} small={false} /> }
              {kind === 'image'               && <ImageMessage url={c.url} caption={text} onClick={() => setLightbox(c.url)} /> }
              {kind === 'audio'               && <AudioMessage url={c.url} small={false} /> }
              {kind === 'document'            && <DocumentMessage url={c.url} filename={c.filename || c.url} caption={text} /> }
              {kind === 'text'                && <div className={styles.body}>{text || '—'}</div> }

              {/* FOOTER */}
              <div className={styles.footer}>
                <span className={styles.time}>{fmtTime(m.created_at || m.timestamp)}</span>
                {isAgent && (
                  <span className={styles.ticks} title={m.status === 'read' ? 'Lida' : m.status === 'delivered' ? 'Entregue' : 'Enviada'}>
                    {m.status === 'read' ? <CheckCheck size={14}/> : <Check size={14}/>}
                  </span>
                )}
                {isSystem && <span className={styles.systemIcon}><AlertCircle size={14}/></span>}
              </div>
            </div>
          );
        })}
      </div>
    </>
  );
}
