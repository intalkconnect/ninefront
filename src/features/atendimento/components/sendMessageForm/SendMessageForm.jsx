import React, { useState, useRef, useEffect } from "react";
import { Smile, Paperclip, Image, Slash } from "lucide-react";
import { toast } from "react-toastify";
import "./SendMessageForm.css";

import useConversationsStore from "../../store/useConversationsStore";
import { useSendMessage } from "../../hooks/useSendMessage";
import { useAudioRecorder } from "../../hooks/useAudioRecorder";
import { useClickOutside } from "../../hooks/useClickOutside";
import { apiGet } from "../../../../shared/apiClient";

import FilePreview from "./FilePreview";
import AutoResizingTextarea from "./AutoResizingTextarea";
import EmojiPicker from "./EmojiPicker";
import UploadFileModal from "./UploadFileModal";
import QuickReplies from "./QuickReplies";

// -------- helpers de preview de resposta (estilo WhatsApp) --------
function pickSnippetFromContent(c) {
  if (!c) return '';
  if (typeof c === 'string') return c;
  if (typeof c === 'object') {
    if (typeof c.body === 'string' && c.body.trim()) return c.body;
    if (typeof c.text === 'string' && c.text.trim()) return c.text;
    if (typeof c.caption === 'string' && c.caption.trim()) return c.caption;

    const url = String(c.url || '').toLowerCase();
    if (!url) return '';

    if (/\.(jpe?g|png|gif|webp|bmp|svg)$/.test(url)) return 'Imagem';
    if (/\.(ogg|mp3|wav|m4a|opus)$/.test(url) || c.voice) return 'Áudio';
    if (/\.(mp4|mov|webm)$/.test(url)) return 'Vídeo';
    if (c.filename) return c.filename;
    return 'Documento';
  }
  return '';
}

function buildReplyPreview(replyTo) {
  if (!replyTo) return null;

  // objeto de mensagem
  if (typeof replyTo === 'object') {
    const title = replyTo.direction === 'outgoing'
      ? 'Você'
      : (replyTo.name || replyTo.sender_name || ''); // <- sem "Contato"
    const snippet = pickSnippetFromContent(replyTo.content);
    return { title, snippet };
  }

  // string solta (ex.: "*Nome:* texto" ou apenas texto)
  if (typeof replyTo === 'string') {
    const s = replyTo.trim();
    const m = s.match(/^\*(.+?)\*:\s*(.*)$/);
    if (m) return { title: m[1], snippet: m[2] };
    return { title: '', snippet: s };
  }

  return null;
}

export default function SendMessageForm({
  userIdSelecionado,
  onMessageAdded,
  replyTo,
  setReplyTo,
  canSendFreeform,
}) {
  // Estados
  const [text, setText] = useState("");
  const [file, setFile] = useState(null);
  const [fileToConfirm, setFileToConfirm] = useState(null);
  const [showEmoji, setShowEmoji] = useState(false);
  const [showQuickReplies, setShowQuickReplies] = useState(false);
  const [hasQuickReplies, setHasQuickReplies] = useState(false);

  // Refs
  const textareaRef = useRef(null);
  const fileInputRef = useRef(null);
  const imageInputRef = useRef(null);
  const emojiPickerRef = useRef(null);
  const quickReplyRef = useRef(null);

  // Hooks
  const { isSending, sendMessage } = useSendMessage();
  const {
    isRecording, startRecording, stopRecording,
    recordedFile, clearRecordedFile, recordingTime
  } = useAudioRecorder();

  // Dados do atendente
  const { agentName, getSettingValue } = useConversationsStore();
  const isSignatureEnabled = getSettingValue("enable_signature") === "true";

  // Canal atual
  const getChannelFromUserId = (userId) => {
    if (!userId) return 'whatsapp';
    if (userId.endsWith('@t.msgcli.net')) return 'telegram';
    return 'whatsapp';
  };
  const currentChannel = getChannelFromUserId(userIdSelecionado);

  // Fechar popovers
  useClickOutside([emojiPickerRef, quickReplyRef], () => {
    setShowEmoji(false);
    setShowQuickReplies(false);
  });

  // QuickReplies existe?
  useEffect(() => {
    (async () => {
      try {
        const data = await apiGet("/quick-replies");
        setHasQuickReplies(data.length > 0);
      } catch (err) {
        console.error("Erro ao checar quick replies:", err);
      }
    })();
  }, []);

  // Troca de conversa => limpa input/arquivo/reply
  useEffect(() => {
    setText('');
    setFile(null);
    setReplyTo?.(null);
  }, [userIdSelecionado, setReplyTo]);

  // fim da gravação
  useEffect(() => {
    if (recordedFile) setFile(recordedFile);
  }, [recordedFile]);

  // Enviar
  const handleSend = (e) => {
    e.preventDefault();
    if (isRecording) return stopRecording();

    const trimmedText = text.trim();
    const hasTextOrFile = trimmedText || file;
    if (!hasTextOrFile) {
      startRecording();
      return;
    }

    // Janela 24h (WhatsApp)
    if (currentChannel === 'whatsapp' && !canSendFreeform) {
      toast.warn('Fora da janela de 24h. Envie um template.', { position: 'bottom-right' });
      return;
    }

    // Assinatura opcional no WhatsApp
    let finalText = trimmedText;
    if (isSignatureEnabled && trimmedText && currentChannel === 'whatsapp') {
      finalText = `*${agentName}:*\n\n${trimmedText}`;
    }

    sendMessage(
      {
        text: finalText,
        file,
        userId: userIdSelecionado,
        replyTo: replyTo?.message_id || null,
      },
      onMessageAdded
    );

    setText('');
    setFile(null);
    setReplyTo(null);
    setShowQuickReplies(false);
  };

  const handleQuickReplySelect = (qr) => {
    setText(qr.content);
    setShowQuickReplies(false);
    textareaRef.current?.focus();
  };

  const handleTextChange = (e) => {
    const value = e.target.value;
    setText(value);
    setShowQuickReplies(
      hasQuickReplies && value.trim().startsWith("/") && value.trim().length === 1
    );
  };

  const handleRemoveFile = () => {
    setFile(null);
    clearRecordedFile();
    fileInputRef.current.value = "";
    imageInputRef.current.value = "";
  };

  const preview = buildReplyPreview(replyTo);

  return (
    <>
      {replyTo && (
        <div className="reply-preview">
          <div className="reply-content">
            <div className="reply-author">Você está respondendo:</div>
            <div className="reply-text">
              {preview && (
                <>
                  <strong>{preview.title || (replyTo?.direction === 'outgoing' ? 'Você' : '')}</strong>
                  {preview.title && ' '}
                  {preview.snippet}
                </>
              )}
            </div>
          </div>
          <button
            type="button"
            className="reply-cancel"
            onClick={() => setReplyTo(null)}
            title="Cancelar resposta"
          >
            <Slash size={16} />
          </button>
        </div>
      )}

      <form className="send-message-form" onSubmit={(e) => e.preventDefault()}>
        <div className="message-input-wrapper">
          {hasQuickReplies && <span className="quick-reply-hash">/</span>}

          <AutoResizingTextarea
            ref={textareaRef}
            className={`send-message-textarea ${isRecording ? "is-recording" : ""}`}
            placeholder={
              file
                ? file.type.startsWith("audio/")
                  ? "Gravação pronta..."
                  : "Digite legenda..."
                : isRecording
                ? `⏱ ${String(Math.floor(recordingTime / 60)).padStart(2, "0")}:${String(recordingTime % 60).padStart(2, "0")}`
                : "Escreva uma mensagem..."
            }
            value={text}
            onChange={handleTextChange}
            onSubmit={handleSend}
            disabled={isSending || isRecording || (file && file.type.startsWith("audio/"))}
            rows={1}
          />
        </div>

        <div className="send-button-group">
          <button type="button" className="btn-attachment" onClick={() => setShowEmoji((v) => !v)}>
            <Smile size={24} color="#555" />
          </button>

          {(currentChannel === 'whatsapp' || currentChannel === 'telegram') && (
            <>
              <button type="button" className="btn-attachment" onClick={() => fileInputRef.current.click()}>
                <Paperclip size={24} color="#555" />
              </button>
              <input type="file" ref={fileInputRef} style={{ display: "none" }} onChange={(e) => setFileToConfirm(e.target.files[0])} />

              <button type="button" className="btn-attachment" onClick={() => imageInputRef.current.click()}>
                <Image size={24} color="#555" />
              </button>
              <input type="file" ref={imageInputRef} style={{ display: "none" }} accept="image/*" onChange={(e) => setFileToConfirm(e.target.files[0])} />
            </>
          )}

          <FilePreview file={file} onRemove={handleRemoveFile} isSending={isSending} isRecording={isRecording} />

          <button type="submit" className="btn-send" onClick={handleSend} disabled={isSending}>
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="#fff">
              <path
                d={
                  isRecording
                    ? "M6 6h12v12H6z"
                    : text.trim() || file
                    ? "M2.01 21l20.99-9L2.01 3v7l15 2-15 2z"
                    : "M12 14a3 3 0 0 0 3-3V5a3 3 0 0 0-6 0v6a3 3 0 0 0 3 3zM17 11a5 5 0 0 1-10 0H5a7 7 0 0 0 14 0h-2z"
                }
              />
            </svg>
          </button>
        </div>

        {showEmoji && (
          <div ref={emojiPickerRef} className="emoji-picker-container">
            <EmojiPicker onSelect={(emoji) => setText((p) => p + emoji)} />
          </div>
        )}
      </form>

      {showQuickReplies && (
        <div ref={quickReplyRef} className="quick-replies-container">
          <QuickReplies onSelect={handleQuickReplySelect} onClose={() => setShowQuickReplies(false)} />
        </div>
      )}

      {fileToConfirm && (
        <UploadFileModal
          file={fileToConfirm}
          onClose={() => setFileToConfirm(null)}
          onSubmit={async (file, caption) => {
            await sendMessage(
              {
                text: caption,
                file,
                userId: userIdSelecionado,
                replyTo: replyTo?.message_id || null,
              },
              onMessageAdded
            );
            setFileToConfirm(null);
          }}
        />
      )}
    </>
  );
}


