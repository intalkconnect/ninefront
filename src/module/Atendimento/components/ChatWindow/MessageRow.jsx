// src/components/ChatWindow/MessageRow.jsx
import React, { useState, useRef, useEffect } from 'react';
import TextMessage from './messageTypes/TextMessage';
import ImageMessage from './messageTypes/ImageMessage';
import DocumentMessage from './messageTypes/DocumentMessage';
import ListMessage from './messageTypes/ListMessage';
import QuickReplyMessage from './messageTypes/QuickReplyMessage';

import AudioMessage from './messageTypes/AudioMessage';
import UnknownMessage from './messageTypes/UnknownMessage';
import { renderReplyContent } from '../../utils/renderUtils';

import './MessageRow.css';
import { CheckCheck, Check, Download, Copy, CornerDownLeft, ChevronDown } from 'lucide-react';

export default function MessageRow({ msg, onImageClick, onPdfClick, onReply }) {
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef();

  // ---------------- Normalização de conteúdo ----------------
  let content = msg?.content;
  const rawType = (msg?.type || '').toLowerCase();

  // Se vier string e parecer JSON, tenta parse
  if (typeof content === 'string') {
    if (!/^\d+$/.test(content)) {
      const s = content.trim();
      if (s.startsWith('{') || s.startsWith('[')) {
        try { content = JSON.parse(s); } catch { /* mantém string */ }
      }
    }
  }

  // ✅ Texto pode vir como objeto { body }, { text } ou string
  // Não muta o original: apenas reconhece 'body' como texto válido
  const hasTextBody =
    typeof content === 'object' &&
    content !== null &&
    (typeof content.body === 'string' && content.body.trim().length > 0);

  const hasTextField =
    typeof content === 'object' &&
    content !== null &&
    (typeof content.text === 'string' && content.text.trim().length > 0);

  const hasCaption =
    typeof content === 'object' &&
    content !== null &&
    (typeof content.caption === 'string' && content.caption.trim().length > 0);

  const isOutgoing = msg.direction === 'outgoing';
  const isSystem = msg.direction === 'system' || rawType === 'system';

  const replyDirection = msg.reply_direction || '';
  const rowClass = `message-row ${isSystem ? 'system' : isOutgoing ? 'outgoing' : 'incoming'}`;
  const bubbleClass = `message-bubble ${isOutgoing ? 'outgoing' : 'incoming'}`;

  const renderTimeAndStatus = () => (
    <div className="message-time">
      {new Date(msg.timestamp).toLocaleTimeString([], {
        hour: '2-digit',
        minute: '2-digit',
      })}
      {isOutgoing && (
        <span className="message-status">
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
        </span>
      )}
    </div>
  );

  // ---------------- Heurísticas por tipo ----------------
  const url = (typeof content === 'object' && content?.url) ? String(content.url) : '';
  const urlLower = url.toLowerCase();

  const isAudio =
    rawType === 'audio' ||
    (typeof content === 'object' && !!content?.voice) ||
    /\.(ogg|mp3|wav|m4a|opus)$/i.test(urlLower);

  const isImage =
    rawType === 'image' ||
    /\.(jpe?g|png|gif|webp|bmp|svg)$/i.test(urlLower) ||
    urlLower.startsWith('blob:');

  const isPdf =
    (rawType === 'document' || (typeof content === 'object' && !!content?.filename)) &&
    (typeof content?.filename === 'string' && content.filename.toLowerCase().endsWith('.pdf'));

  const isList =
    (typeof content === 'object') &&
    ((content?.type === 'list' || content?.body?.type === 'list') &&
      (content?.action || content?.body?.action));

  const isQuickReply =
    (typeof content === 'object') &&
    content?.type === 'button' &&
    Array.isArray(content?.action?.buttons);

  // ---------------- Render do conteúdo ----------------
  let messageContent = null;

  if (isSystem) {
    messageContent = (
      <div className="system-message">
        {typeof content === 'object' ? (content.text || content.body || content.caption) : content}
      </div>
    );
  }

  // Ordem de verificação: áudio/imagem/documento/list/quickreply/texto/string/objeto texto/unknown
  if (!messageContent) {
    if (isAudio) {
      messageContent = <AudioMessage url={url || msg.url || ''} />;
    } else if (isImage) {
      messageContent = (
        <ImageMessage
          url={url}
          caption={typeof content === 'object' ? content.caption : undefined}
          onClick={() => onImageClick?.(url)}
        />
      );
    } else if (isPdf) {
      messageContent = (
        <DocumentMessage
          filename={content.filename}
          url={url}
          caption={content.caption}
          onClick={() => onPdfClick?.(url)}
        />
      );
    } else if (isList) {
      const listData = content?.type === 'list' ? content : content.body;
      messageContent = <ListMessage listData={listData} />;
    } else if (isQuickReply) {
      messageContent = <QuickReplyMessage data={content} />;
    } else if (typeof content === 'string') {
      // inclui caso numérico "1234" e strings comuns
      messageContent = <TextMessage content={content} />;
    } else if (typeof content === 'number' || typeof content === 'boolean') {
      messageContent = <TextMessage content={String(content)} />;
    } else if (rawType === 'text' && (hasTextBody || hasTextField || hasCaption)) {
      // ✅ texto como objeto: usa body > text > caption
      messageContent = <TextMessage content={content.body || content.text || content.caption} />;
    } else if (typeof content === 'object' && (hasTextBody || hasTextField || hasCaption)) {
      // fallback: mesmo sem type='text', se veio objeto com body/text/caption, renderiza como texto
      messageContent = <TextMessage content={content.body || content.text || content.caption} />;
    } else {
      messageContent = <UnknownMessage />;
    }
  }

  // ---------------- Ações do menu ----------------
  const handleCopy = () => {
    if (typeof content === 'string') {
      navigator.clipboard.writeText(content);
    } else if (typeof content === 'object' && (content?.text || content?.body || content?.caption)) {
      navigator.clipboard.writeText(content.text || content.body || content.caption);
    }
    setMenuOpen(false);
  };

  const handleDownload = async () => {
    const fileUrl = (typeof content === 'object' && content?.url) ? content.url : '';
    const filename = (typeof content === 'object' && content?.filename) ? content.filename : 'arquivo';

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

  return (
    <div className={rowClass}>
      {isSystem ? (
        <div className="system-message-wrapper">{messageContent}</div>
      ) : (
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
                    (typeof content === 'object' && (content?.text || content?.body || content?.caption))) && (
                    <button onClick={handleCopy}>
                      <Copy size={14} /> Copiar
                    </button>
                  )}
                  {(isImage || isPdf) && (
                    <button onClick={handleDownload}>
                      <Download size={14} /> Baixar
                    </button>
                  )}
                </div>
              )}
            </div>

            {msg.replyTo && msg.reply_to && typeof msg.reply_to === 'string' && msg.reply_to.trim() !== '' && (
              <div className="replied-message">
                <div className="replied-content">
                  {(replyDirection === 'outgoing') && <strong>Você</strong>}
                  <div className="replied-text">
                    {renderReplyContent(msg.replyTo)}
                  </div>
                </div>
              </div>
            )}

            <div className="message-content">
              {messageContent}
            </div>

            {renderTimeAndStatus()}
          </div>
        </div>
      )}
    </div>
  );
}
