import React, { useEffect, useMemo, useState } from "react";
import {
  ArrowLeft,
  CheckCircle2,
  MessageCircle,
  MessageSquareText as FbIcon,
  Instagram as IgIcon,
  Send,
  RefreshCw,
  PlugZap
} from "lucide-react";
import { useLocation, useNavigate, useParams } from "react-router-dom";
import { apiGet, apiPost } from "../../../shared/apiClient";
import { toast } from "react-toastify";

/* ===== helpers ===== */
function getTenantFromHost() {
  if (typeof window === "undefined") return "";
  const host = window.location.hostname;
  const parts = host.split(".");
  if (parts.length >= 3) return parts[0] === "www" ? parts[1] : parts[0];
  return parts[0] || "";
}
function formatPhone(p) {
  const raw =
    typeof p === "string"
      ? p
      : (p && (p.display_phone_number || p.phone_number || p.number)) || "";
  const digits = (raw || "").replace(/[^\d+]/g, "");
  if (!digits) return "—";
  if (digits.startsWith("+")) return digits;
  return `+${digits}`;
}

/* ===== layout (inline) ===== */
const S = {
  page: { padding: 16, minHeight: "100vh", background: "#f9fafb" },
  header: {
    background: "#fff",
    border: "1px solid #e2e8f0",
    borderRadius: 12,
    padding: 14,
    marginBottom: 16,
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    boxShadow: "0 6px 20px rgba(15, 23, 42, 0.08)",
  },
  titleRow: { display: "flex", alignItems: "center", gap: 10 },
  grid: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fill, minmax(320px, 1fr))",
    gap: 14,
  },
  card: {
    background: "#fff",
    border: "1px solid #e2e8f0",
    borderRadius: 12,
    padding: 14,
    boxShadow: "0 6px 20px rgba(15, 23, 42, 0.08)",
  },
  head: { display: "flex", alignItems: "center", gap: 10, marginBottom: 8 },
  chipOk: {
    display: "inline-flex",
    alignItems: "center",
    gap: 6,
    fontSize: 12,
    color: "#16a34a",
  },
  chipOff: { fontSize: 12, color: "#64748b" },
  kv: {
    display: "grid",
    gridTemplateColumns: "120px 1fr",
    fontSize: 13,
    gap: 6,
    padding: "4px 0",
  },
  k: { color: "#475569" },
  v: {
    color: "#0f172a",
    fontFamily: "ui-monospace, SFMono-Regular, Menlo, monospace",
  },
  actions: { display: "flex", gap: 8, marginTop: 10 },
  btn: {
    border: "1px solid #e2e8f0",
    background: "#fff",
    padding: "8px 10px",
    borderRadius: 8,
    fontWeight: 700,
    cursor: "pointer",
  },
  btnPrimary: {
    background: "#2563eb",
    color: "#fff",
    padding: "8px 10px",
    border: "none",
    borderRadius: 8,
    fontWeight: 700,
    cursor: "pointer",
  },
  subtle: { fontSize: 12, color: "#64748b" },
};

export default function FlowChannels() {
  const { flowId } = useParams();
  const navigate = useNavigate();
  const location = useLocation();
  const tenant = useMemo(() => getTenantFromHost(), []);

  // status de provedores (conexão global) + bindings do flow
  const [loading, setLoading] = useState(true);
  const [wa, setWa] = useState({
    loading: true,
    connected: false,
    id: "",
    phone: null,
  });
  const [fb, setFb] = useState({
    loading: true,
    connected: false,
    pageId: "",
    pageName: "",
  });
  const [ig, setIg] = useState({
    loading: true,
    connected: false,
    pageId: "",
    pageName: "",
    igUserId: "",
    igUsername: "",
  });
  const [tg, setTg] = useState({
    loading: true,
    connected: false,
    botId: "",
    username: "",
    webhookUrl: "",
  });

  const [bindings, setBindings] = useState([]); // [{channel_type, channel_id, meta}]

  const backTo = location.state?.from || -1;

  async function loadAll() {
    setLoading(true);
    try {
      // bindings do flow (já vinculados)
      // (não precisa de tenant; amarrado ao flowId)
      const b = await apiGet(`/flows/${flowId}/channels`);
      setBindings(Array.isArray(b) ? b : []);

      // WhatsApp (com tenant)
      try {
        const ws = await apiGet(`/whatsapp/number?subdomain=${tenant}`);
        if (ws && ws.ok && ws.phone) {
          setWa({
            loading: false,
            connected: true,
            id: ws.phone.id || "",
            phone: ws.phone,
          });
        } else {
          setWa({ loading: false, connected: false, id: "", phone: null });
        }
      } catch {
        setWa({ loading: false, connected: false, id: "", phone: null });
        toast.error("Não foi possível obter o status do WhatsApp.");
      }

      // Telegram (com tenant)
      try {
        const ts = await apiGet(`/telegram/status?subdomain=${tenant}`);
        if (ts && ts.ok) {
          setTg({
            loading: false,
            connected: !!ts.connected,
            botId: ts.bot_id || "",
            username: ts.username || "",
            webhookUrl: ts.webhook_url || "",
          });
        } else {
          setTg({ loading: false, connected: false, botId: "", username: "", webhookUrl: "" });
        }
      } catch {
        setTg({ loading: false, connected: false, botId: "", username: "", webhookUrl: "" });
        toast.error("Não foi possível obter o status do Telegram.");
      }

      // Facebook (com tenant)
      try {
        const fs = await apiGet(`/facebook/status?subdomain=${tenant}`);
        if (fs && fs.ok) {
          setFb({
            loading: false,
            connected: !!fs.connected,
            pageId: fs.page_id || "",
            pageName: fs.page_name || "",
          });
        } else {
          setFb({ loading: false, connected: false, pageId: "", pageName: "" });
        }
      } catch {
        setFb({ loading: false, connected: false, pageId: "", pageName: "" });
        toast.error("Não foi possível obter o status do Facebook.");
      }

      // Instagram (com tenant)
      try {
        const is = await apiGet(`/instagram/status?subdomain=${tenant}`);
        if (is && is.ok) {
          setIg({
            loading: false,
            connected: !!is.connected,
            pageId: is.page_id || "",
            pageName: is.page_name || "",
            igUserId: is.ig_user_id || "",
            igUsername: is.ig_username || "",
          });
        } else {
          setIg({
            loading: false,
            connected: false,
            pageId: "",
            pageName: "",
            igUserId: "",
            igUsername: "",
          });
        }
      } catch {
        setIg({
          loading: false,
          connected: false,
          pageId: "",
          pageName: "",
          igUserId: "",
          igUsername: "",
        });
        toast.error("Não foi possível obter o status do Instagram.");
      }
    } catch (e) {
      console.error(e);
      toast.error("Falha ao carregar canais do flow.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadAll();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [flowId, tenant]);

  const isBound = (type) =>
    bindings.some((b) => (b.channel_type || "").toLowerCase() === type);

  /* ===== postMessage OAuth (FB/IG) — igual ao Channels original ===== */
  useEffect(() => {
    const AUTH_ORIGIN = import.meta.env.VITE_EMBED_ORIGIN; // ex.: https://auth.seudominio.com
    function onMsg(e) {
      if (!AUTH_ORIGIN || e.origin !== AUTH_ORIGIN) return;
      const data = e.data || {};
      const type = data.type;

      // Facebook
      if (type === "fb:oauth") {
        const { code, state } = data;
        let ctx = {};
        try { ctx = state ? JSON.parse(atob(state)) : {}; } catch {}
        const redirect_uri = ctx?.redirectUri;
        const sub = ctx?.tenant || tenant;

        toast.loading("Conectando Facebook…", { toastId: "fb-connecting" });
        apiPost("/facebook/finalize", { subdomain: sub, code, redirect_uri })
          .then(async (res) => {
            if (res?.ok && res?.step === "pages_list") {
              const pages = Array.isArray(res.pages) ? res.pages : [];
              if (!pages.length) throw new Error("Nenhuma Página disponível nesta conta.");
              const pick = pages[0];
              const r2 = await apiPost("/facebook/finalize", {
                subdomain: sub,
                redirect_uri,
                page_id: pick.id,
                user_token: res.user_token,
                persist_token: true,
              });
              if (r2?.ok && r2?.connected) {
                setFb((s) => ({
                  ...s,
                  connected: true,
                  loading: false,
                  pageId: r2.page_id || s.pageId,
                  pageName: r2.page_name || s.pageName,
                }));
                toast.update("fb-connecting", {
                  render: "Facebook conectado.",
                  type: "success",
                  isLoading: false,
                  autoClose: 2500,
                });
                return;
              }
              throw new Error(r2?.error || "Falha ao concluir conexão do Facebook");
            }
            if (res?.ok && res?.connected) {
              setFb((s) => ({
                ...s,
                connected: true,
                loading: false,
                pageId: res.page_id || s.pageId,
                pageName: res.page_name || s.pageName,
              }));
              toast.update("fb-connecting", {
                render: "Facebook conectado.",
                type: "success",
                isLoading: false,
                autoClose: 2500,
              });
              return;
            }
            throw new Error(res?.error || "Falha ao conectar Facebook");
          })
          .catch((err) => {
            toast.update("fb-connecting", {
              render: err?.message || "Falha ao conectar Facebook",
              type: "error",
              isLoading: false,
              autoClose: 4000,
            });
          });
      }

      // Instagram
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
              const pick = res.pages.find((p) => p.has_instagram) || res.pages[0];
              if (!pick) throw new Error("Nenhuma Página disponível");
              const res2 = await apiPost("/instagram/finalize", {
                subdomain: sub,
                redirect_uri,
                page_id: pick.id,
                user_token: res.user_token,
              });
              if (res2?.ok) {
                setIg((s) => ({
                  ...s,
                  connected: true,
                  loading: false,
                  pageId: res2.page_id || s.pageId,
                  pageName: res2.page_name || s.pageName,
                  igUserId: res2.ig_user_id || s.igUserId,
                  igUsername: res2.ig_username || s.igUsername,
                }));
                toast.update("ig-connecting", {
                  render: "Instagram conectado.",
                  type: "success",
                  isLoading: false,
                  autoClose: 2500,
                });
              } else {
                throw new Error(res2?.error || "Falha ao concluir Instagram");
              }
            } else if (res?.ok && res?.connected) {
              setIg((s) => ({
                ...s,
                connected: true,
                loading: false,
                pageId: res.page_id || s.pageId,
                pageName: res.page_name || s.pageName,
                igUserId: res.ig_user_id || s.igUserId,
                igUsername: res.ig_username || s.igUsername,
              }));
              toast.update("ig-connecting", {
                render: "Instagram conectado.",
                type: "success",
                isLoading: false,
                autoClose: 2500,
              });
            } else {
              throw new Error(res?.error || "Falha ao conectar Instagram");
            }
          })
          .catch((err) => {
            toast.update("ig-connecting", {
              render: err?.message || "Falha ao conectar Instagram",
              type: "error",
              isLoading: false,
              autoClose: 4000,
            });
          });
      }
    }
    window.addEventListener("message", onMsg);
    return () => window.removeEventListener("message", onMsg);
  }, [tenant]);

  const waDisplay = formatPhone(wa.phone);

  return (
    <div style={S.page}>
      <div style={S.header}>
        <div style={S.titleRow}>
          <button
            onClick={() => navigate(-1)}
            style={{ ...S.btn, display: "inline-flex", alignItems: "center", gap: 6 }}
            title="Voltar"
          >
            <ArrowLeft size={14} /> Voltar
          </button>
          <div style={{ fontWeight: 800 }}>Canais do Flow</div>
          <div style={{ fontSize: 12, color: "#475569" }}>
            flow: <b>{flowId}</b>
          </div>
          <div style={{ fontSize: 12, color: "#475569" }}>
            <span style={S.subtle}>tenant:</span> <b>{tenant || "—"}</b>
          </div>
        </div>
        <button
          onClick={loadAll}
          style={{ ...S.btn, display: "inline-flex", alignItems: "center", gap: 6 }}
        >
          <RefreshCw size={14} /> Recarregar
        </button>
      </div>

      {loading ? (
        <div style={{ color: "#475569" }}>Carregando…</div>
      ) : (
        <div style={S.grid}>
          {/* WhatsApp */}
          <div style={S.card}>
            <div style={S.head}>
              <div style={iconWrapStyle("#22c55e")}>
                <MessageCircle size={18} />
              </div>
              <div style={{ fontWeight: 700 }}>WhatsApp</div>
              <div style={{ marginLeft: "auto" }}>
                {wa.loading ? (
                  <span style={S.chipOff}>Checando…</span>
                ) : wa.connected ? (
                  isBound("whatsapp") ? (
                    <span style={S.chipOk}>
                      <CheckCircle2 size={14} /> Conectado • Vinculado
                    </span>
                  ) : (
                    <span style={S.chipOk}>
                      <CheckCircle2 size={14} /> Conectado
                    </span>
                  )
                ) : (
                  <span style={S.chipOff}>Não conectado</span>
                )}
              </div>
            </div>

            <div>
              <Row k="Número WABA" v={waDisplay || "—"} mono={false} />
              <Row k="Phone ID" v={wa.id || "—"} mono />
            </div>

            {/* Ação única, limpa — igual ao Channels original */}
            <div style={S.actions}>
              {!wa.connected ? (
                <ConnectWhatsApp tenant={tenant} />
              ) : (
                <button
                  style={S.btn}
                  onClick={() =>
                    navigate("/channels/whatsapp", {
                      state: { returnTo: backTo },
                    })
                  }
                >
                  Perfil
                </button>
              )}
            </div>
          </div>

          {/* Facebook */}
          <div style={S.card}>
            <div style={S.head}>
              <div style={iconWrapStyle("#3b82f6")}>
                <FbIcon size={18} />
              </div>
              <div style={{ fontWeight: 700 }}>Facebook Messenger</div>
              <div style={{ marginLeft: "auto" }}>
                {fb.loading ? (
                  <span style={S.chipOff}>Checando…</span>
                ) : fb.connected ? (
                  isBound("facebook") ? (
                    <span style={S.chipOk}>
                      <CheckCircle2 size={14} /> Conectado • Vinculado
                    </span>
                  ) : (
                    <span style={S.chipOk}>
                      <CheckCircle2 size={14} /> Conectado
                    </span>
                  )
                ) : (
                  <span style={S.chipOff}>Não conectado</span>
                )}
              </div>
            </div>

            <div>
              <Row k="Página" v={fb.pageName || fb.pageId || "—"} mono={false} />
              <Row k="Page ID" v={fb.pageId || "—"} mono />
            </div>

            <div style={S.actions}>
              {!fb.connected ? (
                <ConnectFacebook tenant={tenant} />
              ) : (
                <span style={S.subtle}>
                  Conectado via OAuth. Para alterar, refaça a conexão.
                </span>
              )}
            </div>
          </div>

          {/* Instagram */}
          <div style={S.card}>
            <div style={S.head}>
              <div style={iconWrapStyle("#ef4444")}>
                <IgIcon size={18} />
              </div>
              <div style={{ fontWeight: 700 }}>Instagram</div>
              <div style={{ marginLeft: "auto" }}>
                {ig.loading ? (
                  <span style={S.chipOff}>Checando…</span>
                ) : ig.connected ? (
                  isBound("instagram") ? (
                    <span style={S.chipOk}>
                      <CheckCircle2 size={14} /> Conectado • Vinculado
                    </span>
                  ) : (
                    <span style={S.chipOk}>
                      <CheckCircle2 size={14} /> Conectado
                    </span>
                  )
                ) : (
                  <span style={S.chipOff}>Não conectado</span>
                )}
              </div>
            </div>

            <div>
              <Row k="IG" v={ig.igUsername || ig.igUserId || "—"} mono={false} />
              <Row k="Página" v={ig.pageName || ig.pageId || "—"} mono={false} />
              <Row k="IG User ID" v={ig.igUserId || "—"} mono />
            </div>

            <div style={S.actions}>
              {!ig.connected ? (
                <ConnectInstagram tenant={tenant} />
              ) : (
                <span style={S.subtle}>
                  Conectado via OAuth. Para alterar, refaça a conexão.
                </span>
              )}
            </div>
          </div>

          {/* Telegram */}
          <div style={S.card}>
            <div style={S.head}>
              <div style={iconWrapStyle("#0ea5e9")}>
                <Send size={18} />
              </div>
              <div style={{ fontWeight: 700 }}>Telegram</div>
              <div style={{ marginLeft: "auto" }}>
                {tg.loading ? (
                  <span style={S.chipOff}>Checando…</span>
                ) : tg.connected ? (
                  isBound("telegram") ? (
                    <span style={S.chipOk}>
                      <CheckCircle2 size={14} /> Conectado • Vinculado
                    </span>
                  ) : (
                    <span style={S.chipOk}>
                      <CheckCircle2 size={14} /> Conectado
                    </span>
                  )
                ) : (
                  <span style={S.chipOff}>Não conectado</span>
                )}
              </div>
            </div>

            <div>
              <Row k="Bot" v={tg.username ? `@${tg.username}` : "—"} mono={false} />
              <Row k="Bot ID" v={tg.botId || "—"} mono />
            </div>

            <div style={S.actions}>
              {!tg.connected ? (
                <button
                  style={S.btn}
                  onClick={() =>
                    navigate("/channels/telegram", {
                      state: { returnTo: backTo },
                    })
                  }
                >
                  Conectar (Token)
                </button>
              ) : (
                <button
                  style={S.btn}
                  onClick={() =>
                    navigate("/channels/telegram", {
                      state: { returnTo: backTo },
                    })
                  }
                >
                  Gerenciar
                </button>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

/* ===== componentes auxiliares ===== */

function ConnectWhatsApp({ tenant }) {
  // botão simples + dica (como no Channels original)
  return (
    <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
      <MetaEmbeddedSignupButton tenant={tenant} label="Conectar" />
      <span style={{ ...S.subtle, display: "inline-flex", gap: 6, alignItems: "center" }}>
        <PlugZap size={14} /> Login em janela segura.
      </span>
    </div>
  );
}

function ConnectFacebook({ tenant }) {
  return <FacebookConnectButton tenant={tenant} label="Conectar Facebook" />;
}

function ConnectInstagram({ tenant }) {
  return <InstagramConnectButton tenant={tenant} label="Conectar Instagram" />;
}

function Row({ k, v, mono }) {
  return (
    <div style={S.kv}>
      <div style={S.k}>{k}</div>
      <div style={{ ...S.v, ...(mono ? {} : { fontFamily: "inherit" }) }}>
        {v}
      </div>
    </div>
  );
}

function iconWrapStyle(color) {
  return {
    width: 28,
    height: 28,
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 8,
    background: "#fff",
    border: "1px solid #e2e8f0",
    color,
  };
}

/* ===== Botões “conectar” (usam os existentes do seu projeto) ===== */
// IMPORTANTE: estes imports devem existir no seu projeto.
// Se os caminhos diferirem, ajuste-os aqui.
import WhatsAppEmbeddedSignupButton from "../components/WhatsAppEmbeddedSignupButton";
import FacebookConnectButton from "../components/FacebookConnectButton";
import InstagramConnectButton from "../components/InstagramConnectButton";
