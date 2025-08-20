const APP_ID    = import.meta.env.VITE_META_APP_ID;
const CONFIG_ID = import.meta.env.VITE_META_LOGIN_CONFIG_ID;
const API_BASE  = new URLSearchParams(location.search).get("api")
               || import.meta.env.VITE_API_BASE_URL
               || "";

const qs = (k) => new URLSearchParams(location.search).get(k);
const tenant       = qs("tenant");
const targetOrigin = qs("origin");

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
  setTimeout(() => window.close(), 1000);
}

const btn = $("btn");
$("warn").innerHTML = API_BASE ? "" :
  `<small>⚠️ VITE_API_BASE_URL não definido — a chamada irá para <code>/api/v1/...</code> neste domínio.</small>`;

log("ENV", { APP_ID, CONFIG_ID, API_BASE, tenant, targetOrigin });

if (!tenant || !targetOrigin) failAndClose("tenant/origin ausente");
if (!APP_ID || !CONFIG_ID)    failAndClose("APP_ID/CONFIG_ID ausente (ver VITE_META_*)");

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

    // Habilita botão para gesto do usuário (evita bloqueio de popup)
    setStatus("Pronto. Clique abaixo para continuar.");
    btn.disabled = false;
    btn.onclick = () => startLoginFlow();
  } catch (e) {
    failAndClose(e);
  }
};

function startLoginFlow() {
  btn.disabled = true;
  setStatus("Abrindo login do Facebook…");

  let gotCallback = false;

  const cb = (resp) => {
    gotCallback = true;
    (async () => {
      try {
        log("FB.login resp", resp);
        const code = resp && resp.authResponse && resp.authResponse.code;
        if (!code) return failAndClose("Login cancelado/negado");

        setStatus("Conectando WABA…");
        const url = `${API_BASE || ""}/wa/es/finalize`.replace(/(^https?:\/\/[^/]+)?\/+/, (m, p) => (p || "") + "/");
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
  };

  // 1ª tentativa (abre popup do FB) — exige gesto (ok)
  FB.login(cb, {
    config_id: CONFIG_ID,
    response_type: "code",
    override_default_response_type: true,
    display: "popup",
  });

  // Fallback: se nada acontecer em 1.5s, tenta no MESMO window (display: 'page')
  setTimeout(() => {
    if (!gotCallback) {
      log("fallback → display: 'page'");
      FB.login(cb, {
        config_id: CONFIG_ID,
        response_type: "code",
        override_default_response_type: true,
        display: "page",
      });
    }
  }, 1500);
}

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
