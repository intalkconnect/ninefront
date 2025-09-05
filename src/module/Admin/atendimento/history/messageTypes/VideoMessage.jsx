import React, { useRef, useState, useEffect } from 'react';
import './styles/VideoMessage.css';

export default function VideoMessage({
  url,
  caption,
  small,
  autoPlay = false,
  loop = false,
  muted = true,
  controls,              // se não passar, usa !autoPlay
  mimeType,              // <— novo (opcional, ex.: 'video/mp4')
  poster                 // <— opcional
}) {
  const videoRef = useRef(null);
  const [isMuted, setIsMuted] = useState(muted);
  const [ready, setReady] = useState(false);
  const [hasError, setHasError] = useState(false);

  const effectiveControls = controls ?? !autoPlay;

  useEffect(() => {
    const v = videoRef.current;
    if (!v) return;

    const onMeta = () => setReady(true);
    const onCanPlay = () => setReady(true);
    const onErr = () => setHasError(true);

    v.addEventListener('loadedmetadata', onMeta);
    v.addEventListener('canplay', onCanPlay);
    v.addEventListener('error', onErr);
    v.addEventListener('stalled', onErr);
    v.addEventListener('abort', onErr);
    return () => {
      v.removeEventListener('loadedmetadata', onMeta);
      v.removeEventListener('canplay', onCanPlay);
      v.removeEventListener('error', onErr);
      v.removeEventListener('stalled', onErr);
      v.removeEventListener('abort', onErr);
    };
  }, []);

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
          {/* deixa o <video> SEM esconder; skeleton fica por cima até ter metadata */}
          <video
            ref={videoRef}
            autoPlay={autoPlay}
            loop={loop}
            muted={isMuted}
            playsInline
            controls={effectiveControls}
            preload="metadata"
            poster={poster}
            crossOrigin="anonymous" // inofensivo; ajuda se um dia usar canvas
          >
            <source src={url} type={mimeType || 'video/mp4'} />
            {/* fallback mínimo */}
            Seu navegador não suporta vídeo HTML5.
          </video>

          {!ready && <div className="video-skeleton-overlay" />}

          {caption && <div className="video-caption">{caption}</div>}

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
