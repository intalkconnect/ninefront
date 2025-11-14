import { useCallback, useEffect, useRef, useState } from "react";

/**
 * WhatsAppEmbeddedSignupButton
 *
 * Props:
 * - tenant: string (obrigatório)
 * - label: string (default: "Conectar WhatsApp")
 * - className, style, title, disabled
 * - onPickSuccess: ({ phone_number_id, display? }) => void
 * - onError: (err) => void
 *
 * Fluxo:
 * - Abre o popup do Meta Onboard (Business Manager) com app_id, config_id, state e extras.
 * - NÃO usa mais redirect/callback HTML.
 * - Recebe postMessage do seu AUTH_ORIGIN com { source: "wa-embed", ok, phone_number_id, display? }.
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
  const APP_ID      = import.meta.env.VITE_META_APP_ID;
  const CONFIG_ID   = import.meta.env.VITE_META_LOGIN_CONFIG_ID;
  const AUTH_ORIGIN = import.meta.env.VITE_EMBED_ORIGIN;     // ex.: https://auth.seu-dominio.com
  const API_BASE    = import.meta.env.VITE_API_BASE_URL || "";

  const [loading, setLoading] = useState(false);
  const popupRef = useRef(null);
  const timerRef = useRef(null);

  const cleanup = useCallback(() => {
    if (popupRef.current && !popupRef.current.closed) {
      try { popupRef.current.close(); } catch {}
    }
    popupRef.current = null;
    if (timerRef.current) { clearInterval(timerRef.current); timerRef.current = null; }
    setLoading(false);
  }, []);

  // listener do AUTH_ORIGIN (relay do embed)
  useEffect(() => {
    function onMessage(ev) {
      try {
        if (!AUTH_ORIGIN || ev.origin !== AUTH_ORIGIN) return;
        const d = ev.data || {};
        if (d?.source !== "wa-embed") return;

        if (d?.ok) {
          onPickSuccess?.({
            phone_number_id: String(d.phone_number_id || ""),
            display: d.display || null,
          });
        } else {
          onError?.(new Error(d?.error || "wa_embed_failed"));
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
    if (!tenant)      { onError?.(new Error("Tenant não detectado")); return; }
    if (!APP_ID)      { onError?.(new Error("VITE_META_APP_ID ausente")); return; }
    if (!CONFIG_ID)   { onError?.(new Error("VITE_META_LOGIN_CONFIG_ID ausente")); return; }
    if (!AUTH_ORIGIN) { onError?.(new Error("VITE_EMBED_ORIGIN ausente")); return; }

    // se já existir popup aberto, apenas foca; evita abrir 2
    if (popupRef.current && !popupRef.current.closed) {
      try { popupRef.current.focus(); } catch {}
      return;
    }

    setLoading(true);

    // state em base64URL-safe (sem + / =) para não quebrar parse do lado da Meta
    const rawState = JSON.stringify({ tenant, origin: window.location.origin, api: API_BASE });
    const stateB64 = btoa(rawState).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/,"");

    // monta URL do onboard — extras em JSON simples; o browser codifica 1x (sem double-encode)
    const u = new URL("https://business.facebook.com/messaging/whatsapp/onboard/");
    const extras = { sessionInfoVersion: "3", version: "v3" };
    u.searchParams.set("app_id", APP_ID);
    u.searchParams.set("config_id", CONFIG_ID);
    u.searchParams.set("state", stateB64);
    u.searchParams.set("extras", JSON.stringify(extras));

    const feat = "width=520,height=720,menubar=0,toolbar=0";
    popupRef.current = window.open(u.toString(), "wa-embed", feat);

    if (!popupRef.current) {
      setLoading(false);
      onError?.(new Error("Não foi possível abrir a janela de autenticação."));
      return;
    }

    // watchdog: se o usuário fechar o popup, encerra loading
    timerRef.current = setInterval(() => {
      try {
        if (!popupRef.current || popupRef.current.closed) {
          cleanup();
        }
      } catch {}
    }, 500);
  }, [tenant, APP_ID, CONFIG_ID, AUTH_ORIGIN, API_BASE, cleanup, onError]);

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
