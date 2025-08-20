// components/WhatsAppEmbeddedSignupButton.tsx
import { useEffect } from "react";
import { apiPost } from "./apiCliente"; // 👉 use seus helpers aqui

declare global {
  interface Window { FB: any; fbAsyncInit: any; }
}

type Props = {
  tenant: string; // passe o subdomain aqui
  onConnected?: (data: { waba_id: string; numbers: any[] }) => void;
};

export default function WhatsAppEmbeddedSignupButton({ tenant, onConnected }: Props) {
  useEffect(() => {
    if (window.FB) return;
    window.fbAsyncInit = function () {
      window.FB.init({
        appId: process.env.NEXT_PUBLIC_META_APP_ID!,
        autoLogAppEvents: true,
        xfbml: false,
        version: "v23.0",
      });
    };
    const s = document.createElement("script");
    s.async = true; s.defer = true; s.crossOrigin = "anonymous";
    s.src = "https://connect.facebook.net/en_US/sdk.js";
    document.body.appendChild(s);
  }, []);

  const launch = () => {
    window.FB.login(async (resp: any) => {
      try {
        const code = resp?.authResponse?.code;
        if (!code) return alert("Login cancelado/negado.");

        // 👉 usando apiCliente (baseUrl centralizado) e passando tenant=subdomain
        const data = await apiPost("/api/v1/wa/es/finalize", { code, tenant });
        onConnected?.({ waba_id: data.waba_id, numbers: data.numbers });
        alert(`Conectado! WABA ${data.waba_id} — ${data.numbers?.length || 0} números.`);
      } catch (e: any) {
        console.error(e);
        alert(e?.message || "Falha no Embedded Signup");
      }
    }, {
      config_id: process.env.NEXT_PUBLIC_META_LOGIN_CONFIG_ID, // Facebook Login for Business config
      response_type: "code",
      override_default_response_type: true,
    });
  };

  return <button onClick={launch}>Conectar WhatsApp</button>;
}
