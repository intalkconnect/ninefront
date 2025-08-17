
// src/components/ChatWindow/modals/ImageModal.jsx
import React from 'react';
import './ImageModal.css';

export default function ImageModal({ url, onClose }) {
  return (
    <div className="modal-overlay" onClick={onClose}>
      <img className="modal-image" src={url} alt="Imagem ampliada" />
    </div>
  );
}
