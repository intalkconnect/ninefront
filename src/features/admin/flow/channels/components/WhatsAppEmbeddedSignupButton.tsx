// frontend/components/WhatsAppEmbeddedSignupButton.jsx
import { useCallback, useRef, useState } from "react";

export default function WhatsAppEmbeddedSignupButton({
  tenant,
  label = "Conectar WhatsApp",
  className = "",
  style,
  title,
  disabled = false,
  onError,
}) {
  const APP_ID = import.meta.env.VITE_META_APP_ID;
  const CONFIG_ID = import.meta.env.VITE_META_LOGIN_CONFIG_ID;
  const AUTH_ORIGIN = import.meta.env.VITE_EMBED_ORIGIN; // ex.: https://auth.northgate.ninechat.com.br
  const API_BASE = import.meta.env.VITE_API_BASE_URL || "";

  const [loading, setLoading] = useState(false);
  const popupRef = useRef(null);
  const watchdogRef = useRef(null);
  const clickGuardRef = useRef(false);

  const cleanup = useCallback(() => {
    if (popupRef.current && !popupRef.current.closed) {
      try { popupRef.current.close(); } catch {}
    }
    popupRef.current = null;
    if (watchdogRef.current) {
      clearInterval(watchdogRef.current);
      watchdogRef.current = null;
    }
    clickGuardRef.current = false;
    setLoading(false);
  }, []);

  const start = useCallback(() => {
    if (clickGuardRef.current) return;
    clickGuardRef.current = true;

    const fail = (msg) => {
      onError?.(new Error(msg));
      clickGuardRef.current = false;
      setLoading(false);
    };

    if (!tenant)      return fail("Tenant não detectado");
    if (!APP_ID)      return fail("VITE_META_APP_ID ausente");
    if (!CONFIG_ID)   return fail("VITE_META_LOGIN_CONFIG_ID ausente");
    if (!AUTH_ORIGIN) return fail("VITE_EMBED_ORIGIN ausente");

    // reusar janela se ainda aberta
    if (popupRef.current && !popupRef.current.closed) {
      try { popupRef.current.focus(); } catch {}
      clickGuardRef.current = false;
      return;
    }

    setLoading(true);

    const rawState = JSON.stringify({
      tenant,
      origin: window.location.origin,
      api: API_BASE,
    });
    const stateB64 = btoa(rawState)
      .replace(/\+/g, "-")
      .replace(/\//g, "_")
      .replace(/=+$/, "");

    const base = (() => {
      try { return new URL(AUTH_ORIGIN).origin; } catch { return AUTH_ORIGIN; }
    })();

    const url = new URL(base + "/oauth/wa");
    url.searchParams.set("start", "1");
    url.searchParams.set("state", stateB64);
    url.searchParams.set("app_id", APP_ID);
    url.searchParams.set("config_id", CONFIG_ID);

    const feat =
      "width=700,height=820,menubar=0,toolbar=0,location=0,status=0,resizable=1,scrollbars=1";
    popupRef.current = window.open(url.toString(), "wa-es-onboard", feat);

    if (!popupRef.current) {
      fail("Não foi possível abrir a janela de autenticação.");
      return;
    }

    watchdogRef.current = setInterval(() => {
      try {
        if (!popupRef.current || popupRef.current.closed) cleanup();
      } catch {}
    }, 800);

    setTimeout(() => {
      clickGuardRef.current = false;
    }, 1000);
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
