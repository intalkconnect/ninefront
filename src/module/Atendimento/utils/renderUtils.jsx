// src/utils/renderUtils.js
import React from 'react';
import TextMessage from '../components/ChatWindow/messageTypes/TextMessage';
import ImageMessage from '../components/ChatWindow/messageTypes/ImageMessage';
import DocumentMessage from '../components/ChatWindow/messageTypes/DocumentMessage';
import AudioMessage from '../components/ChatWindow/messageTypes/AudioMessage';
import ListMessage from '../components/ChatWindow/messageTypes/ListMessage';

export function renderReplyContent(msg) {
  if (!msg || !msg.content) return '[mensagem]';

  // Texto simples sem JSON
  if (typeof msg.content === 'string' && !msg.content.trim().startsWith('{')) {
    return <TextMessage content={msg.content} small />;
  }

  try {
    const parsed = typeof msg.content === 'string'
      ? JSON.parse(msg.content)
      : msg.content;

    const url = parsed.url?.toLowerCase?.() || '';
    const filename = parsed.filename?.toLowerCase?.() || '';
    const extension = filename.split('.').pop();

    if ((parsed.type === 'list' || parsed.type === 'buttons') && parsed.action?.sections) {
      return <ListMessage listData={parsed} small />;
    }

    if (parsed.voice || /\.(ogg|mp3|wav|webm)$/i.test(url)) {
      return <AudioMessage url={parsed.url} small />;
    }

    if (/\.(jpe?g|png|gif|webp|bmp|svg)$/i.test(url)) {
      return <ImageMessage url={parsed.url} caption={parsed.caption} small />;
    }

    const docExts = ['pdf', 'doc', 'docx', 'xls', 'xlsx', 'ppt', 'pptx', 'txt'];
    if (filename && docExts.includes(extension)) {
      return <DocumentMessage filename={filename} url={parsed.url} caption={parsed.caption} small />;
    }

    if (parsed.text || parsed.caption) {
      return <TextMessage content={parsed.text || parsed.caption} small />;
    }

    return <TextMessage content="[mensagem]" small />;
  } catch (err) {
    console.error('❌ Erro ao parsear reply:', err);
    return <TextMessage content={msg.content} small />;
  }
}
