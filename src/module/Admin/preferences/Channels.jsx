import React, { useMemo, useState, useEffect } from "react";
import { MessageCircle, Instagram, MessageSquareText, Send, CheckCircle2, PlugZap } from "lucide-react";
import styles from "./styles/Canais.module.css";
import WhatsAppEmbeddedSignupButton from "../components/WhatsAppEmbeddedSignupButton";

function getTenantFromHost() {
  if (typeof window === "undefined") return "";
  const host = window.location.hostname;
  const parts = host.split(".");
  if (parts.length >= 3) return parts[0] === "www" ? parts[1] : parts[0];
  return parts[0] || "";
}

export default function Channels() {
  const tenant = useMemo(() => getTenantFromHost(), []);
  const [wa, setWa] = useState({ connected: false, wabaId: "", numbers: [], okMsg: null, errMsg: null });

  // recebe o resultado do popup
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

  return (
    <div className={styles.container}>
      <div className={styles.header}>
        <div>
          <h1 className={styles.title}>Canais</h1>
          <p className={styles.subtitle}>Conecte seus canais de atendimento.</p>
          {wa.errMsg ? <div className={styles.alertErr}>{wa.errMsg}</div> : null}
          {wa.okMsg ? <div className={styles.alertOk}>{wa.okMsg}</div> : null}
        </div>
        <div className={styles.tenantBadge}>
          {tenant ? <>tenant: <strong>{tenant}</strong></> : <span className={styles.subtle}>defina o tenant</span>}
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

        {/* demais cards… */}
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

        <div className={styles.card}>
          <div className={styles.cardHead}>
            <div className={`${styles.cardIconWrap} ${styles.tg}`}><Send size={18}/></div>
            <div className={styles.cardTitle}>Telegram</div>
            <span className={styles.statusOff}>Não conectado</span>
          </div>
          <div className={styles.cardBody}>
            <p className={styles.cardDesc}>Em breve: informe o token do bot e o segredo do webhook.</p>
            <div className={styles.cardActions}><button className={styles.btnSecondary} disabled>Conectar</button></div>
          </div>
        </div>
      </div>
    </div>
  );
}
