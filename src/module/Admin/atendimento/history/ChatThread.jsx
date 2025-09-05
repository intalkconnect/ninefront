import React, { useRef } from 'react';
import MessageList from './MessageList'; // <- o arquivo que você anexou
import styles from './styles/ChatThread.module.css';

// callbacks opcionais (zoom de imagem, PDF modal, etc.)
export default function ChatThread({ messages = [] }) {
  const listRef = useRef(null);

  return (
    <div className={styles.threadArea}>
      <MessageList
        ref={listRef}
        messages={messages}
        onImageClick={(url) => window.open(url, '_blank')}
        onPdfClick={(url) => window.open(url, '_blank')}
        onReply={null} // histórico: só visual
      />
    </div>
  );
}
