import React, { useEffect, useRef, useState, useCallback } from "react";
import { X, MessageCircle } from "lucide-react";
import { apiGet } from "../../../shared/apiClient";
// Reaproveita o MESMO renderer de mensagens do histórico
import ChatThread from "./ChatThread";
import s from "./styles/MiniChatDrawer.module.css";

export default function MiniChatDrawer({
  open,
  onClose,
  userId,                 // <-- chave para o /messages/:user_id
  cliente,
  canal,
}) {
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState(null);
  const [messages, setMessages] = useState([]);
  const viewportRef = useRef(null);

  const canShow = open && !!userId;

  // fecha com ESC
  const onEsc = useCallback((e) => { if (e.key === "Escape") onClose?.(); }, [onClose]);
  useEffect(() => {
    if (!canShow) return;
    window.addEventListener("keydown", onEsc);
    return () => window.removeEventListener("keydown", onEsc);
  }, [canShow, onEsc]);

  // helpers (mesmos do /history)
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

  // tenta /messages/:user_id (raw), e se vier 404 tenta base64url(user_id)
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
    try {
      const r2 = await apiGet(`/messages/${b64url(userId)}`);
      return Array.isArray(r2) ? r2 : (Array.isArray(r2?.data) ? r2.data : []);
    } catch (e2) {
      throw e2;
    }
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
            direction: dir,           // "incoming"/"outgoing"/"system"
            type,                     // "text", "image", "document", ...
            content,                  // objeto normalizado
            text,                     // usado pelo renderer para mensagens de texto
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

  // auto-scroll
  useEffect(() => {
    if (!canShow) return;
    const el = viewportRef.current;
    if (!el) return;
    const t = setTimeout(() => { el.scrollTop = el.scrollHeight; }, 60);
    return () => clearTimeout(t);
  }, [canShow, messages]);

  return (
    <>
      <div
        className={`${s.overlay} ${open ? s.open : ""}`}
        onMouseDown={(e) => { if (e.target === e.currentTarget) onClose?.(); }}
      />
      <aside className={`${s.drawer} ${open ? s.open : ""}`} aria-hidden={!open} aria-label="Mini chat (preview)">
        <header className={s.header}>
          <div className={s.hLeft}>
            <div className={s.hIcon}><MessageCircle size={16} /></div>
            <div className={s.hText}>
              <div className={s.hTitle}>{cliente || "Conversa"}</div>
              <div className={s.hSub}>{canal || "Pré-visualização"}</div>
            </div>
          </div>
          <div className={s.hRight}>
            <button className={s.iconBtn} onClick={onClose} aria-label="Fechar mini chat">
              <X size={16} />
            </button>
          </div>
        </header>

        <div className={s.content}>
          {!userId ? (
            <div className={s.empty}>Usuário não informado.</div>
          ) : loading ? (
            <div className={s.loadingWrap}>
              <div className={s.spinner} />
              <div className={s.loadingTxt}>Carregando conversa…</div>
            </div>
          ) : err ? (
            <div className={s.empty}>{err}</div>
          ) : messages.length === 0 ? (
            <div className={s.empty}>Sem histórico de mensagens.</div>
          ) : (
            <div ref={viewportRef} className={s.viewport}>
              <ChatThread messages={messages} />
            </div>
          )}
        </div>
      </aside>
    </>
  );
}
