import { useCallback, useEffect, useRef, useState } from "react";

/**
 * WhatsAppEmbeddedSignupButton
 *
 * Abre UM popup apontando para o seu AUTH_ORIGIN (/oauth/wa), que por sua vez
 * redireciona para o OAuth/Embedded da Meta e retorna com { type:"wa:oauth", code, state }.
 *
 * Props:
 * - tenant: string (obrigatório)
 * - label: string (default: "Conectar WhatsApp")
 * - className, style, title, disabled
 * - onOAuthCode: ({ code, stateB64, redirectUri }) => void   // entrega o code pra quem chamar
 * - onError: (err) => void
 */
export default function WhatsAppEmbeddedSignupButton({
  tenant,
  label = "Conectar WhatsApp",
  className = "",
  style,
  title,
  disabled = false,
  onOAuthCode,
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

  useEffect(() => {
    function onMessage(ev) {
      try {
        if (!AUTH_ORIGIN || ev.origin !== AUTH_ORIGIN) return;
        const d = ev.data || {};
        if (d?.type !== "wa:oauth") return;

        const { code, state } = d;
        const redirectUri = `${AUTH_ORIGIN}/oauth/wa`;
        onOAuthCode?.({ code, stateB64: state, redirectUri });
      } catch (e) {
        onError?.(e);
      } finally {
        cleanup();
      }
    }
    window.addEventListener("message", onMessage);
    return () => window.removeEventListener("message", onMessage);
  }, [AUTH_ORIGIN, cleanup, onOAuthCode, onError]);

  const start = useCallback(() => {
    if (!tenant)      { onError?.(new Error("Tenant não detectado")); return; }
    if (!APP_ID)      { onError?.(new Error("VITE_META_APP_ID ausente")); return; }
    if (!CONFIG_ID)   { onError?.(new Error("VITE_META_LOGIN_CONFIG_ID ausente")); return; }
    if (!AUTH_ORIGIN) { onError?.(new Error("VITE_EMBED_ORIGIN ausente")); return; }

    // garante 1 popup só
    if (popupRef.current && !popupRef.current.closed) {
      try { popupRef.current.focus(); } catch {}
      return;
    }

    setLoading(true);

    // state base64URL-safe (sem + / =)
    const rawState = JSON.stringify({ tenant, origin: window.location.origin, api: API_BASE });
    const stateB64 = btoa(rawState).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/,"");

    // Nosso popup → /oauth/wa  (ele vai montar a URL do OAuth/Embedded e redirecionar)
    const url = new URL(`${AUTH_ORIGIN}/oauth/wa`);
    url.searchParams.set("start", "1");
    url.searchParams.set("state", stateB64);
    url.searchParams.set("app_id", APP_ID);
    url.searchParams.set("config_id", CONFIG_ID);

    const feat = "width=520,height=720,menubar=0,toolbar=0";
    popupRef.current = window.open(url.toString(), "wa-onboard", feat);

    if (!popupRef.current) {
      setLoading(false);
      onError?.(new Error("Não foi possível abrir a janela de autenticação."));
      return;
    }

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
