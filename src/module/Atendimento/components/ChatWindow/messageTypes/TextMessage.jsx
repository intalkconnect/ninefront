// src/components/ChatWindow/messageTypes/TextMessage.jsx
import React from 'react';
import './TextMessage.css';

// normaliza para string (sem trim — preserva \n e espaços)
function contentToString(content) {
  if (content == null) return '';
  if (typeof content === 'string') return content;
  if (typeof content === 'object') {
    return String(content.text ?? content.body ?? content.caption ?? '');
  }
  return String(content);
}

// detecta assinatura no início: *Nome:*\n\n (preservando as quebras originais)
function splitSignature(s) {
  if (typeof s !== 'string') return null;
  // captura nome e as quebras (1–2) após a assinatura
  const m = s.match(/^\*([^*]+):\*(\s*(?:\r?\n){1,2})/);
  if (!m) return null;
  const [, rawName, sep] = m;
  const body = s.slice(m[0].length); // resto da mensagem, do jeitinho que veio
  return { name: rawName, sep, body };
}

export default function TextMessage({ content }) {
  const raw = contentToString(content);
  const sig = splitSignature(raw);

  if (sig) {
    return (
      <p className="text-message">
        <strong className="text-signature">{sig.name}:</strong>
        {sig.sep}
        {sig.body}
      </p>
    );
  }

  return <p className="text-message">{raw}</p>;
}
