import { useCallback, useEffect, useRef, useState } from "react";

export default function WhatsAppEmbeddedSignupButton({
  tenant,
  label = "Conectar WhatsApp",
  className = "",
  style,
  title,
  disabled = false,
  onOAuthCode, // ({ code, stateB64, redirectUri })
  onError,
}) {
  const APP_ID      = import.meta.env.VITE_META_APP_ID;
  const CONFIG_ID   = import.meta.env.VITE_META_LOGIN_CONFIG_ID;
  const AUTH_ORIGIN = import.meta.env.VITE_EMBED_ORIGIN; // ex.: https://auth.seudominio.com
  const API_BASE    = import.meta.env.VITE_API_BASE_URL || "";

  const [loading, setLoading] = useState(false);
  const popupRef = useRef(null);
  const watchdogRef = useRef(null);
  const clickGuardRef = useRef(false);

  const cleanup = useCallback(() => {
    if (popupRef.current && !popupRef.current.closed) {
      try { popupRef.current.close(); } catch {}
    }
    popupRef.current = null;
    if (watchdogRef.current) { clearInterval(watchdogRef.current); watchdogRef.current = null; }
    clickGuardRef.current = false;
    setLoading(false);
  }, []);

  useEffect(() => {
    const expectedOrigin = (() => {
      try { return new URL(AUTH_ORIGIN).origin; } catch { return AUTH_ORIGIN; }
    })();
    function onMessage(ev) {
      if (!expectedOrigin || ev.origin !== expectedOrigin) return;
      try {
        const d = ev.data || {};
        if (d?.type === "wa:oauth") {
          const redirectUri = `${expectedOrigin}/oauth/wa`;
          onOAuthCode?.({ code: d.code, stateB64: d.state || "", redirectUri });
          cleanup();
        } else if (d?.type === "wa:oauth:error") {
          onError?.(new Error(d?.error_description || d?.error || "Falha no OAuth do WhatsApp"));
          cleanup();
        }
      } catch (e) {
        onError?.(e);
        cleanup();
      }
    }
    window.addEventListener("message", onMessage);
    return () => window.removeEventListener("message", onMessage);
  }, [AUTH_ORIGIN, cleanup, onOAuthCode, onError]);

  const start = useCallback(() => {
    if (clickGuardRef.current) return;
    clickGuardRef.current = true;

    if (!tenant)      { onError?.(new Error("Tenant não detectado")); clickGuardRef.current = false; return; }
    if (!APP_ID)      { onError?.(new Error("VITE_META_APP_ID ausente")); clickGuardRef.current = false; return; }
    if (!CONFIG_ID)   { onError?.(new Error("VITE_META_LOGIN_CONFIG_ID ausente")); clickGuardRef.current = false; return; }
    if (!AUTH_ORIGIN) { onError?.(new Error("VITE_EMBED_ORIGIN ausente")); clickGuardRef.current = false; return; }

    // Reusa a mesma janela
    if (popupRef.current && !popupRef.current.closed) {
      try { popupRef.current.focus(); } catch {}
      clickGuardRef.current = false;
      return;
    }

    setLoading(true);

    const rawState = JSON.stringify({ tenant, origin: window.location.origin, api: API_BASE });
    const stateB64 = btoa(rawState).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/,"");
    const base = (() => { try { return new URL(AUTH_ORIGIN).origin; } catch { return AUTH_ORIGIN; } })();

    const url = new URL(`${base}/oauth/wa`);
    url.searchParams.set("start", "1");
    url.searchParams.set("state", stateB64);
    url.searchParams.set("app_id", APP_ID);
    url.searchParams.set("config_id", CONFIG_ID);

    // Tamanho semelhante ao wizard
    const feat = "width=700,height=820,menubar=0,toolbar=0,location=0,status=0,resizable=1,scrollbars=1";
    popupRef.current = window.open(url.toString(), "wa-es-onboard", feat);

    if (!popupRef.current) {
      setLoading(false);
      clickGuardRef.current = false;
      onError?.(new Error("Não foi possível abrir a janela de autenticação."));
      return;
    }

    watchdogRef.current = setInterval(() => {
      try { if (!popupRef.current || popupRef.current.closed) cleanup(); } catch {}
    }, 800);

    setTimeout(() => { clickGuardRef.current = false; }, 1000);
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
