import React, { useEffect, useMemo, useState } from "react";
import { ArrowLeft, CheckCircle2, RefreshCw, Settings2 } from "lucide-react";
import { useNavigate, useParams } from "react-router-dom";
import { apiGet, apiPost } from "../../../shared/apiClient";
import { toast } from "react-toastify";

import WhatsAppEmbeddedSignupButton from "./channels/components/WhatsAppEmbeddedSignupButton";
import FacebookConnectButton from "./channels/components/FacebookConnectButton";
import InstagramConnectButton from "./channels/components/InstagramConnectButton";
import BrandIcon from "./BrandIcon";

/* ========= tenant util ========= */
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

/* ========= estilo ========= */
const S = {
  page: { padding: 16, minHeight: "100vh", background: "#f9fafb" },
  header: {
    background: "#fff",
    border: "1px solid #e2e8f0",
    borderRadius: 12,
    padding: 14,
    marginBottom: 16,
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    boxShadow: "0 6px 20px rgba(15, 23, 42, 0.08)",
  },
  titleRow: { display: "flex", alignItems: "center", gap: 10 },
  grid: { display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(320px, 1fr))", gap: 14 },
  card: {
    background: "#fff",
    border: "1px solid #e2e8f0",
    borderRadius: 12,
    padding: 14,
    boxShadow: "0 6px 20px rgba(15, 23, 42, 0.08)",
  },
  head: { display: "flex", alignItems: "center", gap: 10, marginBottom: 8 },
  chipOk: { display: "inline-flex", alignItems: "center", gap: 6, fontSize: 12, color: "#16a34a" },
  chipOff: { fontSize: 12, color: "#64748b" },
  kv: { display: "grid", gridTemplateColumns: "120px 1fr", fontSize: 13, gap: 6, padding: "4px 0" },
  k: { color: "#475569" },
  v: { color: "#0f172a", fontFamily: "ui-monospace, SFMono-Regular, Menlo, monospace" },
  actions: { display: "flex", gap: 8, marginTop: 10, flexWrap: "wrap" },
  btn: { border: "1px solid #e2e8f0", background: "#fff", padding: "8px 10px", borderRadius: 8, fontWeight: 700, cursor: "pointer" },
  btnPrimary: { background: "#2563eb", color: "#fff", padding: "8px 10px", borderRadius: 8, border: "none", fontWeight: 700, cursor: "pointer" },
  btnGhost: { border: "1px solid #e2e8f0", background: "#fff", padding: "8px 10px", borderRadius: 8, fontWeight: 700, cursor: "pointer" },
};

export default function FlowChannels() {
  const { flowId } = useParams();
  const navigate = useNavigate();
  const tenant = useMemo(() => getTenantFromHost(), []);

  const [loading, setLoading] = useState(true);

  // status informativo do tenant (não define conectado do flow)
  const [wa, setWa] = useState({ connected: false, id: "", display: "" });
  const [fb, setFb] = useState({ connected: false, pageId: "", pageName: "" });
  const [ig, setIg] = useState({ connected: false, igUserId: "", igUsername: "", pageName: "" });
  const [tgTenant, setTgTenant] = useState({ connected: false, botId: "", username: "" });

  // vínculos reais do FLOW (fonte de verdade)
  const [bindings, setBindings] = useState([]);
  const isBound = (type) => bindings.some((b) => b.channel_type === type && b.is_active);

  async function fetchBindings() {
    const b = await apiGet(`/flows/${flowId}/channels`);
    setBindings(Array.isArray(b) ? b : []);
  }

  async function loadAll() {
    setLoading(true);
    try {
      await fetchBindings();

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

      try {
        const ts = await apiGet(`/telegram/status?subdomain=${tenant}&flow_id=${flowId}`);
        setTgTenant({ connected: !!ts?.connected, botId: ts?.bot_id || "", username: ts?.username || "" });
      } catch { setTgTenant({ connected: false, botId: "", username: "" }); }
    } catch (e) {
      console.error(e);
      toast.error("Falha ao carregar canais do flow.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { loadAll(); /* eslint-disable-next-line */ }, [flowId]);

  // cria vínculo deste flow (após NOVA conexão)
  async function connectThisFlow(kind, key, label) {
    if (!key) { toast.warn("Conta não encontrada para conectar."); return; }
    try {
      await apiPost(`/flows/${flowId}/channels`, { channel_type: kind, channel_key: key, display_name: label || null });
      await fetchBindings();
      toast.success(`${kind} conectado a este flow.`);
    } catch { toast.error(`Falha ao conectar ${kind}.`); }
  }

  const openWaProfile = () =>
    navigate("/settings/channels/whatsapp/profile", { state: { returnTo: `/development/flowhub/${flowId}/channels` } });

  const openTgConnect = () =>
    navigate("/channels/telegram", { state: { returnTo: `/development/flowhub/${flowId}/channels`, flowId } });

  return (
    <div style={S.page}>
      <div style={S.header}>
        <div style={S.titleRow}>
          <button onClick={() => navigate(-1)} style={{ ...S.btn, display: "inline-flex", alignItems: "center", gap: 6 }} title="Voltar">
            <ArrowLeft size={14} /> Voltar
          </button>
          <div style={{ fontWeight: 800 }}>Canais do Flow</div>
          <div style={{ fontSize: 12, color: "#475569" }}>id: <b>{flowId}</b></div>
        </div>
        <button onClick={loadAll} style={{ ...S.btn, display: "inline-flex", alignItems: "center", gap: 6 }}>
          <RefreshCw size={14} /> Recarregar
        </button>
      </div>

      {loading ? (
        <div style={{ color: "#475569" }}>Carregando…</div>
      ) : (
        <div style={S.grid}>
          {/* WhatsApp */}
          <div style={S.card}>
            <div style={S.head}>
              <div style={iconWrap()} title="WhatsApp"><BrandIcon type="whatsapp" /></div>
              <div style={{ fontWeight: 700 }}>WhatsApp</div>
              <div style={{ marginLeft: "auto" }}>
                {isBound("whatsapp") ? <span style={S.chipOk}><CheckCircle2 size={14} /> Conectado</span> : <span style={S.chipOff}>Não conectado</span>}
              </div>
            </div>

            <Row k="Número" v={wa.display || "—"} />
            <Row k="Phone ID" v={wa.id || "—"} mono />

            <div style={S.actions}>
              {isBound("whatsapp") ? (
                <button style={S.btnGhost} onClick={openWaProfile} title="Abrir Perfil do WhatsApp">
                  <Settings2 size={14} style={{ marginRight: 6 }} /> Perfil
                </button>
              ) : (
                <WhatsAppEmbeddedSignupButton
                  tenant={tenant}
                  label={wa.connected ? "Conectar novo WhatsApp" : "Conectar WhatsApp"}
                  onPickSuccess={({ phone_number_id, display }) =>
                    connectThisFlow("whatsapp", phone_number_id, display || "WhatsApp")
                  }
                />
              )}
            </div>
          </div>

          {/* Facebook */}
          <div style={S.card}>
            <div style={S.head}>
              <div style={iconWrap()} title="Facebook"><BrandIcon type="facebook" /></div>
              <div style={{ fontWeight: 700 }}>Facebook Messenger</div>
              <div style={{ marginLeft: "auto" }}>
                {isBound("facebook") ? <span style={S.chipOk}><CheckCircle2 size={14} /> Conectado</span> : <span style={S.chipOff}>Não conectado</span>}
              </div>
            </div>

            <Row k="Página" v={fb.pageName || "—"} />
            <Row k="Page ID" v={fb.pageId || "—"} mono />

            <div style={S.actions}>
              {isBound("facebook") ? null : (
                <FacebookConnectButton
                  tenant={tenant}
                  label={fb.connected ? "Conectar novo Facebook" : "Conectar Facebook"}
                  onConnected={({ page_id, page_name }) => connectThisFlow("facebook", page_id, page_name || "Facebook")}
                />
              )}
            </div>
          </div>

          {/* Instagram */}
          <div style={S.card}>
            <div style={S.head}>
              <div style={iconWrap()} title="Instagram"><BrandIcon type="instagram" /></div>
              <div style={{ fontWeight: 700 }}>Instagram</div>
              <div style={{ marginLeft: "auto" }}>
                {isBound("instagram") ? <span style={S.chipOk}><CheckCircle2 size={14} /> Conectado</span> : <span style={S.chipOff}>Não conectado</span>}
              </div>
            </div>

            <Row k="IG" v={ig.igUsername || "—"} />
            <Row k="IG User ID" v={ig.igUserId || "—"} mono />
            <Row k="Página" v={ig.pageName || "—"} />

            <div style={S.actions}>
              {isBound("instagram") ? null : (
                <InstagramConnectButton
                  tenant={tenant}
                  label={ig.connected ? "Conectar novo Instagram" : "Conectar Instagram"}
                  onConnected={({ ig_user_id, ig_username, page_name }) =>
                    connectThisFlow("instagram", ig_user_id, ig_username || page_name || "Instagram")
                  }
                />
              )}
            </div>
          </div>

          {/* Telegram */}
          <div style={S.card}>
            <div style={S.head}>
              <div style={iconWrap()} title="Telegram"><BrandIcon type="telegram" /></div>
              <div style={{ fontWeight: 700 }}>Telegram</div>
              <div style={{ marginLeft: "auto" }}>
                {isBound("telegram") ? <span style={S.chipOk}><CheckCircle2 size={14} /> Conectado</span> : <span style={S.chipOff}>Não conectado</span>}
              </div>
            </div>

            <Row k="Bot" v={tgTenant.username ? `@${tgTenant.username}` : "—"} />
            <Row k="Bot ID" v={tgTenant.botId || "—"} mono />

            <div style={S.actions}>
              {isBound("telegram") ? null : (
                <button style={S.btnPrimary} onClick={openTgConnect}>Conectar Telegram</button>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

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
