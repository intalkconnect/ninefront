// components/InstagramConnectButton.jsx
import { useCallback } from "react";

export default function InstagramConnectButton({ tenant, label = "Conectar Instagram" }) {
  const APP_ID      = import.meta.env.VITE_META_APP_ID;
  const AUTH_BACK   = import.meta.env.VITE_AUTH_BACKEND; // ex.: https://auth.seudominio.com
  const API_BASE    = import.meta.env.VITE_API_BASE_URL; // seu backend que faz as chamadas Graph

  const start = useCallback(() => {
    if (!tenant) return alert("Tenant não detectado");
    if (!APP_ID) return alert("VITE_META_APP_ID ausente");
    if (!AUTH_BACK) return alert("VITE_AUTH_BACKEND ausente");

    const redirectUri = `${AUTH_BACK}/fb-callback`; // seu endpoint que troca code→token
    const scope = [
      "pages_show_list",
      "pages_manage_metadata",
      "pages_messaging",
      "instagram_basic",
      "instagram_manage_messages"
    ].join(",");

    // opcional: empacotar contexto para a volta
    const state = btoa(JSON.stringify({ tenant, api: API_BASE, origin: window.location.origin }));

    const url =
      `https://www.facebook.com/v23.0/dialog/oauth` +
      `?client_id=${encodeURIComponent(APP_ID)}` +
      `&redirect_uri=${encodeURIComponent(redirectUri)}` +
      `&response_type=code` +
      `&scope=${encodeURIComponent(scope)}` +
      `&state=${encodeURIComponent(state)}`;

    window.open(url, "ig-connect", "width=520,height=720,menubar=0,toolbar=0");
  }, [tenant, APP_ID, AUTH_BACK, API_BASE]);

  return <button onClick={start}>{label}</button>;
}
