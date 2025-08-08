// src/components/ChatWindow/OriginalMessageSnippet.jsx
import React from 'react';
import TextMessage from './messageTypes/TextMessage';
import ImageMessage from './messageTypes/ImageMessage';
import AudioMessage from './messageTypes/AudioMessage';
import DocumentMessage from './messageTypes/DocumentMessage';

export default function OriginalMessageSnippet({ messageId, allMessages }) {
  const original = allMessages.find(m => m.whatsapp_message_id === messageId);

  if (!original) {
    return <div className="reply-snippet"><em>Mensagem não encontrada</em></div>;
  }

  let content = original.content;
  if (typeof content === 'string') {
    try {
      content = JSON.parse(content);
    } catch (err) {
      content = { text: content };
    }
  }

  const type = original.type;
  const direction = original.direction === 'incoming' ? 'Contato' : 'Você';

  return (
    <div className="reply-snippet">
      <strong>{direction}</strong>
      <div className="reply-preview-content">
        {type === 'text' && <TextMessage content={content.body || content.text} />}
        {type === 'image' && <ImageMessage url={content.url} caption={content.caption} small />}
        {type === 'audio' && <AudioMessage url={content.url} small />}
        {type === 'document' && (
          <DocumentMessage
            filename={content.filename}
            url={content.url}
            caption={content.caption}
            small
          />
        )}
        {!['text', 'image', 'audio', 'document'].includes(type) && (
          <TextMessage content="[tipo não suportado]" />
        )}
      </div>
    </div>
  );
}
