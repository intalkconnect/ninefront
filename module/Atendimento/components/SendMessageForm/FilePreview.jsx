// src/components/FilePreview.jsx

import React from 'react';

/**
 * Mostra preview de arquivo ou áudio, com botão “×” para remover.
 * Props:
 *   - file: File | null
 *   - onRemove: () => void
 *   - isSending: boolean
 *   - isRecording: boolean
 */
export default function FilePreview({ file, onRemove, isSending, isRecording }) {
  if (!file) return null;

  return (
    <div className="send-form-preview">
      {file.type.startsWith('audio/') ? (
        <>
          <audio controls src={URL.createObjectURL(file)} />
          <button
            type="button"
            onClick={onRemove}
            disabled={isSending || isRecording}
            title="Remover gravação de áudio"
          >
            ×
          </button>
        </>
      ) : (
        <>
          <span>
            📎 Anexado: <strong>{file.name}</strong>
          </span>
          <button
            type="button"
            onClick={onRemove}
            disabled={isSending || isRecording}
            title="Remover anexo"
          >
            ×
          </button>
        </>
      )}
    </div>
  );
}
