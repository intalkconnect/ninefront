// src/components/ChatWindow/messageTypes/TextMessage.jsx
import React from 'react';
import './TextMessage.css';

// normaliza para string
function contentToString(content) {
  if (content == null) return '';
  if (typeof content === 'string') return content;
  if (typeof content === 'object') {
    return String(content.text || content.body || content.caption || '').trim();
  }
  return String(content);
}

// detecta assinatura no início: *Nome:*\n\n
function splitSignature(s) {
  if (typeof s !== 'string') return null;
  const m = s.match(/^\*([^*]+):\*\s*(?:\r?\n){1,2}/);
  if (!m) return null;
  return { name: m[1].trim(), body: s.slice(m[0].length) };
}

export default function TextMessage({ content }) {
  const raw = contentToString(content);
  const sig = splitSignature(raw);

  if (sig) {
    return (
      <p className="text-message">
        <strong className="text-signature">{sig.name}:</strong>
        {sig.body ? <> {sig.body}</> : null}
      </p>
    );
  }

  return <p className="text-message">{raw}</p>;
}
