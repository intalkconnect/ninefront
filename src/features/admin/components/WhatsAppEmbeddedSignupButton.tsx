// components/WhatsAppEmbeddedSignupButton.jsx
import { useCallback } from "react";

export default function WhatsAppEmbeddedSignupButton({ tenant, label = "Conectar WhatsApp" }) {
  const APP_ID     = import.meta.env.VITE_META_APP_ID;
  const CONFIG_ID  = import.meta.env.VITE_META_LOGIN_CONFIG_ID;
  const AUTH_ORIGIN= import.meta.env.VITE_EMBED_ORIGIN;        // ex.: https://auth.dkdevs.com.br
  const API_BASE   = import.meta.env.VITE_API_BASE_URL || "";  // ex.: https://hmg.dkdevs.com.br

  const start = useCallback(() => {
    if (!tenant)      return alert("Tenant não detectado");
    if (!APP_ID)      return alert("VITE_META_APP_ID ausente");
    if (!CONFIG_ID)   return alert("VITE_META_LOGIN_CONFIG_ID ausente");
    if (!AUTH_ORIGIN) return alert("VITE_EMBED_ORIGIN ausente");

    const redirectUri = `${AUTH_ORIGIN}/wa-callback.html`;
    // carrego infos no state (base64) pra callback saber pra onde voltar e qual tenant/api usar
    const state = btoa(JSON.stringify({
      tenant,
      origin: window.location.origin,
      api: API_BASE
    }));

    const url =
      `https://www.facebook.com/v23.0/dialog/oauth` +
      `?client_id=${encodeURIComponent(APP_ID)}` +
      `&redirect_uri=${encodeURIComponent(redirectUri)}` +
      `&response_type=code` +
      `&config_id=${encodeURIComponent(CONFIG_ID)}` +
      `&state=${encodeURIComponent(state)}`;

    window.open(
      url,
      "wa-embed",
      "width=520,height=720,menubar=0,toolbar=0"
    );
  }, [tenant, APP_ID, CONFIG_ID, AUTH_ORIGIN, API_BASE]);

  return <button onClick={start}>{label}</button>;
}
