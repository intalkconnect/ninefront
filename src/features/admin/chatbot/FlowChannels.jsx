// src/features/admin/chatbot/FlowChannels.jsx
import React, { useMemo, useState, useEffect } from "react";
import {
  MessageCircle, Instagram as IgIcon, MessageSquareText as FbIcon, Send,
  CheckCircle2, PlugZap, Link as LinkIcon, Link2Off as UnlinkIcon, ArrowLeft
} from "lucide-react";
import { apiGet, apiPost } from "../../../shared/apiClient";
import { useNavigate, useParams, useLocation } from "react-router-dom";
import { toast } from "react-toastify";
import styles from "./styles/Channels.module.css";

/* =========== utils (mantidos) =========== */
function formatPhone(p) {
  const raw = typeof p === "string" ? p : (p && (p.display_phone_number || p.phone_number || p.number)) || "";
  const digits = (raw || "").replace(/[^\d+]/g, "");
  if (!digits) return "—";
  if (digits.startsWith("+")) return digits;
  return `+${digits}`;
}

export default function FlowChannels() {
  const { flowId } = useParams();
  const navigate = useNavigate();
  const location = useLocation();

  // provider status
  const [wa, setWa] = useState({ loading: true, connected: false, phoneId: "", phone: null, stabilizing: false });
  const [fb, setFb] = useState({ loading: true, connected: false, pageId: "", pageName: "" });
  const [ig, setIg] = useState({ loading: true, connected: false, pageId: "", pageName: "", igUserId: "", igUsername: "" });
  const [tg, setTg] = useState({ loading: true, connected: false, botId: "", username: "" });

  // vínculos com o flow
  const [bindings, setBindings] = useState({
    whatsapp: null, // {channel_id, extra}
    facebook: null,
    instagram: null,
    telegram: null,
  });

  const backTo = `/admin/development/flowhub`;

  /* ====== Carregamento ====== */
  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        // 1) status dos provedores (você já tem esses endpoints por tenant/conta — aqui assumo endpoints globais)
        //    Se seus endpoints exigem subdomínio/tenant, adicione como querystring.
        // WhatsApp
        try {
          const ws = await apiGet(`/whatsapp/number`);
          if (alive) {
            if (ws && ws.ok && ws.phone) {
              setWa({ loading: false, connected: true, phoneId: ws.phone.id || "", phone: ws.phone, stabilizing: false });
            } else {
              setWa({ loading: false, connected: false, phoneId: "", phone: null, stabilizing: false });
            }
          }
        } catch {
          if (alive) setWa({ loading: false, connected: false, phoneId: "", phone: null, stabilizing: false });
        }

        // Facebook
        try {
          const fs = await apiGet(`/facebook/status`);
          if (alive) {
            setFb({ loading: false, connected: !!fs?.connected, pageId: fs?.page_id || "", pageName: fs?.page_name || "" });
          }
        } catch {
          if (alive) setFb({ loading: false, connected: false, pageId: "", pageName: "" });
        }

        // Instagram
        try {
          const is = await apiGet(`/instagram/status`);
          if (alive) {
            setIg({
              loading: false,
              connected: !!is?.connected,
              pageId: is?.page_id || "",
              pageName: is?.page_name || "",
              igUserId: is?.ig_user_id || "",
              igUsername: is?.ig_username || ""
            });
          }
        } catch {
          if (alive) setIg({ loading: false, connected: false, pageId: "", pageName: "", igUserId: "", igUsername: "" });
        }

        // Telegram
        try {
          const ts = await apiGet(`/telegram/status`);
          if (alive) {
            setTg({ loading: false, connected: !!ts?.connected, botId: ts?.bot_id || "", username: ts?.username || "" });
          }
        } catch {
          if (alive) setTg({ loading: false, connected: false, botId: "", username: "" });
        }

        // 2) vínculos do flow
        try {
          const binds = await apiGet(`/flows/${flowId}/channels`);
          if (alive) {
            const idx = Object.create(null);
            (Array.isArray(binds) ? binds : []).forEach(b => {
              const key = (b.channel_type || "").toLowerCase();
              idx[key] = b;
            });
            setBindings({
              whatsapp: idx.whatsapp || null,
              facebook: idx.facebook || null,
              instagram: idx.instagram || null,
              telegram: idx.telegram || null,
            });
          }
        } catch (e) {
          console.error("Erro ao carregar vínculos:", e);
          toast.error("Falha ao carregar canais vinculados ao fluxo.");
        }
      } catch (e) {
        console.error(e);
      }
    })();
    return () => { alive = false; };
  }, [flowId]);

  /* ====== ações: vincular / desvincular ====== */

  async function bindChannel(type, payload) {
    const toastId = toast.loading("Vinculando canal…");
    try {
      const body = {
        channel_type: type,           // 'whatsapp' | 'facebook' | 'instagram' | 'telegram'
        channel_id: payload.id,       // e.g. phone.id, page_id, ig_user_id, bot_id
        meta: payload.meta || null,   // livre (page name, username, etc.)
      };
      await apiPost(`/flows/${flowId}/channels/upsert`, body);
      toast.update(toastId, { render: "Canal vinculado ao flow.", type: "success", isLoading: false, autoClose: 1800 });

      // atualiza bindings localmente
      setBindings((b) => ({ ...b, [type]: { channel_type: type, channel_id: body.channel_id, meta: body.meta, is_active: true }}));
    } catch (e) {
      toast.update(toastId, { render: "Falha ao vincular canal.", type: "error", isLoading: false, autoClose: 2500 });
    }
  }

  async function unbindChannel(type) {
    const toastId = toast.loading("Desvinculando canal…");
    try {
      await apiPost(`/flows/${flowId}/channels/delete`, { channel_type: type });
      toast.update(toastId, { render: "Canal desvinculado.", type: "success", isLoading: false, autoClose: 1500 });
      setBindings((b) => ({ ...b, [type]: null }));
    } catch (e) {
      toast.update(toastId, { render: "Falha ao desvincular.", type: "error", isLoading: false, autoClose: 2500 });
    }
  }

  /* ====== atalhos para telas de provedor (opcional) ====== */
  const goWhatsProfile = () => navigate("/channels/whatsapp", { state: { returnTo: location.pathname } });
  const goTelegram    = () => navigate("/channels/telegram", { state: { returnTo: location.pathname } });

  const waHasData   = !wa.loading && !wa.stabilizing;
  const waDispPhone = formatPhone(wa.phone);

  const card = (props) => (
    <div className={styles.card}>
      <div className={styles.cardHead}>
        {props.icon}
        <div className={styles.cardTitle}>{props.title}</div>

        {props.statusRender()}
      </div>

      <div className={styles.cardBody}>{props.children}</div>
    </div>
  );

  return (
    <div className={styles.container}>
      {/* Header */}
      <div className={styles.header}>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <button className={styles.btnSecondary}
                  onClick={()=>navigate(`/admin/development/studio/${flowId}`)}
                  title="Voltar para o Builder">
            <ArrowLeft size={14}/> Voltar
          </button>
          <div className={styles.subtitle}>Canais vinculados ao Flow</div>
        </div>
        <div className={styles.tenantBadge}>
          flow: <strong>{flowId}</strong>
        </div>
      </div>

      <div className={styles.grid}>
        {/* WhatsApp */}
        {card({
          icon: <div className={`${styles.cardIconWrap} ${styles.wa}`}><MessageCircle size={18}/></div>,
          title: "WhatsApp",
          statusRender: () =>
            waHasData
              ? (wa.connected
                ? <span className={styles.statusOk}><CheckCircle2 size={14}/> Conectado (prov.)</span>
                : <span className={styles.statusOff}>Não conectado (prov.)</span>)
              : <span className={styles.statusNeutral}>Checando…</span>,
          children: (
            <>
              {!wa.connected ? (
                <>
                  <p className={styles.cardDesc}>Conecte um número WABA para ficar disponível para vínculo.</p>
                  <div className={styles.cardActions}>
                    <button className={styles.btnSecondary} onClick={goWhatsProfile}>Abrir Perfil</button>
                  </div>
                </>
              ) : (
                <>
                  <div className={styles.connectedBlock}>
                    <div className={styles.kv}>
                      <span className={styles.k}>Número</span>
                      <span className={styles.v}>{waDispPhone}</span>
                    </div>
                    <div className={styles.kv}>
                      <span className={styles.k}>Phone ID</span>
                      <span className={`${styles.v} ${styles.mono}`}>{wa.phoneId || wa.phone?.id || "—"}</span>
                    </div>
                  </div>

                  {/* vínculo */}
                  {bindings.whatsapp ? (
                    <div className={styles.bindRow}>
                      <span className={styles.boundChip}><CheckCircle2 size={14}/> Vinculado ao flow</span>
                      <button className={styles.btnGhost} onClick={()=>unbindChannel("whatsapp")}>
                        <UnlinkIcon size={14}/> Desvincular
                      </button>
                    </div>
                  ) : (
                    <div className={styles.bindRow}>
                      <button
                        className={styles.btnPrimary}
                        onClick={() => bindChannel("whatsapp", {
                          id: wa.phoneId || wa.phone?.id,
                          meta: { display_number: waDispPhone, verified_name: wa.phone?.verified_name || "" }
                        })}
                      >
                        <LinkIcon size={14}/> Vincular ao Flow
                      </button>
                      <button className={styles.btnSecondary} onClick={goWhatsProfile}>
                        Gerenciar no provedor
                      </button>
                    </div>
                  )}
                </>
              )}
            </>
          )
        })}

        {/* Facebook */}
        {card({
          icon: <div className={`${styles.cardIconWrap} ${styles.fb}`}><FbIcon size={18}/></div>,
          title: "Facebook Messenger",
          statusRender: () =>
            fb.loading ? <span className={styles.statusNeutral}>Checando…</span> :
            fb.connected ? <span className={styles.statusOk}><CheckCircle2 size={14}/> Conectado (prov.)</span> :
            <span className={styles.statusOff}>Não conectado (prov.)</span>,
          children: (
            <>
              {!fb.connected ? (
                <>
                  <p className={styles.cardDesc}>Conecte a Página do Facebook para ficará disponível para vínculo.</p>
                  <div className={styles.cardActions}>
                    {/* seu botão de oAuth existente */}
                    <button className={styles.btnSecondary} onClick={() => window.open("/auth/facebook", "_blank")}>
                      Conectar Facebook
                    </button>
                  </div>
                </>
              ) : (
                <>
                  <div className={styles.connectedBlock}>
                    <div className={styles.kv}><span className={styles.k}>Página</span><span className={styles.v}>{fb.pageName || "—"}</span></div>
                    <div className={styles.kv}><span className={styles.k}>Page ID</span><span className={`${styles.v} ${styles.mono}`}>{fb.pageId || "—"}</span></div>
                  </div>

                  {bindings.facebook ? (
                    <div className={styles.bindRow}>
                      <span className={styles.boundChip}><CheckCircle2 size={14}/> Vinculado ao flow</span>
                      <button className={styles.btnGhost} onClick={()=>unbindChannel("facebook")}><UnlinkIcon size={14}/> Desvincular</button>
                    </div>
                  ) : (
                    <div className={styles.bindRow}>
                      <button className={styles.btnPrimary}
                              onClick={() => bindChannel("facebook", { id: fb.pageId, meta: { page_name: fb.pageName } })}>
                        <LinkIcon size={14}/> Vincular ao Flow
                      </button>
                    </div>
                  )}
                </>
              )}
            </>
          )
        })}

        {/* Instagram */}
        {card({
          icon: <div className={`${styles.cardIconWrap} ${styles.ig}`}><IgIcon size={18}/></div>,
          title: "Instagram",
          statusRender: () =>
            ig.loading ? <span className={styles.statusNeutral}>Checando…</span> :
            ig.connected ? <span className={styles.statusOk}><CheckCircle2 size={14}/> Conectado (prov.)</span> :
            <span className={styles.statusOff}>Não conectado (prov.)</span>,
          children: (
            <>
              {!ig.connected ? (
                <>
                  <p className={styles.cardDesc}>Conecte sua conta profissional do Instagram (via Página FB vinculada).</p>
                  <div className={styles.cardActions}>
                    <button className={styles.btnSecondary} onClick={() => window.open("/auth/instagram", "_blank")}>
                      Conectar Instagram
                    </button>
                  </div>
                </>
              ) : (
                <>
                  <div className={styles.connectedBlock}>
                    <div className={styles.kv}><span className={styles.k}>IG</span><span className={styles.v}>{ig.igUsername || "—"}</span></div>
                    <div className={styles.kv}><span className={styles.k}>IG User ID</span><span className={`${styles.v} ${styles.mono}`}>{ig.igUserId || "—"}</span></div>
                  </div>

                  {bindings.instagram ? (
                    <div className={styles.bindRow}>
                      <span className={styles.boundChip}><CheckCircle2 size={14}/> Vinculado ao flow</span>
                      <button className={styles.btnGhost} onClick={()=>unbindChannel("instagram")}><UnlinkIcon size={14}/> Desvincular</button>
                    </div>
                  ) : (
                    <div className={styles.bindRow}>
                      <button className={styles.btnPrimary}
                              onClick={() => bindChannel("instagram", { id: ig.igUserId, meta: { ig_username: ig.igUsername, page_name: ig.pageName } })}>
                        <LinkIcon size={14}/> Vincular ao Flow
                      </button>
                    </div>
                  )}
                </>
              )}
            </>
          )
        })}

        {/* Telegram */}
        {card({
          icon: <div className={`${styles.cardIconWrap} ${styles.tg}`}><Send size={18}/></div>,
          title: "Telegram",
          statusRender: () =>
            tg.loading ? <span className={styles.statusNeutral}>Checando…</span> :
            tg.connected ? <span className={styles.statusOk}><CheckCircle2 size={14}/> Conectado (prov.)</span> :
            <span className={styles.statusOff}>Não conectado (prov.)</span>,
          children: (
            <>
              {!tg.connected ? (
                <>
                  <p className={styles.cardDesc}>Conecte informando o Bot Token.</p>
                  <div className={styles.cardActions}>
                    <button className={styles.btnSecondary} onClick={goTelegram}>Conectar</button>
                  </div>
                </>
              ) : (
                <>
                  <div className={styles.connectedBlock}>
                    <div className={styles.kv}><span className={styles.k}>Bot</span><span className={styles.v}>{tg.username ? `@${tg.username}` : "—"}</span></div>
                    <div className={styles.kv}><span className={styles.k}>Bot ID</span><span className={`${styles.v} ${styles.mono}`}>{tg.botId || "—"}</span></div>
                  </div>

                  {bindings.telegram ? (
                    <div className={styles.bindRow}>
                      <span className={styles.boundChip}><CheckCircle2 size={14}/> Vinculado ao flow</span>
                      <button className={styles.btnGhost} onClick={()=>unbindChannel("telegram")}><UnlinkIcon size={14}/> Desvincular</button>
                    </div>
                  ) : (
                    <div className={styles.bindRow}>
                      <button className={styles.btnPrimary}
                              onClick={() => bindChannel("telegram", { id: tg.botId, meta: { username: tg.username } })}>
                        <LinkIcon size={14}/> Vincular ao Flow
                      </button>
                      <button className={styles.btnSecondary} onClick={goTelegram}>
                        Gerenciar no provedor
                      </button>
                    </div>
                  )}
                </>
              )}
            </>
          )
        })}
      </div>
    </div>
  );
}
