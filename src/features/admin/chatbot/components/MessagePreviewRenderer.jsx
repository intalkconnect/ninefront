import React from "react";

// Ajuste os caminhos abaixo conforme sua estrutura:
import TextMessage from "../../components/chat/messageTypes/TextMessage";
import QuickReplyMessage from "../../components/chat/messageTypes/QuickReplyMessage";
import InteractiveListMessage from "../../components/chat/messageTypes/InteractiveListMessage";
import InteractiveButtonsMessage from "../../components/chat/messageTypes/InteractiveButtonsMessage";
import ImageMessage from "../../components/chat/messageTypes/ImageMessage";
import DocumentMessage from "../../components/chat/messageTypes/DocumentMessage";
import AudioMessage from "../../components/chat/messageTypes/AudioMessage";
import VideoMessage from "../../components/chat/messageTypes/VideoMessage";
import ContactsMessage from "../../components/chat/messageTypes/ContactsMessage";

// styles opcionais para fallback/location (vêm do CSS do NodeConfigPanel)
import styles from "./styles/NodeConfigPanel.module.css";

/**
 * Renderer genérico para a prévia de mensagens dentro do NodeConfigPanel.
 * Props esperadas:
 * - type: "text" | "interactive" | "media" | "location" | "contacts"
 * - block: objeto do bloco selecionado (usa block.content como base)
 * - conteudoDraft: state de edição em tempo real (tem .text, .content, .media, .location)
 */
export default function MessagePreviewRenderer({ type, block, conteudoDraft }) {
  // 1) TEXT
  if (type === "text") {
    const text =
      typeof block.content === "string"
        ? (conteudoDraft.text ?? block.content)
        : (conteudoDraft.text || "");
    return <TextMessage text={text || ""} small />;
  }

  // 2) INTERACTIVE
  if (type === "interactive") {
    const c = conteudoDraft.content || {};
    if (c.type === "list") {
      return <InteractiveListMessage data={c} small />;
    }
    // Se preferir sempre o componente de botões, troque a linha abaixo:
    // return <InteractiveButtonsMessage data={c} small />;
    return <QuickReplyMessage data={c} small />;
  }

  // 3) MEDIA
  if (type === "media") {
    const m = conteudoDraft.media || {};
    const cap = m.caption || "";
    switch (m.mediaType) {
      case "document":
        return <DocumentMessage url={m.url || ""} filename={cap} small />;
      case "audio":
        return <AudioMessage url={m.url || ""} small />;
      case "video":
        return <VideoMessage url={m.url || ""} caption={cap} small />;
      case "image":
      default:
        return <ImageMessage url={m.url || ""} caption={cap} small />;
    }
  }

  // 4) LOCATION (sem componente específico — cartão simples)
  if (type === "location") {
    const loc = conteudoDraft.location || {};
    return (
      <div className={styles.locationPreview}>
        <div className={styles.locationTitle}>{loc.name || "Local"}</div>
        <div className={styles.locationAddr}>{loc.address || "Endereço"}</div>
        {(loc.latitude || loc.longitude) && (
          <div className={styles.locationCoords}>
            {loc.latitude ?? "—"}, {loc.longitude ?? "—"}
          </div>
        )}
      </div>
    );
  }

  // 5) CONTACTS (se usar como tipo separado)
  if (type === "contacts") {
    const d = conteudoDraft.content || {};
    return <ContactsMessage data={d} small />;
  }

  // fallback
  return <div className={styles.placeholder}>Sem prévia disponível</div>;
}
