// webapp/src/components/WhatsAppEmbeddedSignupButton.jsx
import { useCallback, useEffect, useRef, useState } from "react";
import { apiPost } from "../../../../../shared/apiClient";

function mkNonce() {
  return Math.random().toString(36).slice(2) + Date.now().toString(36);
}

/**
 * Props:
 * - tenant (string)
 * - label, className, style, title, disabled
 * - onPickSuccess({ phone_number_id, display })
 * - onError(err)
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
  const AUTH_ORIGIN = import.meta.env.VITE_EMBED_ORIGIN; // ex.: https://auth.northgate.ninechat.com.br

  const [loading, setLoading] = useState(false);

  const popupRef     = useRef(null);
  const timerRef     = useRef(null);
  const activeNonce  = useRef(null);     // casa o state com a tentativa atual
  const finishingRef = useRef(false);    // evita finalizar 2x
  const startedRef   = useRef(false);    // evita abrir 2x

  const cleanup = useCallback(() => {
    finishingRef.current = false;
    startedRef.current = false;
    activeNonce.current = null;

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

  // recebe o postMessage do /oauth/wa
  useEffect(() => {
    function onMessage(ev) {
      try {
        if (!AUTH_ORIGIN || ev.origin !== AUTH_ORIGIN) return;
        const data = ev.data || {};
        if (data?.type !== "wa:oauth") return;

        // Garante que esta mensagem é da TENTATIVA atual
        const stateStr = data.state || "";
        let st = {};
        try { st = stateStr ? JSON.parse(atob(stateStr)) : {}; } catch {}
        if (!st?.nonce || st.nonce !== activeNonce.current) {
          // mensagem antiga/duplicada — ignora
          return;
        }

        if (finishingRef.current) return;
        finishingRef.current = true;

        const code = data.code;
        const redirect_uri = `${AUTH_ORIGIN}/oauth/wa`;
        const sub = st?.tenant || tenant;

        (async () => {
          try {
            const res = await apiPost("/whatsapp/finalize", {
              subdomain: sub,
              code,
              redirect_uri,
            });

            if (!res?.ok) {
              throw new Error(res?.error || "Falha ao finalizar o WhatsApp");
            }

            const phoneId =
              res.phone_number_id ||
              res.phone_id ||
              res.phone?.id ||
              res.phone?.phone_number_id ||
              "";
            const display =
              res.phone?.display_phone_number ||
              res.display_phone_number ||
              res.phone?.verified_name ||
              null;

            if (!phoneId) throw new Error("phone_number_id ausente na resposta");

            onPickSuccess?.({ phone_number_id: String(phoneId), display });
          } catch (e) {
            onError?.(e instanceof Error ? e : new Error(String(e)));
          } finally {
            cleanup();
          }
        })();
      } catch (e) {
        onError?.(e instanceof Error ? e : new Error(String(e)));
        cleanup();
      }
    }

    window.addEventListener("message", onMessage);
    return () => window.removeEventListener("message", onMessage);
  }, [AUTH_ORIGIN, tenant, cleanup, onPickSuccess, onError]);

  const start = useCallback(() => {
    if (startedRef.current) {
      // já iniciamos — apenas foca o popup existente
      if (popupRef.current && !popupRef.current.closed) {
        try { popupRef.current.focus(); } catch {}
      }
      return;
    }

    if (!tenant)       { onError?.(new Error("Tenant não detectado")); return; }
    if (!APP_ID)       { onError?.(new Error("VITE_META_APP_ID ausente")); return; }
    if (!CONFIG_ID)    { onError?.(new Error("VITE_META_LOGIN_CONFIG_ID ausente")); return; }
    if (!AUTH_ORIGIN)  { onError?.(new Error("VITE_EMBED_ORIGIN ausente")); return; }

    startedRef.current = true;
    setLoading(true);

    const redirectUri = `${AUTH_ORIGIN}/oauth/wa`;
    const nonce = mkNonce();
    activeNonce.current = nonce;

    // state: sempre base64
    const state = btoa(JSON.stringify({
      nonce,
      tenant,
      origin: window.location.origin,
      redirectUri,
    }));

    // extras SEM encode (Meta faz JSON.parse(extras) cru)
    const extrasRaw = JSON.stringify({ sessionInfoVersion: "3", version: "v3" });

    const url =
      `https://business.facebook.com/messaging/whatsapp/onboard/` +
      `?app_id=${encodeURIComponent(APP_ID)}` +
      `&config_id=${encodeURIComponent(CONFIG_ID)}` +
      `&redirect_uri=${encodeURIComponent(redirectUri)}` +
      `&state=${encodeURIComponent(state)}` +
      `&extras=${extrasRaw}`;

    const feat = "width=520,height=720,menubar=0,toolbar=0";
    const w = window.open(url, "wa-embed", feat);

    if (!w) {
      startedRef.current = false;
      setLoading(false);
      onError?.(new Error("Não foi possível abrir a janela de autenticação."));
      return;
    }

    popupRef.current = w;
    try { w.focus(); } catch {}

    // watchdog: se o usuário fechar a janela, limpamos estado
    timerRef.current = setInterval(() => {
      try {
        if (!popupRef.current || popupRef.current.closed) {
          cleanup();
        }
      } catch {
        // cross-origin
      }
    }, 500);
  }, [tenant, APP_ID, CONFIG_ID, AUTH_ORIGIN, cleanup, onError]);

  return (
    <button
      type="button"
      className={className}
      style={{ pointerEvents: loading ? "none" : undefined, ...style }}
      title={title || label}
      onClick={start}
      disabled={disabled || loading}
    >
      {loading ? "Conectando..." : label}
    </button>
  );
}
