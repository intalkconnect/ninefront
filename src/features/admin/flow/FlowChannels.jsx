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

import styles from "./FlowChannels.module.css";

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

export default function FlowChannels() {
  const { flowId } = useParams();
  const navigate = useNavigate();
  const tenant = useMemo(() => getTenantFromHost(), []);

  const [loading, setLoading] = useState(true);
  const [flowName, setFlowName] = useState("");

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

  async function fetchFlowMeta() {
    try {
      const meta = await apiGet(`/flows/${flowId}`);
      setFlowName(meta?.name || "");
    } catch {
      setFlowName("");
    }
  }

  async function loadAll() {
    setLoading(true);
    try {
      await Promise.all([fetchBindings(), fetchFlowMeta()]);

      // WhatsApp
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

      // Facebook
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

      // Instagram
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

      // Telegram
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
    <div className={styles.page}>
      <div className={styles.header}>
        <div className={styles.titleRow}>
          <button
            onClick={() => navigate("/development/flowhub")}
            className={styles.btn}
            title="Voltar"
          >
            <ArrowLeft size={14} /> Voltar
          </button>
          <div className={styles.headerTitle}>Canais do Flow</div>
          <div className={styles.headerMeta}>
            id: <b>{flowId}</b>
            {flowName ? (
              <span className={styles.headerName}>
                • nome: <b title={flowName}>{flowName}</b>
              </span>
            ) : null}
          </div>
        </div>
        <button onClick={loadAll} className={styles.btn}>
          <RefreshCw size={14} /> Recarregar
        </button>
      </div>

      {loading ? (
        <LogoLoader full size={56} src="/logo.svg" />
      ) : (
        <div className={styles.grid}>
          {/* WhatsApp */}
          <div className={styles.card}>
            <div className={styles.head}>
              <div className={styles.iconWrap} title="WhatsApp">
                <BrandIcon type="whatsapp" />
              </div>
              <div className={styles.cardTitle}>WhatsApp</div>
              <div className={styles.statusRight}>
                {isBound("whatsapp") ? (
                  <span className={styles.chipOk}>
                    <CheckCircle2 size={14} /> Conectado
                  </span>
                ) : (
                  <span className={styles.chipOff}>Não conectado</span>
                )}
              </div>
            </div>

            {/* título em cima, valor embaixo */}
            <RowV title="Número" value={isBound("whatsapp") ? (wa.display || "—") : "—"} />

            <div className={styles.actions}>
              {isBound("whatsapp") ? (
                <button
                  className={styles.btnGhost}
                  onClick={openWaProfile}
                  title="Abrir Perfil do WhatsApp"
                >
                  <Settings2 size={14} /> Perfil
                </button>
              ) : (
                <WhatsAppEmbeddedSignupButton
                  tenant={tenant}
                  label={wa.connected ? "Conectar" : "Conectar WhatsApp"}
                  style={styles.btnPrimary}
                  onPickSuccess={({ phone_number_id, display }) =>
                    connectThisFlow("whatsapp", phone_number_id, display || "WhatsApp")
                  }
                />
              )}
            </div>
          </div>

          {/* Facebook */}
          <div className={styles.card}>
            <div className={styles.head}>
              <div className={styles.iconWrap} title="Facebook">
                <BrandIcon type="facebook" />
              </div>
              <div className={styles.cardTitle}>Facebook Messenger</div>
              <div className={styles.statusRight}>
                {isBound("facebook") ? (
                  <span className={styles.chipOk}>
                    <CheckCircle2 size={14} /> Conectado
                  </span>
                ) : (
                  <span className={styles.chipOff}>Não conectado</span>
                )}
              </div>
            </div>

            <RowV
              title="Página"
              value={isBound("facebook") ? (fbBinding?.display_name || fb.pageName || "—") : "—"}
            />

            <div className={styles.actions}>
              {isBound("facebook") ? null : (
                <FacebookConnectButton
                  tenant={tenant}
                  label="Conectar"
                  style={styles.btnPrimary}
                  onConnected={({ page_id, page_name }) =>
                    connectThisFlow("facebook", page_id, page_name || "Facebook")
                  }
                />
              )}
            </div>
          </div>

          {/* Instagram */}
          <div className={styles.card}>
            <div className={styles.head}>
              <div className={styles.iconWrap} title="Instagram">
                <BrandIcon type="instagram" />
              </div>
              <div className={styles.cardTitle}>Instagram</div>
              <div className={styles.statusRight}>
                {isBound("instagram") ? (
                  <span className={styles.chipOk}>
                    <CheckCircle2 size={14} /> Conectado
                  </span>
                ) : (
                  <span className={styles.chipOff}>Não conectado</span>
                )}
              </div>
            </div>

            <RowV
              title="IG"
              value={
                isBound("instagram")
                  ? (igBinding?.display_name || ig.igUsername || "—")
                  : "—"
              }
            />
            <RowV
              title="Página"
              value={isBound("instagram") ? (ig.pageName || "—") : "—"}
            />

            <div className={styles.actions}>
              {isBound("instagram") ? null : (
                <InstagramConnectButton
                  tenant={tenant}
                  label="Conectar"
                  style={styles.btnPrimary}
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
          <div className={styles.card}>
            <div className={styles.head}>
              <div className={styles.iconWrap} title="Telegram">
                <BrandIcon type="telegram" />
              </div>
              <div className={styles.cardTitle}>Telegram</div>
              <div className={styles.statusRight}>
                {isBound("telegram") ? (
                  <span className={styles.chipOk}>
                    <CheckCircle2 size={14} /> Conectado
                  </span>
                ) : (
                  <span className={styles.chipOff}>Não conectado</span>
                )}
              </div>
            </div>

            <RowV
              title="Bot"
              value={
                isBound("telegram") && (tgBinding?.display_name || tgTenant.username)
                  ? `@${String((tgBinding?.display_name || tgTenant.username)).replace(/^@/, "")}`
                  : "—"
              }
            />

            <div className={styles.actions}>
              {isBound("telegram") ? (
                <button className={styles.btnGhost} onClick={openTgConnect}>
                  Detalhes
                </button>
              ) : (
                <button className={styles.btnPrimary} onClick={openTgConnect}>
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

function RowV({ title, value }) {
  return (
    <div className={styles.kvV}>
      <div className={styles.kvTitle}>{title}</div>
      <div className={styles.kvValue} title={String(value)}>{value}</div>
    </div>
  );
}
