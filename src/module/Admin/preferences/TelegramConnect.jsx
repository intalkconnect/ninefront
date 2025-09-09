import React, { useEffect, useMemo, useState } from "react";
import { ArrowLeft, PlugZap } from "lucide-react";
import { useLocation, useNavigate } from "react-router-dom";
import { apiPost } from "../../../shared/apiClient";
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

  const [token, setToken] = useState("");
  const [secret, setSecret] = useState("");
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState(null);
  const [ok, setOk] = useState(null);

  useEffect(() => { setSecret(genSecretHex()); }, []);

  async function handleConnect() {
    if (!tenant) return setErr("Tenant não identificado.");
    if (!token)  return setErr("Informe o Bot Token.");
    setLoading(true); setErr(null); setOk(null);
    try {
      const j = await apiPost("/tg/connect", { subdomain: tenant, botToken: token, secret });
      if (!j?.ok) throw new Error(j?.error || "Falha ao conectar Telegram");
      setOk("Telegram conectado com sucesso.");
    } catch (e) {
      setErr(String(e?.message || e));
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className={styles.page}>
      <div className={styles.breadcrumbs}>
        <span className={styles.bcLink} onClick={() => navigate("/channels")}>Canais</span>
        <span className={styles.bcSep}>/</span>
        <span>Telegram</span>
      </div>

      <div className={styles.pageHeader}>
        <div className={styles.titleWrap}>
          <h1 className={styles.title}>Telegram — Conectar</h1>
          <div className={styles.metaRow}>Tenant: <strong>{tenant || "—"}</strong></div>
        </div>

        <div className={styles.headerActions}>
          <button className={styles.backBtn} onClick={() => navigate(backTo)}>
            <ArrowLeft size={16}/> Voltar
          </button>
        </div>
      </div>

      <div className={styles.editorCard}>
        {err && <div className={styles.alertErr} style={{marginBottom:12}}>{err}</div>}
        {ok &&  <div className={styles.alertOk}  style={{marginBottom:12}}>{ok}</div>}

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
            />
          </div>
          <div className={styles.hintRow}>
            <PlugZap size={14}/> Geramos um segredo de webhook automaticamente.
          </div>
        </div>

        <div className={styles.actionsRow}>
          <button className={styles.btnTgPrimary} onClick={handleConnect} disabled={loading}>
            {loading ? "Conectando..." : "Conectar"}
          </button>
        </div>
      </div>
    </div>
  );
}
