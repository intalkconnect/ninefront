// File: src/pages/admin/monitoring/MiniChatDrawer.jsx
import React, { useEffect, useRef, useState, useCallback } from "react";
import { X, MessageCircle } from "lucide-react";
import { apiGet } from "../../../../shared/apiClient";
import ChatThread from "../../atendimento/history/ChatThread";
import s from "./styles/MiniChatDrawer.module.css";

/**
 * MiniChat – preview somente-leitura
 * - variant: "drawer" | "webchat" (default: "webchat")
 * - Skeleton cobre o webchat inteiro (header + corpo)
 */
export default function MiniChatDrawer({
  open,
  onClose,
  userId,
  cliente,
  canal,
  variant = "webchat",
}) {
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState(null);
  const [messages, setMessages] = useState([]);

  // Evita "flash" do skeleton em loads muito rápidos
  const [showSkel, setShowSkel] = useState(false);

  const viewportRef = useRef(null);
  const drawerRef = useRef(null);

  const canShow = open && !!userId;

  const getAvatarText = (name) => {
    if (!name) return "C";
    const words = name.trim().split(" ");
    if (words.length >= 2) return (words[0][0] + words[1][0]).toUpperCase();
    return name.slice(0, 2).toUpperCase();
  };

  const onEsc = useCallback((e) => { if (e.key === "Escape") onClose?.(); }, [onClose]);

  const handleClickOutside = useCallback((e) => {
    if (drawerRef.current && !drawerRef.current.contains(e.target)) onClose?.();
  }, [onClose]);

  useEffect(() => {
    if (!canShow) return;
    window.addEventListener("keydown", onEsc);
    document.addEventListener("mousedown", handleClickOutside);
    return () => {
      window.removeEventListener("keydown", onEsc);
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [canShow, onEsc, handleClickOutside]);

  // ===== normalização (igual ao histórico) =====
  const safeParse = (raw) => {
    if (raw == null) return null;
    if (typeof raw === "object") return raw;
    const s = String(raw);
    try { return JSON.parse(s); } catch {
      if (/^https?:\/\//i.test(s)) return { url: s };
      return s;
    }
  };

  const mergeContent = (rawContent, meta, type) => {
    const c = safeParse(rawContent);
    const out =
      (c && typeof c === "object" && !Array.isArray(c)) ? { ...c } :
      (typeof c === "string" ? { text: c } : {});
    const m = meta || {};
    out.url       ??= m.url || m.file_url || m.download_url || m.signed_url || m.public_url || null;
    out.filename  ??= m.filename || m.name || null;
    out.mime_type ??= m.mime || m.mimetype || m.content_type || null;
    out.caption   ??= m.caption || null;
    out.voice     ??= m.voice || (String(type).toLowerCase() === "audio" ? true : undefined);
    out.size      ??= m.size || m.filesize || null;
    out.width     ??= m.width || null;
    out.height    ??= m.height || null;
    out.duration  ??= m.duration || m.audio_duration || null;
    return out;
  };

  const deriveStatus = (row) => {
    if (row.read_at) return "read";
    if (row.delivered_at) return "delivered";
    const dir = String(row.direction || "").toLowerCase();
    return dir === "outgoing" ? "sent" : "received";
  };

  const b64url = (s) => {
    try {
      return btoa(unescape(encodeURIComponent(String(s))))
        .replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
    } catch { return String(s); }
  };

  const is404 = (e) => {
    const st = e?.status ?? e?.response?.status;
    return st === 404 || /\b404\b/.test(String(e?.message || e || ""));
  };

  const fetchMessages = async () => {
    // 1) raw user_id
    try {
      const r = await apiGet(`/messages/${encodeURIComponent(userId)}`);
      return Array.isArray(r) ? r : (Array.isArray(r?.data) ? r.data : []);
    } catch (e) {
      if (!is404(e)) throw e;
    }
    // 2) base64url(user_id)
    const r2 = await apiGet(`/messages/${b64url(userId)}`);
    return Array.isArray(r2) ? r2 : (Array.isArray(r2?.data) ? r2.data : []);
  };

  useEffect(() => {
    let alive = true;
    async function load() {
      if (!canShow) return;
      setLoading(true); setErr(null);
      try {
        const rows = await fetchMessages();
        const normalized = rows.map((m) => {
          const dir = String(m.direction || "").toLowerCase();
          const type = String(m.type || "").toLowerCase();
          const content = mergeContent(m.content, m.metadata, type);
          const text =
            typeof content === "string" ? content :
            (content.text || content.body || content.caption || null);
          return {
            id: m.id ?? `${m.timestamp ?? Date.now()}-${Math.random().toString(36).slice(2,7)}`,
            direction: dir,
            type,
            content,
            text,
            timestamp: m.timestamp,
            created_at: m.timestamp,
            channel: m.channel,
            message_id: m.message_id,
            ticket_number: m.ticket_number,
            from_agent: dir === "outgoing" || dir === "system",
            sender_name: dir === "outgoing" ? (m.assigned_to || "Atendente")
                      : (dir === "system" ? "Sistema" : null),
            delivered_at: m.delivered_at,
            read_at: m.read_at,
            status: deriveStatus(m),
            metadata: m.metadata || null,
            reply_to: m.reply_to || m.metadata?.context?.message_id || null,
            context: m.metadata?.context || null,
          };
        });
        if (alive) setMessages(normalized);
      } catch (e) {
        console.error("MiniChat – erro ao buscar mensagens:", e);
        if (alive) { setErr("Falha ao carregar as mensagens."); setMessages([]); }
      } finally {
        if (alive) setLoading(false);
      }
    }
    load();
    return () => { alive = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [canShow, userId]);

  useEffect(() => {
    if (!canShow) return;
    const el = viewportRef.current;
    if (!el) return;
    const t = setTimeout(() => { el.scrollTop = el.scrollHeight; }, 60);
    return () => clearTimeout(t);
  }, [canShow, messages]);

  useEffect(() => {
    let t;
    if (loading) t = setTimeout(() => setShowSkel(true), 120);
    else setShowSkel(false);
    return () => clearTimeout(t);
  }, [loading]);

  const classes = [
    s.container,
    variant === "drawer" ? s.isDrawer : s.isWidget,
    open ? s.open : ""
  ].join(" ");

  const ready = !!userId && !loading && !err;
  const useSkeleton = !!userId && showSkel;

  return (
    <>
      {open && variant === "webchat" && <div className={s.backdrop} onClick={onClose} />}

      <aside
        ref={drawerRef}
        className={classes}
        aria-hidden={!open}
        aria-label="Mini chat (preview)"
      >
        {/* TUDO que é “real” (header+corpo) fica aqui dentro e some enquanto carrega */}
        <div className={`${s.contentWrap} ${useSkeleton ? s.contentHidden : s.contentVisible}`}>
          <header className={s.header}>
            <div className={s.hLeft}>
              <div className={s.avatar}>{getAvatarText(cliente)}</div>
              <div className={s.hText}>
                <div className={s.hTitle}>{cliente || "Conversa"}</div>
                <div className={s.hSub}>
                  <span className={s.badge}>
                    <MessageCircle size={11} /> {canal || "Canal"}
                  </span>
                </div>
              </div>
            </div>
            <div className={s.hRight}>
              <button
                className={s.iconBtn}
                onClick={onClose}
                aria-label="Fechar mini chat"
                title="Fechar"
              >
                <X size={14} />
              </button>
            </div>
          </header>

          <div className={s.body}>
            <div
              ref={viewportRef}
              className={s.viewport}
            >
              {ready ? (
                messages.length > 0 ? (
                  <ChatThread messages={messages} />
                ) : (
                  <div className={s.state}>Sem histórico de mensagens.</div>
                )
              ) : !userId ? (
                <div className={s.state}>Usuário não informado.</div>
              ) : err ? (
                <div className={s.state}>{err}</div>
              ) : null}
            </div>
          </div>
        </div>

        {/* OVERLAY de skeleton cobrindo o WEBCHAT INTEIRO */}
        {useSkeleton && (
          <div className={s.overlayShellFull} aria-hidden="true">
            <WebchatSkeleton />
          </div>
        )}
      </aside>
    </>
  );
}

/* Skeleton cobrindo header + corpo */
function WebchatSkeleton() {
  return (
    <div className={s.skelRoot}>
      {/* Header fake */}
      <div className={s.skelHeader}>
        <div className={s.skelHLeft}>
          <div className={s.skelHAvatar} />
          <div className={s.skelHText}>
            <div className={s.skelHLine} />
            <div className={`${s.skelHLine} ${s.skelHLineSmall}`} />
          </div>
        </div>
        <div className={s.skelHBtn} />
      </div>

      {/* Corpo fake (bolhas) */}
      <div className={s.skelViewport}>
        <div className={`${s.skelMsg} ${s.skelLeft}`}>
          <div className={s.skelAvatar} />
          <div className={s.skelBubble}>
            <div className={`${s.skelLine} ${s.skelW80}`} />
            <div className={`${s.skelLine} ${s.skelW55}`} />
          </div>
        </div>

        <div className={`${s.skelMsg} ${s.skelRight}`}>
          <div className={s.skelBubble}>
            <div className={`${s.skelLine} ${s.skelW65}`} />
          </div>
          <div className={s.skelAvatar} />
        </div>

        <div className={`${s.skelMsg} ${s.skelLeft}`}>
          <div className={s.skelAvatar} />
          <div>
            <div className={s.skelMedia} />
            <div style={{ height: 8 }} />
            <div className={`${s.skelLine} ${s.skelW40}`} />
          </div>
        </div>

        <div className={`${s.skelMsg} ${s.skelRight}`}>
          <div className={s.skelBubble}>
            <div className={`${s.skelLine} ${s.skelW90}`} />
            <div className={`${s.skelLine} ${s.skelW65}`} />
          </div>
          <div className={s.skelAvatar} />
        </div>
      </div>
    </div>
  );
}
