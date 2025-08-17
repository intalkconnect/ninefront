// src/hooks/useEmojiPicker.js
import { useEffect } from 'react';

/**
 * Hook que cuida de:
 * 1) Abrir/Fechar emoji picker via showEmoji boolean externo
 * 2) Registrar event listener de “emoji-click” para injetar emoji
 * 3) Fechar o picker quando clicar fora
 *
 * Uso:
 *   const pickerRef = useRef(null);
 *   const { onEmojiClick, handleOpenPicker, handleClosePicker } = useEmojiPicker(
 *     showEmoji, setShowEmoji, setText
 *   );
 */
export function useEmojiPicker(showEmoji, setShowEmoji, setText, pickerRef) {
  // Fecha picker ao clicar fora
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (pickerRef.current && !pickerRef.current.contains(event.target)) {
        setShowEmoji(false);
      }
    };
    document.addEventListener('click', handleClickOutside);
    return () => document.removeEventListener('click', handleClickOutside);
  }, [pickerRef, setShowEmoji]);

  // Adiciona listener de emoji-click
  useEffect(() => {
    if (!pickerRef.current) return;

    const handler = (e) => {
      setText((prev) => prev + e.detail.unicode);
    };
    pickerRef.current.addEventListener('emoji-click', handler);
    return () => {
      pickerRef.current?.removeEventListener('emoji-click', handler);
    };
  }, [showEmoji, pickerRef, setText]);

  // Funções para abrir/fechar
  const handleOpenPicker = () => setShowEmoji(true);
  const handleClosePicker = () => setShowEmoji(false);

  return { handleOpenPicker, handleClosePicker };
}
