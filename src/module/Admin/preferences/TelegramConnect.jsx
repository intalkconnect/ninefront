import React, { useEffect, useMemo, useState } from "react";
import { ArrowLeft, PlugZap, CheckCircle2, RefreshCw, Copy, Bot, AlertCircle } from "lucide-react";
import { useLocation, useNavigate } from "react-router-dom";
import { apiGet, apiPost } from "../../../shared/apiClient";
import styles from "./styles/TelegramConnect.module.css";

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

  // form
  const [token, setToken] = useState("");
  const [secret, setSecret] = useState(genSecretHex());
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState(null);
  const [ok, setOk] = useState(null);

  // Setup instructions visibility
  const [showInstructions, setShowInstructions] = useState(false);

  async function loadStatus() {
    setChecking(true);
    setErr(null);
    try {
      const s = await apiGet(`/tg/status?subdomain=${tenant}`);
      const isConn = !!s?.connected;
      setConnected(isConn);
      setBotId(s?.bot_id || "");
      setUsername(s?.username || "");
    } catch {
      setErr("Falha ao consultar status do Telegram.");
    } finally {
      setChecking(false);
    }
  }

  useEffect(() => {
    if (!tenant) { setErr("Tenant não identificado."); setChecking(false); return; }
    loadStatus();
    setSecret(genSecretHex());
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tenant]);

  async function handleConnect() {
    if (connected) return;
    if (!tenant) return setErr("Tenant não identificado.");
    if (!token) return setErr("Informe o Bot Token.");

    setLoading(true); setErr(null); setOk(null);
    try {
      const j = await apiPost("/tg/connect", { subdomain: tenant, botToken: token, secret });
      if (!j?.ok) throw new Error(j?.error || "Falha ao conectar Telegram");
      setOk("Telegram conectado com sucesso!");
      await loadStatus();
      setToken("");
    } catch (e) {
      setErr(String(e?.message || e));
    } finally {
      setLoading(false);
    }
  }

  async function handleDisconnect() {
    // Implementar lógica de desconexão se necessário
    console.log("Desconectar Telegram");
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
            {ok && <div className={styles.alertOk} style={{ marginBottom: 12 }}>{ok}</div>}

            {connected ? (
              <>
                <div className={styles.statusBar}>
                  <span className={styles.statusChipOk}>
                    <CheckCircle2 size={14}/> Conectado
                  </span>
                </div>

                <div className={styles.kpiGrid}>
                  <div className={styles.kvCard}>
                    <div className={styles.kvTitle}>Bot</div>
                    <div className={styles.kvValue}>{username ? `@${username}` : "—"}</div>
                  </div>

                  <div className={styles.kvCard}>
                    <div className={styles.kvTitle}>Bot ID</div>
                    <div className={styles.kvValueRow}>
                      <span className={`${styles.kvValue} ${styles.mono}`}>{botId || "—"}</span>
                      {botId && (
                        <button
                          className={styles.copyBtn}
                          onClick={() => navigator.clipboard.writeText(botId)}
                          title="Copiar ID"
                        >
                          <Copy size={14}/>
                        </button>
                      )}
                    </div>
                  </div>
                </div>

                <div className={styles.actionsRow}>
                  <button
                    className={styles.btnDanger}
                    onClick={handleDisconnect}
                  >
                    Desconectar
                  </button>
                </div>
              </>
            ) : (
              <>
                {/* Hero section */}
                <div className={styles.heroSection}>
                  <div className={styles.heroIcon}>
                    <Bot size={48} />
                  </div>
                  <h2 className={styles.heroTitle}>Conecte seu Bot do Telegram</h2>
                  <p className={styles.heroSubtitle}>
                    Configure seu bot do Telegram para integração com o sistema de mensageria
                  </p>
                </div>

                <div className={styles.section}>
                  <div className={styles.formRow}>
                    <label className={styles.label}>Bot Token *</label>
                    <input
                      className={styles.input}
                      type="text"
                      placeholder="123456789:ABCdefGhIJklmnoPQRstuvWXyz..."
                      value={token}
                      onChange={(e) => setToken(e.target.value)}
                      autoComplete="off"
                      disabled={loading}
                    />
                  </div>
                  
                  <div className={styles.hintRow}>
                    <PlugZap size={14}/> Um segredo de webhook foi gerado automaticamente.
                  </div>

                  <div className={styles.instructionsToggle}>
                    <button 
                      className={styles.instructionsBtn}
                      onClick={() => setShowInstructions(!showInstructions)}
                    >
                      <AlertCircle size={14} />
                      {showInstructions ? 'Ocultar' : 'Como obter o Bot Token?'}
                    </button>
                  </div>

                  {showInstructions && (
                    <div className={styles.instructionsCard}>
                      <h4 className={styles.instructionsTitle}>Criando um Bot no Telegram</h4>
                      <div className={styles.instructionsList}>
                        <div className={styles.instructionItem}>
                          <div className={styles.instructionStep}>1</div>
                          <div className={styles.instructionText}>
                            <strong>Abra o Telegram</strong> e procure por <code>@BotFather</code>
                          </div>
                        </div>
                        <div className={styles.instructionItem}>
                          <div className={styles.instructionStep}>2</div>
                          <div className={styles.instructionText}>
                            <strong>Digite</strong> <code>/newbot</code> e siga as instruções
                          </div>
                        </div>
                        <div className={styles.instructionItem}>
                          <div className={styles.instructionStep}>3</div>
                          <div className={styles.instructionText}>
                            <strong>Escolha um nome</strong> para seu bot (ex: "Meu Sistema Bot")
                          </div>
                        </div>
                        <div className={styles.instructionItem}>
                          <div className={styles.instructionStep}>4</div>
                          <div className={styles.instructionText}>
                            <strong>Escolha um username</strong> que termine com "bot" (ex: "meusistema_bot")
                          </div>
                        </div>
                        <div className={styles.instructionItem}>
                          <div className={styles.instructionStep}>5</div>
                          <div className={styles.instructionText}>
                            <strong>Copie o token</strong> fornecido pelo BotFather e cole no campo acima
                          </div>
                        </div>
                      </div>
                    </div>
                  )}
                </div>

                <div className={styles.actionsRow}>
                  <button
                    className={styles.btnTgPrimary}
                    onClick={handleConnect}
                    disabled={loading || connected || !token.trim()}
                  >
                    {loading ? "Conectando..." : "Conectar Bot"}
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
