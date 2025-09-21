
// src/components/ChatWindow/messageTypes/ImageMessage.jsx
import React from 'react';
import './ImageMessage.css';

export default function ImageMessage({ url, caption, onClick, small }) {
  return (
    <div className={`image-container ${small ? 'image-small' : ''}`} onClick={onClick}>
      <img src={url} alt={caption || 'Imagem'} />
    </div>
  );
}

