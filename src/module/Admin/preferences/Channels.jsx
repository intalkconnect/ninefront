import React, { useMemo, useState, useEffect } from "react";
import { MessageCircle, Instagram, MessageSquareText, Send, CheckCircle2, PlugZap, X } from "lucide-react";
import { apiGet, apiPost } from '../../../shared/apiClient';
import styles from "./styles/Channels.module.css";
import WhatsAppEmbeddedSignupButton from "../components/WhatsAppEmbeddedSignupButton";

/* ================= utils ================= */
function getTenantFromHost() {
  if (typeof window === "undefined") return "";
  const host = window.location.hostname;
  const parts = host.split(".");
  if (parts.length >= 3) return parts[0] === "www" ? parts[1] : parts[0];
  return parts[0] || "";
}
function genSecretHex(bytes = 32) {
  if (typeof window !== "undefined" && window.crypto?.getRandomValues) {
    const arr = new Uint8Array(bytes);
    window.crypto.getRandomValues(arr);
    return Array.from(arr).map(b => b.toString(16).padStart(2, "0")).join("");
  }
  let out = "";
  for (let i = 0; i < bytes; i++) out += Math.floor(Math.random() * 256).toString(16).padStart(2, "0");
  return out;
}

/* =============== Modal Telegram =============== */
function TelegramConnectModal({ open, onClose, tenant, onSuccess }) {
  const [token, setToken] = useState("");
  const [secret, setSecret] = useState("");       // gerado silenciosamente
  const [loading, setLoading] = useState(false);
  const [errMsg, setErrMsg] = useState(null);

  useEffect(() => {
    if (!open) return;
    setToken("");
    setErrMsg(null);
    setLoading(false);
    // gera o secret sem mostrar para o usuário
    setSecret(genSecretHex());
  }, [open]);

  if (!open) return null;

  const overlay = { position:"fixed", inset:0, background:"rgba(0,0,0,.45)", display:"flex", alignItems:"center", justifyContent:"center", zIndex:1000 };
  const modal   = { width:"min(520px,92vw)", background:"#fff", borderRadius:12, boxShadow:"0 10px 30px rgba(0,0,0,.25)", padding:"18px", position:"relative" };
  const header  = { display:"flex", alignItems:"center", justifyContent:"space-between", marginBottom:12 };
  const title   = { fontSize:18, fontWeight:700 };
  const input   = { width:"100%", padding:"10px 12px", border:"1px solid #e2e8f0", borderRadius:8 };
  const label   = { fontSize:12, fontWeight:600, color:"#475569", marginBottom:6 };
  const row     = { display:"grid", gridTemplateColumns:"1fr", gap:10, marginBottom:12 };
  const actions = { display:"flex", gap:10, justifyContent:"flex-end", marginTop:8 };

async function handleConnect() {
  if (!tenant) return setErrMsg("Tenant não identificado pelo subdomínio.");
  if (!token)  return setErrMsg("Informe o Bot Token.");

  setLoading(true); setErrMsg(null);
  try {
    const res = await fetch("/api/v1/tg/connect", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ subdomain: tenant, botToken: token, secret })
    });

    // parser robusto: suporta Response do fetch, axios-like e objeto já-JSON
    const parseJSONLike = async (r) => {
      if (r && typeof r.json === "function") { // fetch Response
        // tenta com content-type; se não for json, tenta text() e parse manual
        const ct = r.headers?.get?.("content-type") || "";
        if (ct.includes("application/json")) return await r.json();
        const txt = await r.text();
        try { return JSON.parse(txt); } catch { return { ok: false, error: "non_json_response", raw: txt }; }
      }
      if (r && typeof r === "object" && "data" in r) return r.data; // axios
      return r; // já é um objeto
    };

    const j = await parseJSONLike(res);

    if (!res.ok || !j?.ok) {
      const msg = j?.error || `HTTP ${res.status}`;
      throw new Error(msg);
    }

    onSuccess({ botId: j.bot_id, username: j.username, webhookUrl: j.webhook_url });
    onClose();
  } catch (e) {
    setErrMsg(String(e?.message || e));
  } finally {
    setLoading(false);
  }
}


  return (
    <div style={overlay} onClick={onClose}>
      <div style={modal} onClick={(e) => e.stopPropagation()}>
        <div style={header}>
          <div style={title}>Conectar Telegram</div>
          <button className={styles.btnIcon} onClick={onClose} title="Fechar" aria-label="Fechar"><X size={18}/></button>
        </div>

        {errMsg && <div className={styles.alertErr} style={{ marginBottom:10 }}>{errMsg}</div>}

        <div style={row}>
          <label style={label}>Bot Token</label>
          <input
            style={input}
            type="text"
            placeholder="ex.: 123456:AAHk...-seu-token"
            value={token}
            onChange={(e) => setToken(e.target.value)}
            autoComplete="off"
          />
        </div>

        {/* observação simples; secret é gerado e não é exibido */}
        <p className={styles.cardDesc}> Conecte informando apenas o <strong>Bot Token</strong>.</p>


        <div style={actions}>
          <button className={styles.btnGhost} onClick={onClose}>Cancelar</button>
          <button className={styles.btnPrimary} onClick={handleConnect} disabled={loading}>
            {loading ? "Conectando..." : "Conectar"}
          </button>
        </div>
      </div>
    </div>
  );
}


/* ========================= page ========================= */
export default function Channels() {
  const tenant = useMemo(() => getTenantFromHost(), []);

  // WhatsApp
  const [wa, setWa] = useState({ connected: false, wabaId: "", numbers: [], okMsg: null, errMsg: null });

  // Telegram (estado “conectado” e dados do bot)
  const [tg, setTg] = useState({
    connected: false,
    botId: "",
    username: "",
    webhookUrl: "",
    okMsg: null,
    errMsg: null
  });

  // controla modal
  const [showTgModal, setShowTgModal] = useState(false);

  // WhatsApp Embedded Signup → mensagens do popup
  useEffect(() => {
    const AUTH_ORIGIN = import.meta.env.VITE_EMBED_ORIGIN; // ex.: https://auth.seudominio.com
    function onMsg(e) {
      if (!AUTH_ORIGIN || e.origin !== AUTH_ORIGIN) return;
      const { type, payload, error } = e.data || {};
      if (type === "wa:connected") {
        setWa({
          connected: true,
          wabaId: payload?.waba_id || "",
          numbers: Array.isArray(payload?.numbers) ? payload.numbers : [],
          okMsg: "WhatsApp conectado com sucesso.",
          errMsg: null,
        });
        setTimeout(() => setWa((s) => ({ ...s, okMsg: null })), 2000);
      }
      if (type === "wa:error") {
        setWa((s) => ({ ...s, errMsg: error || "Falha ao conectar." }));
      }
    }
    window.addEventListener("message", onMsg);
    return () => window.removeEventListener("message", onMsg);
  }, []);

  const iconWrap = (cls, icon) => <div className={`${styles.cardIconWrap} ${cls}`}>{icon}</div>;

  return (
    <div className={styles.container}>
      <div className={styles.header}>
        <div>
          <h1 className={styles.title}>Canais</h1>
          <p className={styles.subtitle}>Conecte seus canais de atendimento.</p>
          {wa.errMsg && <div className={styles.alertErr}>{wa.errMsg}</div>}
          {wa.okMsg && <div className={styles.alertOk}>{wa.okMsg}</div>}
          {tg.errMsg && <div className={styles.alertErr}>{tg.errMsg}</div>}
          {tg.okMsg && <div className={styles.alertOk}>{tg.okMsg}</div>}
        </div>
        <div className={styles.tenantBadge}>
          {tenant ? <>id: <strong>{tenant}</strong></> : <span className={styles.subtle}>defina o tenant</span>}
        </div>
      </div>

      <div className={styles.grid}>
        {/* WhatsApp */}
        <div className={styles.card}>
          <div className={styles.cardHead}>
            {iconWrap(styles.wa, <MessageCircle size={18} />)}
            <div className={styles.cardTitle}>WhatsApp</div>
            {wa.connected
              ? <span className={styles.statusOk}><CheckCircle2 size={14}/> Conectado</span>
              : <span className={styles.statusOff}>Não conectado</span>}
          </div>
          <div className={styles.cardBody}>
            <p className={styles.cardDesc}>Conecte via Signup Meta e selecione o número.</p>
            {!wa.connected ? (
              <div className={styles.cardActions}>
                <div className={styles.btnWrap}>
                  <WhatsAppEmbeddedSignupButton tenant={tenant} />
                </div>
                <div className={styles.hint}><PlugZap size={14}/> Login ocorre em janela do domínio seguro.</div>
              </div>
            ) : (
              <div className={styles.connectedBlock}>
                <div className={styles.kv}><span className={styles.k}>WABA</span><span className={styles.v}>{wa.wabaId}</span></div>
                <div className={styles.kv}><span className={styles.k}>Números</span><span className={styles.v}>{wa.numbers?.length || 0}</span></div>
              </div>
            )}
          </div>
        </div>

        {/* Instagram */}
        <div className={styles.card}>
          <div className={styles.cardHead}>
            {iconWrap(styles.ig, <Instagram size={18}/>)}
            <div className={styles.cardTitle}>Instagram</div>
            <span className={styles.statusOff}>Não conectado</span>
          </div>
          <div className={styles.cardBody}>
            <p className={styles.cardDesc}>Em breve: conecte seu Instagram Business.</p>
            <div className={styles.cardActions}><button className={styles.btnSecondary} disabled>Conectar</button></div>
          </div>
        </div>

        {/* Facebook */}
        <div className={styles.card}>
          <div className={styles.cardHead}>
            {iconWrap(styles.fb, <MessageSquareText size={18}/>)}
            <div className={styles.cardTitle}>Facebook Messenger</div>
            <span className={styles.statusOff}>Não conectado</span>
          </div>
          <div className={styles.cardBody}>
            <p className={styles.cardDesc}>Em breve: conecte sua página do Facebook.</p>
            <div className={styles.cardActions}><button className={styles.btnSecondary} disabled>Conectar</button></div>
          </div>
        </div>

        {/* Telegram (abre modal) */}
        <div className={styles.card}>
          <div className={styles.cardHead}>
            {iconWrap(styles.tg, <Send size={18}/>)}
            <div className={styles.cardTitle}>Telegram</div>
            {tg.connected
              ? <span className={styles.statusOk}><CheckCircle2 size={14}/> Conectado</span>
              : <span className={styles.statusOff}>Não conectado</span>}
          </div>
          <div className={styles.cardBody}>
            {!tg.connected ? (
              <>
                <p className={styles.cardDesc}>
                  Conecte informando <strong>Bot Token</strong> e <strong>Webhook Secret</strong> em um modal.
                </p>
                <div className={styles.cardActions}>
                  <button className={styles.btnSecondary} onClick={() => setShowTgModal(true)}>Conectar</button>
                </div>
              </>
            ) : (
              <div className={styles.connectedBlock}>
                <div className={styles.kv}><span className={styles.k}>Bot</span><span className={styles.v}>{tg.username || "—"}</span></div>
                <div className={styles.kv}><span className={styles.k}>Bot ID</span><span className={styles.v}>{tg.botId || "—"}</span></div>
                <div className={styles.kv}><span className={styles.k}>Webhook</span><span className={styles.v}>{tg.webhookUrl || "—"}</span></div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Modal Telegram */}
      <TelegramConnectModal
        open={showTgModal}
        onClose={() => setShowTgModal(false)}
        tenant={tenant}
        onSuccess={({ botId, username, webhookUrl }) =>
          setTg({ connected: true, botId, username, webhookUrl, okMsg: "Telegram conectado com sucesso.", errMsg: null })
        }
      />
    </div>
  );
}
