import React, { useRef, useState } from 'react';
import './VideoMessage.css';

export default function VideoMessage({
  url,
  caption,
  small,
  autoPlay = false,     // use true p/ “sticker” (loop mudo)
  loop = false,
  muted = true,
  controls,            // se não passar, usa !autoPlay
}) {
  const videoRef = useRef(null);
  const [isMuted, setIsMuted] = useState(muted);
  const [isLoading, setIsLoading] = useState(true);
  const [hasError, setHasError] = useState(false);

  const onLoadedData = () => setIsLoading(false);
  const onError = () => { setIsLoading(false); setHasError(true); };

  const effectiveControls = controls ?? !autoPlay;

  const toggleSound = () => {
    const el = videoRef.current;
    if (!el) return;
    const next = !isMuted;
    setIsMuted(next);
    el.muted = next;
    if (!next) el.play?.().catch(() => {});
  };

  return (
    <div className={`video-container ${small ? 'video-small' : ''}`}>
      {hasError ? (
        <div className="video-fallback">Não foi possível carregar o vídeo.</div>
      ) : (
        <>
          {isLoading && <div className="video-skeleton" />}
          <video
            ref={videoRef}
            src={url}
            autoPlay={autoPlay}
            loop={loop}
            muted={isMuted}
            playsInline
            controls={effectiveControls}
            preload="metadata"
            onLoadedData={onLoadedData}
            onError={onError}
            className={isLoading ? 'hidden' : ''}
          />
          {caption && <div className="video-caption">{caption}</div>}

          {/* Quando em autoplay (estilo sticker), exibe um botão para habilitar som */}
          {autoPlay && (
            <button
              className="video-sound-toggle"
              onClick={toggleSound}
              title={isMuted ? 'Ativar som' : 'Silenciar'}
            >
              {isMuted ? '🔇' : '🔊'}
            </button>
          )}
        </>
      )}
    </div>
  );
}
