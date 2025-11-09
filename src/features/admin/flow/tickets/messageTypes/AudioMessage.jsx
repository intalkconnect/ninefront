// src/components/ChatWindow/messageTypes/AudioMessage.jsx
import React from 'react';
import './styles/AudioMessage.css'; // importa as regras que acabamos de definir

export default function AudioMessage({ url, small }) {
  const containerClass = small ? 'audio-container audio-small' : 'audio-container';
  return (
    <div className={containerClass}>
      <audio controls src={url} preload="metadata" />
    </div>
  );
}

