const APP_ID    = import.meta.env.VITE_META_APP_ID;
const CONFIG_ID = import.meta.env.VITE_META_LOGIN_CONFIG_ID;

function qs(key) { return new URLSearchParams(location.search).get(key); }

const tenant       = qs("tenant");
const targetOrigin = qs("origin"); // ex.: https://clienteA.dkdevs.com.br
const apiOverride  = qs("api");    // opcional

const API_BASE = apiOverride || import.meta.env.VITE_API_BASE_URL || ""; // ex.: https://endpoints.dkdevs.com.br

function postToParent(type, payloadOrError) {
  if (!window.opener || !targetOrigin) return;
  if (type === "wa:error") {
    window.opener.postMessage({ type, error: String(payloadOrError) }, targetOrigin);
  } else {
    window.opener.postMessage({ type, payload: payloadOrError }, targetOrigin);
  }
}

function failAndClose(err) {
  postToParent("wa:error", err?.message || err || "unknown_error");
  window.close();
}

if (!APP_ID || !CONFIG_ID) {
  failAndClose("APP_ID ou CONFIG_ID ausente");
}

if (!tenant || !targetOrigin) {
  failAndClose("tenant/origin ausente");
}

// Carrega SDK
window.fbAsyncInit = function() {
  try {
    FB.init({
      appId: APP_ID,
      autoLogAppEvents: true,
      xfbml: false,
      version: "v23.0",
    });

    FB.login(function(resp) {
      (async () => {
        try {
          const code = resp && resp.authResponse && resp.authResponse.code;
          if (!code) return failAndClose("cancelled");

          const res = await fetch(`${API_BASE}/wa/es/finalize`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            // ⚠️ backend lê subdomain pelo plugin/header/body; mandamos explicitamente
            body: JSON.stringify({ code, subdomain: tenant }),
            credentials: "include",
          });
          if (!res.ok) {
            const j = await res.json().catch(() => ({}));
            throw new Error(j?.error || j?.message || `finalize ${res.status}`);
          }
          const data = await res.json().catch(() => ({}));
          postToParent("wa:connected", data);
          window.close();
        } catch (e) {
          failAndClose(e);
        }
      })();
    }, {
      config_id: CONFIG_ID,
      response_type: "code",
      override_default_response_type: true,
      display: "popup",
    });
  } catch (e) {
    failAndClose(e);
  }
};

// injeta o script do SDK
(function(d, s, id) {
  if (d.getElementById(id)) return;
  const js = d.createElement(s);
  js.id = id;
  js.async = true;
  js.defer = true;
  js.crossOrigin = "anonymous";
  js.src = "https://connect.facebook.net/pt_BR/sdk.js";
  const fjs = d.getElementsByTagName(s)[0];
  fjs.parentNode.insertBefore(js, fjs);
})(document, "script", "facebook-jssdk");
