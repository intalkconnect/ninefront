import { useEffect, useRef, useState } from 'react';

function pickSupportedMimeType() {
  if (typeof window === 'undefined' || !window.MediaRecorder) return null;
  const candidates = [
    'audio/ogg;codecs=opus',     // ✅ melhor p/ WA/TG
    'audio/webm;codecs=opus',    // fallback comum (Chrome)
    'audio/mp4',                 // Safari
    'audio/webm',                // fallback genérico
  ];
  for (const t of candidates) {
    try {
      if (MediaRecorder.isTypeSupported(t)) return t;
    } catch {}
  }
  return null;
}

function extFromMime(m) {
  if (!m) return 'ogg';
  if (m.startsWith('audio/ogg')) return 'ogg';
  if (m.startsWith('audio/webm')) return 'webm';
  if (m.startsWith('audio/mp4')) return 'm4a';
  return 'ogg';
}

/**
 * Gravação leve (Opus) sem conversão para MP3.
 * - Gera File pequeno (OGG/WebM/M4A) com mimeType correto
 * - Marca file._isVoice = true para envio como “voice note”
 */
export function useAudioRecorder() {
  const [isRecording, setIsRecording] = useState(false);
  const [recordedFile, setRecordedFile] = useState(null);
  const [recordingTime, setRecordingTime] = useState(0);

  const mediaStreamRef = useRef(null);
  const recorderRef = useRef(null);
  const chunksRef = useRef([]);
  const tickRef = useRef(null);

  useEffect(() => {
    return () => {
      try { stopRecording(); } catch {}
      if (mediaStreamRef.current) {
        mediaStreamRef.current.getTracks().forEach(t => t.stop());
        mediaStreamRef.current = null;
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function startRecording() {
    if (isRecording) return;

    const mimeType = pickSupportedMimeType();
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    mediaStreamRef.current = stream;

    chunksRef.current = [];
    setRecordingTime(0);

    const rec = new MediaRecorder(stream, {
      mimeType: mimeType || undefined,
      audioBitsPerSecond: 32000, // 32kbps opus => bem leve
    });
    recorderRef.current = rec;

    rec.ondataavailable = (e) => {
      if (e.data && e.data.size > 0) chunksRef.current.push(e.data);
    };

    rec.onstop = () => {
      const type = mimeType || 'audio/ogg;codecs=opus';
      const blob = new Blob(chunksRef.current, { type });
      const ext = extFromMime(type);
      const file = new File([blob], `voice-${Date.now()}.${ext}`, { type });
      // marca como “mensagem de voz” pro sender
      // eslint-disable-next-line no-underscore-dangle
      file._isVoice = true;

      setRecordedFile(file);
      chunksRef.current = [];

      // encerra tracks
      try { stream.getTracks().forEach(t => t.stop()); } catch {}
      mediaStreamRef.current = null;
    };

    // cronômetro simples (opcional: limite de 60s, por ex.)
    tickRef.current = setInterval(() => {
      setRecordingTime((t) => t + 1);
    }, 1000);

    rec.start(200); // coleta em chunks pequenos
    setIsRecording(true);
  }

  function stopRecording() {
    if (!isRecording) return;
    try { recorderRef.current?.stop(); } catch {}
    recorderRef.current = null;
    setIsRecording(false);
    if (tickRef.current) {
      clearInterval(tickRef.current);
      tickRef.current = null;
    }
  }

  function clearRecordedFile() {
    setRecordedFile(null);
    setRecordingTime(0);
  }

  return {
    isRecording,
    startRecording,
    stopRecording,
    recordedFile,
    clearRecordedFile,
    recordingTime,
  };
}
