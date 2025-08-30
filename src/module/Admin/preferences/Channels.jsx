import React, { useMemo, useState, useEffect } from "react";
import {
  MessageCircle, Instagram, MessageSquareText, Send,
  CheckCircle2, PlugZap
} from "lucide-react";
import styles from "./styles/Channels.module.css";
import WhatsAppEmbeddedSignupButton from "../components/WhatsAppEmbeddedSignupButton";

function getTenantFromHost() {
  if (typeof window === "undefined") return "";
  const host = window.location.hostname;
  const parts = host.split(".");
  if (parts.length >= 3) return parts[0] === "www" ? parts[1] : parts[0];
  return parts[0] || "";
}

// gera secret hex forte (32 bytes -> 64 chars)
function genSecretHex(bytes = 32) {
  if (typeof window !== "undefined" && window.crypto?.getRandomValues) {
    const arr = new Uint8Array(bytes);
    window.crypto.getRandomValues(arr);
    return Array.from(arr).map(b => b.toString(16).padStart(2, "0")).join("");
  }
  let out = "";
  for (let i = 0; i < bytes; i++) out += Math.floor(Math.random() * 256).toString(16).padStart(2, "0");
  return out;
}

export default function Channels() {
  const tenant = useMemo(() => getTenantFromHost(), []);

  // qual card está aberto (null = todos fechados)
  const [openCard, setOpenCard] = useState(null); // 'wa' | 'ig' | 'fb' | 'tg' | null

  // WhatsApp
  const [wa, setWa] = useState({ connected: false, wabaId: "", numbers: [], okMsg: null, errMsg: null });

  // Telegram
  const [tg, setTg] = useState({
    connected: false,
    botId: "",
    username: "",
    webhookUrl: "",
    token: "",
    secret: "",
    okMsg: null,
    errMsg: null,
    loading: false,
  });

  // secret inicial do Telegram
  useEffect(() => {
    setTg((s) => s.secret ? s : ({ ...s, secret: genSecretHex() }));
  }, []);

  // WhatsApp Embedded Signup (postMessage)
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
        setOpenCard(null); // fecha após conectar
      }
      if (type === "wa:error") {
        setWa((s) => ({ ...s, errMsg: error || "Falha ao conectar." }));
      }
    }
    window.addEventListener("message", onMsg);
    return () => window.removeEventListener("message", onMsg);
  }, []);

  // conectar Telegram (chama seu back /api/v1/tg/connect)
  async function connectTelegram() {
    if (!tenant) {
      setTg((s) => ({ ...s, errMsg: "Tenant não identificado pelo subdomínio." }));
      return;
    }
    if (!tg.token || !tg.secret) {
      setTg((s) => ({ ...s, errMsg: "Informe o Bot Token e o Webhook Secret." }));
      return;
    }
    try {
      setTg((s) => ({ ...s, loading: true, errMsg: null, okMsg: null }));
      const res = await fetch("/api/v1/tg/connect", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          subdomain: tenant,
          botToken: tg.token,
          secret: tg.secret,
        }),
      });
      const j = await res.json();
      if (!res.ok || !j?.ok) throw new Error(j?.error || "Falha ao conectar Telegram");
      setTg((s) => ({
        ...s,
        connected: true,
        botId: j.bot_id || "",
        username: j.username || "",
        webhookUrl: j.webhook_url || "",
        okMsg: "Telegram conectado com sucesso.",
        errMsg: null,
      }));
      setTimeout(() => setTg((s) => ({ ...s, okMsg: null })), 2000);
      setOpenCard(null); // fecha após conectar
    } catch (e) {
      setTg((s) => ({ ...s, errMsg: String(e?.message || e) }));
    } finally {
      setTg((s) => ({ ...s, loading: false }));
    }
  }

  // estilos locais
  const inputStyle = { width: "100%", padding: "8px 10px", border: "1px solid #ddd", borderRadius: "6px", background: "#fff", color: "#111" };
  const labelStyle = { fontSize: 12, fontWeight: 600, marginBottom: 6, color: "#444" };
  const rowStyle = { display: "grid", gridTemplateColumns: "1fr", gap: 10, marginBottom: 10 };

  // cabeçalho padrão com botão "Conectar" que só abre o card
  function CardHead({ id, icon, title, connected }) {
    return (
      <div className={styles.cardHead}>
        <div className={`${styles.cardIconWrap} ${styles[id]}`}>{icon}</div>
        <div className={styles.cardTitle}>{title}</div>
        {connected ? (
          <span className={styles.statusOk}><CheckCircle2 size={14}/> Conectado</span>
        ) : (
          <button
            className={styles.btnSecondary}
            onClick={() => setOpenCard(id)}
            title="Abrir para conectar"
          >
            Conectar
          </button>
        )}
      </div>
    );
  }

  // corpo visível somente quando id === openCard
  function CardBody({ id, children }) {
    if (openCard !== id) return null;
    return <div className={styles.cardBody}>{children}</div>;
  }

  return (
    <div className={styles.container}>
      <div className={styles.header}>
        <div>
          <h1 className={styles.title}>Canais</h1>
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
          <CardHead id="wa" icon={<MessageCircle size={18}/>} title="WhatsApp" connected={wa.connected}/>
          <CardBody id="wa">
            <p className={styles.cardDesc}>Conecte via Signup Meta e selecione o número.</p>
            {!wa.connected ? (
              <div className={styles.cardActions}>
                <div className={styles.btnWrap}><WhatsAppEmbeddedSignupButton tenant={tenant} /></div>
                <div className={styles.hint}><PlugZap size={14}/> Login ocorre em janela do domínio seguro.</div>
              </div>
            ) : null}
          </CardBody>
        </div>

        {/* Instagram */}
        <div className={styles.card}>
          <CardHead id="ig" icon={<Instagram size={18}/>} title="Instagram" connected={false}/>
          <CardBody id="ig">
            <p className={styles.cardDesc}>Em breve: conecte seu Instagram Business.</p>
            <div className={styles.cardActions}><button className={styles.btnSecondary} disabled>Conectar</button></div>
          </CardBody>
        </div>

        {/* Facebook */}
        <div className={styles.card}>
          <CardHead id="fb" icon={<MessageSquareText size={18}/>} title="Facebook Messenger" connected={false}/>
          <CardBody id="fb">
            <p className={styles.cardDesc}>Em breve: conecte sua página do Facebook.</p>
            <div className={styles.cardActions}><button className={styles.btnSecondary} disabled>Conectar</button></div>
          </CardBody>
        </div>

        {/* Telegram */}
        <div className={styles.card}>
          <CardHead id="tg" icon={<Send size={18}/>} title="Telegram" connected={tg.connected}/>
          <CardBody id="tg">
            {!tg.connected ? (
              <>
                <p className={styles.cardDesc}>
                  Informe o <strong>Bot Token</strong> e o <strong>Webhook Secret</strong>. Usamos um webhook único
                  e identificamos o tenant pelo header <code>x-telegram-bot-api-secret-token</code>.
                </p>

                <div style={rowStyle}>
                  <label style={labelStyle}>Bot Token</label>
                  <input
                    type="text"
                    placeholder="ex.: 123456:AAHk...-seu-token"
                    value={tg.token}
                    onChange={(e) => setTg((s) => ({ ...s, token: e.target.value }))}
                    style={inputStyle}
                    autoComplete="off"
                  />
                </div>

                <div style={rowStyle}>
                  <label style={labelStyle}>Webhook Secret</label>
                  <div style={{ display: "grid", gridTemplateColumns: "1fr auto", gap: 10 }}>
                    <input
                      type="text"
                      value={tg.secret}
                      onChange={(e) => setTg((s) => ({ ...s, secret: e.target.value }))}
                      style={inputStyle}
                      autoComplete="off"
                    />
                    <button
                      className={styles.btnSecondary}
                      type="button"
                      onClick={() => setTg((s) => ({ ...s, secret: genSecretHex() }))}
                      title="Gerar novo secret"
                    >
                      Gerar
                    </button>
                  </div>
                  <div className={styles.hint}>Guarde esse valor — ele identifica seu tenant no webhook único.</div>
                </div>

                <div className={styles.cardActions}>
                  <button
                    className={styles.btnSecondary}
                    onClick={connectTelegram}
                    disabled={tg.loading}
                    title="Conectar bot"
                  >
                    {tg.loading ? "Conectando..." : "Conectar"}
                  </button>
                </div>
              </>
            ) : null}
          </CardBody>
        </div>
      </div>
    </div>
  );
}
