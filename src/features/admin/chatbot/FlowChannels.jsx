// src/features/admin/chatbot/FlowChannels.jsx
import React, { useEffect, useState } from "react";
import {
  ArrowLeft, CheckCircle2, MessageCircle, MessageSquareText as FbIcon,
  Instagram as IgIcon, Send, RefreshCw, ExternalLink
} from "lucide-react";
import { useNavigate, useParams } from "react-router-dom";
import { apiGet } from "../../../shared/apiClient";
import { toast } from "react-toastify";

// simples css inline para reutilizar seu visual (pode trocar por CSS module)
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

  // status de provedores (conexão global) + bindings do flow
  const [loading, setLoading] = useState(true);
  const [wa, setWa] = useState({ connected: false, id: "", display: "" });
  const [fb, setFb] = useState({ connected: false, pageId: "", pageName: "" });
  const [ig, setIg] = useState({ connected: false, igUserId: "", igUsername: "", pageName: "" });
  const [tg, setTg] = useState({ connected: false, botId: "", username: "" });

  const [bindings, setBindings] = useState([]); // [{channel_type, channel_id, meta}]

  async function loadAll() {
    setLoading(true);
    try {
      // bindings do flow (já vinculados)
      const b = await apiGet(`/flows/${flowId}/channels`);
      setBindings(Array.isArray(b) ? b : []);

      // status de provedores (ajuste endpoints conforme seu back)
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

  useEffect(() => { loadAll(); /* eslint-disable-next-line */ }, [flowId]);

  const isBound = (type) => bindings.some(b => b.channel_type === type);

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
              <div style={iconWrapStyle("#22c55e")}><MessageCircle size={18}/></div>
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
              <button
                onClick={() => navigate("/channels/whatsapp", { state: { returnTo: -1 } })}
                style={S.btnPrimary}
              >
                Gerenciar no provedor <ExternalLink size={14} style={{ marginLeft: 6 }}/>
              </button>
            </div>
          </div>

          {/* Facebook */}
          <div style={S.card}>
            <div style={S.head}>
              <div style={iconWrapStyle("#3b82f6")}><FbIcon size={18}/></div>
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
              <button
                onClick={() => window.open("/auth/facebook", "_blank")}
                style={S.btnPrimary}
              >
                Gerenciar no provedor <ExternalLink size={14} style={{ marginLeft: 6 }}/>
              </button>
            </div>
          </div>

          {/* Instagram */}
          <div style={S.card}>
            <div style={S.head}>
              <div style={iconWrapStyle("#ef4444")}><IgIcon size={18}/></div>
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
              <button
                onClick={() => window.open("/auth/instagram", "_blank")}
                style={S.btnPrimary}
              >
                Gerenciar no provedor <ExternalLink size={14} style={{ marginLeft: 6 }}/>
              </button>
            </div>
          </div>

          {/* Telegram */}
          <div style={S.card}>
            <div style={S.head}>
              <div style={iconWrapStyle("#0ea5e9")}><Send size={18}/></div>
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
              <button
                onClick={() => navigate("/channels/telegram", { state: { returnTo: -1 } })}
                style={S.btnPrimary}
              >
                Gerenciar no provedor <ExternalLink size={14} style={{ marginLeft: 6 }}/>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

/* helpers visuais */
function iconWrapStyle(color) {
  return {
    width: 28,
    height: 28,
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 8,
    background: "#fff",
    border: "1px solid #e2e8f0",
    color,
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
function formatPhone(p) {
  const raw = typeof p === "string" ? p : (p && (p.display_phone_number || p.phone_number || p.number)) || "";
  const digits = (raw || "").replace(/[^\d+]/g, "");
  if (!digits) return "—";
  if (digits.startsWith("+")) return digits;
  return `+${digits}`;
}
