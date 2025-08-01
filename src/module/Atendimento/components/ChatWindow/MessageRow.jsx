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

  let content = msg.content;

  // Modified content parsing logic
  if (typeof content === 'string') {
    // If it's a numeric string (all digits), keep as string
    if (/^\d+$/.test(content)) {
      // Do nothing, keep as string
    } 
    // Only try to parse if it looks like JSON
    else if (content.trim().startsWith('{') || content.trim().startsWith('[')) {
      try {
        content = JSON.parse(content);
      } catch {
        // Keep as string if parsing fails
      }
    }
  }

  const isOutgoing = msg.direction === 'outgoing';
  const isSystem = msg.direction === 'system' || msg.type === 'system';

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
          {msg.status === 'delivered' ? (
            <CheckCheck size={14} className="check delivered" />
          ) : msg.status === 'sent' ? (
            <CheckCheck size={14} className="check sent" />
          ) : (
            <Check size={14} className="check pending" />
          )}
        </span>
      )}
    </div>
  );

  const urlLower = String(content?.url || '').toLowerCase();
  const isAudio = msg.type === 'audio' || content?.voice || /\.(ogg|mp3|wav)$/i.test(urlLower);
  const isImage = msg.type === 'image' || /\.(jpe?g|png|gif|webp|bmp|svg)$/i.test(content?.url || '');
  const isPdf = (msg.type === 'document' || content?.filename) && content?.filename?.toLowerCase().endsWith('.pdf');
  const isList = (content?.type === 'list' || content?.body?.type === 'list') && (content?.action || content?.body?.action);
  const isQuickReply = content?.type === 'button' && Array.isArray(content?.action?.buttons);

  let messageContent = null;

  if (isSystem) {
  messageContent = (
    <div className="system-message">
      {typeof content === 'object' ? content.text : content}
    </div>
  );
}


  // Content rendering logic with numeric string handling
  if (typeof content === 'string' && /^\d+$/.test(content)) {
    messageContent = <TextMessage content={content} />;
  } else if (typeof content === 'number' || typeof content === 'boolean') {
    messageContent = <TextMessage content={String(content)} />;
  } else if (isAudio) {
    messageContent = <AudioMessage url={content.url || msg.url || ''} />;
  } else if (isImage) {
    messageContent = (
      <ImageMessage
        url={content.url}
        caption={content.caption}
        onClick={() => onImageClick?.(content.url)}
      />
    );
  } else if (isPdf) {
    messageContent = (
      <DocumentMessage
        filename={content.filename}
        url={content.url}
        caption={content.caption}
        onClick={() => onPdfClick?.(content.url)}
      />
    );
  } else if (isList) {
    const listData = content?.type === 'list' ? content : content.body;
    messageContent = <ListMessage listData={listData} />;
  } else if (isQuickReply) {
  messageContent = <QuickReplyMessage data={content} />;
  } else if (typeof content === 'string') {
    messageContent = <TextMessage content={content} />;
  } else if (typeof content === 'object' && (content?.text || content?.caption)) {
    messageContent = <TextMessage content={content.text || content.caption} />;
  } else {
    messageContent = <UnknownMessage />;
  }

  const handleCopy = () => {
    if (typeof content === 'string') {
      navigator.clipboard.writeText(content);
    } else if (typeof content === 'object' && content?.text) {
      navigator.clipboard.writeText(content.text);
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
                {(typeof content === 'string' || (typeof content === 'object' && content?.text)) && (
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
          {msg.replyTo && (
            <div className="replied-message">
              <div className="replied-content">
                {(msg.reply_direction === 'outgoing') && <strong>Você</strong>}
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
