import React, { useMemo, useState, useEffect } from "react";
import { MessageCircle, Instagram, MessageSquareText, Send, CheckCircle2, PlugZap } from "lucide-react";
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
  // fallback (não-criptográfico)
  let out = "";
  for (let i = 0; i < bytes; i++) {
    out += Math.floor(Math.random() * 256).toString(16).padStart(2, "0");
  }
  return out;
}

export default function Channels() {
  const tenant = useMemo(() => getTenantFromHost(), []);
  const [wa, setWa] = useState({ connected: false, wabaId: "", numbers: [], okMsg: null, errMsg: null });

  // --- Telegram state ---
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

  // preenche secret inicial
  useEffect(() => {
    setTg((s) => s.secret ? s : { ...s, secret: genSecretHex() });
  }, []);

  // recebe o resultado do popup (WhatsApp Embedded Signup)
  useEffect(() => {
    const AUTH_ORIGIN = import.meta.env.VITE_EMBED_ORIGIN; // ex.: https://auth.dkdevs.com.br
    function onMsg(e) {
      if (!AUTH_ORIGIN || e.origin !== AUTH_ORIGIN) return; // segurança
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
      // Se quiser permitir allowed_updates customizados, adicione aqui:
      // const allowed_updates = ["message", "edited_message", "callback_query"];
      const res = await fetch("/tg/connect", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          subdomain: tenant,
          botToken: tg.token,
          secret: tg.secret,
          // allowed_updates
        }),
      });
      const j = await res.json();
      if (!res.ok || !j?.ok) {
        throw new Error(j?.error || "Falha ao conectar Telegram");
      }
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
    } catch (e) {
      setTg((s) => ({ ...s, errMsg: String(e?.message || e) }));
    } finally {
      setTg((s) => ({ ...s, loading: false }));
    }
  }

  function regenSecret() {
    setTg((s) => ({ ...s, secret: genSecretHex() }));
  }

  // helpers de input rápidos (inline style discreto para não depender de novas classes)
  const inputStyle = {
    width: "100%",
    padding: "8px 10px",
    border: "1px solid #ddd",
    borderRadius: "6px",
    background: "#fff",
    color: "#111",
    outline: "none",
  };
  const labelStyle = { fontSize: 12, fontWeight: 600, marginBottom: 6, color: "#444" };
  const rowStyle = { display: "grid", gridTemplateColumns: "1fr", gap: 10, marginBottom: 10 };

  return (
    <div className={styles.container}>
      <div className={styles.header}>
        <div>
          <h1 className={styles.title}>Canais</h1>
          <p className={styles.subtitle}>Conecte seus canais de atendimento.</p>
          {wa.errMsg ? <div className={styles.alertErr}>{wa.errMsg}</div> : null}
          {wa.okMsg ? <div className={styles.alertOk}>{wa.okMsg}</div> : null}
          {tg.errMsg ? <div className={styles.alertErr}>{tg.errMsg}</div> : null}
          {tg.okMsg ? <div className={styles.alertOk}>{tg.okMsg}</div> : null}
        </div>
        <div className={styles.tenantBadge}>
          {tenant ? <>id: <strong>{tenant}</strong></> : <span className={styles.subtle}>defina o tenant</span>}
        </div>
      </div>

      <div className={styles.grid}>
        {/* WhatsApp */}
        <div className={styles.card}>
          <div className={styles.cardHead}>
            <div className={`${styles.cardIconWrap} ${styles.wa}`}><MessageCircle size={18} /></div>
            <div className={styles.cardTitle}>WhatsApp</div>
            {wa.connected
              ? <span className={styles.statusOk}><CheckCircle2 size={14}/> Conectado</span>
              : <span className={styles.statusOff}>Não conectado</span>}
          </div>
          <div className={styles.cardBody}>
            <p className={styles.cardDesc}>Conecte via Signup Meta e selecione o número.</p>
            {!wa.connected ? (
              <div className={styles.cardActions}>
                <div className={styles.btnWrap}>
                  <WhatsAppEmbeddedSignupButton tenant={tenant} />
                </div>
                <div className={styles.hint}><PlugZap size={14}/> Login ocorre em janela do domínio seguro.</div>
              </div>
            ) : (
              <div className={styles.connectedBlock}>
                <div className={styles.kv}><span className={styles.k}>WABA</span><span className={styles.v}>{wa.wabaId}</span></div>
                <div className={styles.kv}><span className={styles.k}>Números</span><span className={styles.v}>{wa.numbers?.length || 0}</span></div>
                {wa.numbers?.length > 0 && (
                  <div className={styles.listWrap}>
                    <div className={styles.listTitle}>Números encontrados</div>
                    <ul className={styles.numList}>
                      {wa.numbers.map((n) => (
                        <li key={n?.id} className={styles.numRow}>
                          <div className={styles.numMain}>
                            <span className={styles.numPhone}>{n?.display_phone_number || n?.verified_name || "—"}</span>
                            <span className={styles.numId}>id: {n?.id}</span>
                          </div>
                          <div className={styles.numActions}>
                            <button className={styles.btnTiny} disabled title="Em breve">Definir principal</button>
                            <button className={styles.btnTiny} disabled title="Em breve">Enviar teste</button>
                          </div>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>

        {/* Instagram */}
        <div className={styles.card}>
          <div className={styles.cardHead}>
            <div className={`${styles.cardIconWrap} ${styles.ig}`}><Instagram size={18}/></div>
            <div className={styles.cardTitle}>Instagram</div>
            <span className={styles.statusOff}>Não conectado</span>
          </div>
          <div className={styles.cardBody}>
            <p className={styles.cardDesc}>Em breve: conecte seu Instagram Business.</p>
            <div className={styles.cardActions}><button className={styles.btnSecondary} disabled>Conectar</button></div>
          </div>
        </div>

        {/* Facebook */}
        <div className={styles.card}>
          <div className={styles.cardHead}>
            <div className={`${styles.cardIconWrap} ${styles.fb}`}><MessageSquareText size={18}/></div>
            <div className={styles.cardTitle}>Facebook Messenger</div>
            <span className={styles.statusOff}>Não conectado</span>
          </div>
          <div className={styles.cardBody}>
            <p className={styles.cardDesc}>Em breve: conecte sua página do Facebook.</p>
            <div className={styles.cardActions}><button className={styles.btnSecondary} disabled>Conectar</button></div>
          </div>
        </div>

        {/* Telegram (conector funcional) */}
        <div className={styles.card}>
          <div className={styles.cardHead}>
            <div className={`${styles.cardIconWrap} ${styles.tg}`}><Send size={18}/></div>
            <div className={styles.cardTitle}>Telegram</div>
            {tg.connected
              ? <span className={styles.statusOk}><CheckCircle2 size={14}/> Conectado</span>
              : <span className={styles.statusOff}>Não conectado</span>}
          </div>
          <div className={styles.cardBody}>
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

                <div style={{ ...rowStyle }}>
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
                      onClick={regenSecret}
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
            ) : (
              <div className={styles.connectedBlock}>
                <div className={styles.kv}><span className={styles.k}>Bot</span><span className={styles.v}>{tg.username || "—"}</span></div>
                <div className={styles.kv}><span className={styles.k}>Bot ID</span><span className={styles.v}>{tg.botId || "—"}</span></div>
                <div className={styles.kv}><span className={styles.k}>Webhook</span><span className={styles.v}>{tg.webhookUrl || "—"}</span></div>
                <div className={styles.hint}>Já configurado para webhook único. Qualquer update chega com seu secret e vai para <code>{tenant}.incoming</code>.</div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
