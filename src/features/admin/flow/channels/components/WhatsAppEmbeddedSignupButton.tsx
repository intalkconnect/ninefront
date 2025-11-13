// webapp/src/components/WhatsAppEmbeddedSignupButton.jsx
import { useCallback, useEffect, useRef, useState } from "react";
import { apiPost } from "../../../../../shared/apiClient";

/**
 * WhatsAppEmbeddedSignupButton
 *
 * Props:
 * - tenant: string (obrigatório)
 * - label: string (default: "Conectar WhatsApp")
 * - className, style, title, disabled
 * - onPickSuccess: (payload) => void
 *      payload: { phone_number_id: string, display?: string }
 * - onError: (err) => void
 *
 * Fluxo:
 * 1) Abre popup para https://business.facebook.com/messaging/whatsapp/onboard/
 * 2) Meta redireciona para {AUTH_ORIGIN}/oauth/wa?code=...&state=...
 * 3) Sua rota /oauth/wa faz postMessage({ type: "wa:oauth", code, state }) para window.opener
 * 4) Este componente recebe, chama POST /whatsapp/finalize, e retorna phone_number_id via onPickSuccess
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
  const CONFIG_ID = import.meta.env.VITE_META_LOGIN_CONFIG_ID; // ou VITE_WA_CONFIG_ID
  const AUTH_ORIGIN = import.meta.env.VITE_EMBED_ORIGIN;        // ex.: https://auth.northgate.ninechat.com.br

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

  // recebe o postMessage do /oauth/wa
  useEffect(() => {
    function onMessage(ev) {
      try {
        if (!AUTH_ORIGIN || ev.origin !== AUTH_ORIGIN) return; // segurança
        const data = ev.data || {};
        if (data?.type !== "wa:oauth") return;

        const { code, state } = data;
        // redirect_uri deve ser exatamente o mesmo usado na abertura
        const redirect_uri = `${AUTH_ORIGIN}/oauth/wa`;
        const sub = (() => {
          try {
            const s = state ? JSON.parse(atob(state)) : {};
            return s?.tenant || tenant;
          } catch {
            return tenant;
          }
        })();

        // finaliza no backend para obter o phone_number_id
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

            // normaliza possíveis formatos
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
    if (!tenant)       { onError?.(new Error("Tenant não detectado")); return; }
    if (!APP_ID)       { onError?.(new Error("VITE_META_APP_ID ausente")); return; }
    if (!CONFIG_ID)    { onError?.(new Error("VITE_META_LOGIN_CONFIG_ID ausente")); return; }
    if (!AUTH_ORIGIN)  { onError?.(new Error("VITE_EMBED_ORIGIN ausente")); return; }
    if (loading) return;

    setLoading(true);

    const redirectUri = `${AUTH_ORIGIN}/oauth/wa`;

    // state em base64 para round-trip (tenha o que precisar)
    const state = btoa(
      JSON.stringify({
        tenant,
        origin: window.location.origin,
        redirectUri, // útil para o backend/rota
      })
    );

    // ⚠️ IMPORTANTE: extras deve ir como JSON cru (sem encode),
    // pois a página da Meta faz JSON.parse(extras) sem decodeURIComponent.
    const extrasRaw = JSON.stringify({ sessionInfoVersion: "3", version: "v3" });

    const url =
      `https://business.facebook.com/messaging/whatsapp/onboard/` +
      `?app_id=${encodeURIComponent(APP_ID)}` +
      `&config_id=${encodeURIComponent(CONFIG_ID)}` +
      `&redirect_uri=${encodeURIComponent(redirectUri)}` +
      `&state=${encodeURIComponent(state)}` +
      `&extras=${extrasRaw}`; // <- SEM encode aqui

    const feat = "width=520,height=720,menubar=0,toolbar=0";
    popupRef.current = window.open(url, "wa-embed", feat);

    if (!popupRef.current) {
      setLoading(false);
      onError?.(new Error("Não foi possível abrir a janela de autenticação."));
      return;
    }

    // watchdog: se fechar o popup, limpamos estado
    timerRef.current = setInterval(() => {
      try {
        if (!popupRef.current || popupRef.current.closed) {
          cleanup();
        }
      } catch {
        // ignore cross-origin
      }
    }, 500);
  }, [tenant, APP_ID, CONFIG_ID, AUTH_ORIGIN, loading, cleanup, onError]);

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
