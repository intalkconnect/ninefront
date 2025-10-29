// webapp/src/pages/Channels/components/FacebookConnectButton.jsx
import { useCallback } from "react";

export default function FacebookConnectButton({ tenant, label = "Conectar Facebook" }) {
  const APP_ID    = import.meta.env.VITE_META_APP_ID;
  const AUTH_ORIG = import.meta.env.VITE_EMBED_ORIGIN; // ex.: https://auth.seu-dominio.com

  const start = useCallback(() => {
    if (!tenant) return alert("Tenant não detectado");
    if (!APP_ID) return alert("VITE_META_APP_ID ausente");
    if (!AUTH_ORIG) return alert("VITE_EMBED_ORIGIN ausente");

    const redirectUri = `${AUTH_ORIG}/oauth/fb`;
    const scope = [
    "pages_show_list",
    "pages_manage_metadata",
    "pages_messaging",
    "pages_read_engagement",
    "business_management"
    ].join(",");

    const state = btoa(JSON.stringify({ tenant, origin: window.location.origin, redirectUri }));

    const url =
      `https://www.facebook.com/v23.0/dialog/oauth` +
      `?client_id=${encodeURIComponent(APP_ID)}` +
      `&redirect_uri=${encodeURIComponent(redirectUri)}` +
      `&response_type=code` +
      `&scope=${encodeURIComponent(scope)}` +
      `&state=${encodeURIComponent(state)}`;

    window.open(url, "fb-connect", "width=520,height=720,menubar=0,toolbar=0");
  }, [tenant, APP_ID, AUTH_ORIG]);

  return <button onClick={start}>{label}</button>;
}
