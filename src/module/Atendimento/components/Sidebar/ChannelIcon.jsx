// components/ChannelIcon.jsx
import React from "react";
import { SiWhatsapp, SiTelegram } from "react-icons/si";
import { MessageSquare } from "lucide-react"; // webchat genérico (ou escolha outro)

const ChannelIcon = ({ channel, size = 16 }) => {
  const common = { width: size, height: size };

  switch ((channel || "").toLowerCase()) {
    case "whatsapp":
      return <SiWhatsapp {...common} aria-label="WhatsApp" />;
    case "telegram":
      return <SiTelegram {...common} aria-label="Telegram" />;
    case "webchat":
      return <MessageSquare {...common} aria-label="Webchat" />;
    default:
      return <span style={{ display: "inline-block", ...common }} />;
  }
};

export default ChannelIcon;
