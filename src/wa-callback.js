const $ = (id) => document.getElementById(id);
const setStatus = (t)=> ($("status").textContent=t);
const showErr = (t)=> ($("msg").innerHTML = `<div class="err">${t}</div>`);
const showOk  = (t)=> ($("msg").innerHTML = `<div class="ok">${t}</div>`);
const setView = (h)=> ($("view").innerHTML = h||"");
const log = (...a)=>{ try{console.log("[wa-cb]",...a)}catch{}; try{const p=$("log");p.hidden=false;p.textContent+=a.map(x=>typeof x==="string"?x:JSON.stringify(x,null,2)).join(" ")+"\n"}catch{} };

const usp = new URLSearchParams(location.search);
const code = usp.get("code");
const stateStr = usp.get("state");

if (!code) {
  showErr("Login cancelado/negado");
  // tenta avisar o opener e fechar
  try {
    const st = JSON.parse(atob(stateStr||""));
    if (window.opener && st?.origin) window.opener.postMessage({ type:"wa:error", error:"cancelled" }, st.origin);
  } catch {}
  setTimeout(()=>window.close(), 1000);
} else {
  (async () => {
    try {
      const st = JSON.parse(atob(stateStr||"")) || {};
      const tenant = st.tenant;
      const origin = st.origin;
      const API_BASE = st.api || "";

      if (!tenant || !origin) throw new Error("state inválido");

      setStatus("Conectando WABA…");
      const finalizeUrl = `${API_BASE}/api/v1/wa/es/finalize`;
      const r = await fetch(finalizeUrl, {
        method:"POST",
        headers:{ "Content-Type":"application/json" },
        body: JSON.stringify({ code, subdomain: tenant }),
        credentials: "include",
      });
      const j = await r.json().catch(()=> ({}));
      log("finalize", r.status, j);
      if (!r.ok) throw new Error(j?.error || j?.message || `finalize ${r.status}`);

      const numbers = Array.isArray(j?.numbers) ? j.numbers : [];
      if (numbers.length === 0) {
        setStatus("Conta conectada, nenhum número encontrado.");
        showOk("Conexão concluída.");
        if (window.opener) window.opener.postMessage({ type:"wa:connected", payload:j }, origin);
        setTimeout(()=>window.close(), 800);
        return;
      }

      setStatus("Selecione o número para ativar");
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

      document.getElementById("confirm").onclick = async () => {
        try {
          const sel = document.querySelector('input[name="num"]:checked');
          if (!sel) return alert("Escolha um número");
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
          log("pick", r2.status, j2);
          if (!r2.ok) throw new Error(j2?.error || j2?.message || `pick-number ${r2.status}`);

          showOk("Número ativado.");
          if (window.opener) window.opener.postMessage({ type:"wa:connected", payload:{ ...j, picked: phone_number_id } }, origin);
          setTimeout(()=>window.close(), 700);
        } catch (e) {
          showErr(String(e?.message || e));
        }
      };
    } catch (e) {
      showErr(String(e?.message || e));
      try {
        const st = JSON.parse(atob(stateStr||""));
        if (window.opener && st?.origin) window.opener.postMessage({ type:"wa:error", error:String(e?.message || e) }, st.origin);
      } catch {}
      setTimeout(()=>window.close(), 1200);
    }
  })();
}
