const APP_ID    = import.meta.env.VITE_META_APP_ID;
const CONFIG_ID = import.meta.env.VITE_META_LOGIN_CONFIG_ID;
const API_BASE  = new URLSearchParams(location.search).get("api")
               || import.meta.env.VITE_API_BASE_URL
               || "";

const qs = (k) => new URLSearchParams(location.search).get(k);
const tenant       = qs("tenant");
const targetOrigin = qs("origin"); // ex.: https://hmg.dkdevs.com.br

const $ = (id) => document.getElementById(id);
const log = (...a) => { try { console.log("[wa-embed]", ...a); } catch{}; try { const pre=$("log"); pre.hidden=false; pre.textContent += a.map(x=> typeof x==="string"?x:JSON.stringify(x,null,2)).join(" ")+"\n"; }catch{} };
const setStatus = (t) => { $("status").textContent = t; };
const showErr   = (t) => { $("msg").innerHTML = `<div class="err">${t}</div>`; };
const showOk    = (t) => { $("msg").innerHTML = `<div class="ok">${t}</div>`; };

function postToParent(type, payloadOrError) {
  if (!window.opener || !targetOrigin) return;
  if (type === "wa:error") {
    window.opener.postMessage({ type, error: String(payloadOrError) }, targetOrigin);
  } else {
    window.opener.postMessage({ type, payload: payloadOrError }, targetOrigin);
  }
}

function failAndClose(err) {
  log("failAndClose:", err);
  showErr(String(err?.message || err || "Erro desconhecido"));
  postToParent("wa:error", err?.message || err);
  // dá 1s pro usuário ver o erro antes de fechar
  setTimeout(() => window.close(), 1000);
}

(async function boot(){
  try {
    log("ENV", { APP_ID, CONFIG_ID, API_BASE, tenant, targetOrigin });

    if (!tenant || !targetOrigin) return failAndClose("tenant/origin ausente");
    if (!APP_ID || !CONFIG_ID)    return failAndClose("APP_ID/CONFIG_ID ausente (ver VITE_META_*)");

    // Timeout se o SDK não vier
    const sdkTimeout = setTimeout(() => {
      failAndClose("Facebook SDK não carregou (ver Allowed Domains e JSSDK on)");
    }, 10000);

    // Carrega SDK
    window.fbAsyncInit = function() {
      clearTimeout(sdkTimeout);
      try {
        log("fbAsyncInit → FB.init");
        FB.init({ appId: APP_ID, autoLogAppEvents: true, xfbml: false, version: "v23.0" });

        setStatus("Abrindo login do Facebook…");
        FB.login(function(resp) {
          (async () => {
            try {
              log("FB.login resp", resp);
              const code = resp && resp.authResponse && resp.authResponse.code;
              if (!code) return failAndClose("Login cancelado/negado");

              setStatus("Conectando WABA…");
              const url = `${API_BASE}/wa/es/finalize`;
              const r = await fetch(url, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ code, subdomain: tenant }),
                credentials: "include",
              });
              const j = await r.json().catch(()=> ({}));
              log("finalize status", r.status, j);
              if (!r.ok) throw new Error(j?.error || j?.message || `finalize ${r.status}`);

              showOk("Conta conectada com sucesso.");
              postToParent("wa:connected", j);
              setTimeout(() => window.close(), 600);
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
      if (d.getElementById(id)) { log("SDK já presente"); return; }
      const js = d.createElement(s);
      js.id = id; js.async = true; js.defer = true; js.crossOrigin = "anonymous";
      js.src = "https://connect.facebook.net/pt_BR/sdk.js";
      const fjs = d.getElementsByTagName(s)[0];
      fjs.parentNode.insertBefore(js, fjs);
      log("injetado SDK:", js.src);
    })(document, "script", "facebook-jssdk");
  } catch (e) {
    failAndClose(e);
  }
})();
