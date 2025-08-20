// components/ChannelIcon.jsx
import React from "react";
// importe apenas os que você precisa (cada um vira um módulo pequeno)
import whatsapp from "simple-icons/icons/whatsapp.js";
import telegram from "simple-icons/icons/telegram.js";
// não existe "webchat" como marca; use um ícone genérico do Lucide
import { MessageSquare } from "lucide-react";

/**
 * Renderiza o logo do canal como SVG inline (sem requests).
 * - size: px
 * - color: se não passar, usa a cor oficial do simple-icons
 */
function BrandSvg({ icon, size = 16, color }) {
  // simple-icons exporta { title, hex, slug, path }
  const fill = color || `#${icon.hex}`;
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      role="img"
      aria-label={icon.title}
      focusable="false"
      style={{ display: "block" }}
    >
      <path d={icon.path} fill={fill} />
    </svg>
  );
}

const ChannelIcon = React.memo(function ChannelIcon({
  channel,
  size = 16,
  color, // opcional para sobrescrever a cor de marca
}) {
  switch ((channel || "").toLowerCase()) {
    case "whatsapp":
      return <BrandSvg icon={whatsapp} size={size} color={color} />;
    case "telegram":
      return <BrandSvg icon={telegram} size={size} color={color} />;
    case "webchat":
    case "site":
    case "web":
      // ícone mono (Lucide) — usa currentColor
      return <MessageSquare size={size} strokeWidth={2} />;
    default:
      return <span style={{ width: size, height: size, display: "inline-block" }} />;
  }
});

export default ChannelIcon;
