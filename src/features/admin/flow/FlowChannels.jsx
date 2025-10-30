import React, { useEffect, useMemo, useState, useCallback } from "react";
import { ArrowLeft, CheckCircle2, RefreshCw, Settings2 } from "lucide-react";
import { useNavigate, useParams } from "react-router-dom";
import { apiGet, apiPost } from "../../../shared/apiClient";
import { toast } from "react-toastify";

import WhatsAppEmbeddedSignupButton from "./channels/components/WhatsAppEmbeddedSignupButton";
import FacebookConnectButton from "./channels/components/FacebookConnectButton";
import InstagramConnectButton from "./channels/components/InstagramConnectButton";
import LogoLoader from "../../../components/common/LogoLoader";
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
  const raw =
    typeof p === "string"
      ? p
      : (p && (p.display_phone_number || p.phone_number || p.number)) || "";
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
  grid: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fill, minmax(320px, 1fr))",
    gap: 14,
  },
  card: {
    background: "#fff",
    border: "1px solid #e2e8f0",
    borderRadius: 12,
    padding: 14,
    boxShadow: "0 6px 20px rgba(15, 23, 42, 0.08)",
  },
  head: { display: "flex", alignItems: "center", gap: 10, marginBottom: 8 },
  chipOk: {
    display: "inline-flex",
    alignItems: "center",
    gap: 6,
    fontSize: 12,
    color: "#16a34a",
  },
  chipOff: { fontSize: 12, color: "#64748b" },
  kv: {
    display: "grid",
    gridTemplateColumns: "120px 1fr",
    fontSize: 13,
    gap: 6,
    padding: "4px 0",
  },
  k: { color: "#475569" },
  v: {
    color: "#0f172a",
    fontFamily: "ui-monospace, SFMono-Regular, Menlo, monospace",
  },
  actions: { display: "flex", gap: 8, marginTop: 10, flexWrap: "wrap" },
  btn: {
    border: "1px solid #e2e8f0",
    background: "#fff",
    padding: "8px 10px",
    borderRadius: 8,
    fontWeight: 700,
    cursor: "pointer",
  },
  btnPrimary: {
    background: "#2563eb",
    color: "#fff",
    padding: "8px 10px",
    borderRadius: 8,
    border: "none",
    fontWeight: 700,
    cursor: "pointer",
  },
  btnGhost: {
    border: "1px solid #e2e8f0",
    background: "#fff",
    padding: "8px 10px",
    borderRadius: 8,
    fontWeight: 700,
    cursor: "pointer",
  },
};

export default function FlowChannels() {
  const { flowId } = useParams();
  const navigate = useNavigate();
  const tenant = useMemo(() => getTenantFromHost(), []);

  const [loading, setLoading] = useState(true);

  // status informativo do tenant (não define conectado do flow)
  const [wa, setWa] = useState({ connected: false, id: "", display: "" });
  const [fb, setFb] = useState({ connected: false, pageId: "", pageName: "" });
  const [ig, setIg] = useState({
    connected: false,
    igUserId: "",
    igUsername: "",
    pageName: "",
  });
  const [tgTenant, setTgTenant] = useState({
    connected: false,
    botId: "",
    username: "",
  });

  // vínculos reais do FLOW (fonte de verdade)
  const [bindings, setBindings] = useState([]);
  const isBound = useCallback(
    (type) => bindings.some((b) => b.channel_type === type && b.is_active),
    [bindings]
  );

  async function fetchBindings() {
    const b = await apiGet(`/flows/${flowId}/channels`);
    setBindings(Array.isArray(b) ? b : []);
  }

  async function loadAll() {
    setLoading(true);
    try {
      await fetchBindings();

      // WhatsApp (status do tenant)  **ENDPOINT CORRETO: /wa/**
      try {
        const ws = await apiGet(`/whatsapp/number?subdomain=${tenant}`);
        const connected = !!(ws?.ok && ws?.phone);
        setWa({
          connected,
          id: ws?.phone?.id || "",
          display: formatPhone(ws?.phone),
        });
      } catch {
        setWa({ connected: false, id: "", display: "" });
      }

      // Facebook (status do tenant) — usado apenas para habilitar botão; dados só exibidos se bound
      try {
        const fs = await apiGet(`/facebook/status?subdomain=${tenant}`);
        setFb({
          connected: !!fs?.connected,
          pageId: fs?.page_id || "",
          pageName: fs?.page_name || "",
        });
      } catch {
        setFb({ connected: false, pageId: "", pageName: "" });
      }

      // Instagram (status do tenant) — idem
      try {
        const is = await apiGet(`/instagram/status?subdomain=${tenant}`);
        setIg({
          connected: !!is?.connected,
          igUserId: is?.ig_user_id || "",
          igUsername: is?.ig_username || "",
          pageName: is?.page_name || "",
        });
      } catch {
        setIg({ connected: false, igUserId: "", igUsername: "", pageName: "" });
      }

      // Telegram (status do tenant + bound deste flow) — backend agora prioriza o bot do flow
      try {
        const ts = await apiGet(
          `/telegram/status?subdomain=${tenant}&flow_id=${flowId}`
        );
        let botId = ts?.bot_id || "";
        let username = ts?.username || "";
        const connected = !!(ts?.connected || ts?.bound);
        setTgTenant({
          connected,
          botId: botId || "",
          username: (username || "").replace(/^@/, ""),
        });
      } catch {
        setTgTenant({ connected: false, botId: "", username: "" });
      }
    } catch (e) {
      console.error(e);
      toast.error("Falha ao carregar canais do flow.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadAll();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [flowId]);

  // cria vínculo deste flow (após NOVA conexão)
  async function connectThisFlow(kind, key, label) {
    if (!key) {
      toast.warn("Conta não encontrada para conectar.");
      return;
    }
    try {
      await apiPost(`/flows/${flowId}/channels`, {
        channel_type: kind,
        channel_key: key,
        display_name: label || null,
      });
      await fetchBindings();
      toast.success(`${kind} conectado a este flow.`);
      if (kind === "telegram") await loadAll();
    } catch {
      toast.error(`Falha ao conectar ${kind}.`);
    }
  }

  const waBinding = useMemo(
    () => bindings.find((b) => b.channel_type === "whatsapp" && b.is_active),
    [bindings]
  );
  const fbBinding = useMemo(
    () => bindings.find((b) => b.channel_type === "facebook" && b.is_active),
    [bindings]
  );
  const igBinding = useMemo(
    () => bindings.find((b) => b.channel_type === "instagram" && b.is_active),
    [bindings]
  );
  const tgBinding = useMemo(
    () => bindings.find((b) => b.channel_type === "telegram" && b.is_active),
    [bindings]
  );

  const openWaProfile = () =>
    navigate("/channels/whatsapp", {
      state: {
        returnTo: `/development/flowhub/${flowId}/channels`,
        flowId,
        channelKey: waBinding?.channel_key || null, // phone_id vinculado
      },
    });

  const openTgConnect = () =>
    navigate("/channels/telegram", {
      state: { returnTo: `/development/flowhub/${flowId}/channels`, flowId },
    });

  return (
    <div style={S.page}>
      <div style={S.header}>
        <div style={S.titleRow}>
          <button
            onClick={() => navigate('/development/flowhub')}
            style={{ ...S.btn, display: "inline-flex", alignItems: "center", gap: 6 }}
            title="Voltar"
          >
            <ArrowLeft size={14} /> Voltar
          </button>
          <div style={{ fontWeight: 800 }}>Canais do Flow</div>
          <div style={{ fontSize: 12, color: "#475569" }}>
            id: <b>{flowId}</b>
          </div>
        </div>
        <button
          onClick={loadAll}
          style={{ ...S.btn, display: "inline-flex", alignItems: "center", gap: 6 }}
        >
          <RefreshCw size={14} /> Recarregar
        </button>
      </div>

      {loading ? (
         <LogoLoader
        full
        size={56}
        label="Carregando flow…"
        src="/logo.svg"
      />
      ) : (
        <div style={S.grid}>
          {/* WhatsApp */}
          <div style={S.card}>
            <div style={S.head}>
              <div style={iconWrap()} title="WhatsApp">
                <BrandIcon type="whatsapp" />
              </div>
              <div style={{ fontWeight: 700 }}>WhatsApp</div>
              <div style={{ marginLeft: "auto" }}>
                {isBound("whatsapp") ? (
                  <span style={S.chipOk}>
                    <CheckCircle2 size={14} /> Conectado
                  </span>
                ) : (
                  <span style={S.chipOff}>Não conectado</span>
                )}
              </div>
            </div>

            {/* Exibir dados SOMENTE quando estiver vinculado ao flow */}
            <Row k="Número" v={isBound("whatsapp") ? (wa.display || "—") : "—"} />

            <div style={S.actions}>
              {isBound("whatsapp") ? (
                <button
                  style={S.btnGhost}
                  onClick={openWaProfile}
                  title="Abrir Perfil do WhatsApp"
                >
                  <Settings2 size={14} style={{ marginRight: 6 }} /> Perfil
                </button>
              ) : (
                <WhatsAppEmbeddedSignupButton
                  tenant={tenant}
                  label={wa.connected ? "Conectar" : "Conectar WhatsApp"}
                  style={S.btnPrimary}
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
              <div style={iconWrap()} title="Facebook">
                <BrandIcon type="facebook" />
              </div>
              <div style={{ fontWeight: 700 }}>Facebook Messenger</div>
              <div style={{ marginLeft: "auto" }}>
                {isBound("facebook") ? (
                  <span style={S.chipOk}>
                    <CheckCircle2 size={14} /> Conectado
                  </span>
                ) : (
                  <span style={S.chipOff}>Não conectado</span>
                )}
              </div>
            </div>

            {/* NÃO misturar dados: só mostra metadados se o flow estiver vinculado */}
            <Row k="Página" v={isBound("facebook") ? (fbBinding?.display_name || fb.pageName || "—") : "—"} />

            <div style={S.actions}>
              {isBound("facebook") ? null : (
                <FacebookConnectButton
                  tenant={tenant}
                  label={fb.connected ? "Conectar" : "Conectar Facebook"}
                  style={S.btnPrimary}
                  onConnected={({ page_id, page_name }) =>
                    connectThisFlow("facebook", page_id, page_name || "Facebook")
                  }
                />
              )}
            </div>
          </div>

          {/* Instagram */}
          <div style={S.card}>
            <div style={S.head}>
              <div style={iconWrap()} title="Instagram">
                <BrandIcon type="instagram" />
              </div>
              <div style={{ fontWeight: 700 }}>Instagram</div>
              <div style={{ marginLeft: "auto" }}>
                {isBound("instagram") ? (
                  <span style={S.chipOk}>
                    <CheckCircle2 size={14} /> Conectado
                  </span>
                ) : (
                  <span style={S.chipOff}>Não conectado</span>
                )}
              </div>
            </div>

            {/* NÃO misturar dados: só mostra metadados se o flow estiver vinculado */}
            <Row
              k="IG"
              v={
                isBound("instagram")
                  ? (igBinding?.display_name || ig.igUsername || "—")
                  : "—"
              }
            />
            <Row
              k="Página"
              v={
                isBound("instagram")
                  ? (ig.pageName || "—")
                  : "—"
              }
            />

            <div style={S.actions}>
              {isBound("instagram") ? null : (
                <InstagramConnectButton
                  tenant={tenant}
                  label={ig.connected ? "Conectar" : "Conectar Instagram"}
                  style={S.btnPrimary}
                  onConnected={({ ig_user_id, ig_username, page_name }) =>
                    connectThisFlow(
                      "instagram",
                      ig_user_id,
                      ig_username || page_name || "Instagram"
                    )
                  }
                />
              )}
            </div>
          </div>

          {/* Telegram */}
          <div style={S.card}>
            <div style={S.head}>
              <div style={iconWrap()} title="Telegram">
                <BrandIcon type="telegram" />
              </div>
              <div style={{ fontWeight: 700 }}>Telegram</div>
              <div style={{ marginLeft: "auto" }}>
                {isBound("telegram") ? (
                  <span style={S.chipOk}>
                    <CheckCircle2 size={14} /> Conectado
                  </span>
                ) : (
                  <span style={S.chipOff}>Não conectado</span>
                )}
              </div>
            </div>

            {/* Exibir dados do bot APENAS quando houver vínculo no flow */}
            <Row
              k="Bot"
              v={
                isBound("telegram") && (tgBinding?.display_name || tgTenant.username)
                  ? `@${String((tgBinding?.display_name || tgTenant.username)).replace(/^@/, "")}`
                  : "—"
              }
            />

            <div style={S.actions}>
              {isBound("telegram") ? (
                <button style={S.btnGhost} onClick={openTgConnect}>
                  Detalhes
                </button>
              ) : (
                <button style={S.btnPrimary} onClick={openTgConnect}>
                  Conectar
                </button>
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
