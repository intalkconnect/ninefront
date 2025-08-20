import { useEffect, useState, useRef, useCallback } from "react";
import { apiPost } from '../../../shared/apiClient'; // 👉 use seus helpers aqui

export default function WhatsAppEmbeddedSignupButton({ tenant, onConnected, label = "Conectar WhatsApp", locale = "pt_BR" }) {
  const [loading, setLoading] = useState(false);
  const initedRef = useRef(false);

  const APP_ID = process.env.META_APP_ID;
  const CONFIG_ID = process.env.META_LOGIN_CONFIG_ID;

  useEffect(() => {
    if (typeof window === "undefined") return;
    if (initedRef.current) return;
    initedRef.current = true;

    if (!document.getElementById("facebook-jssdk")) {
      const s = document.createElement("script");
      s.async = true; s.defer = true; s.crossOrigin = "anonymous";
      s.id = "facebook-jssdk";
      s.src = `https://connect.facebook.net/${locale}/sdk.js`;
      document.body.appendChild(s);
    }

    window.fbAsyncInit = function () {
      if (!APP_ID) {
        console.error("[EmbeddedSignup] META_APP_ID ausente");
        return;
      }
      window.FB.init({
        appId: APP_ID,
        autoLogAppEvents: true,
        xfbml: false,
        version: "v23.0",
      });
    };
  }, [APP_ID, locale]);

  const launch = useCallback(() => {
    if (!CONFIG_ID) { alert("META_LOGIN_CONFIG_ID não configurado"); return; }
    if (!APP_ID)    { alert("META_APP_ID não configurado"); return; }
    if (typeof window === "undefined" || !window.FB) { alert("Facebook SDK ainda não carregou"); return; }

    setLoading(true);
    window.FB.login(async (resp) => {
      try {
        const code = resp?.authResponse?.code;
        if (!code) { setLoading(false); return; }
        const data = await apiPost("/wa/es/finalize", { code, tenant });
        onConnected && onConnected({ waba_id: data.waba_id, numbers: data.numbers });
        alert(`Conectado! WABA ${data.waba_id} — ${data.numbers?.length || 0} números.`);
      } catch (err) {
        console.error("[EmbeddedSignup] finalize falhou:", err);
        alert(err?.message || "Falha ao finalizar conexão");
      } finally {
        setLoading(false);
      }
    }, {
      config_id: CONFIG_ID,
      response_type: "code",
      override_default_response_type: true,
      display: "popup",
    });
  }, [APP_ID, CONFIG_ID, tenant, onConnected]);

  return (
    <button onClick={launch} disabled={loading} style={{ opacity: loading ? 0.6 : 1 }}>
      {loading ? "Conectando..." : label}
    </button>
  );
}
