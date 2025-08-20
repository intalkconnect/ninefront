const APP_ID    = import.meta.env.VITE_META_APP_ID;
const CONFIG_ID = import.meta.env.VITE_META_LOGIN_CONFIG_ID;

const usp   = new URLSearchParams(location.search);
const API_BASE  = usp.get("api") || import.meta.env.VITE_API_BASE_URL || "";
const tenant    = usp.get("tenant");
const parentOrigin = usp.get("origin");
const autostart = usp.get("autostart") === "1";

const $ = (id) => document.getElementById(id);
const log = (...a)=>{ try{console.log("[wa-embed]",...a)}catch{}; try{const p=$("log");p.hidden=false;p.textContent+=a.map(x=>typeof x==="string"?x:JSON.stringify(x,null,2)).join(" ")+"\n"}catch{} }
const setStatus = (t)=> ($("status").textContent=t);
const showErr = (t)=> ($("msg").innerHTML=`<div class="err">${t}</div>`);
const showOk  = (t)=> ($("msg").innerHTML=`<div class="ok">${t}</div>`);
const setView = (h)=> ($("view").innerHTML=h||"");

function postToParent(type, payloadOrError){
  if (!window.opener || !parentOrigin) return;
  if (type==="wa:error") window.opener.postMessage({type,error:String(payloadOrError)}, parentOrigin);
  else window.opener.postMessage({type,payload:payloadOrError}, parentOrigin);
}

// 1) SDK
window.fbAsyncInit = function(){
  try {
    FB.init({ appId: APP_ID, autoLogAppEvents: true, xfbml: false, version: "v23.0" });
    log("FB.init ok", {autostart, display:"page"});
    setStatus("Abrindo login…");

    // 2) Login direto nesta janela (uma janela só)
    if (autostart) startLogin();
    else {
      setView(`<button class="btn" id="go">Continuar</button>`);
      document.getElementById("go").onclick = startLogin;
    }
  } catch(e){ fail(e) }
};

function startLogin(){
  FB.login((resp)=>{
    (async ()=>{
      try{
        log("FB.login resp", resp);
        const code = resp && resp.authResponse && resp.authResponse.code;
        if(!code) return fail("Login cancelado/negado");

        setStatus("Coletando números da WABA…");
        const finalizeUrl = `${API_BASE}/api/v1/wa/es/finalize`;
        const r = await fetch(finalizeUrl, {
          method:"POST",
          headers:{ "Content-Type":"application/json" },
          body: JSON.stringify({ code, subdomain: tenant }),
          credentials: "include",
        });
        const j = await r.json().catch(()=> ({}));
        log("finalize", r.status, j);
        if(!r.ok) throw new Error(j?.error || j?.message || `finalize ${r.status}`);

        const numbers = Array.isArray(j?.numbers) ? j.numbers : [];
        if(numbers.length === 0){
          setStatus("Conta conectada, mas nenhum número encontrado.");
          postToParent("wa:connected", j);
          setTimeout(()=>window.close(), 800);
          return;
        }

        // 3) UI de seleção do número
        setStatus("Selecione o número que deseja ativar");
        const list = numbers.map(n => `
          <label class="row">
            <input type="radio" name="num" value="${n.id}">
            <div>
              <div><strong>${n.display_phone_number || n.verified_name || "—"}</strong></div>
              <div class="muted">id: ${n.id}</div>
            </div>
          </label>
        `).join("");

        setView(`
          <div>${list}</div>
          <button class="btn" id="confirm">Ativar número selecionado</button>
        `);

        document.getElementById("confirm").onclick = async ()=>{
          try{
            const sel = document.querySelector('input[name="num"]:checked');
            if(!sel) return alert("Escolha um número");
            const phone_number_id = sel.value;

            setStatus("Ativando número…");
            const pickUrl = `${API_BASE}/api/v1/wa/es/pick-number`;
            const r2 = await fetch(pickUrl, {
              method:"POST",
              headers:{ "Content-Type":"application/json" },
              body: JSON.stringify({ subdomain: tenant, phone_number_id }),
              credentials: "include",
            });
            const j2 = await r2.json().catch(()=> ({}));
            log("pick-number", r2.status, j2);
            if(!r2.ok) throw new Error(j2?.error || j2?.message || `pick-number ${r2.status}`);

            showOk("Número ativado.");
            postToParent("wa:connected", { ...j, picked: phone_number_id });
            setTimeout(()=>window.close(), 700);
          }catch(e){ fail(e) }
        };

      }catch(e){ fail(e) }
    })();
  }, {
    config_id: CONFIG_ID,
    response_type: "code",
    override_default_response_type: true,
    display: "page", // 👈 tudo nesta janela
  });
}

function fail(e){
  showErr(String(e?.message || e || "Erro"));
  postToParent("wa:error", e?.message || e);
}

(function(d,s,id){
  if(d.getElementById(id)) return;
  const js = d.createElement(s);
  js.id=id; js.async=true; js.defer=true; js.crossOrigin="anonymous";
  js.src="https://connect.facebook.net/pt_BR/sdk.js";
  d.getElementsByTagName(s)[0].parentNode.insertBefore(js, d.getElementsByTagName(s)[0]);
})(document,"script","facebook-jssdk");
