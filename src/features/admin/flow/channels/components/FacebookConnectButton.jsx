import React, { useCallback, useEffect, useRef, useState } from "react";

/**
 * FacebookConnectButton
 * - Estilável (className/style)
 * - Loading + watchdog para popup
 * - Espera postMessage do AUTH_ORIG e retorna dados da página
 *
 * Esperado do redirect (no AUTH_ORIG):
 * window.opener?.postMessage(
 *   { source: "fb-oauth", ok: true, page_id, page_name, user_token },
 *   callerOrigin
 * );
 */
export default function FacebookConnectButton({
  tenant,
  label = "Conectar Facebook",
  className = "",
  style,
  title,
  disabled = false,
  onConnected,   // (payload) => void
  onError,       // (err) => void
}) {
  const APP_ID    = import.meta.env.VITE_META_APP_ID;
  const AUTH_ORIG = import.meta.env.VITE_EMBED_ORIGIN; // ex.: https://auth.seu-dominio.com

  const [loading, setLoading] = useState(false);
  const popupRef = useRef(null);
  const timerRef = useRef(null);

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

  // escuta retorno do AUTH_ORIG (redirect)
  useEffect(() => {
    function onMessage(ev) {
      try {
        if (!AUTH_ORIG || ev.origin !== AUTH_ORIG) return;
        const d = ev.data || {};
        if (d?.source !== "fb-oauth") return;

        if (d?.ok) {
          onConnected?.({
            page_id: String(d.page_id || ""),
            page_name: d.page_name || null,
            user_token: d.user_token || null,
          });
        } else {
          onError?.(new Error(d?.error || "fb_oauth_failed"));
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
    if (!tenant)    { onError?.(new Error("Tenant não detectado")); return; }
    if (!APP_ID)    { onError?.(new Error("VITE_META_APP_ID ausente")); return; }
    if (!AUTH_ORIG) { onError?.(new Error("VITE_EMBED_ORIGIN ausente")); return; }
    if (loading) return;

    setLoading(true);

    const redirectUri = `${AUTH_ORIG}/oauth/fb`;
    const scope = [
      "pages_show_list",
      "pages_manage_metadata",
      "pages_messaging",
      "pages_read_engagement",
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

    const feat = "width=520,height=720,menubar=0,toolbar=0";
    popupRef.current = window.open(url, "fb-connect", feat);

    if (!popupRef.current) {
      setLoading(false);
      onError?.(new Error("Não foi possível abrir a janela de autenticação."));
      return;
    }

    // watchdog: se o usuário fechar o popup
    timerRef.current = setInterval(() => {
      try {
        if (!popupRef.current || popupRef.current.closed) cleanup();
      } catch {}
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
