import React, { useEffect, useMemo, useState } from "react";
import { ArrowLeft, PlugZap, CheckCircle2, RefreshCw, Copy, Bot, AlertCircle } from "lucide-react";
import { useLocation, useNavigate } from "react-router-dom";
import { apiGet, apiPost } from "../../../../../shared/apiClient";
import styles from "./styles/TelegramConnect.module.css";
import { toast } from "react-toastify";

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
  const flowId  = location.state?.flowId || null;

  // status do tenant (somente info)
  const [checking, setChecking] = useState(true);
  const [connected, setConnected] = useState(false);
  const [botId, setBotId] = useState("");
  const [username, setUsername] = useState("");

  // form
  const [token, setToken] = useState("");
  const [secret, setSecret] = useState(genSecretHex());
  const [loading, setLoading] = useState(false);

  const [showInstructions, setShowInstructions] = useState(false);

  async function loadStatus() {
    setChecking(true);
    try {
      const s = await apiGet(`/telegram/status?subdomain=${tenant}`);
      const isConn = !!s?.connected;
      setConnected(isConn);
      setBotId(s?.bot_id || "");
      setUsername(s?.username || "");
    } catch {
      toast.error("Falha ao consultar status do Telegram.");
    } finally {
      setChecking(false);
    }
  }

  useEffect(() => {
    if (!tenant) {
      toast.error("Tenant não identificado.");
      setChecking(false);
      return;
    }
    loadStatus();
    setSecret(genSecretHex());
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tenant]);

  async function handleConnect() {
    if (!tenant) return toast.warn("Tenant não identificado.");
    if (!token.trim()) return toast.warn("Informe o Bot Token.");

    setLoading(true);
    const id = toast.loading("Conectando Telegram…");
    try {
      // 1) conecta o bot no tenant
      const j = await apiPost("/telegram/connect", { subdomain: tenant, botToken: token.trim(), secret });
      if (!j?.ok) throw new Error(j?.error || "Falha ao conectar Telegram");

      // 2) se veio flowId, vincula este flow imediatamente
      if (flowId && j.bot_id) {
        await apiPost(`/flows/${flowId}/channels`, {
          channel_type: "telegram",
          channel_key: j.bot_id,
          display_name: j.username || "Telegram",
        });
      }

      toast.update(id, { render: "Telegram conectado!", type: "success", isLoading: false, autoClose: 1800 });
      setToken("");
      setShowInstructions(false);
      await loadStatus();

      // 3) volta para a tela do flow (se houver)
      if (flowId) {
        navigate(backTo || `/development/flowhub/${flowId}/channels`, { replace: true });
      }
    } catch (e) {
      toast.update(id, { render: String(e?.message || e) || "Erro ao conectar.", type: "error", isLoading: false, autoClose: 3500 });
    } finally {
      setLoading(false);
    }
  }

  async function handleDisconnect() {
    toast.info("Função de desconexão ainda não implementada.");
  }

  const title = connected ? "Telegram — Conectado" : "Telegram — Conectar";

  return (
    <div className={styles.page}>
      <div className={styles.breadcrumbs}>
        <span className={styles.bcLink} onClick={() => navigate(backTo)}>Canais</span>
        <span className={styles.bcSep}>/</span>
        <span>Telegram</span>
      </div>

      <div className={styles.pageHeader}>
        <div className={styles.titleWrap}>
          <h1 className={styles.title}>{title}</h1>
          <div className={styles.metaRow}>
            Tenant: <strong>{tenant || "—"}</strong>
            {flowId ? <span style={{ marginLeft: 12 }}>• Flow: <strong>{flowId}</strong></span> : null}
          </div>
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
        ) : connected ? (
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
                      onClick={async () => {
                        try { await navigator.clipboard.writeText(botId); toast.success("ID copiado!"); }
                        catch { toast.error("Não foi possível copiar."); }
                      }}
                      title="Copiar ID"
                    >
                      <Copy size={14}/>
                    </button>
                  )}
                </div>
              </div>
            </div>

            <div className={styles.actionsRow}>
              <button className={styles.btnDanger} onClick={handleDisconnect}>
                Desconectar
              </button>
            </div>
          </>
        ) : (
          <>
            <div className={styles.heroSection}>
              <div className={styles.heroIcon}><Bot size={48} /></div>
              <h2 className={styles.heroTitle}>Conecte seu Bot do Telegram</h2>
              <p className={styles.heroSubtitle}>Este passo conecta no tenant e já vincula este flow (se veio com flowId).</p>
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
                <button className={styles.instructionsBtn} onClick={() => setShowInstructions(!showInstructions)}>
                  <AlertCircle size={14} />
                  {showInstructions ? 'Ocultar' : 'Como obter o Bot Token?'}
                </button>
              </div>

              {showInstructions && (
                <div className={styles.instructionsCard}>
                  <h4 className={styles.instructionsTitle}>Criando um Bot no Telegram</h4>
                  <ol className={styles.instructionsList}>
                    <li><strong>Abra o Telegram</strong> e procure por <code>@BotFather</code></li>
                    <li><strong>Digite</strong> <code>/newbot</code> e siga as instruções</li>
                    <li><strong>Escolha um nome</strong> para seu bot</li>
                    <li><strong>Escolha um username</strong> que termine com <code>bot</code></li>
                    <li><strong>Copie o token</strong> gerado e cole acima</li>
                  </ol>
                </div>
              )}
            </div>

            <div className={styles.actionsRow}>
              <button className={styles.btnTgPrimary} onClick={handleConnect} disabled={loading || !token.trim()}>
                {loading ? "Conectando..." : "Conectar Telegram"}
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
