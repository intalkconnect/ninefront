import React, { useMemo, useState } from 'react';
import { Check, CheckCheck, AlertCircle, File as FileIcon, Image as ImageIcon, Music2, Video, Download } from 'lucide-react';
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
  const out = [];
  let lastDay = '';
  for (const m of messages) {
    const d = (m.created_at || m.timestamp || '').slice(0,10);
    if (d && d !== lastDay) {
      out.push({ kind: 'divider', id: `div-${d}-${out.length}`, label: dayLabel(m.created_at || m.timestamp) });
      lastDay = d;
    }
    out.push({ kind: 'msg', data: m });
  }
  return out;
}

function humanSize(bytes) {
  if (!bytes || isNaN(bytes)) return '';
  const units = ['B','KB','MB','GB','TB'];
  let v = Number(bytes), i = 0;
  while (v >= 1024 && i < units.length - 1) { v /= 1024; i++; }
  return `${v.toFixed(v < 10 && i > 0 ? 1 : 0)} ${units[i]}`;
}

function FileCard({ url, filename, size, mime }) {
  const ext = (filename || '').split('.').pop()?.toLowerCase() || '';
  const isPdf = mime === 'application/pdf' || ext === 'pdf';
  const Icon = mime?.startsWith?.('audio/') ? Music2 : mime?.startsWith?.('video/') ? Video : FileIcon;
  return (
    <a href={url} target="_blank" rel="noreferrer" className={styles.fileCard}>
      <div className={styles.fileIcon}><Icon size={18}/></div>
      <div className={styles.fileMeta}>
        <div className={styles.fileName} title={filename || url}>{filename || url}</div>
        <div className={styles.fileSub}>
          {mime || (ext && `.${ext}`)} {size ? `• ${humanSize(size)}` : ''} {isPdf ? '• PDF' : ''}
        </div>
      </div>
      <div className={styles.fileDl}><Download size={16}/></div>
    </a>
  );
}

function ImageThumb({ url, alt, onClick }) {
  return (
    <button type="button" className={styles.imgBtn} onClick={onClick}>
      <img src={url} alt={alt || 'Imagem'} className={styles.img} loading="lazy" />
      <div className={styles.imgZoom}><ImageIcon size={16}/> Ampliar</div>
    </button>
  );
}

function AudioPlayer({ url }) {
  return <audio className={styles.audio} src={url} controls preload="metadata" />;
}

function Lightbox({ open, url, onClose }) {
  if (!open) return null;
  return (
    <div className={styles.lb} onClick={onClose}>
      <img src={url} alt="preview" className={styles.lbImg} />
    </div>
  );
}

// detecção inspirada no MessageRow do ChatWindow
function detectKind(msg) {
  const type = String(msg.type || '').toLowerCase();
  const c = msg.content || {};
  const url = String(c?.url || '').toLowerCase();
  const mime = String(c?.mime_type || '');

  const isImage = type === 'image' || mime.startsWith('image/') || /\.(jpe?g|png|gif|webp|bmp|svg)$/i.test(url) || url.startsWith('blob:');
  if (isImage) return 'image';

  const isAudio = type === 'audio' || c?.voice || mime.startsWith('audio/') || /\.(ogg|mp3|wav|m4a|opus)$/i.test(url);
  if (isAudio) return 'audio';

  const isVideo = type === 'video' || mime.startsWith('video/') || /(^blob:)|\.(mp4|mov|webm)$/i.test(url);
  if (isVideo) return 'video';

  const isPdf = (type === 'document' || c?.filename || mime === 'application/pdf') &&
                (c?.filename?.toLowerCase?.().endsWith('.pdf') || mime === 'application/pdf');
  if (isPdf) return 'document';

  if (type === 'document' || c?.filename || c?.url) return 'document';

  // “interactive”, “contacts”, “list”, “button” etc → trata como documento/unknown amigável
  if (type === 'interactive' || type === 'contacts' || type === 'list' || type === 'button') return 'document';

  return 'text';
}

export default function ChatThread({ messages = [] }) {
  const [lightbox, setLightbox] = useState(null);
  const timeline = useMemo(() => buildTimeline(messages), [messages]);

  if (!messages.length) return <div className={styles.empty}>Sem mensagens.</div>;

  return (
    <>
      <div className={styles.thread}>
        {timeline.map((item) => {
          if (item.kind === 'divider') return <div key={item.id} className={styles.divider}><span>{item.label}</span></div>;

          const m = item.data;
          const isAgent = m.direction === 'outgoing';
          const isSystem = m.direction === 'system';
          const bubbleClass =
            isSystem ? `${styles.msg} ${styles.system}` :
            isAgent  ? `${styles.msg} ${styles.agent}`  :
                       `${styles.msg} ${styles.client}`;

          const kind = detectKind(m);
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
              {kind === 'image' && c.url && (
                <>
                  {text && <div className={styles.caption}>{text}</div>}
                  <ImageThumb url={c.url} alt={text} onClick={() => setLightbox(c.url)} />
                </>
              )}

              {kind === 'audio' && c.url && (
                <>
                  {text && <div className={styles.caption}>{text}</div>}
                  <AudioPlayer url={c.url} />
                </>
              )}

              {(kind === 'document' || kind === 'video') && c.url && (
                <>
                  {text && <div className={styles.caption}>{text}</div>}
                  <FileCard url={c.url} filename={c.filename} size={c.size} mime={c.mime_type} />
                </>
              )}

              {kind === 'text' && (
                <div className={styles.body}>{text || '—'}</div>
              )}

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

      <Lightbox open={!!lightbox} url={lightbox} onClose={() => setLightbox(null)} />
    </>
  );
}
