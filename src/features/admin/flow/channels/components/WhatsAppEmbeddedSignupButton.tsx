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
  const AUTH_ORIGIN = import.meta.env.VITE_EMBED_ORIGIN; // e.g. https://auth.seudominio.com
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
    const expectedOrigin = (() => {
      try { return new URL(AUTH_ORIGIN).origin; } catch { return AUTH_ORIGIN; }
    })();

    function onMessage(ev) {
      try {
        if (!expectedOrigin || ev.origin !== expectedOrigin) return;
        const d = ev.data || {};

        // sucesso
        if (d?.type === "wa:oauth") {
          const { code, state } = d;
          if (!code) {
            onError?.(new Error("Retorno do OAuth sem 'code'."));
            // não limpamos aqui pra não fechar o popup antes de o usuário ver
            return;
          }

          // envia ACK ao popup (ele só fecha depois de receber este ACK)
          try {
            ev.source?.postMessage?.({ type: "wa:ack" }, ev.origin);
          } catch {}

          const redirectUri = `${expectedOrigin}/oauth/wa`;

          // agora podemos prosseguir com a finalização
          onOAuthCode?.({ code, stateB64: state, redirectUri });

          // NÃO chamamos cleanup aqui; deixamos o popup fechar sozinho após ACK
          return;
        }

        // erro vindo do popup
        if (d?.type === "wa:oauth:error") {
          // não fechamos automaticamente; deixamos o popup aberto para o usuário ler
          onError?.(new Error(d?.error_description || d?.error || "Falha no OAuth do WhatsApp"));
          return;
        }
      } catch (e) {
        onError?.(e);
      }
    }

    window.addEventListener("message", onMessage);
    return () => window.removeEventListener("message", onMessage);
  }, [AUTH_ORIGIN, onOAuthCode, onError]);

  const start = useCallback(() => {
    if (!tenant)      { onError?.(new Error("Tenant não detectado")); return; }
    if (!APP_ID)      { onError?.(new Error("VITE_META_APP_ID ausente")); return; }
    if (!CONFIG_ID)   { onError?.(new Error("VITE_META_LOGIN_CONFIG_ID ausente")); return; }
    if (!AUTH_ORIGIN) { onError?.(new Error("VITE_EMBED_ORIGIN ausente")); return; }

    if (popupRef.current && !popupRef.current.closed) {
      try { popupRef.current.focus(); } catch {}
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

    const feat = "width=520,height=720,menubar=0,toolbar=0";
    popupRef.current = window.open(url.toString(), "wa-onboard", feat);

    if (!popupRef.current) {
      setLoading(false);
      onError?.(new Error("Não foi possível abrir a janela de autenticação."));
      return;
    }

    // vigia o fechamento para limpar estado
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
