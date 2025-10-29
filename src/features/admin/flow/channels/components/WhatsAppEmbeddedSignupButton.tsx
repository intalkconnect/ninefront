import { useCallback, useEffect, useRef, useState } from "react";

/**
 * WhatsAppEmbeddedSignupButton
 *
 * Props:
 * - tenant: string (obrigatório)
 * - label: string (default: "Conectar WhatsApp")
 * - className, style, title, disabled
 * - onPickSuccess: (payload) => void
 *      payload esperado: { phone_number_id: string, display?: string }
 * - onError: (err) => void
 *
 * Comportamento:
 * - Abre popup do OAuth (Embedded Signup).
 * - Escuta postMessage do domínio AUTH_ORIGIN (VITE_EMBED_ORIGIN).
 * - Quando recebe { source: "wa-embed", ok: true, phone_number_id, display }, chama onPickSuccess.
 */
export default function WhatsAppEmbeddedSignupButton({
  tenant,
  label = "Conectar WhatsApp",
  className = "",
  style,
  title,
  disabled = false,
  onPickSuccess,
  onError,
}) {
  const APP_ID = import.meta.env.VITE_META_APP_ID;
  const CONFIG_ID = import.meta.env.VITE_META_LOGIN_CONFIG_ID;
  const AUTH_ORIGIN = import.meta.env.VITE_EMBED_ORIGIN;        // ex.: https://auth.seu-dominio.com
  const API_BASE = import.meta.env.VITE_API_BASE_URL || "";     // ex.: https://hmg.seu-dominio.com

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

  // Listener do postMessage enviado por /wa-callback.html (no AUTH_ORIGIN)
  useEffect(() => {
    function onMessage(ev) {
      try {
        if (!AUTH_ORIGIN || ev.origin !== AUTH_ORIGIN) return;  // segurança
        const d = ev.data || {};
        if (d?.source !== "wa-embed") return;

        if (d?.ok) {
          const payload = {
            phone_number_id: String(d.phone_number_id || ""),
            display: d.display || null,
          };
          onPickSuccess?.(payload);
        } else {
          const err = new Error(d?.error || "wa_embed_failed");
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
  }, [AUTH_ORIGIN, cleanup, onPickSuccess, onError]);

  const start = useCallback(() => {
    if (!tenant)    { onError?.(new Error("Tenant não detectado")); return; }
    if (!APP_ID)    { onError?.(new Error("VITE_META_APP_ID ausente")); return; }
    if (!CONFIG_ID) { onError?.(new Error("VITE_META_LOGIN_CONFIG_ID ausente")); return; }
    if (!AUTH_ORIGIN) { onError?.(new Error("VITE_EMBED_ORIGIN ausente")); return; }
    if (loading) return;

    setLoading(true);

    const redirectUri = `${AUTH_ORIGIN}/wa-callback.html`;

    // Informações necessárias para o callback saber de onde veio e qual API usar
    const state = btoa(JSON.stringify({
      tenant,
      origin: window.location.origin,
      api: API_BASE,
    }));

    const url =
      `https://www.facebook.com/v23.0/dialog/oauth` +
      `?client_id=${encodeURIComponent(APP_ID)}` +
      `&redirect_uri=${encodeURIComponent(redirectUri)}` +
      `&response_type=code` +
      `&config_id=${encodeURIComponent(CONFIG_ID)}` +
      `&state=${encodeURIComponent(state)}`;

    const feat = "width=520,height=720,menubar=0,toolbar=0";
    popupRef.current = window.open(url, "wa-embed", feat);

    if (!popupRef.current) {
      setLoading(false);
      onError?.(new Error("Não foi possível abrir a janela de autenticação."));
      return;
    }

    // watchdog: se o usuário fechar a janela, cancelamos o loading
    timerRef.current = setInterval(() => {
      try {
        if (!popupRef.current || popupRef.current.closed) {
          cleanup();
        }
      } catch {
        // ignore cross-origin access issues
      }
    }, 500);
  }, [tenant, APP_ID, CONFIG_ID, AUTH_ORIGIN, API_BASE, loading, cleanup, onError]);

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
