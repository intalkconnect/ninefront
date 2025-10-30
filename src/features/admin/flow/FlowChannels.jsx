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

import styles from "./styles/FlowChannels.module.css";

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

  async function loadAll() {
    setLoading(true);
    try {
      // nome do flow
      try {
        const meta = await apiGet(`/flows/${flowId}`);
        setFlowName(meta?.name || "");
      } catch {
        setFlowName("");
      }

      await fetchBindings();

      // WhatsApp (status do tenant)
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

      // Facebook (status do tenant)
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

      // Instagram (status do tenant)
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

      // Telegram (status do tenant + bound deste flow)
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
        channelKey: waBinding?.channel_key || null,
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
            <ArrowLeft size={14} />
            <span>Voltar</span>
          </button>

        </div>

        <div className={styles.metaRow}>
          <div className={styles.flowMeta}>
            <span>Canais do Flow</span>
          </div>
          <div className={styles.flowInfo}>
            <span className={styles.dim}>id:</span>&nbsp;<b>{flowId}</b>
            {flowName ? (
              <>
                <span className={styles.sep}>·</span>
                <span className={styles.dim}>nome:</span>&nbsp;<b>{flowName}</b>
              </>
            ) : null}
          </div>
        </div>

        <button onClick={loadAll} className={styles.btn}>
          <RefreshCw size={14} />
          <span>Recarregar</span>
        </button>
      </div>

      {loading ? (
        <LogoLoader full size={56} src="/logo.svg" />
      ) : (
        <div className={styles.grid}>
          {/* WhatsApp */}
<div className={styles.actions}>
  {isBound("whatsapp") ? (
    <button className={styles.btnGhost} onClick={openWaProfile}>
      <Settings2 size={14} />
      <span>Perfil</span>
    </button>
  ) : (
    <div className={styles.btnWrap}>
      <WhatsAppEmbeddedSignupButton
        tenant={tenant}
        label="Conectar"
        /* caso o componente aceite, deixo também essas props de bônus */
        className={styles.btnPrimary}
        buttonClassName={styles.btnPrimary}
      />
    </div>
  )}
</div>

{/* Facebook */}
<div className={styles.actions}>
  {isBound("facebook") ? null : (
    <div className={styles.btnWrap}>
      <FacebookConnectButton
        tenant={tenant}
        label="Conectar"
        className={styles.btnPrimary}
        buttonClassName={styles.btnPrimary}
      />
    </div>
  )}
</div>

{/* Instagram */}
<div className={styles.actions}>
  {isBound("instagram") ? null : (
    <div className={styles.btnWrap}>
      <InstagramConnectButton
        tenant={tenant}
        label="Conectar"
        className={styles.btnPrimary}
        buttonClassName={styles.btnPrimary}
      />
    </div>
  )}
</div>

{/* Telegram */}
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
      )}
    </div>
  );
}

function KV({ label, value }) {
  return (
    <div className={styles.kv}>
      <div className={styles.k}>{label}</div>
      <div className={styles.v}>{value}</div>
    </div>
  );
}
