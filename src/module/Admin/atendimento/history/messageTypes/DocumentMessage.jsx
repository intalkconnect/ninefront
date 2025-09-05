// src/components/ChatWindow/messageTypes/DocumentMessage.jsx
import React from 'react';
import { getFileIcon } from '../utils/getFileIcon';
import './DocumentMessage.css';

export default function DocumentMessage({ filename, url, caption, onClick, small }) {
  return (
    <div className={`document-container ${small ? 'document-small' : ''}`} onClick={onClick}>
      <img className="document-icon" src={getFileIcon(filename)} alt="Ícone de arquivo" />
      <div className="document-details">
        {caption || filename}
      </div>
    </div>
  );
}

