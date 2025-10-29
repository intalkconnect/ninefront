import React, { useCallback, useEffect, useRef, useState } from "react";

/**
 * InstagramConnectButton
 * - Estilável via className/style
 * - Evita duplo clique com estado de loading
 * - Abre popup do OAuth e aguarda postMessage do AUTH_ORIG
 * - Chama onConnected(payload) quando sucesso
 *
 * Expectativa do postMessage (enviado pela sua página de redirect em AUTH_ORIG):
 *   window.opener.postMessage(
 *     { source: "ig-oauth", ok: true, page_id, page_name, ig_user_id, ig_username, user_token },
 *     originDoCaller
 *   );
 */
export default function InstagramConnectButton({
  tenant,
  label = "Conectar Instagram",
  className = "",
  style,
  title,
  disabled = false,
  onConnected,     // (payload) => void
  onError,         // (err) => void
}) {
  const APP_ID    = import.meta.env.VITE_META_APP_ID;
  const AUTH_ORIG = import.meta.env.VITE_EMBED_ORIGIN; // ex.: https://auth.seu-dominio.com

  const [loading, setLoading] = useState(false);
  const popupRef = useRef(null);
  const timerRef = useRef(null);

  // encerra listeners/recursos
  const cleanup = useCallback(() => {
    if (popupRef.current && !popupRef.current.closed) {
      try { popupRef.current.close(); } catch {}
    }
    popupRef.current = null;
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
    setLoading(false);
  }, []);

  // escuta o retorno do AUTH_ORIG
  useEffect(() => {
    function onMessage(ev) {
      try {
        // segurança: só aceita do AUTH_ORIG
        if (!AUTH_ORIG || ev.origin !== AUTH_ORIG) return;
        const d = ev.data || {};
        if (d?.source !== "ig-oauth") return;

        if (d?.ok) {
          // sucesso
          onConnected?.({
            page_id: String(d.page_id || ""),
            page_name: d.page_name || null,
            ig_user_id: String(d.ig_user_id || ""),
            ig_username: d.ig_username || null,
            user_token: d.user_token || null,
          });
        } else {
          const err = new Error(d?.error || "ig_oauth_failed");
          onError?.(err);
        }
      } catch (e) {
        onError?.(e);
      } finally {
        cleanup();
      }
    }

    window.addEventListener("message", onMessage);
    return () => window.removeEventListener("message", onMessage);
  }, [AUTH_ORIG, cleanup, onConnected, onError]);

  const start = useCallback(() => {
    if (!tenant)   { onError?.(new Error("Tenant não detectado")); return; }
    if (!APP_ID)   { onError?.(new Error("VITE_META_APP_ID ausente")); return; }
    if (!AUTH_ORIG){ onError?.(new Error("VITE_EMBED_ORIGIN ausente")); return; }
    if (loading) return;

    setLoading(true);

    const redirectUri = `${AUTH_ORIG}/oauth/ig`;

    // Escopos para Instagram Messaging
    const scope = [
      "pages_show_list",
      "pages_read_engagement",
      "pages_manage_metadata",
      "instagram_basic",
      "instagram_manage_messages",
      "business_management",
    ].join(",");

    const state = btoa(JSON.stringify({
      tenant,
      origin: window.location.origin,
      redirectUri,
    }));

    const url =
      `https://www.facebook.com/v23.0/dialog/oauth` +
      `?client_id=${encodeURIComponent(APP_ID)}` +
      `&redirect_uri=${encodeURIComponent(redirectUri)}` +
      `&response_type=code` +
      `&scope=${encodeURIComponent(scope)}` +
      `&state=${encodeURIComponent(state)}`;

    // abre popup
    const feat = "width=520,height=720,menubar=0,toolbar=0";
    popupRef.current = window.open(url, "ig-connect", feat);

    if (!popupRef.current) {
      setLoading(false);
      onError?.(new Error("Não foi possível abrir a janela de autenticação."));
      return;
    }

    // watchdog: se o usuário fechar o popup, cancelar loading
    timerRef.current = setInterval(() => {
      try {
        if (!popupRef.current || popupRef.current.closed) {
          cleanup();
        }
      } catch {
        // ignore cross-origin access issues
      }
    }, 500);
  }, [tenant, APP_ID, AUTH_ORIG, loading, cleanup, onError]);

  return (
    <button
      type="button"
      className={className}
      style={style}
      title={title || label}
      onClick={start}
      disabled={disabled || loading}
    >
      {loading ? "Conectando..." : label}
    </button>
  );
}
