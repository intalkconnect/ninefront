// File: src/pages/admin/monitoring/MiniChatDrawerThread.jsx
import React, { useEffect, useRef, useState, useCallback } from "react";
import { X, MessageCircle, ExternalLink } from "lucide-react";
import { apiGet } from "../../../shared/apiClient";
// ⬇️ caminho relativo para o MESMO ChatThread usado pelo TicketDetail
import ChatThread from "../atendimento/history/ChatThread";
import s from "./styles/MiniChatDrawer.module.css";

/**
 * MiniChatDrawerThread
 * - Drawer lateral (somente visualização) renderizando o MESMO ChatThread do histórico.
 * - Busca mensagens do ticket usando o mesmo endpoint do TicketDetail.
 *
 * Props:
 *  - open: boolean
 *  - onClose: () => void
 *  - ticketId: string | number  (use o mesmo identificador que o TicketDetail recebe em :id)
 *  - cliente?: string
 *  - canal?: string
 *  - historyUrlBase?: string  (default: "/admin/management/history")
 */
export default function MiniChatDrawerThread({
  open,
  onClose,
  ticketId,
  cliente,
  canal,
  historyUrlBase = "/admin/management/history",
}) {
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState(null);
  const [messages, setMessages] = useState([]);
  const viewportRef = useRef(null);

  const canShow = open && ticketId;

  // ESC fecha
  const onEsc = useCallback((e) => { if (e.key === "Escape") onClose?.(); }, [onClose]);
  useEffect(() => {
    if (!canShow) return;
    window.addEventListener("keydown", onEsc);
    return () => window.removeEventListener("keydown", onEsc);
  }, [canShow, onEsc]);

  // Carrega mensagens exatamente como o TicketDetail faz
  useEffect(() => {
    let alive = true;
    async function load() {
      if (!canShow) return;
      setLoading(true); setErr(null);
      try {
        // Mesmo endpoint do TicketDetail (ajuste se seu backend diferir)
        const res = await apiGet(`/tickets/history/${ticketId}?include=messages,attachments&messages_limit=500`);
        if (!alive) return;
        setMessages(Array.isArray(res?.messages) ? res.messages : []);
      } catch (e) {
        if (!alive) return;
        console.error("Falha ao carregar o ticket (mini):", e);
        setErr("Falha ao carregar a conversa.");
        setMessages([]);
      } finally {
        if (alive) setLoading(false);
      }
    }
    load();
    return () => { alive = false; };
  }, [canShow, ticketId]);

  // Auto-scroll para o fim ao trocar mensagens
  useEffect(() => {
    if (!canShow) return;
    const el = viewportRef.current;
    if (!el) return;
    const t = setTimeout(() => { el.scrollTop = el.scrollHeight; }, 60);
    return () => clearTimeout(t);
  }, [canShow, messages]);

  const fullHistoryHref = `${historyUrlBase}/${ticketId}`;

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
              <div className={s.hTitle}>{cliente || `Ticket #${ticketId}`}</div>
              <div className={s.hSub}>{canal || "Pré-visualização"}</div>
            </div>
          </div>
          <div className={s.hRight}>
            <a className={s.fullBtn} href={fullHistoryHref} title="Abrir no histórico completo">
              <ExternalLink size={16} />
            </a>
            <button className={s.iconBtn} onClick={onClose} aria-label="Fechar mini chat">
              <X size={16} />
            </button>
          </div>
        </header>

        <div className={s.content}>
          {loading ? (
            <div className={s.loadingWrap}>
              <div className={s.spinner} />
              <div className={s.loadingTxt}>Carregando conversa…</div>
            </div>
          ) : err ? (
            <div className={s.empty}>{err}</div>
          ) : (
            <div ref={viewportRef} className={s.viewport}>
              {/* ⬇️ Reaproveitando o MESMO ChatThread do TicketDetail */}
              <ChatThread messages={messages} />
            </div>
          )}
        </div>
      </aside>
    </>
  );
}
