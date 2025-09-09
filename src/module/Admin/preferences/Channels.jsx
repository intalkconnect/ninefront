import React, { useMemo, useState, useEffect } from "react";
import { MessageCircle, Instagram, MessageSquareText, Send, CheckCircle2, PlugZap } from "lucide-react";
import { apiGet } from '../../../shared/apiClient';
import styles from "./styles/Channels.module.css";
import WhatsAppEmbeddedSignupButton from "../components/WhatsAppEmbeddedSignupButton";
import { useNavigate, useLocation } from "react-router-dom";

/* ================= utils ================= */
function getTenantFromHost() {
  if (typeof window === "undefined") return "";
  const host = window.location.hostname;
  const parts = host.split(".");
  if (parts.length >= 3) return parts[0] === "www" ? parts[1] : parts[0];
  return parts[0] || "";
}

export default function Channels() {
  const tenant = useMemo(() => getTenantFromHost(), []);
  const navigate = useNavigate();
  const location = useLocation();

  // WhatsApp
  const [wa, setWa] = useState({ connected: false, wabaId: "", numbers: [], okMsg: null, errMsg: null });

  // Telegram
  const [tg, setTg] = useState({
    connected: false,
    botId: "",
    username: "",
    webhookUrl: "",
    okMsg: null,
    errMsg: null
  });

  // ✅ Checa status dos canais ao carregar a página
  useEffect(() => {
    if (!tenant) return;

    (async () => {
      try {
        const s = await apiGet(`/channels/status?subdomain=${tenant}`);
        if (s?.telegram) {
          setTg((prev) => ({
            ...prev,
            connected: !!s.telegram.connected,
            botId: s.telegram.bot_id || "",
            username: s.telegram.username || "",
            webhookUrl: s.telegram.webhook_url || ""
          }));
        }
        if (s?.whatsapp) {
          setWa((prev) => ({
            ...prev,
            connected: !!s.whatsapp.connected,
            wabaId: s.whatsapp.waba_id || "",
            numbers: Array.isArray(s.whatsapp.numbers) ? s.whatsapp.numbers : []
          }));
        }
      } catch {
        try {
          const ts = await apiGet(`/tg/status?subdomain=${tenant}`);
          if (ts?.ok) {
            setTg((prev) => ({ ...prev, connected: true, botId: ts.bot_id || "", username: ts.username || "", webhookUrl: ts.webhook_url || "" }));
          }
        } catch {}
        try {
          const ws = await apiGet(`/wa/status?subdomain=${tenant}`);
          if (ws?.ok) {
            setWa((prev) => ({ ...prev, connected: true, wabaId: ws.waba_id || "", numbers: Array.isArray(ws.numbers) ? ws.numbers : [] }));
          }
        } catch {}
      }
    })();
  }, [tenant]);

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

  const goToWaProfile = () =>
    navigate("/channels/whatsapp", { state: { returnTo: location.pathname + location.search } });

  const goToTgConnect = () =>
    navigate("/channels/telegram", { state: { returnTo: location.pathname + location.search } });

  const iconWrap = (cls, icon) => <div className={`${styles.cardIconWrap} ${cls}`}>{icon}</div>;

  return (
    <div className={styles.container}>
      <div className={styles.header}>
        <div>
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
              <div className={`${styles.btnWrap} ${styles.btnWrapWa}`}>
                <WhatsAppEmbeddedSignupButton tenant={tenant} />
                <div className={styles.hint}><PlugZap size={14}/> Login ocorre em janela do domínio seguro.</div>
              </div>
            ) : (
              <>
                <div className={styles.connectedBlock}>
                  <div className={styles.kv}><span className={styles.k}>WABA</span><span className={styles.v}>{wa.wabaId}</span></div>
                  <div className={styles.kv}><span className={styles.k}>Números</span><span className={styles.v}>{wa.numbers?.length || 0}</span></div>
                </div>
                <div className={styles.cardActions}>
                  <button className={styles.btnSecondary} onClick={goToWaProfile}>
                    Gerenciar / Perfil
                  </button>
                </div>
              </>
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
            <div className={styles.cardActions}><button className={styles.btnGhost} disabled>Conectar</button></div>
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
            <div className={styles.cardActions}><button className={styles.btnGhost} disabled>Conectar</button></div>
          </div>
        </div>

        {/* Telegram → abre página (sem modal) */}
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
                <p className={styles.cardDesc}>Conecte informando <strong>Bot Token</strong>.</p>
                <div className={styles.cardActions}>
                  <button className={styles.btnTgPrimary} onClick={goToTgConnect}>Conectar</button>
                </div>
              </>
            ) : (
              <>
                <div className={styles.connectedBlock}>
                  <div className={styles.kv}><span className={styles.k}>Bot</span><span className={styles.v}>{tg.username || "—"}</span></div>
                  <div className={styles.kv}><span className={styles.k}>Bot ID</span><span className={styles.v}>{tg.botId || "—"}</span></div>
                </div>
                <div className={styles.cardActions}>
                  <button className={styles.btnSecondary} onClick={goToTgConnect}>Gerenciar</button>
                </div>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
