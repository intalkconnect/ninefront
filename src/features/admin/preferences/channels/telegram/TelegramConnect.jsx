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
  const tenant   = useMemo(() => getTenantFromHost(), []);
  const navigate = useNavigate();
  const location = useLocation();

  // flowId pode vir por state (preferido) ou por query (?flow_id=)
  const flowId   = location.state?.flowId || new URLSearchParams(location.search).get("flow_id") || null;
  const backTo   = location.state?.returnTo || (flowId ? `/development/flowhub/${flowId}/channels` : "/settings/channels");

  // status
  const [checking, setChecking] = useState(true);
  const [connected, setConnected] = useState(false); // conexão no tenant
  const [bound, setBound] = useState(false);         // vinculado a ESTE flow
  const [botId, setBotId] = useState("");
  const [username, setUsername] = useState("");

  // form
  const [token, setToken] = useState("");
  const [secret, setSecret] = useState(genSecretHex());
  const [loading, setLoading] = useState(false);

  // Setup instructions visibility
  const [showInstructions, setShowInstructions] = useState(false);

  async function loadStatus() {
    setChecking(true);
    try {
      const s = await apiGet(`/telegram/status?subdomain=${tenant}${flowId ? `&flow_id=${flowId}` : ""}`);
      const isConn = !!s?.connected;
      setConnected(isConn);
      setBound(!!s?.bound);               // << flow-aware
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
  }, [tenant, flowId]);

  async function handleConnect() {
    // Se já estiver conectado e já vinculado a este flow, nada a fazer
    if (connected && bound) return;
    if (!tenant) return toast.warn("Tenant não identificado.");
    if (!token.trim() && !connected) return toast.warn("Informe o Bot Token.");

    setLoading(true);
    const id = toast.loading("Conectando Telegram…");
    try {
      const payload = {
        subdomain: tenant,
        secret,
      };

      // se ainda NÃO há conexão no tenant, precisa do token
      if (!connected) payload.botToken = token.trim();

      // sempre que vier flowId, o backend já cria/garante o vínculo em flow_channels
      if (flowId) payload.flow_id = flowId;

      const j = await apiPost("/telegram/connect", payload);
      if (!j?.ok) throw new Error(j?.error || "Falha ao conectar Telegram");

      toast.update(id, { render: "Telegram conectado com sucesso!", type: "success", isLoading: false, autoClose: 2500 });
      await loadStatus();
      setToken("");
      setShowInstructions(false);
    } catch (e) {
      toast.update(id, { render: String(e?.message || e) || "Erro ao conectar.", type: "error", isLoading: false, autoClose: 3500 });
    } finally {
      setLoading(false);
    }
  }

  async function handleDisconnect() {
    // Caso tenha endpoint: await apiPost("/telegram/disconnect", { subdomain: tenant, flow_id: flowId });
    toast.info("Função de desconexão ainda não implementada.");
  }

  const title = connected
    ? (bound ? "Telegram — Conectado neste flow" : "Telegram — Conectado (outro flow)")
    : "Telegram — Conectar";

  return (
    <div className={styles.page}>
      {/* breadcrumbs */}
      <div className={styles.breadcrumbs}>
        <span className={styles.bcLink} onClick={() => navigate(backTo)}>Canais do Flow</span>
        <span className={styles.bcSep}>/</span>
        <span>Telegram</span>
      </div>

      {/* header */}
      <div className={styles.pageHeader}>
        <div className={styles.titleWrap}>
          <h1 className={styles.title}>{title}</h1>
          <div className={styles.metaRow}>
            Tenant: <strong>{tenant || "—"}</strong>
            {flowId && <span style={{ marginLeft: 8 }}>• Flow: <strong>{flowId}</strong></span>}
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
        ) : (
          <>
            {connected && bound ? (
              <>
                <div className={styles.statusBar}>
                  <span className={styles.statusChipOk}>
                    <CheckCircle2 size={14}/> Conectado • Vinculado a este flow
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
                            try {
                              await navigator.clipboard.writeText(botId);
                              toast.success("ID copiado!");
                            } catch {
                              toast.error("Não foi possível copiar.");
                            }
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
                {/* Hero section */}
                <div className={styles.heroSection}>
                  <div className={styles.heroIcon}>
                    <Bot size={48} />
                  </div>
                  <h2 className={styles.heroTitle}>Conecte seu Bot do Telegram</h2>
                  <p className={styles.heroSubtitle}>
                    {connected
                      ? "Já há um bot conectado neste tenant. Clique em Conectar para vinculá-lo a este flow."
                      : "Configure seu bot do Telegram para integração com o sistema de mensageria."}
                  </p>
                </div>

                {/* Se o tenant ainda não tem bot, pedimos o token */}
                {!connected && (
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
                        {showInstructions ? "Ocultar" : "Como obter o Bot Token?"}
                      </button>
                    </div>

                    {showInstructions && (
                      <div className={styles.instructionsCard}>
                        <h4 className={styles.instructionsTitle}>Criando um Bot no Telegram</h4>
                        <div className={styles.instructionsList}>
                          {[
                            ["1", <>Abra o Telegram e procure por <code>@BotFather</code></>],
                            ["2", <>Digite <code>/newbot</code> e siga as instruções</>],
                            ["3", <>Escolha um nome para seu bot (ex: "Meu Sistema Bot")</>],
                            ["4", <>Escolha um username que termine com <code>bot</code> (ex: "meusistema_bot")</>],
                            ["5", <>Copie o token fornecido e cole no campo acima</>],
                          ].map(([n, content]) => (
                            <div className={styles.instructionItem} key={n}>
                              <div className={styles.instructionStep}>{n}</div>
                              <div className={styles.instructionText}>{content}</div>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                )}

                <div className={styles.actionsRow}>
                  <button
                    className={styles.btnTgPrimary}
                    onClick={handleConnect}
                    disabled={loading || (!connected && !token.trim())}
                    title={connected ? "Vincular este bot ao flow" : "Conectar bot ao tenant e vincular ao flow"}
                  >
                    {loading ? "Conectando..." : (connected ? "Vincular ao flow" : "Conectar Bot")}
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
