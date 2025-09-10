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

function formatPhone(p) {
  // aceita string ou objeto { display_phone_number, phone_number, number }
  const raw =
    typeof p === "string"
      ? p
      : (p && (p.display_phone_number || p.phone_number || p.number)) || "";
  const digits = (raw || "").replace(/[^\d+]/g, "");
  if (!digits) return "—";
  if (digits.startsWith("+")) return digits;
  return `+${digits}`;
}

export default function Channels() {
  const tenant = useMemo(() => getTenantFromHost(), []);
  const navigate = useNavigate();
  const location = useLocation();

  // WhatsApp (via /waProfile/number)
  const [wa, setWa] = useState({
    loading: true,
    connected: false,
    phoneId: "",
    phone: null, // payload completo de phone (quality_rating, verified_name, etc.)
    okMsg: null,
    errMsg: null,
    stabilizing: false // evita "piscada" durante transição do popup
  });

  // Telegram
  const [tg, setTg] = useState({
    loading: true,
    connected: false,
    botId: "",
    username: "",
    webhookUrl: "",
    okMsg: null,
    errMsg: null
  });

  // ✅ Carrega status individuais
  useEffect(() => {
    if (!tenant) return;

    // WhatsApp
    (async () => {
      try {
        const ws = await apiGet(`/whatsapp/profile/number?subdomain=${tenant}`);
        if (ws && ws.ok && ws.phone) {
          setWa((prev) => ({
            ...prev,
            loading: false,
            connected: true,
            phoneId: ws.phone.id || "",
            phone: ws.phone,
            errMsg: null
          }));
        } else {
          setWa((prev) => ({
            ...prev,
            loading: false,
            connected: false,
            phoneId: "",
            phone: null
          }));
        }
      } catch (e) {
        setWa((prev) => ({
          ...prev,
          loading: false,
          connected: false,
          phoneId: "",
          phone: null,
          errMsg: "Não foi possível obter o status do WhatsApp."
        }));
      }
    })();

    // Telegram
    (async () => {
      try {
        const ts = await apiGet(`/tg/status?subdomain=${tenant}`);
        if (ts && ts.ok) {
          setTg((prev) => ({
            ...prev,
            loading: false,
            connected: true,
            botId: ts.bot_id || "",
            username: ts.username || "",
            webhookUrl: ts.webhook_url || "",
            errMsg: null
          }));
        } else {
          setTg((prev) => ({ ...prev, loading: false, connected: false }));
        }
      } catch {
        setTg((prev) => ({
          ...prev,
          loading: false,
          connected: false,
          errMsg: "Não foi possível obter o status do Telegram."
        }));
      }
    })();
  }, [tenant]);

  // WhatsApp Embedded Signup → mensagens do popup
  useEffect(() => {
    const AUTH_ORIGIN = import.meta.env.VITE_EMBED_ORIGIN; // ex.: https://auth.seudominio.com

    function onMsg(e) {
      if (!AUTH_ORIGIN || e.origin !== AUTH_ORIGIN) return;
      const data = e.data || {};
      const type = data.type;
      const payload = data.payload;
      const error = data.error;

      if (type === "wa:connecting") {
        setWa((s) => ({ ...s, stabilizing: true }));
      }

      if (type === "wa:connected") {
        // payload pode vir de formas distintas; tentamos normalizar
        const phone =
          (payload && payload.phone) ||
          (payload && payload.number) ||
          (payload && payload.numbers && payload.numbers[0]) ||
          null;

        setWa((s) => ({
          ...s,
          loading: false,
          stabilizing: false,
          connected: true,
          phoneId: (phone && (phone.id || phone.phone_id)) || s.phoneId || "",
          phone: phone || s.phone,
          okMsg: "WhatsApp conectado com sucesso.",
          errMsg: null
        }));

        // limpa a mensagem de OK
        setTimeout(() => {
          setWa((st) => ({ ...st, okMsg: null }));
        }, 2000);
      }

      if (type === "wa:error") {
        setWa((s) => ({ ...s, stabilizing: false, errMsg: error || "Falha ao conectar." }));
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

  const waHasData = !wa.loading && !wa.stabilizing;
  const waDisplayNumber = formatPhone(wa.phone);

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
            {waHasData ? (
              wa.connected ? (
                <span className={styles.statusOk}><CheckCircle2 size={14}/> Conectado</span>
              ) : (
                <span className={styles.statusOff}>Não conectado</span>
              )
            ) : (
              <span className={styles.statusNeutral || styles.statusOff}>Checando…</span>
            )}
          </div>
          <div className={styles.cardBody}>
            {!wa.connected ? (
              <>
                <p className={styles.cardDesc}>
                  Conecte via <strong>Meta Embedded Signup</strong> e selecione o número quando conectado.
                </p>
<div className={`${styles.btnWrap} ${styles.btnWrapWa}`}>
  <WhatsAppEmbeddedSignupButton tenant={tenant} label="Conectar" />
  <div className={styles.hint}><PlugZap size={14}/> Login ocorre em janela do domínio seguro.</div>
</div>

              </>
            ) : (
              <>
                <div className={styles.connectedBlock}>
                  <div className={styles.kv}>
                    <span className={styles.k}>Número WABA</span>
                    <span className={styles.v}>{waDisplayNumber}</span>
                  </div>
                  {/* Campos opcionais (exibidos se vierem na API) */}
                  {wa.phone && wa.phone.verified_name && (
                    <div className={styles.kv}>
                      <span className={styles.k}>Nome verificado</span>
                      <span className={styles.v}>{wa.phone.verified_name}</span>
                    </div>
                  )}
                  
                </div>
                <div className={styles.cardActions}>
                  <button className={styles.btnSecondary} onClick={goToWaProfile}>
                    Perfil
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
            {tg.loading ? (
              <span className={styles.statusNeutral || styles.statusOff}>Checando…</span>
            ) : tg.connected ? (
              <span className={styles.statusOk}><CheckCircle2 size={14}/> Conectado</span>
            ) : (
              <span className={styles.statusOff}>Não conectado</span>
            )}
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
