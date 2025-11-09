import React, { useRef } from 'react';
import MessageList from './MessageList';
import styles from './styles/ChatThread.module.css';

export default function ChatThread({ messages = [] }) {
  const listRef = useRef(null);

  return (
    <div className={styles.threadArea}>
      <MessageList
        ref={listRef}
        messages={messages}
        onImageClick={(url) => window.open(url, '_blank')}
        onPdfClick={(url) => window.open(url, '_blank')}
        onReply={null} // histórico: somente leitura
      />
    </div>
  );
}
