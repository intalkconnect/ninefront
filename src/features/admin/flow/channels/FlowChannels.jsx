import React, { useEffect, useMemo, useState, useCallback } from "react";
import { ArrowLeft, CheckCircle2, RefreshCw, Settings2 } from "lucide-react";
import { useNavigate, useParams } from "react-router-dom";
import { apiGet } from "../../../../shared/apiClient";
import { toast } from "react-toastify";

import WhatsAppEmbeddedSignupButton from "./components/WhatsAppEmbeddedSignupButton";
import FacebookConnectButton from "./components/FacebookConnectButton";
import InstagramConnectButton from "./components/InstagramConnectButton";
import LogoLoader from "../../../../components/common/LogoLoader";
import BrandIcon from "../BrandIcon";

import styles from "./styles/FlowChannels.module.css";

/* ========= utils ========= */
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
  const [wa, setWa] = useState({ connected: false, display: "" });
  const [fb, setFb] = useState({ connected: false, pageName: "" });
  const [ig, setIg] = useState({ connected: false, igUsername: "", pageName: "" });
  const [tgTenant, setTgTenant] = useState({ connected: false, username: "" });

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
      // meta do flow
      try {
        const meta = await apiGet(`/flows/${flowId}`);
        setFlowName(meta?.name || "");
      } catch {
        setFlowName("");
      }

      await fetchBindings();

      // WhatsApp
      try {
        const ws = await apiGet(`/whatsapp/number?subdomain=${tenant}`);
        const connected = !!(ws?.ok && ws?.phone);
        setWa({ connected, display: formatPhone(ws?.phone) });
      } catch {
        setWa({ connected: false, display: "" });
      }

      // Facebook
      try {
        const fs = await apiGet(`/facebook/status?subdomain=${tenant}`);
        setFb({ connected: !!fs?.connected, pageName: fs?.page_name || "" });
      } catch {
        setFb({ connected: false, pageName: "" });
      }

      // Instagram
      try {
        const is = await apiGet(`/instagram/status?subdomain=${tenant}`);
        setIg({
          connected: !!is?.connected,
          igUsername: is?.ig_username || "",
          pageName: is?.page_name || "",
        });
      } catch {
        setIg({ connected: false, igUsername: "", pageName: "" });
      }

      // Telegram (tenant + bound deste flow)
      try {
        const ts = await apiGet(`/telegram/status?subdomain=${tenant}&flow_id=${flowId}`);
        const connected = !!(ts?.connected || ts?.bound);
        setTgTenant({ connected, username: (ts?.username || "").replace(/^@/, "") });
      } catch {
        setTgTenant({ connected: false, username: "" });
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

  const waBinding = useMemo(
    () => bindings.find((b) => b.channel_type === "whatsapp" && b.is_active),
    [bindings]
  );
  const tgBinding = useMemo(
    () => bindings.find((b) => b.channel_type === "telegram" && b.is_active),
    [bindings]
  );

  const openWaProfile = () =>
    navigate("/workflow/hub/channels/whatsapp", {
      state: {
        returnTo: `/workflow/hub/${flowId}/channels`,
        flowId,
        channelKey: waBinding?.channel_key || null,
      },
    });

  const openTgConnect = () =>
    navigate("/workflow/hub/channels/telegram", {
      state: { returnTo: `/workflow/hub/${flowId}/channels`, flowId },
    });

  return (
    <div className={styles.page}>
      <div className={styles.header}>
        <div className={styles.titleRow}>
          <button
            onClick={() => navigate(-1)}
            className={styles.btn}
            title="Voltar"
          >
            <ArrowLeft size={14} />
            <span>Voltar</span>
          </button>
        </div>

        <div className={styles.metaRow}>
          <div className={styles.flowMeta}>Canais do Flow</div>
        </div>

        <button onClick={loadAll} className={styles.btn}>
          <RefreshCw size={14} />
          <span>Recarregar</span>
        </button>
      </div>

      {loading ? (
        <LogoLoader full size={56} src="/logo.png" />
      ) : (
        <div className={styles.grid}>
          {/* WhatsApp */}
          <div className={styles.card}>
            <div className={styles.head}>
              <div className={styles.iconWrap} title="WhatsApp">
                <BrandIcon type="whatsapp" />
              </div>
              <div className={styles.title}>WhatsApp</div>
              <div className={styles.status}>
                {isBound("whatsapp") ? (
                  <span className={styles.chipOk}>
                    <CheckCircle2 size={14} /> Conectado
                  </span>
                ) : (
                  <span className={styles.chipOff}>Não conectado</span>
                )}
              </div>
            </div>

            <KV label="Número" value={isBound("whatsapp") ? (wa.display || "—") : "—"} />

            <div className={styles.actions}>
              {!isBound("whatsapp") ? (
                <div className={styles.btnWrap}>
                  <WhatsAppEmbeddedSignupButton
                    tenant={tenant}
                    label="Conectar"            /* <— sempre “Conectar” */
                    className={styles.btnPrimary}
                    buttonClassName={styles.btnPrimary}
                  />
                </div>
              ) : (
                <button className={styles.btnGhost} onClick={openWaProfile}>
                  <Settings2 size={14} />
                  <span>Perfil</span>
                </button>
              )}
            </div>
          </div>

          {/* Facebook */}
          <div className={styles.card}>
            <div className={styles.head}>
              <div className={styles.iconWrap} title="Facebook">
                <BrandIcon type="facebook" />
              </div>
              <div className={styles.title}>Messenger</div>
              <div className={styles.status}>
                {isBound("facebook") ? (
                  <span className={styles.chipOk}>
                    <CheckCircle2 size={14} /> Conectado
                  </span>
                ) : (
                  <span className={styles.chipOff}>Não conectado</span>
                )}
              </div>
            </div>

            <KV label="Página" value={isBound("facebook") ? (fb.pageName || "—") : "—"} />

            <div className={styles.actions}>
              {!isBound("facebook") && (
                <div className={styles.btnWrap}>
                  <FacebookConnectButton
                    tenant={tenant}
                    label="Conectar"          /* <— sempre “Conectar” */
                    className={styles.btnPrimary}
                    buttonClassName={styles.btnPrimary}
                  />
                </div>
              )}
            </div>
          </div>

          {/* Instagram */}
          <div className={styles.card}>
            <div className={styles.head}>
              <div className={styles.iconWrap} title="Instagram">
                <BrandIcon type="instagram" />
              </div>
              <div className={styles.title}>Instagram</div>
              <div className={styles.status}>
                {isBound("instagram") ? (
                  <span className={styles.chipOk}>
                    <CheckCircle2 size={14} /> Conectado
                  </span>
                ) : (
                  <span className={styles.chipOff}>Não conectado</span>
                )}
              </div>
            </div>

            <KV label="IG" value={isBound("instagram") ? (ig.igUsername || "—") : "—"} />
            {/* <KV label="Página" value={isBound("instagram") ? (ig.pageName || "—") : "—"} /> */}

            <div className={styles.actions}>
              {!isBound("instagram") && (
                <div className={styles.btnWrap}>
                  <InstagramConnectButton
                    tenant={tenant}
                    label="Conectar"          /* <— sempre “Conectar” */
                    className={styles.btnPrimary}
                    buttonClassName={styles.btnPrimary}
                  />
                </div>
              )}
            </div>
          </div>

          {/* Telegram */}
          <div className={styles.card}>
            <div className={styles.head}>
              <div className={styles.iconWrap} title="Telegram">
                <BrandIcon type="telegram" />
              </div>
              <div className={styles.title}>Telegram</div>
              <div className={styles.status}>
                {isBound("telegram") ? (
                  <span className={styles.chipOk}>
                    <CheckCircle2 size={14} /> Conectado
                  </span>
                ) : (
                  <span className={styles.chipOff}>Não conectado</span>
                )}
              </div>
            </div>

            <KV
              label="Bot"
              value={
                isBound("telegram") && tgTenant.username
                  ? `@${String(tgTenant.username).replace(/^@/, "")}`
                  : "—"
              }
            />

            <div className={styles.actions}>
              {!isBound("telegram") ? (
                <button className={styles.btnPrimary} onClick={openTgConnect} buttonClassName={styles.btnPrimary}>
                  Conectar        {/* <— sempre “Conectar” */}
                </button>
              ) : (
                <button className={styles.btnGhost} onClick={openTgConnect}>
                  Detalhes
                </button>
              )}
            </div>
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
