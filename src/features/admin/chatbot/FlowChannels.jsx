import React, { useEffect, useMemo, useState } from "react";
import { ArrowLeft, CheckCircle2, RefreshCw } from "lucide-react";
import { useNavigate, useParams } from "react-router-dom";
import { apiGet, apiPost } from "../../../shared/apiClient";
import { toast } from "react-toastify";

import WhatsAppEmbeddedSignupButton from "../components/WhatsAppEmbeddedSignupButton";
import FacebookConnectButton from "../components/FacebookConnectButton";
import InstagramConnectButton from "../components/InstagramConnectButton";

/* ========= util: tenant ========= */
function getTenantFromHost() {
  if (typeof window === "undefined") return "";
  const host = window.location.hostname;
  const parts = host.split(".");
  if (parts.length >= 3) return parts[0] === "www" ? parts[1] : parts[0];
  return parts[0] || "";
}
function formatPhone(p) {
  const raw = typeof p === "string" ? p : (p && (p.display_phone_number || p.phone_number || p.number)) || "";
  const digits = (raw || "").replace(/[^\d+]/g, "");
  if (!digits) return "—";
  if (digits.startsWith("+")) return digits;
  return `+${digits}`;
}

/* ========= Brand icons originais ========= */
function BrandIcon({ type, size = 18 }) {
  const s = { width: size, height: size, display: "block" };
  switch (type) {
    case "whatsapp":
      return (
        <svg viewBox="0 0 32 32" style={s} aria-label="WhatsApp">
          <path fill="#25D366" d="M16.04 3C9.39 3 4 8.38 4 15.02c0 2.53.75 4.88 2.05 6.84L4 29l7.34-2.02c1.88 1.16 4.1 1.84 6.49 1.84 6.65 0 12.04-5.38 12.04-12.02C29.86 8.38 22.69 3 16.04 3z"/>
          <path fill="#FFF" d="M12.72 10.75c-.27-.6-.55-.61-.81-.62-.21-.01-.46-.01-.71-.01s-.65.09-1 .46c-.34.37-1.3 1.27-1.3 3.1 0 1.82 1.33 3.58 1.51 3.83.19.25 2.56 4.03 6.25 5.49 3.09 1.22 3.72.98 4.39.92.67-.06 2.17-.88 2.48-1.73.31-.85.31-1.58.22-1.73-.09-.15-.34-.25-.71-.44-.37-.19-2.17-1.07-2.5-1.19-.34-.12-.58-.19-.83.19-.25.37-.96 1.19-1.18 1.44-.22.25-.44.28-.81.09-.37-.19-1.53-.56-2.92-1.78-1.08-.96-1.81-2.15-2.03-2.52-.22-.37-.02-.58.17-.77.18-.18.41-.47.62-.72.2-.25.27-.43.41-.71.12-.28.06-.52-.03-.71-.09-.18-.78-1.95-1.08-2.62z"/>
        </svg>
      );
    case "facebook":
      return (
        <svg viewBox="0 0 24 24" style={s} aria-label="Facebook">
          <path fill="#1877F2" d="M24 12.073C24 5.405 18.627 0 12 0 5.373 0 0 5.405 0 12.073 0 18.09 4.388 23.094 10.125 24v-8.437H7.078v-3.49h3.047V9.356c0-3.007 1.792-4.666 4.533-4.666 1.313 0 2.686.235 2.686.235v2.953h-1.514c-1.492 0-1.955.93-1.955 1.885v2.256h3.328l-.532 3.49h-2.796V24C19.612 23.094 24 18.09 24 12.073z"/>
        </svg>
      );
    case "instagram":
      return (
        <svg viewBox="0 0 24 24" style={s} aria-label="Instagram">
          <defs>
            <linearGradient id="ig" x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor="#f58529"/><stop offset="50%" stopColor="#dd2a7b"/><stop offset="100%" stopColor="#8134af"/>
            </linearGradient>
          </defs>
          <path fill="url(#ig)" d="M12 2.2c3.2 0 3.6 0 4.9.1 1.2.1 1.9.2 2.4.4.6.2 1 .5 1.5 1 .5.5.8.9 1 1.5.2.5.3 1.2.4 2.4.1 1.3.1 1.7.1 4.9s0 3.6-.1 4.9c-.1 1.2-.2 1.9-.4 2.4-.2.6-.5 1-1 1.5-.5.5-.9.8-1.5 1-.5.2-1.2.3-2.4.4-1.3.1-1.7.1-4.9.1s-3.6 0-4.9-.1c-1.2-.1-1.9-.2-2.4-.4-.6-.2-1-.5-1.5-1-.5-.5-.8-.9-1-1.5-.2-.5-.3-1.2-.4-2.4C2.2 15.6 2.2 15.2 2.2 12s0-3.6.1-4.9c.1-1.2.2-1.9.4-2.4.2-.6.5-1 1-1.5.5-.5.9-.8 1.5-1 .5-.2 1.2-.3 2.4-.4C8.4 2.2 8.8 2.2 12 2.2z"/>
          <circle cx="18.3" cy="5.7" r="1.2" fill="#fff"/>
          <circle cx="12" cy="12" r="3.2" fill="#fff"/>
        </svg>
      );
    case "telegram":
      return (
        <svg viewBox="0 0 240 240" style={s} aria-label="Telegram">
          <circle cx="120" cy="120" r="120" fill="#2AABEE"/>
          <path fill="#fff" d="M52 120l118-46c5.6-2.2 10.5 1.3 8.7 9.3l-20.1 94.8c-1.4 6.4-5.3 8-10.7 5L113 154l-17.9 17.3c-2 2-3.6 3.6-7.3 3.6l2.6-37.1 67.7-61.1c3-2.6-.6-4.1-4.6-1.5l-83.8 53.2-36.1-11.4c-7.8-2.4-7.9-7.8 1.5-11.1z"/>
        </svg>
      );
    default:
      return null;
  }
}

/* ========= estilo ========= */
const S = {
  page: { padding: 16, minHeight: "100vh", background: "#f9fafb" },
  header: {
    background: "#fff", border: "1px solid #e2e8f0", borderRadius: 12,
    padding: 14, marginBottom: 16, display: "flex", alignItems: "center", justifyContent: "space-between",
    boxShadow: "0 6px 20px rgba(15, 23, 42, 0.08)"
  },
  titleRow: { display: "flex", alignItems: "center", gap: 10 },
  grid: { display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(320px, 1fr))", gap: 14 },
  card: { background: "#fff", border: "1px solid #e2e8f0", borderRadius: 12, padding: 14, boxShadow: "0 6px 20px rgba(15, 23, 42, 0.08)" },
  head: { display: "flex", alignItems: "center", gap: 10, marginBottom: 8 },
  chipOk: { display: "inline-flex", alignItems: "center", gap: 6, fontSize: 12, color: "#16a34a" },
  chipOff: { fontSize: 12, color: "#64748b" },
  kv: { display: "grid", gridTemplateColumns: "120px 1fr", fontSize: 13, gap: 6, padding: "4px 0" },
  k: { color: "#475569" }, v: { color: "#0f172a", fontFamily: "ui-monospace, SFMono-Regular, Menlo, monospace" },
  actions: { display: "flex", gap: 8, marginTop: 10 },
  btn: { border: "1px solid #e2e8f0", background: "#fff", padding: "8px 10px", borderRadius: 8, fontWeight: 700, cursor: "pointer" },
  btnPrimary: { background: "#2563eb", color: "#fff", padding: "8px 10px", borderRadius: 8, border: "none", fontWeight: 700, cursor: "pointer" },
};

export default function FlowChannels() {
  const { flowId } = useParams();
  const navigate = useNavigate();
  const tenant = useMemo(() => getTenantFromHost(), []);

  const [loading, setLoading] = useState(true);

  // status do tenant (apenas para exibir dados — NÃO controla o CTA)
  const [wa, setWa] = useState({ connected: false, id: "", display: "" });
  const [fb, setFb] = useState({ connected: false, pageId: "", pageName: "" });
  const [ig, setIg] = useState({ connected: false, igUserId: "", igUsername: "", pageName: "" });
  const [tg, setTg] = useState({ connected: false, bound: false, botId: "", username: "" });

  // bindings do flow
  const [bindings, setBindings] = useState([]); // [{channel_type, channel_key, display_name, is_active}]

  const isBound = (type) => bindings.some(b => b.channel_type === type && b.is_active);

  async function ensureBind(kind, key, label) {
    // sempre cria/atualiza o vínculo do canal COM ESTE FLOW
    const res = await apiPost(`/flows/${flowId}/channels`, {
      channel_type: kind,
      channel_key: key,
      display_name: label || null
    });
    return res;
  }

  async function loadAll() {
    setLoading(true);
    try {
      // bindings do flow
      const b = await apiGet(`/flows/${flowId}/channels`);
      setBindings(Array.isArray(b) ? b : []);

      // status de provedores do tenant (apenas informativo)
      try {
        const ws = await apiGet(`/whatsapp/number?subdomain=${tenant}`);
        const connected = !!(ws?.ok && ws?.phone);
        setWa({ connected, id: ws?.phone?.id || "", display: formatPhone(ws?.phone) });
      } catch { setWa({ connected: false, id: "", display: "" }); }

      try {
        const fs = await apiGet(`/facebook/status?subdomain=${tenant}`);
        setFb({ connected: !!fs?.connected, pageId: fs?.page_id || "", pageName: fs?.page_name || "" });
      } catch { setFb({ connected: false, pageId: "", pageName: "" }); }

      try {
        const is = await apiGet(`/instagram/status?subdomain=${tenant}`);
        setIg({ connected: !!is?.connected, igUserId: is?.ig_user_id || "", igUsername: is?.ig_username || "", pageName: is?.page_name || "" });
      } catch { setIg({ connected: false, igUserId: "", igUsername: "", pageName: "" }); }

      // Telegram é flow-aware (status retorna bound)
      try {
        const ts = await apiGet(`/telegram/status?subdomain=${tenant}&flow_id=${flowId}`);
        setTg({
          connected: !!ts?.connected,
          bound: !!ts?.bound,
          botId: ts?.bot_id || "",
          username: ts?.username || ""
        });
      } catch { setTg({ connected: false, bound: false, botId: "", username: "" }); }

    } catch (e) {
      console.error(e);
      toast.error("Falha ao carregar canais do flow.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { loadAll(); /* eslint-disable-next-line */ }, [flowId]);

  // callbacks de sucesso — SEMPRE conectam ao flow
  const onWaPickSuccess = async ({ phone_number_id, display }) => {
    try {
      await ensureBind("whatsapp", phone_number_id, display || "WhatsApp");
      toast.success("WhatsApp conectado a este flow.");
      await loadAll();
    } catch { toast.error("Falha ao conectar WhatsApp ao flow."); }
  };

  const onFbConnected = async ({ page_id, page_name }) => {
    try {
      await ensureBind("facebook", page_id, page_name || "Facebook");
      toast.success("Facebook conectado a este flow.");
      await loadAll();
    } catch { toast.error("Falha ao conectar Facebook ao flow."); }
  };

  const onIgConnected = async ({ ig_user_id, ig_username, page_name }) => {
    try {
      await ensureBind("instagram", ig_user_id, ig_username || page_name || "Instagram");
      toast.success("Instagram conectado a este flow.");
      await loadAll();
    } catch { toast.error("Falha ao conectar Instagram ao flow."); }
  };

  return (
    <div style={S.page}>
      <div style={S.header}>
        <div style={S.titleRow}>
          <button onClick={() => navigate(-1)} style={{ ...S.btn, display: "inline-flex", alignItems: "center", gap: 6 }} title="Voltar">
            <ArrowLeft size={14}/> Voltar
          </button>
          <div style={{ fontWeight: 800 }}>Canais do Flow</div>
          <div style={{ fontSize: 12, color: "#475569" }}>id: <b>{flowId}</b></div>
        </div>
        <button onClick={loadAll} style={{ ...S.btn, display: "inline-flex", alignItems: "center", gap: 6 }}>
          <RefreshCw size={14}/> Recarregar
        </button>
      </div>

      {loading ? (
        <div style={{ color: "#475569" }}>Carregando…</div>
      ) : (
        <div style={S.grid}>
          {/* WhatsApp */}
          <div style={S.card}>
            <div style={S.head}>
              <div style={iconWrap("#22c55e")}><BrandIcon type="whatsapp" /></div>
              <div style={{ fontWeight: 700 }}>WhatsApp</div>
              <div style={{ marginLeft: "auto" }}>
                {isBound("whatsapp")
                  ? <span style={S.chipOk}><CheckCircle2 size={14}/> Conectado</span>
                  : <span style={S.chipOff}>Não conectado</span>}
              </div>
            </div>
            <div>
              <Row k="Número" v={wa.display || "—"} />
              <Row k="Phone ID" v={wa.id || "—"} mono />
            </div>
            <div style={S.actions}>
              {isBound("whatsapp") ? null : (
                wa.connected
                  ? <button style={S.btnPrimary} onClick={() => ensureBind("whatsapp", wa.id, wa.display || "WhatsApp").then(loadAll).then(()=>toast.success("WhatsApp conectado ao flow")).catch(()=>toast.error("Falha ao conectar WhatsApp"))}>Conectar WhatsApp</button>
                  : <WhatsAppEmbeddedSignupButton tenant={tenant} label="Conectar WhatsApp" onPickSuccess={onWaPickSuccess}/>
              )}
            </div>
          </div>

          {/* Facebook */}
          <div style={S.card}>
            <div style={S.head}>
              <div style={iconWrap("#1877F2")}><BrandIcon type="facebook" /></div>
              <div style={{ fontWeight: 700 }}>Facebook Messenger</div>
              <div style={{ marginLeft: "auto" }}>
                {isBound("facebook")
                  ? <span style={S.chipOk}><CheckCircle2 size={14}/> Conectado</span>
                  : <span style={S.chipOff}>Não conectado</span>}
              </div>
            </div>
            <div>
              <Row k="Página" v={fb.pageName || "—"} />
              <Row k="Page ID" v={fb.pageId || "—"} mono />
            </div>
            <div style={S.actions}>
              {isBound("facebook") ? null : (
                fb.connected
                  ? <button style={S.btnPrimary} onClick={() => ensureBind("facebook", fb.pageId, fb.pageName || "Facebook").then(loadAll).then(()=>toast.success("Facebook conectado ao flow")).catch(()=>toast.error("Falha ao conectar Facebook"))}>Conectar Facebook</button>
                  : <FacebookConnectButton tenant={tenant} label="Conectar Facebook" onConnected={onFbConnected}/>
              )}
            </div>
          </div>

          {/* Instagram */}
          <div style={S.card}>
            <div style={S.head}>
              <div style={iconWrap("#DD2A7B")}><BrandIcon type="instagram" /></div>
              <div style={{ fontWeight: 700 }}>Instagram</div>
              <div style={{ marginLeft: "auto" }}>
                {isBound("instagram")
                  ? <span style={S.chipOk}><CheckCircle2 size={14}/> Conectado</span>
                  : <span style={S.chipOff}>Não conectado</span>}
              </div>
            </div>
            <div>
              <Row k="IG" v={ig.igUsername || "—"} />
              <Row k="IG User ID" v={ig.igUserId || "—"} mono />
              <Row k="Página" v={ig.pageName || "—"} />
            </div>
            <div style={S.actions}>
              {isBound("instagram") ? null : (
                ig.connected
                  ? <button style={S.btnPrimary} onClick={() => ensureBind("instagram", ig.igUserId, ig.igUsername || ig.pageName || "Instagram").then(loadAll).then(()=>toast.success("Instagram conectado ao flow")).catch(()=>toast.error("Falha ao conectar Instagram"))}>Conectar Instagram</button>
                  : <InstagramConnectButton tenant={tenant} label="Conectar Instagram" onConnected={onIgConnected}/>
              )}
            </div>
          </div>

          {/* Telegram */}
          <div style={S.card}>
            <div style={S.head}>
              <div style={iconWrap("#2AABEE")}><BrandIcon type="telegram" /></div>
              <div style={{ fontWeight: 700 }}>Telegram</div>
              <div style={{ marginLeft: "auto" }}>
                {tg.bound
                  ? <span style={S.chipOk}><CheckCircle2 size={14}/> Conectado</span>
                  : <span style={S.chipOff}>Não conectado</span>}
              </div>
            </div>
            <div>
              <Row k="Bot" v={tg.username ? `@${tg.username}` : "—"} />
              <Row k="Bot ID" v={tg.botId || "—"} mono />
            </div>
            <div style={S.actions}>
              {tg.bound ? null : (
                <button
                  style={S.btnPrimary}
                  onClick={() => navigate("/development/flowhub/telegram/connect", { state: { returnTo: -1, flowId } })}
                >
                  Conectar Telegram
                </button>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

/* helpers visuais */
function iconWrap() {
  return {
    width: 28,
    height: 28,
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 8,
    background: "#fff",
    border: "1px solid #e2e8f0",
  };
}
function Row({ k, v, mono }) {
  return (
    <div style={S.kv}>
      <div style={S.k}>{k}</div>
      <div style={{ ...S.v, ...(mono ? {} : { fontFamily: "inherit" }) }}>{v}</div>
    </div>
  );
}
