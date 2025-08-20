import React, { useState, useRef, useEffect } from 'react';
import TextMessage from './messageTypes/TextMessage';
import ImageMessage from './messageTypes/ImageMessage';
import DocumentMessage from './messageTypes/DocumentMessage';
import ListMessage from './messageTypes/ListMessage';
import QuickReplyMessage from './messageTypes/QuickReplyMessage';
import AudioMessage from './messageTypes/AudioMessage';
import UnknownMessage from './messageTypes/UnknownMessage';
import './MessageRow.css';
import { CheckCheck, Check, Download, Copy, CornerDownLeft, ChevronDown } from 'lucide-react';

// -------- helpers para o cabeçalho de resposta --------
function pickSnippet(c) {
  if (!c) return '';
  if (typeof c === 'string') return c;
  if (typeof c === 'object') {
    if (typeof c.body === 'string' && c.body.trim()) return c.body;
    if (typeof c.text === 'string' && c.text.trim()) return c.text;
    if (typeof c.caption === 'string' && c.caption.trim()) return c.caption;

    const url = String(c.url || '').toLowerCase();
    if (!url) return '';

    if (/\.(jpe?g|png|gif|webp|bmp|svg)$/.test(url)) return 'Imagem';
    if (/\.(ogg|mp3|wav|m4a|opus)$/.test(url) || c.voice) return 'Áudio';
    if (/\.(mp4|mov|webm)$/.test(url)) return 'Vídeo';
    if (c.filename) return c.filename;
    return 'Documento';
  }
  return '';
}

function buildReplyPreview(raw) {
  if (!raw) return null;

  if (typeof raw === 'string') {
    const s = raw.trim();
    const m = s.match(/^\*(.+?)\*:\s*(.*)$/);
    if (m) return { title: m[1], snippet: m[2] };
    return { title: '', snippet: s };
  }

  const title = raw.direction === 'outgoing'
    ? 'Você'
    : (raw.name || raw.sender_name || '');

  const snippet = pickSnippet(raw.content);
  return { title, snippet };
}

export default function MessageRow({ msg, onImageClick, onPdfClick, onReply }) {
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef();

  // normaliza content
  let content = msg.content;
  if (typeof content === 'string') {
    if (!/^\d+$/.test(content)) {
      const s = content.trim();
      if (s.startsWith('{') || s.startsWith('[')) {
        try { content = JSON.parse(s); } catch {}
      }
    }
  }

  const isOutgoing = msg.direction === 'outgoing';
  const isSystem = msg.direction === 'system' || msg.type === 'system';

  const side = isSystem ? 'system' : (isOutgoing ? 'outgoing' : 'incoming');
  const rowClass = `message-row ${side}`;
  const wrapperClass = `message-wrapper ${isOutgoing ? 'outgoing' : 'incoming'}`;
  const bubbleClass = `message-bubble ${isOutgoing ? 'outgoing' : 'incoming'}`;

  const timeText = new Date(msg.timestamp).toLocaleTimeString([], {
    hour: '2-digit',
    minute: '2-digit',
  });

  const urlLower = String(content?.url || '').toLowerCase();
  const isAudio = msg.type === 'audio' || content?.voice || /\.(ogg|mp3|wav|m4a|opus)$/i.test(urlLower);
  const isImage = msg.type === 'image' || /\.(jpe?g|png|gif|webp|bmp|svg)$/i.test(content?.url || '') || urlLower.startsWith('blob:');
  const isPdf = (msg.type === 'document' || content?.filename) && content?.filename?.toLowerCase().endsWith('.pdf');
  const isList = (content?.type === 'list' || content?.body?.type === 'list') && (content?.action || content?.body?.action);
  const isQuickReply = content?.type === 'button' && Array.isArray(content?.action?.buttons);

  let messageContent = null;

  if (isSystem) {
    messageContent = (
      <div className="system-message">
        {typeof content === 'object'
          ? (content.text || content.body || content.caption)
          : content}
      </div>
    );
  }

  if (!messageContent) {
    if (typeof content === 'string' && /^\d+$/.test(content)) {
      messageContent = <TextMessage content={content} />;
    } else if (typeof content === 'number' || typeof content === 'boolean') {
      messageContent = <TextMessage content={String(content)} />;
    } else if (isAudio) {
      messageContent = <AudioMessage url={content?.url || msg.url || ''} />;
    } else if (isImage) {
      messageContent = (
        <ImageMessage
          url={content?.url}
          caption={content?.caption}
          onClick={() => onImageClick?.(content?.url)}
        />
      );
    } else if (isPdf) {
      messageContent = (
        <DocumentMessage
          filename={content?.filename}
          url={content?.url}
          caption={content?.caption}
          onClick={() => onPdfClick?.(content?.url)}
        />
      );
    } else if (isList) {
      const listData = content?.type === 'list' ? content : content.body;
      messageContent = <ListMessage listData={listData} />;
    } else if (isQuickReply) {
      messageContent = <QuickReplyMessage data={content} />;
    } else if (typeof content === 'string') {
      messageContent = <TextMessage content={content} />;
    } else if (typeof content === 'object' && (content?.body || content?.text || content?.caption)) {
      messageContent = <TextMessage content={content.body || content.text || content.caption} />;
    } else {
      messageContent = <UnknownMessage />;
    }
  }

  const handleCopy = () => {
    if (typeof content === 'string') {
      navigator.clipboard.writeText(content);
    } else if (typeof content === 'object' && (content?.body || content?.text || content?.caption)) {
      navigator.clipboard.writeText(content.body || content.text || content.caption);
    }
    setMenuOpen(false);
  };

  const handleDownload = async () => {
    const fileUrl = content?.url;
    const filename = content?.filename || 'arquivo';
    if (!fileUrl) return;
    try {
      const response = await fetch(fileUrl);
      const blob = await response.blob();
      const blobUrl = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = blobUrl;
      link.download = filename;
      document.body.appendChild(link);
      link.click();
      link.remove();
      URL.revokeObjectURL(blobUrl);
      setMenuOpen(false);
    } catch (err) {
      console.error('Erro ao baixar arquivo:', err);
    }
  };

  const toggleMenu = () => setMenuOpen(!menuOpen);

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (menuRef.current && !menuRef.current.contains(event.target)) {
        setMenuOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const replyPreview =
    buildReplyPreview(msg.replyTo) ||
    buildReplyPreview(msg.reply_preview) ||
    buildReplyPreview(msg.reply_to);

  return (
    <div className={rowClass}>
      {isSystem ? (
        <div className="system-message-wrapper">{messageContent}</div>
      ) : (
        <div className={wrapperClass}>
          {/* BOLHA */}
          <div className={bubbleClass}>
            <div className="message-bubble-content">
              <div className="menu-arrow" ref={menuRef}>
                <button onClick={toggleMenu} className="menu-button" title="Mais opções">
                  <ChevronDown size={16} />
                </button>
                {menuOpen && (
                  <div className={`menu-dropdown ${isOutgoing ? 'right' : 'left'}`}>
                    {onReply && (
                      <button onClick={() => { onReply(msg); setMenuOpen(false); }}>
                        <CornerDownLeft size={14} /> Responder
                      </button>
                    )}
                    {(typeof content === 'string' ||
                      (typeof content === 'object' && (content?.body || content?.text || content?.caption))) && (
                      <button onClick={handleCopy}>
                        <Copy size={14} /> Copiar
                      </button>
                    )}
                    {((content?.url && (isImage || isPdf))) && (
                      <button onClick={handleDownload}>
                        <Download size={14} /> Baixar
                      </button>
                    )}
                  </div>
                )}
              </div>

              {replyPreview && (
                <div className="replied-message">
                  <div className="replied-bar" />
                  <div className="replied-content">
                    <div className="replied-title">
                      <strong>
                        {replyPreview.title || (msg.reply_direction === 'outgoing' ? 'Você' : '')}
                      </strong>
                    </div>
                    <div className="replied-text">{replyPreview.snippet}</div>
                  </div>
                </div>
              )}

              <div className="message-content">
                {messageContent}
              </div>
            </div>
          </div>

          {/* META FORA DA BOLHA */}
          <div className={`message-meta ${isOutgoing ? 'outgoing' : 'incoming'}`}>
            <span className="message-time">{timeText}</span>
            {isOutgoing && (
              <>
                {msg.status === 'read' ? (
                  <CheckCheck size={14} className="check read" />
                ) : msg.status === 'delivered' ? (
                  <CheckCheck size={14} className="check delivered" />
                ) : msg.status === 'sent' ? (
                  <CheckCheck size={14} className="check sent" />
                ) : msg.status === 'error' ? (
                  <span className="check error">❌</span>
                ) : (
                  <Check size={14} className="check pending" />
                )}
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
