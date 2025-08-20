import { useState, useCallback } from "react";

export default function WhatsAppEmbeddedSignupButton({ tenant, label = "Conectar WhatsApp" }) {
  const [loading, setLoading] = useState(false);
  const AUTH_ORIGIN = import.meta.env.VITE_EMBED_ORIGIN;      // ex.: https://auth.dkdevs.com.br
  const API_BASE    = import.meta.env.VITE_API_BASE_URL || ""; // opcional, passa pro embed

  const launch = useCallback(() => {
    if (!AUTH_ORIGIN) { alert("VITE_EMBED_ORIGIN não configurado"); return; }
    if (!tenant) { alert("Tenant/subdomain não detectado"); return; }

    const origin = window.location.origin;
    const url = `${AUTH_ORIGIN}/wa-embed.html?tenant=${encodeURIComponent(tenant)}&origin=${encodeURIComponent(origin)}${API_BASE ? `&api=${encodeURIComponent(API_BASE)}` : ""}`;

    setLoading(true);
    const w = window.open(url, "wa-embed", "width=520,height=720,menubar=0,toolbar=0");
    if (!w) {
      setLoading(false);
      alert("Popup bloqueado pelo navegador. Habilite popups para este site.");
    } else {
      // o estado volta ao normal quando recebermos a mensagem (na Canais.jsx) ou se o usuário fechar
      const timer = setInterval(() => {
        if (w.closed) { setLoading(false); clearInterval(timer); }
      }, 500);
    }
  }, [AUTH_ORIGIN, API_BASE, tenant]);

  return (
    <button onClick={launch} disabled={loading} style={{ opacity: loading ? 0.6 : 1 }}>
      {loading ? "Abrindo..." : label}
    </button>
  );
}
