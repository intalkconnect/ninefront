// webapp/src/pages/Channels/components/InstagramConnectButton.jsx
import { useCallback } from "react";

export default function InstagramConnectButton({ tenant, label = "Conectar Instagram" }) {
  const APP_ID    = import.meta.env.VITE_META_APP_ID;
  const AUTH_ORIG = import.meta.env.VITE_EMBED_ORIGIN;     // ex.: https://auth.seudominio.com
  const API_BASE  = import.meta.env.VITE_API_BASE_URL;

  const start = useCallback(() => {
    if (!tenant) return alert("Tenant não detectado");
    if (!APP_ID) return alert("VITE_META_APP_ID ausente");
    if (!AUTH_ORIG) return alert("VITE_EMBED_ORIGIN ausente");

    const redirectUri = `${AUTH_ORIG}/ig-callback.html`;   // ou /oauth/ig
    const scope = [
      "pages_show_list","pages_manage_metadata","pages_messaging",
      "instagram_basic","instagram_manage_messages"
    ].join(",");

    const state = btoa(JSON.stringify({ tenant, origin: window.location.origin, api: API_BASE, redirectUri }));

    const url =
      `https://www.facebook.com/v23.0/dialog/oauth` +
      `?client_id=${encodeURIComponent(APP_ID)}` +
      `&redirect_uri=${encodeURIComponent(redirectUri)}` +
      `&response_type=code` +
      `&scope=${encodeURIComponent(scope)}` +
      `&state=${encodeURIComponent(state)}`;

    window.open(url, "ig-connect", "width=520,height=720,menubar=0,toolbar=0");
  }, [tenant, APP_ID, AUTH_ORIG, API_BASE]);

  return <button onClick={start}>{label}</button>;
}
