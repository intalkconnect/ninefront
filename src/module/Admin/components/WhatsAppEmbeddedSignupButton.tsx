// components/WhatsAppEmbeddedSignupButton.jsx
import { useState, useCallback } from "react";

export default function WhatsAppEmbeddedSignupButton({ tenant, label = "Conectar WhatsApp" }) {
  const [loading, setLoading] = useState(false);
  const AUTH_ORIGIN = import.meta.env.VITE_EMBED_ORIGIN;          // ex.: https://auth.dkdevs.com.br
  const API_BASE    = import.meta.env.VITE_API_BASE_URL || "";     // ex.: https://hmg.dkdevs.com.br

  const start = useCallback(() => {
    if (!AUTH_ORIGIN) { alert("VITE_EMBED_ORIGIN não configurado"); return; }
    if (!tenant)      { alert("Tenant não detectado"); return; }

    // abre UMA janela; dentro dela o login da Meta acontecerá em `display:'page'`
    const origin = window.location.origin;
    const url = `${AUTH_ORIGIN}/wa-embed.html?tenant=${encodeURIComponent(tenant)}&origin=${encodeURIComponent(origin)}&api=${encodeURIComponent(API_BASE)}&autostart=1`;
    const w = window.open(url, "wa-embed", "width=520,height=720,menubar=0,toolbar=0");
    if (!w) alert("Popup bloqueado. Habilite popups para este site.");
    else setLoading(true);
  }, [AUTH_ORIGIN, API_BASE, tenant]);

  return (
    <button onClick={start} disabled={loading} style={{ opacity: loading ? 0.6 : 1 }}>
      {loading ? "Abrindo..." : label}
    </button>
  );
}
