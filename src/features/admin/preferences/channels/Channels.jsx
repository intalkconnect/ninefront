// webapp/src/pages/Channels/Channels.jsx
import React, { useMemo, useState, useEffect } from "react";
import { MessageCircle, Instagram as IgIcon, MessageSquareText as FbIcon, Send, CheckCircle2, PlugZap } from "lucide-react";
import { apiGet, apiPost } from '../../../../shared/apiClient';
import styles from "./styles/Channels.module.css";
import WhatsAppEmbeddedSignupButton from "../../components/WhatsAppEmbeddedSignupButton";
import FacebookConnectButton from "../../components/FacebookConnectButton";
import InstagramConnectButton from "../../components/InstagramConnectButton";
import { useNavigate, useLocation } from "react-router-dom";
import { toast } from "react-toastify";

/* =========== utils já existentes =========== */
function getTenantFromHost() {
  if (typeof window === "undefined") return "";
  const host = window.location.hostname;
  const parts = host.split(".");
  if (parts.length >= 3) return parts[0] === "www" ? parts[1] : parts[0];
  return parts[0] || "";
}
function formatPhone(p) {
  const raw = typeof p === "string" ? p : (p && (p.display_phone_number || p.phone_number || p.number)) || "";
  const digits = (raw || "").replace(/[^\d+]/g, "");
  if (!digits) return "—";
  if (digits.startsWith("+")) return digits;
  return `+${digits}`;
}

export default function Channels() {
  const tenant = useMemo(() => getTenantFromHost(), []);
  const navigate = useNavigate();
  const location = useLocation();

  // WhatsApp (mesmo do seu código)
  const [wa, setWa] = useState({ loading: true, connected: false, phoneId: "", phone: null, stabilizing: false });

  // Telegram (mesmo do seu código)
  const [tg, setTg] = useState({ loading: true, connected: false, botId: "", username: "", webhookUrl: "" });

  // NOVOS: Facebook / Instagram
  const [fb, setFb] = useState({ loading: true, connected: false, pageId: "", pageName: "" });
  const [ig, setIg] = useState({ loading: true, connected: false, pageId: "", pageName: "", igUserId: "", igUsername: "" });

  /* ====== Status loaders ====== */
  useEffect(() => {
    if (!tenant) return;

    // WhatsApp
    (async () => {
      try {
        const ws = await apiGet(`/whatsapp/number?subdomain=${tenant}`);
        if (ws && ws.ok && ws.phone) {
          setWa((prev) => ({ ...prev, loading: false, connected: true, phoneId: ws.phone.id || "", phone: ws.phone }));
        } else {
          setWa((prev) => ({ ...prev, loading: false, connected: false, phoneId: "", phone: null }));
        }
      } catch {
        setWa((prev) => ({ ...prev, loading: false, connected: false, phoneId: "", phone: null }));
        toast.error("Não foi possível obter o status do WhatsApp.");
      }
    })();

    // Telegram
    (async () => {
      try {
        const ts = await apiGet(`/telegram/status?subdomain=${tenant}`);
        if (ts && ts.ok) {
          setTg({ loading: false, connected: !!ts.connected, botId: ts.bot_id || "", username: ts.username || "", webhookUrl: ts.webhook_url || "" });
        } else setTg((prev) => ({ ...prev, loading: false, connected: false }));
      } catch {
        setTg({ loading: false, connected: false, botId: "", username: "", webhookUrl: "" });
        toast.error("Não foi possível obter o status do Telegram.");
      }
    })();

    // Facebook
    (async () => {
      try {
        const fs = await apiGet(`/facebook/status?subdomain=${tenant}`);
        if (fs && fs.ok) {
          setFb({ loading: false, connected: !!fs.connected, pageId: fs.page_id || "", pageName: fs.page_name || "" });
        } else setFb((prev) => ({ ...prev, loading: false, connected: false }));
      } catch {
        setFb({ loading: false, connected: false, pageId: "", pageName: "" });
        toast.error("Não foi possível obter o status do Facebook.");
      }
    })();

    // Instagram
    (async () => {
      try {
        const is = await apiGet(`/instagram/status?subdomain=${tenant}`);
        if (is && is.ok) {
          setIg({
            loading: false, connected: !!is.connected,
            pageId: is.page_id || "", pageName: is.page_name || "",
            igUserId: is.ig_user_id || "", igUsername: is.ig_username || ""
          });
        } else setIg((prev) => ({ ...prev, loading: false, connected: false }));
      } catch {
        setIg({ loading: false, connected: false, pageId: "", pageName: "", igUserId: "", igUsername: "" });
        toast.error("Não foi possível obter o status do Instagram.");
      }
    })();
  }, [tenant]);

  /* ====== OAuth popup → postMessage handlers ====== */
  useEffect(() => {
    const AUTH_ORIGIN = import.meta.env.VITE_EMBED_ORIGIN; // ex.: https://auth.seudominio.com
    function onMsg(e) {
      if (!AUTH_ORIGIN || e.origin !== AUTH_ORIGIN) return;
      const data = e.data || {};
      const type = data.type;

      // Facebook: receber code e finalizar
      if (type === "fb:oauth") {
        const { code, state } = data;
        let ctx = {};
        try { ctx = state ? JSON.parse(atob(state)) : {}; } catch {}
        const redirect_uri = ctx?.redirectUri;
        const sub = ctx?.tenant || tenant;

        toast.loading("Conectando Facebook…", { toastId: "fb-connecting" });
        apiPost("/facebook/finalize", { subdomain: sub, code, redirect_uri })
         .then(async (res) => {
           // PASSO 1: a API retorna a lista de páginas + user_token
           if (res?.ok && res?.step === "pages_list") {
             const pages = Array.isArray(res.pages) ? res.pages : [];
             if (!pages.length) throw new Error("Nenhuma Página disponível nesta conta.");

             // escolha simples: primeira página (ou abra um modal para o usuário escolher)
             const pick = pages[0];

             // PASSO 2: finalizar de verdade com page_id + user_token
             const r2 = await apiPost("/facebook/finalize", {
               subdomain: sub,
               redirect_uri,
               page_id: pick.id,
               user_token: res.user_token
             });

             if (r2?.ok && r2?.connected) {
               setFb((s) => ({
                 ...s,
                 connected: true,
                 loading: false,
                 pageId: r2.page_id || s.pageId,
                 pageName: r2.page_name || s.pageName
               }));
               toast.update("fb-connecting", { render: "Facebook conectado.", type: "success", isLoading: false, autoClose: 2500 });
               return;
             }
             throw new Error(r2?.error || "Falha ao concluir conexão do Facebook");
           }

           // Alguns ambientes podem já retornar conectado (caso só haja 1 página)
           if (res?.ok && res?.connected) {
             setFb((s) => ({
               ...s,
               connected: true,
               loading: false,
               pageId: res.page_id || s.pageId,
               pageName: res.page_name || s.pageName
             }));
             toast.update("fb-connecting", { render: "Facebook conectado.", type: "success", isLoading: false, autoClose: 2500 });
             return;
           }

           throw new Error(res?.error || "Falha ao conectar Facebook");
         })
         .catch((err) => {
           toast.update("fb-connecting", { render: err?.message || "Falha ao conectar Facebook", type: "error", isLoading: false, autoClose: 4000 });
         });
      }

      // Instagram: receber code e finalizar (1ª chamada retorna lista de páginas)
      if (type === "ig:oauth") {
        const { code, state } = data;
        let ctx = {};
        try { ctx = state ? JSON.parse(atob(state)) : {}; } catch {}
        const redirect_uri = ctx?.redirectUri;
        const sub = ctx?.tenant || tenant;

        toast.loading("Conectando Instagram…", { toastId: "ig-connecting" });
        apiPost("/instagram/finalize", { subdomain: sub, code, redirect_uri })
          .then(async (res) => {
            if (res?.ok && res?.step === "pages_list") {
              // caso tenha várias páginas, pegue a primeira com instagram ou peça UI para escolha
              const pick = res.pages.find(p => p.has_instagram) || res.pages[0];
              if (!pick) throw new Error("Nenhuma Página disponível");
              const res2 = await apiPost("/instagram/finalize", { subdomain: sub, redirect_uri, page_id: pick.id, user_token: res.user_token });
              if (res2?.ok) {
                setIg((s) => ({
                  ...s, connected: true, loading:false,
                  pageId: res2.page_id || s.pageId, pageName: res2.page_name || s.pageName,
                  igUserId: res2.ig_user_id || s.igUserId, igUsername: res2.ig_username || s.igUsername
                }));
                toast.update("ig-connecting", { render: "Instagram conectado.", type: "success", isLoading: false, autoClose: 2500 });
              } else {
                throw new Error(res2?.error || "Falha ao concluir Instagram");
              }
            } else if (res?.ok && res?.connected) {
              setIg((s) => ({
                ...s, connected:true, loading:false,
                pageId: res.page_id || s.pageId, pageName: res.page_name || s.pageName,
                igUserId: res.ig_user_id || s.igUserId, igUsername: res.ig_username || s.igUsername
              }));
              toast.update("ig-connecting", { render: "Instagram conectado.", type: "success", isLoading: false, autoClose: 2500 });
            } else {
              throw new Error(res?.error || "Falha ao conectar Instagram");
            }
          })
          .catch((err) => {
            toast.update("ig-connecting", { render: err?.message || "Falha ao conectar Instagram", type: "error", isLoading: false, autoClose: 4000 });
          });
      }
    }
    window.addEventListener("message", onMsg);
    return () => window.removeEventListener("message", onMsg);
  }, [tenant]);

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
        <div><p className={styles.subtitle}>Conecte seus canais de atendimento.</p></div>
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
            {waHasData ? (wa.connected ? <span className={styles.statusOk}><CheckCircle2 size={14}/> Conectado</span> : <span className={styles.statusOff}>Não conectado</span>) : (<span className={styles.statusNeutral || styles.statusOff}>Checando…</span>)}
          </div>
          <div className={styles.cardBody}>
            {!wa.connected ? (
              <>
                <p className={styles.cardDesc}>Conecte via <strong>Meta Embedded Signup</strong> e selecione o número.</p>
                <div className={`${styles.btnWrap} ${styles.btnWrapWa}`}>
                  <WhatsAppEmbeddedSignupButton tenant={tenant} label="Conectar" />
                  <div className={styles.hint}><PlugZap size={14}/> Login ocorre em janela do domínio seguro.</div>
                </div>
              </>
            ) : (
              <>
                <div className={styles.connectedBlock}>
                  <div className={styles.kv}><span className={styles.k}>Número WABA</span><span className={styles.v}>{waDisplayNumber}</span></div>
                  {wa.phone?.verified_name && (<div className={styles.kv}><span className={styles.k}>Nome verificado</span><span className={styles.v}>{wa.phone.verified_name}</span></div>)}
                </div>
                <div className={styles.cardActions}><button className={styles.btnSecondary} onClick={goToWaProfile}>Perfil</button></div>
              </>
            )}
          </div>
        </div>

        {/* Facebook */}
        <div className={styles.card}>
          <div className={styles.cardHead}>
            {iconWrap(styles.fb, <FbIcon size={18}/>)}
            <div className={styles.cardTitle}>Facebook Messenger</div>
            {fb.loading ? <span className={styles.statusNeutral || styles.statusOff}>Checando…</span> :
              fb.connected ? <span className={styles.statusOk}><CheckCircle2 size={14}/> Conectado</span> :
              <span className={styles.statusOff}>Não conectado</span>}
          </div>
          <div className={styles.cardBody}>
            {!fb.connected ? (
              <>
                <p className={styles.cardDesc}>Conecte sua <strong>Página do Facebook</strong> para receber mensagens.</p>
                <div className={styles.cardActions}>
                  <FacebookConnectButton tenant={tenant} label="Conectar Facebook" />
                </div>
              </>
            ) : (
              <>
                <div className={styles.connectedBlock}>
                  <div className={styles.kv}><span className={styles.k}>Página</span><span className={styles.v}>{fb.pageName || fb.pageId}</span></div>
                  <div className={styles.kv}><span className={styles.k}>Page ID</span><span className={styles.v}>{fb.pageId}</span></div>
                </div>
              </>
            )}
          </div>
        </div>

        {/* Instagram */}
        <div className={styles.card}>
          <div className={styles.cardHead}>
            {iconWrap(styles.ig, <IgIcon size={18}/>)}
            <div className={styles.cardTitle}>Instagram</div>
            {ig.loading ? <span className={styles.statusNeutral || styles.statusOff}>Checando…</span> :
              ig.connected ? <span className={styles.statusOk}><CheckCircle2 size={14}/> Conectado</span> :
              <span className={styles.statusOff}>Não conectado</span>}
          </div>
          <div className={styles.cardBody}>
            {!ig.connected ? (
              <>
                <p className={styles.cardDesc}>Conecte sua conta <strong>Instagram Profissional</strong> (via Página FB vinculada).</p>
                <div className={styles.cardActions}>
                  <InstagramConnectButton tenant={tenant} label="Conectar Instagram" />
                </div>
              </>
            ) : (
              <>
                <div className={styles.connectedBlock}>
                  <div className={styles.kv}><span className={styles.k}>IG</span><span className={styles.v}>{ig.igUsername || ig.igUserId}</span></div>
                  <div className={styles.kv}><span className={styles.k}>Página</span><span className={styles.v}>{ig.pageName || ig.pageId}</span></div>
                </div>
              </>
            )}
          </div>
        </div>

        {/* Telegram (igual ao seu) */}
        <div className={styles.card}>
          <div className={styles.cardHead}>
            {iconWrap(styles.tg, <Send size={18}/>)}
            <div className={styles.cardTitle}>Telegram</div>
            {tg.loading ? <span className={styles.statusNeutral || styles.statusOff}>Checando…</span> :
              tg.connected ? <span className={styles.statusOk}><CheckCircle2 size={14}/> Conectado</span> :
              <span className={styles.statusOff}>Não conectado</span>}
          </div>
          <div className={styles.cardBody}>
            {!tg.connected ? (
              <>
                <p className={styles.cardDesc}>Conecte informando <strong>Bot Token</strong>.</p>
                <div className={styles.cardActions}>
                  <button className={styles.btnTgPrimary} onClick={() => navigate("/channels/telegram", { state:{ returnTo: location.pathname + location.search } })}>Conectar</button>
                </div>
              </>
            ) : (
              <>
                <div className={styles.connectedBlock}>
                  <div className={styles.kv}><span className={styles.k}>Bot</span><span className={styles.v}>{tg.username || "—"}</span></div>
                  <div className={styles.kv}><span className={styles.k}>Bot ID</span><span className={styles.v}>{tg.botId || "—"}</span></div>
                </div>
                <div className={styles.cardActions}>
                  <button className={styles.btnSecondary} onClick={() => navigate("/channels/telegram", { state:{ returnTo: location.pathname + location.search } })}>Gerenciar</button>
                </div>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
