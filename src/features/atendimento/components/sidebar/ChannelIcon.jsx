// components/ChannelIcon.jsx
import React from "react";
import { SiWhatsapp, SiTelegram } from "react-icons/si";
import { MessageSquare } from "lucide-react";

const MAP = {
  whatsapp: { Icon: SiWhatsapp, bg: "#25D366" },
  telegram: { Icon: SiTelegram, bg: "#26A5E4" },
  webchat:  { Icon: MessageSquare, bg: "#0ea5e9" },
};

export default function ChannelIcon({ channel, size = 16, variant = "badge" }) {
  const key = (channel || "").toLowerCase();
  const { Icon, bg } = MAP[key] || { Icon: MessageSquare, bg: "#6B7280" };

  if (variant === "badge") {
    const inner = Math.round(size * 0.62); // glifo um pouco menor que o círculo
    return (
      <span
        className="channel-badge"
        style={{
          width: size,
          height: size,
          backgroundColor: bg,
          display: "inline-flex",
          alignItems: "center",
          justifyContent: "center",
          borderRadius: "50%",
        }}
      >
        <Icon size={inner} color="#fff" />
      </span>
    );
  }

  // mono (sem fundo)
  return <Icon size={size} color={bg} />;
}
