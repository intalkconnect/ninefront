import React from 'react';

function getSnippet(type, content) {
  try {
      if (!content) return null;
    type = (type || '').toLowerCase();

    if (type === 'text') {
      const body = typeof content === 'string' ? content : content?.body || content?.text || content?.caption;
      return body || '[Texto]';
    }

    if (type === 'audio') {
      return content?.voice ? '🎤 Voz (Telegram)' : '🎵 Áudio';
    }

    if (type === 'image') return '🖼️ Imagem';
    if (type === 'video') return '🎥 Vídeo';
    if (type === 'file') return '📎 Documento';
    if (type === 'template') return '📋 Template';
    if (type === 'location') return '📍 Localização';
    if (type === 'contact') return '👤 Contato';
    if (type === 'sticker') return '🌟 Figurinha';

    return '📄 Mensagem';
  } catch (err) {
    console.error('Erro ao gerar snippet:', err);
    return '[Mensagem]';
  }
}

export default function OriginalMessageSnippet({ message }) {
  if (!message) return null;

  const snippet = getSnippet(message.type, message.content);
  if (!snippet) return null;

  return (
    <div className="text-sm text-gray-500 truncate">
      {snippet}
    </div>
  );
}

