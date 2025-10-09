import { useCallback } from "react";

export default function InstagramConnectButton({ tenant, label = "Conectar Instagram" }) {
  const APP_ID    = import.meta.env.VITE_META_APP_ID;
  const AUTH_ORIG = import.meta.env.VITE_EMBED_ORIGIN; // ex.: https://auth.seu-dominio.com

  const start = useCallback(() => {
    if (!tenant)   return alert("Tenant não detectado");
    if (!APP_ID)   return alert("VITE_META_APP_ID ausente");
    if (!AUTH_ORIG) return alert("VITE_EMBED_ORIGIN ausente");

    const redirectUri = `${AUTH_ORIG}/oauth/ig`;

    // ⚠️ Escopos mínimos para Instagram Messaging:
    // - pages_show_list: listar páginas do usuário
    // - pages_read_engagement: ler infos da página
    // - pages_manage_metadata: gerenciar assinatura de webhooks
    // - instagram_basic: básico do IG business
    // - instagram_manage_messages: DMs (obrigatório)
    // - business_management: vínculo página/conta
    const scope = [
      "pages_show_list",
      "pages_read_engagement",
      "pages_manage_metadata",
      "instagram_basic",
      "instagram_manage_messages",
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

    window.open(url, "ig-connect", "width=520,height=720,menubar=0,toolbar=0");
  }, [tenant, APP_ID, AUTH_ORIG]);

  return <button onClick={start}>{label}</button>;
}
