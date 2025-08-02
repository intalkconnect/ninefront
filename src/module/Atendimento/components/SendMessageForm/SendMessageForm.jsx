import React, { useState, useRef, useEffect } from "react";
import { ToastContainer, toast } from "react-toastify";
import "react-toastify/dist/ReactToastify.css";
import { Smile, Paperclip, Image, Slash } from "lucide-react";
import "./SendMessageForm.css";

import useConversationsStore from "../../store/useConversationsStore";

import TextMessage from "../ChatWindow/messageTypes/TextMessage";
import ImageMessage from "../ChatWindow/messageTypes/ImageMessage";
import DocumentMessage from "../ChatWindow/messageTypes/DocumentMessage";
import AudioMessage from "../ChatWindow/messageTypes/AudioMessage";
import ListMessage from "../ChatWindow/messageTypes/ListMessage";

import { useSendMessage } from "../../hooks/useSendMessage";
import { useAudioRecorder } from "../../hooks/useAudioRecorder";
import { useClickOutside } from "../../hooks/useClickOutside";
import { apiGet } from "../../services/apiClient";

import FilePreview from "./FilePreview";
import AutoResizingTextarea from "./AutoResizingTextarea";
import EmojiPicker from "./EmojiPicker";
import UploadFileModal from "./UploadFileModal";
import QuickReplies from "./QuickReplies";

/**
 * Formulário de envio de mensagens com:
 *  - Emojis
 *  - Anexos
 *  - Áudio push‑to‑talk
 *  - Respostas rápidas (#) / botão hash
 */
export default function SendMessageForm({
  userIdSelecionado,
  onMessageAdded,
  replyTo,
  setReplyTo,
}) {
  /* ------------------------------------------------------------------ */
  /*  Estados principais                                                */
  /* ------------------------------------------------------------------ */
  const [text, setText] = useState("");
  const [file, setFile] = useState(null);
  const [fileToConfirm, setFileToConfirm] = useState(null);
  const [showEmoji, setShowEmoji] = useState(false);
  const [showQuickReplies, setShowQuickReplies] = useState(false);
  const [hasQuickReplies, setHasQuickReplies] = useState(false);

  /* ------------------------------------------------------------------ */
  /*  Refs                                                              */
  /* ------------------------------------------------------------------ */
  const textareaRef = useRef(null);
  const fileInputRef = useRef(null);
  const imageInputRef = useRef(null);
  const emojiPickerRef = useRef(null);
  const quickReplyRef = useRef(null);

  /* ------------------------------------------------------------------ */
  /*  Hooks personalizados                                               */
  /* ------------------------------------------------------------------ */
  const { isSending, sendMessage } = useSendMessage();
  const {
    isRecording,
    startRecording,
    stopRecording,
    recordedFile,
    clearRecordedFile,
    recordingTime,
  } = useAudioRecorder();
  const conversation = useConversationsStore(
  (s) => s.conversations[userIdSelecionado]
);


  /* ------------------------------------------------------------------ */
  /*  Detecta clique fora para fechar menus                              */
  /* ------------------------------------------------------------------ */
  useClickOutside([emojiPickerRef, quickReplyRef], () => {
    setShowEmoji(false);
    setShowQuickReplies(false);
  });

  /* ------------------------------------------------------------------ */
  /*  Verifica se existem respostas rápidas                              */
  /* ------------------------------------------------------------------ */
  useEffect(() => {
    (async () => {
      try {
        const data = await apiGet("/quickReplies");
        setHasQuickReplies(data.length > 0);
      } catch (err) {
        console.error("Erro ao checar quick replies:", err);
      }
    })();
  }, []);

  /* ------------------------------------------------------------------ */
  /*  Reset ao trocar de usuário                                         */
  /* ------------------------------------------------------------------ */
  useEffect(() => {
    setText("");
    setFile(null);
    setReplyTo(null);
  }, [userIdSelecionado]);

  /* ------------------------------------------------------------------ */
  /*  Atualiza file ao terminar gravação                                */
  /* ------------------------------------------------------------------ */
  useEffect(() => {
    if (recordedFile) setFile(recordedFile);
  }, [recordedFile]);

  /* ------------------------------------------------------------------ */
  /*  Manipuladores                                                      */
  /* ------------------------------------------------------------------ */
  const handleSend = (e) => {
  e.preventDefault();
  if (isRecording) return stopRecording();

  const trimmedText = text.trim();
  const hasTextOrFile = trimmedText || file;

  if (!hasTextOrFile) {
    startRecording();
    return;
  }

  const lastIncoming = [...(conversation?.messages || [])]
    .reverse()
    .find((msg) => msg.direction === 'incoming');

  const canSendFreeform =
    lastIncoming && isWithin24Hours(lastIncoming.timestamp);

  if (!canSendFreeform) {
    toast.warn(
      'A conversa está fora da janela de 24h. Envie um template primeiro.',
      { position: 'bottom-right' }
    );
    return;
  }

  let textToSend = trimmedText;
  if (isSignatureEnabled && trimmedText) {
    textToSend = `*${agentName}:*\n\n${trimmedText}`;
  }

  sendMessage(
    {
      text: textToSend,
      file,
      userId: userIdSelecionado,
      replyTo: replyTo?.whatsapp_message_id || null,
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

  /* ------------------------------------------------------------------ */
  /*  onChange do textarea                                               */
  /* ------------------------------------------------------------------ */
  const handleTextChange = (e) => {
    const value = e.target.value;
    setText(value);
    setShowQuickReplies(
      hasQuickReplies &&
        value.trim().startsWith("/") &&
        value.trim().length === 1
    );
  };

  /* ------------------------------------------------------------------ */
  /*  Remove arquivo                                                     */
  /* ------------------------------------------------------------------ */
  const handleRemoveFile = () => {
    setFile(null);
    clearRecordedFile();
    fileInputRef.current.value = "";
    imageInputRef.current.value = "";
  };

  /* ------------------------------------------------------------------ */
  /*  JSX                                                                */
  /* ------------------------------------------------------------------ */
  return (
    <>
      {replyTo && (
        <div className="reply-preview">
          <div className="reply-content">
            <div className="reply-author">Você está respondendo:</div>
            <div className="reply-text">
              {replyTo.content?.text || replyTo.content || "[Mensagem]"}
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
        {/* Campo de mensagem + ícone hash */}
        <div className="message-input-wrapper">
          {hasQuickReplies && <span className="quick-reply-hash">/</span>}

          <AutoResizingTextarea
            ref={textareaRef}
            className="send-message-textarea"
            placeholder={
              file
                ? file.type.startsWith("audio/")
                  ? "Gravação pronta..."
                  : "Digite legenda..."
                : isRecording
                ? `⏱ ${String(Math.floor(recordingTime / 60)).padStart(
                    2,
                    "0"
                  )}:${String(recordingTime % 60).padStart(2, "0")}`
                : "Escreva uma mensagem..."
            }
            value={text}
            onChange={handleTextChange}
            onSubmit={handleSend}
            disabled={
              isSending ||
              isRecording ||
              (file && file.type.startsWith("audio/"))
            }
            rows={1}
          />
        </div>

        {/* Botões */}
        <div className="send-button-group">
          {/*           {hasQuickReplies && (
            <button
              type="button"
              className="btn-attachment"
              onClick={() => setShowQuickReplies((v) => !v)}
              title="Respostas Rápidas"
            >
              /
            </button>
          )} */}

          <button
            type="button"
            className="btn-attachment"
            onClick={() => setShowEmoji((v) => !v)}
          >
            <Smile size={24} color="#555" />
          </button>

          <button
            type="button"
            className="btn-attachment"
            onClick={() => fileInputRef.current.click()}
          >
            <Paperclip size={24} color="#555" />
          </button>
          <input
            type="file"
            ref={fileInputRef}
            style={{ display: "none" }}
            onChange={(e) => setFileToConfirm(e.target.files[0])}
          />

          <button
            type="button"
            className="btn-attachment"
            onClick={() => imageInputRef.current.click()}
          >
            <Image size={24} color="#555" />
          </button>
          <input
            type="file"
            ref={imageInputRef}
            style={{ display: "none" }}
            accept="image/*"
            onChange={(e) => setFileToConfirm(e.target.files[0])}
          />

          <FilePreview
            file={file}
            onRemove={handleRemoveFile}
            isSending={isSending}
            isRecording={isRecording}
          />

          <button
            type="submit"
            className="btn-send"
            onClick={handleSend}
            disabled={isSending}
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              viewBox="0 0 24 24"
              fill="#fff"
            >
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

        {/* Emoji-picker */}
        {showEmoji && (
          <div ref={emojiPickerRef} className="emoji-picker-container">
            <EmojiPicker onSelect={(emoji) => setText((p) => p + emoji)} />
          </div>
        )}
      </form>

      {/* Quick Replies dropdown */}
      {showQuickReplies && (
        <div ref={quickReplyRef} className="quick-replies-container">
          <QuickReplies
            onSelect={handleQuickReplySelect}
            onClose={() => setShowQuickReplies(false)}
          />
        </div>
      )}

      {/* Modal confirmação upload */}
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
                replyTo: replyTo?.whatsapp_message_id || null,
              },
              onMessageAdded
            );
            setFileToConfirm(null);
          }}
        />
      )}

      <ToastContainer />
    </>
  );
}



