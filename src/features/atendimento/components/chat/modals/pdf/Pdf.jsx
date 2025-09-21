
// src/components/ChatWindow/modals/PdfModal.jsx
import React from 'react';
import './styles/Pdf.css';

export default function PdfModal({ url, onClose }) {
  return (
    <div className="pdf-modal-overlay" onClick={onClose}>
      <iframe className="pdf-modal-content" src={url} title="Visualização PDF" />
    </div>
  );
}
