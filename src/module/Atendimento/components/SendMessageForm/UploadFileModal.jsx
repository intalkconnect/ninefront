import React, { useState } from 'react';
import './UploadFileModal.css';

export default function UploadFileModal({ file, onClose, onSubmit }) {
  const [caption, setCaption] = useState('');
  const [isUploading, setIsUploading] = useState(false);

  const handleSubmit = async () => {
    setIsUploading(true);
    try {
      await onSubmit(file, caption);
      onClose();
    } catch (err) {
      console.error('Erro ao enviar:', err);
    } finally {
      setIsUploading(false);
    }
  };

  return (
    <div className="upload-modal-overlay">
      <div className="upload-modal">
        <h2>Enviar arquivo</h2>
        <p><strong>{file.name}</strong></p>
        <p>{(file.size / 1024 / 1024).toFixed(2)} MB</p>
        <textarea
          placeholder="Adicione uma legenda (opcional)"
          value={caption}
          onChange={(e) => setCaption(e.target.value)}
        />
        <div className="upload-modal-buttons">
          <button onClick={onClose} disabled={isUploading}>Cancelar</button>
          <button onClick={handleSubmit} disabled={isUploading}>
            {isUploading ? <span className="spinner" /> : 'Enviar'}
          </button>
        </div>
      </div>
    </div>
  );
}
