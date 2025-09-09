// TelegramConnect.jsx
import React, { useEffect, useMemo, useState } from "react";
import { ArrowLeft, PlugZap, CheckCircle2, RefreshCw } from "lucide-react";
import { useLocation, useNavigate } from "react-router-dom";
import { apiGet, apiPost } from "../../../shared/apiClient";
import styles from "./styles/ChannelEditor.module.css";

function getTenantFromHost() {
  if (typeof window === "undefined") return "";
  const host = window.location.hostname;
  const parts = host.split(".");
  if (parts.length >= 3) return parts[0] === "www" ? parts[1] : parts[0];
  return parts[0] || "";
}
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

export default function TelegramConnect() {
  const tenant = useMemo(() => getTenantFromHost(), []);
  const navigate = useNavigate();
  const location = useLocation();
  const backTo = location.state?.returnTo || "/channels";

  // status
  const [checking, setChecking] = useState(true);
  const [connected, setConnected] = useState(false);
  const [botId, setBotId] = useState("");
  const [username, setUsername] = useState("");
  const [webhook, setWebhook] = useState("");

  // form
  const [token, setToken] = useState("");
  const [secret, setSecret] = useState(genSecretHex());
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState(null);
  const [ok, setOk] = useState(null);

  async function loadStatus() {
    setChecking(true);
    setErr(null);
    try {
      const s = await apiGet(`/tg/status?subdomain=${tenant}`);
      const isConn = !!s?.connected;
      setConnected(isConn);
      setBotId(s?.bot_id || "");
      setUsername(s?.username || "");
      setWebhook(s?.webhook_url || "");
    } catch (e) {
      setErr("Falha ao consultar status do Telegram.");
    } finally {
      setChecking(false);
    }
  }

  useEffect(() => {
    if (!tenant) { setErr("Tenant não identificado."); setChecking(false); return; }
    loadStatus();
    // secreto novo a cada visita (apenas para conectar)
    setSecret(genSecretHex());
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tenant]);

  async function handleConnect() {
    if (connected) return; // não deixa conectar se já estiver conectado
    if (!tenant) return setErr("Tenant não identificado.");
    if (!token)  return setErr("Informe o Bot Token.");

    setLoading(true); setErr(null); setOk(null);
    try {
      const j = await apiPost("/tg/connect", { subdomain: tenant, botToken: token, secret });
      if (!j?.ok) throw new Error(j?.error || "Falha ao conectar Telegram");
      setOk("Telegram conectado com sucesso.");
      // atualiza status após conectar
      await loadStatus();
      setToken("");
    } catch (e) {
      setErr(String(e?.message || e));
    } finally {
      setLoading(false);
    }
  }

  const title = connected ? "Telegram — Conectado" : "Telegram — Conectar";

  return (
    <div className={styles.page}>
      {/* breadcrumbs */}
      <div className={styles.breadcrumbs}>
        <span className={styles.bcLink} onClick={() => navigate("/channels")}>Canais</span>
        <span className={styles.bcSep}>/</span>
        <span>Telegram</span>
      </div>

      {/* header */}
      <div className={styles.pageHeader}>
        <div className={styles.titleWrap}>
          <h1 className={styles.title}>{title}</h1>
          <div className={styles.metaRow}>Tenant: <strong>{tenant || "—"}</strong></div>
        </div>

        <div className={styles.headerActions}>
          <button className={styles.backBtn} onClick={() => navigate(backTo)}>
            <ArrowLeft size={16}/> Voltar
          </button>
          <button className={styles.btn} onClick={loadStatus} disabled={checking}>
            <RefreshCw size={16}/> Recarregar
          </button>
        </div>
      </div>

      <div className={styles.editorCard}>
        {checking ? (
          <div className={styles.loading}>Carregando…</div>
        ) : (
          <>
            {err && <div className={styles.alertErr} style={{ marginBottom: 12 }}>{err}</div>}
            {ok  && <div className={styles.alertOk}  style={{ marginBottom: 12 }}>{ok}</div>}

            {connected ? (
              // ======= Painel somente-leitura quando já conectado =======
              <div className={styles.section}>
                <div className={styles.kpiGrid}>
                  <div className={styles.kvCard}>
                    <div className={styles.kvTitle}>Bot</div>
                    <div className={styles.kvValue}>
                      {username ? `@${username}` : "—"}
                    </div>
                  </div>
                  <div className={styles.kvCard}>
                    <div className={styles.kvTitle}>Bot ID</div>
                    <div className={`${styles.kvValue} ${styles.mono}`}>{botId || "—"}</div>
                  </div>
                  <div className={styles.kvCard}>
                    <div className={styles.kvTitle}>Webhook</div>
                    <div className={styles.kvValue}>{webhook || "—"}</div>
                  </div>
                </div>

                <div className={styles.hintRow} style={{ marginTop: 8 }}>
                  <CheckCircle2 size={16} /> Bot já está conectado. Não é necessário reconectar.
                </div>
              </div>
            ) : (
              // ======= Formulário de conexão (apenas se NÃO estiver conectado) =======
              <>
                <div className={styles.section}>
                  <div className={styles.formRow}>
                    <label className={styles.label}>Bot Token</label>
                    <input
                      className={styles.input}
                      type="text"
                      placeholder="ex.: 123456:AAHk...-seu-token"
                      value={token}
                      onChange={(e) => setToken(e.target.value)}
                      autoComplete="off"
                      disabled={loading}
                    />
                  </div>

                  <div className={styles.hintRow}>
                    <PlugZap size={14}/> Um segredo de webhook foi gerado automaticamente.
                  </div>
                </div>

                <div className={styles.actionsRow}>
                  <button
                    className={styles.btnTgPrimary}
                    onClick={handleConnect}
                    disabled={loading || connected}
                  >
                    {loading ? "Conectando..." : "Conectar"}
                  </button>
                </div>
              </>
            )}
          </>
        )}
      </div>
    </div>
  );
}
