import React, { useEffect, useMemo, useState } from "react";
import { ArrowLeft, Save } from "lucide-react";
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

export default function WhatsAppProfile() {
  const tenant = useMemo(() => getTenantFromHost(), []);
  const navigate = useNavigate();
  const location = useLocation();
  const backTo = location.state?.returnTo || "/channels";

  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState(null);
  const [ok, setOk] = useState(null);

  const [wabaId, setWabaId] = useState("");
  const [numbers, setNumbers] = useState([]);
  const [displayName, setDisplayName] = useState("");
  const [about, setAbout] = useState("");

  useEffect(() => {
    let alive = true;
    (async () => {
      setLoading(true); setErr(null);
      try {
        // status + perfil simples
        const st = await apiGet(`/wa/status?subdomain=${tenant}`);
        if (alive && st?.ok) {
          setWabaId(st.waba_id || "");
          setNumbers(Array.isArray(st.numbers) ? st.numbers : []);
        }
        // se existir endpoint de perfil, carregue nomes
        try {
          const pf = await apiGet(`/wa/profile?subdomain=${tenant}`);
          if (alive && pf) {
            setDisplayName(pf.display_name || "");
            setAbout(pf.about || "");
          }
        } catch {}
      } catch (e) {
        if (alive) setErr("Falha ao carregar perfil do WhatsApp.");
      } finally {
        if (alive) setLoading(false);
      }
    })();
    return () => { alive = false; };
  }, [tenant]);

  async function handleSave() {
    setErr(null); setOk(null);
    try {
      await apiPost("/wa/profile", { subdomain: tenant, display_name: displayName, about });
      setOk("Perfil atualizado com sucesso.");
    } catch {
      setErr("Não foi possível salvar o perfil.");
    }
  }

  return (
    <div className={styles.page}>
      <div className={styles.breadcrumbs}>
        <span className={styles.bcLink} onClick={() => navigate("/channels")}>Canais</span>
        <span className={styles.bcSep}>/</span>
        <span>WhatsApp</span>
      </div>

      <div className={styles.pageHeader}>
        <div className={styles.titleWrap}>
          <h1 className={styles.title}>WhatsApp — Perfil</h1>
          <div className={styles.metaRow}>Tenant: <strong>{tenant || "—"}</strong></div>
        </div>

        <div className={styles.headerActions}>
          <button className={styles.backBtn} onClick={() => navigate(backTo)}>
            <ArrowLeft size={16}/> Voltar
          </button>
          <button className={styles.btnPrimary} onClick={handleSave} disabled={loading}>
            <Save size={16} style={{marginRight:6}}/> Salvar
          </button>
        </div>
      </div>

      <div className={styles.editorCard}>
        {loading ? (
          <div className={styles.loading}>Carregando…</div>
        ) : err ? (
          <div className={styles.alertErr}>{err}</div>
        ) : (
          <>
            {ok && <div className={styles.alertOk} style={{marginBottom:12}}>{ok}</div>}

            <div className={styles.section}>
              <div className={styles.kv}>
                <div className={styles.k}>WABA</div>
                <div className={styles.v}>{wabaId || "—"}</div>
              </div>

              <div className={styles.kv} style={{alignItems:"flex-start"}}>
                <div className={styles.k}>Números</div>
                <div className={styles.v}>
                  {numbers?.length ? (
                    <ul className={styles.numList}>
                      {numbers.map((n, i) => (
                        <li key={i} className={styles.numRow}>
                          <div className={styles.numMain}>
                            <div className={styles.numPhone}>{n.display || n.phone || n.id || "número"}</div>
                            <div className={styles.numId}>{n.id || n.phone_id || ""}</div>
                          </div>
                        </li>
                      ))}
                    </ul>
                  ) : (
                    <span className={styles.muted}>Nenhum número vinculado.</span>
                  )}
                </div>
              </div>
            </div>

            <div className={styles.divider} />

            <div className={styles.section}>
              <div className={styles.formRow}>
                <label className={styles.label}>Nome de exibição</label>
                <input
                  className={styles.input}
                  value={displayName}
                  onChange={(e)=>setDisplayName(e.target.value)}
                  placeholder="Ex.: Minha Empresa"
                />
              </div>
              <div className={styles.formRow}>
                <label className={styles.label}>Sobre</label>
                <input
                  className={styles.input}
                  value={about}
                  onChange={(e)=>setAbout(e.target.value)}
                  placeholder="Texto curto"
                />
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
