import React from 'react';

/**
 * Gera uma prévia textual da última mensagem com base no tipo e conteúdo.
 */
function getSnippet(type, content) {
  try {
    if (!type || !content) return null;

    switch (type) {
      case 'text':
        if (typeof content === 'string') return content;
        if (typeof content === 'object' && content.body) return content.body;
        return '[Texto]';

      case 'image':
        return '🖼️ Imagem';

      case 'audio':
        if (content.voice) return '🎤 Voz (Telegram)';
        return '🎵 Áudio';

      case 'video':
        return '🎥 Vídeo';

      case 'file':
        return '📎 Documento';

      case 'template':
        return '📋 Template';

      case 'location':
        return '📍 Localização';

      case 'contact':
        return '👤 Contato';

      case 'sticker':
        return '🌟 Figurinha';

      default:
        return '📄 Mensagem';
    }
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

