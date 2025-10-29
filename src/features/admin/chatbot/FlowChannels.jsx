// src/features/admin/chatbot/FlowChannels.jsx
import React, { useEffect, useState } from "react";
import {
  ArrowLeft, CheckCircle2, RefreshCw,
} from "lucide-react";
import { useNavigate, useParams, useLocation } from "react-router-dom";
import { apiGet } from "../../../shared/apiClient";
import { toast } from "react-toastify";

// botões originais (como no Channels original que você enviou)
import WhatsAppEmbeddedSignupButton from "../preferences/components/WhatsAppEmbeddedSignupButton";
import FacebookConnectButton from "../preferences/components/FacebookConnectButton";
import InstagramConnectButton from "../preferences/components/InstagramConnectButton";

/* Logos reais */
const WhatsAppLogo = ({ size = 18 }) => (
  <svg width={size} height={size} viewBox="0 0 32 32" aria-hidden="true">
    <path fill="#25D366" d="M16 3C9.372 3 4 8.372 4 15c0 2.124.56 4.118 1.545 5.856L4 29l8.35-1.514A11.93 11.93 0 0 0 16 27c6.628 0 12-12 12-12S22.628 3 16 3z"/>
    <path fill="#fff" d="M23.09 19.18c-.2.56-1.16 1.07-1.6 1.1-.44.03-1 .03-1.61-.1-.37-.09-.84-.27-1.45-.53-2.55-1.1-4.2-3.65-4.33-3.82-.13-.17-1.03-1.37-1.03-2.62 0-1.25.65-1.86.88-2.11.23-.25.5-.31.67-.31.17 0 .34.01.49.01.16 0 .37-.06.58.44.2.5.69 1.73.75 1.85.06.12.1.26.02.42-.08.16-.12.26-.24.4-.12.14-.25.31-.36.42-.12.12-.24.25-.1.49.14.25.62 1.02 1.34 1.66.92.82 1.7 1.08 1.95 1.2.25.12.39.1.53-.06.14-.16.61-.71.78-.95.17-.24.33-.2.55-.12.23.08 1.44.68 1.69.81.25.13.41.19.47.3.06.11.06.64-.14 1.24z"/>
  </svg>
);
const InstagramLogo = ({ size = 18 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" aria-hidden="true">
    <linearGradient id="ig2" x1="0" x2="1" y1="1" y2="0">
      <stop offset="0%" stopColor="#feda75"/><stop offset="25%" stopColor="#fa7e1e"/>
      <stop offset="50%" stopColor="#d62976"/><stop offset="75%" stopColor="#962fbf"/>
      <stop offset="100%" stopColor="#4f5bd5"/>
    </linearGradient>
    <path fill="url(#ig2)" d="M7 2h10a5 5 0 0 1 5 5v10a5 5 0 0 1-5 5H7a5 5 0 0 1-5-5V7a5 5 0 0 1 5-5z"/>
    <circle cx="18" cy="6" r="1.3" fill="#fff"/>
    <circle cx="12" cy="12" r="3.5" fill="none" stroke="#fff" strokeWidth="2"/>
    <rect x="4" y="4" width="16" height="16" rx="4" ry="4" fill="none" stroke="#fff" strokeWidth="2"/>
  </svg>
);
const FacebookLogo = ({ size = 18 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" aria-hidden="true">
    <path fill="#1877F2" d="M24 12.073C24 5.403 18.627 0 12 0S0 5.403 0 12.073C0 18.1 4.388 23.093 10.125 24v-8.44H7.078v-3.487h3.047V9.41c0-3.007 1.79-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953h-1.513c-1.49 0-1.954.927-1.954 1.878v2.26h3.328l-.532 3.487h-2.796V24C19.612 23.093 24 18.1 24 12.073z"/>
  </svg>
);
const TelegramLogo = ({ size = 18 }) => (
  <svg width={size} height={size} viewBox="0 0 240 240" aria-hidden="true">
    <circle cx="120" cy="120" r="120" fill="#29A9EB"/>
    <path fill="#fff" d="M52 123l117-45c5-2 9 2 8 7l-20 93c-1 6-8 8-12 5l-33-24-18 18c-2 2-6 1-6-2l1-26 63-60c2-2 0-2-3 0l-78 49-34-14c-6-2-6-10 0-12z"/>
  </svg>
);

/* Estilos inline (simples) */
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
  k: { color: "#475569" },
  v: { color: "#0f172a", fontFamily: "ui-monospace, SFMono-Regular, Menlo, monospace" },
  actions: { display: "flex", gap: 8, marginTop: 10 },
  btn: { border: "1px solid #e2e8f0", background: "#fff", padding: "8px 10px", borderRadius: 8, fontWeight: 700, cursor: "pointer" },
  btnPrimary: { background: "#2563eb", color: "#fff", padding: "8px 10px", borderRadius: 8, border: "none", fontWeight: 700, cursor: "pointer" },
};

export default function FlowChannels() {
  const { flowId } = useParams();
  const navigate = useNavigate();
  const location = useLocation();

  const [loading, setLoading] = useState(true);

  // status de provedores
  const [wa, setWa] = useState({ connected: false, id: "", display: "" });
  const [fb, setFb] = useState({ connected: false, pageId: "", pageName: "" });
  const [ig, setIg] = useState({ connected: false, igUserId: "", igUsername: "", pageName: "" });
  const [tg, setTg] = useState({ connected: false, botId: "", username: "" });

  // bindings do flow
  const [bindings, setBindings] = useState([]); // [{channel_type, channel_id, ...}]

  async function loadAll() {
    setLoading(true);
    try {
      // canais vinculados ao flow
      const b = await apiGet(`/flows/${flowId}/channels`);
      setBindings(Array.isArray(b) ? b : []);

      // status provedores (mesmos endpoints do Channels original)
      try {
        const ws = await apiGet(`/whatsapp/number`);
        const connected = !!(ws?.ok && ws?.phone);
        setWa({
          connected,
          id: ws?.phone?.id || "",
          display: formatPhone(ws?.phone),
        });
      } catch { setWa({ connected: false, id: "", display: "" }); }

      try {
        const fs = await apiGet(`/facebook/status`);
        setFb({ connected: !!fs?.connected, pageId: fs?.page_id || "", pageName: fs?.page_name || "" });
      } catch { setFb({ connected: false, pageId: "", pageName: "" }); }

      try {
        const is = await apiGet(`/instagram/status`);
        setIg({
          connected: !!is?.connected,
          igUserId: is?.ig_user_id || "",
          igUsername: is?.ig_username || "",
          pageName: is?.page_name || "",
        });
      } catch { setIg({ connected: false, igUserId: "", igUsername: "", pageName: "" }); }

      try {
        const ts = await apiGet(`/telegram/status`);
        setTg({ connected: !!ts?.connected, botId: ts?.bot_id || "", username: ts?.username || "" });
      } catch { setTg({ connected: false, botId: "", username: "" }); }
    } catch (e) {
      console.error(e);
      toast.error("Falha ao carregar canais do flow.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { loadAll(); /* eslint-disable-line */ }, [flowId]);

  const isBound = (type) => bindings.some(b => String(b.channel_type).toLowerCase() === type);

  return (
    <div style={S.page}>
      <div style={S.header}>
        <div style={S.titleRow}>
          <button
            onClick={() => navigate(-1)}
            style={{ ...S.btn, display: "inline-flex", alignItems: "center", gap: 6 }}
            title="Voltar"
          >
            <ArrowLeft size={14}/> Voltar
          </button>
          <div style={{ fontWeight: 800 }}>Canais do Flow</div>
          <div style={{ fontSize: 12, color: "#475569" }}>id: <b>{flowId}</b></div>
        </div>
        <button
          onClick={loadAll}
          style={{ ...S.btn, display: "inline-flex", alignItems: "center", gap: 6 }}
          title="Recarregar"
        >
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
              <WhatsAppLogo />
              <div style={{ fontWeight: 700 }}>WhatsApp</div>
              <div style={{ marginLeft: "auto" }}>
                {wa.connected ? (
                  isBound("whatsapp") ? (
                    <span style={S.chipOk}><CheckCircle2 size={14}/> Conectado • Vinculado</span>
                  ) : (
                    <span style={S.chipOk}><CheckCircle2 size={14}/> Conectado</span>
                  )
                ) : (
                  <span style={S.chipOff}>Não conectado</span>
                )}
              </div>
            </div>
            <div>
              <Row k="Número" v={wa.display || "—"} />
              <Row k="Phone ID" v={wa.id || "—"} mono />
            </div>
            <div style={S.actions}>
              {/* mesmo comportamento do Channels original */}
              <WhatsAppEmbeddedSignupButton tenant="" label="Conectar" />
            </div>
          </div>

          {/* Facebook */}
          <div style={S.card}>
            <div style={S.head}>
              <FacebookLogo />
              <div style={{ fontWeight: 700 }}>Facebook Messenger</div>
              <div style={{ marginLeft: "auto" }}>
                {fb.connected ? (
                  isBound("facebook") ? (
                    <span style={S.chipOk}><CheckCircle2 size={14}/> Conectado • Vinculado</span>
                  ) : (
                    <span style={S.chipOk}><CheckCircle2 size={14}/> Conectado</span>
                  )
                ) : (
                  <span style={S.chipOff}>Não conectado</span>
                )}
              </div>
            </div>
            <div>
              <Row k="Página" v={fb.pageName || "—"} />
              <Row k="Page ID" v={fb.pageId || "—"} mono />
            </div>
            <div style={S.actions}>
              <FacebookConnectButton tenant="" label="Conectar Facebook" />
            </div>
          </div>

          {/* Instagram */}
          <div style={S.card}>
            <div style={S.head}>
              <InstagramLogo />
              <div style={{ fontWeight: 700 }}>Instagram</div>
              <div style={{ marginLeft: "auto" }}>
                {ig.connected ? (
                  isBound("instagram") ? (
                    <span style={S.chipOk}><CheckCircle2 size={14}/> Conectado • Vinculado</span>
                  ) : (
                    <span style={S.chipOk}><CheckCircle2 size={14}/> Conectado</span>
                  )
                ) : (
                  <span style={S.chipOff}>Não conectado</span>
                )}
              </div>
            </div>
            <div>
              <Row k="IG" v={ig.igUsername || "—"} />
              <Row k="IG User ID" v={ig.igUserId || "—"} mono />
              <Row k="Página" v={ig.pageName || "—"} />
            </div>
            <div style={S.actions}>
              <InstagramConnectButton tenant="" label="Conectar Instagram" />
            </div>
          </div>

          {/* Telegram */}
          <div style={S.card}>
            <div style={S.head}>
              <TelegramLogo />
              <div style={{ fontWeight: 700 }}>Telegram</div>
              <div style={{ marginLeft: "auto" }}>
                {tg.connected ? (
                  isBound("telegram") ? (
                    <span style={S.chipOk}><CheckCircle2 size={14}/> Conectado • Vinculado</span>
                  ) : (
                    <span style={S.chipOk}><CheckCircle2 size={14}/> Conectado</span>
                  )
                ) : (
                  <span style={S.chipOff}>Não conectado</span>
                )}
              </div>
            </div>
            <div>
              <Row k="Bot" v={tg.username ? `@${tg.username}` : "—"} />
              <Row k="Bot ID" v={tg.botId || "—"} mono />
            </div>
            <div style={S.actions}>
              {/* segue padrão do Channels original */}
              <button
                onClick={() => navigate("/channels/telegram", { state: { returnTo: location.pathname } })}
                style={S.btnPrimary}
              >
                Configurar Bot
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

/* helpers */
function Row({ k, v, mono }) {
  return (
    <div style={S.kv}>
      <div style={S.k}>{k}</div>
      <div style={{ ...S.v, ...(mono ? {} : { fontFamily: "inherit" }) }}>{v}</div>
    </div>
  );
}

function formatPhone(p) {
  const raw = typeof p === "string" ? p : (p && (p.display_phone_number || p.phone_number || p.number)) || "";
  const digits = (raw || "").replace(/[^\d+]/g, "");
  if (!digits) return "—";
  if (digits.startsWith("+")) return digits;
  return `+${digits}`;
}
