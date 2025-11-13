import { useCallback, useEffect, useRef, useState } from "react";
import { apiPost } from "../../../shared/apiClient";

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
 * - Abre popup do Embedded Signup (WAES) usando business.facebook.com.
 * - Usa redirect_uri = `${AUTH_ORIGIN}/oauth/wa` (rota existente no seu server).
 * - Escuta postMessage do domínio AUTH_ORIGIN com { type: "wa:oauth", code, state }.
 * - Finaliza a conexão chamando sua API `/whatsapp/finalize` e, se ok,
 *   dispara onPickSuccess(payload).
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
  const APP_ID =
    import.meta.env.VITE_META_APP_ID ||
    import.meta.env.VITE_FACEBOOK_APP_ID; // fallback opcional
  const CONFIG_ID =
    import.meta.env.VITE_WA_CONFIG_ID ||
    import.meta.env.VITE_META_LOGIN_CONFIG_ID; // aceita os dois nomes
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

  // Listener do postMessage enviado por /oauth/wa (no AUTH_ORIGIN)
  useEffect(() => {
    async function onMessage(ev) {
      try {
        if (!AUTH_ORIGIN || ev.origin !== AUTH_ORIGIN) return; // segurança
        const d = ev.data || {};
        if (d?.type !== "wa:oauth") return;

        // d = { type: "wa:oauth", code, state }
        const code = d.code || "";
        let ctx = {};
        try { ctx = d.state ? JSON.parse(atob(d.state)) : {}; } catch {}
        const redirect_uri = `${AUTH_ORIGIN}/oauth/wa`;
        const sub = ctx?.tenant || tenant;

        // Finaliza no backend (troca code -> tokens/phone)
        const res = await apiPost("/whatsapp/finalize", {
          subdomain: sub,
          code,
          redirect_uri
        });

        if (res?.ok) {
          // normaliza payload esperado
          const phoneId =
            res.phone_number_id ||
            res?.phone?.id ||
            res?.phone_id ||
            "";
          const display =
            res?.phone?.display_phone_number ||
            res?.display ||
            null;

          onPickSuccess?.({ phone_number_id: String(phoneId), display });
        } else {
          throw new Error(res?.error || "Falha ao finalizar WhatsApp");
        }
      } catch (e) {
        onError?.(e);
      } finally {
        cleanup();
      }
    }

    window.addEventListener("message", onMessage);
    return () => window.removeEventListener("message", onMessage);
  }, [AUTH_ORIGIN, cleanup, onPickSuccess, onError, tenant]);

  const start = useCallback(() => {
    if (!tenant)       { onError?.(new Error("Tenant não detectado")); return; }
    if (!APP_ID)       { onError?.(new Error("VITE_META_APP_ID ausente")); return; }
    if (!CONFIG_ID)    { onError?.(new Error("VITE_WA_CONFIG_ID / VITE_META_LOGIN_CONFIG_ID ausente")); return; }
    if (!AUTH_ORIGIN)  { onError?.(new Error("VITE_EMBED_ORIGIN ausente")); return; }
    if (loading) return;

    setLoading(true);

    const redirectUri = `${AUTH_ORIGIN}/oauth/wa`;

    // infos que o callback poderá usar
    const state = btoa(JSON.stringify({
      tenant,
      origin: window.location.origin,
      api: API_BASE,
      redirectUri
    }));

    // URL oficial do WhatsApp Embedded Signup
    const extras = encodeURIComponent(JSON.stringify({ sessionInfoVersion: "3", version: "v3" }));
    const params = new URLSearchParams({
      app_id: String(APP_ID),
      config_id: String(CONFIG_ID),
      redirect_uri: redirectUri,
      state,
      extras
    });
    const url = `https://business.facebook.com/messaging/whatsapp/onboard/?${params.toString()}`;

    const feat = "width=800,height=720,menubar=0,toolbar=0";
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
      } catch { /* ignore */ }
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
