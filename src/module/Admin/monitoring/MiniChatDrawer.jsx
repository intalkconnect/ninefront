// File: src/pages/admin/monitoring/MiniChatDrawer.jsx
import React, { useEffect, useRef, useState, useCallback } from "react";
import { X, MessageCircle, Minimize2, Maximize2, Phone, Video } from "lucide-react";
import { apiGet } from "../../../shared/apiClient";
import ChatThread from "../atendimento/history/ChatThread";
import s from "./styles/MiniChatDrawer.module.css";

/**
 * MiniChat Melhorado
 * - Preview somente-leitura com design moderno
 * - variant: "drawer" | "webchat" (default: "webchat")
 * - Suporte a minimização e indicadores de status
 */
export default function MiniChatDrawer({
  open,
  onClose,
  userId,
  cliente,
  canal,
  variant = "webchat",
  agentOnline = false,
  lastSeen,
}) {
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState(null);
  const [messages, setMessages] = useState([]);
  const [isMinimized, setIsMinimized] = useState(false);
  const viewportRef = useRef(null);

  const canShow = open && !!userId;

  // Função para determinar avatar baseado no nome
  const getAvatarText = (name) => {
    if (!name) return "C";
    const words = name.trim().split(" ");
    if (words.length >= 2) {
      return (words[0][0] + words[1][0]).toUpperCase();
    }
    return name.slice(0, 2).toUpperCase();
  };

  // Função para formatar último acesso
  const formatLastSeen = (timestamp) => {
    if (!timestamp) return null;
    const now = new Date();
    const lastSeenDate = new Date(timestamp);
    const diffMs = now - lastSeenDate;
    const diffMins = Math.floor(diffMs / 60000);
    
    if (diffMins < 1) return "Online agora";
    if (diffMins < 60) return `Visto há ${diffMins} min`;
    if (diffMins < 1440) return `Visto há ${Math.floor(diffMins / 60)}h`;
    return `Visto há ${Math.floor(diffMins / 1440)} dias`;
  };

  const onEsc = useCallback((e) => { 
    if (e.key === "Escape") onClose?.(); 
  }, [onClose]);

  useEffect(() => {
    if (!canShow) return;
    window.addEventListener("keydown", onEsc);
    return () => window.removeEventListener("keydown", onEsc);
  }, [canShow, onEsc]);

  // helpers de normalização (mantidos do original)
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
    // 2) base64url(user_id) se seu backend decode()
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
    if (!canShow || isMinimized) return;
    const el = viewportRef.current;
    if (!el) return;
    const t = setTimeout(() => { el.scrollTop = el.scrollHeight; }, 60);
    return () => clearTimeout(t);
  }, [canShow, messages, isMinimized]);

  const classes = [
    s.container,
    variant === "drawer" ? s.isDrawer : s.isWidget,
    open ? s.open : "",
    isMinimized ? s.minimized : ""
  ].join(" ");

  const renderContent = () => {
    if (!userId) {
      return (
        <div className={s.state}>
          <span>Usuário não informado.</span>
        </div>
      );
    }

    if (loading) {
      return (
        <div className={s.state}>
          <div className={s.spinner} />
          <span>Carregando conversa…</span>
        </div>
      );
    }

    if (err) {
      return (
        <div className={s.state}>
          <span>⚠️</span>
          <span>{err}</span>
        </div>
      );
    }

    if (messages.length === 0) {
      return (
        <div className={s.state}>
          <span>Sem histórico de mensagens.</span>
          <small>Inicie uma conversa para ver as mensagens aqui</small>
        </div>
      );
    }

    return (
      <div ref={viewportRef} className={s.viewport}>
        <ChatThread messages={messages} />
      </div>
    );
  };

  return (
    <>
      <div
        className={`${s.backdrop} ${open ? s.open : ""}`}
        onMouseDown={(e) => { if (e.target === e.currentTarget) onClose?.(); }}
      />
      
      <aside 
        className={classes} 
        aria-hidden={!open} 
        aria-label="Mini chat (preview)"
      >
        <header className={s.header}>
          <div className={s.hLeft}>
            <div className={s.avatar}>
              {getAvatarText(cliente)}
              {agentOnline && <div className={s.statusIndicator} />}
              {!agentOnline && lastSeen && <div className={`${s.statusIndicator} ${s.offline}`} />}
            </div>
            <div className={s.hText}>
              <div className={s.hTitle}>{cliente || "Conversa"}</div>
              <div className={s.hSub}>
                <span className={s.badge}>
                  <MessageCircle size={12} /> 
                  {canal || "Canal"}
                </span>
                {!agentOnline && lastSeen && (
                  <span className={s.lastSeen}>
                    {formatLastSeen(lastSeen)}
                  </span>
                )}
                {agentOnline && (
                  <span className={s.onlineStatus}>
                    Online
                  </span>
                )}
              </div>
            </div>
          </div>
          
          <div className={s.hRight}>
            {/* Botões de ação adiccionais */}
            <button 
              className={s.iconBtn} 
              onClick={() => {/* ação de chamada */}}
              aria-label="Iniciar chamada"
              title="Iniciar chamada"
            >
              <Phone size={14} />
            </button>
            
            <button 
              className={s.iconBtn} 
              onClick={() => {/* ação de vídeo */}}
              aria-label="Iniciar videochamada"
              title="Iniciar videochamada"
            >
              <Video size={14} />
            </button>
            
            <button 
              className={s.iconBtn} 
              onClick={() => setIsMinimized(!isMinimized)}
              aria-label={isMinimized ? "Maximizar" : "Minimizar"}
              title={isMinimized ? "Maximizar" : "Minimizar"}
            >
              {isMinimized ? <Maximize2 size={14} /> : <Minimize2 size={14} />}
            </button>
            
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

        {!isMinimized && (
          <div className={s.body}>
            {renderContent()}
          </div>
        )}
      </aside>
    </>
  );
}
