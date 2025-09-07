// File: src/pages/admin/monitoring/MiniChatDrawer.jsx
import React, { useEffect, useMemo, useRef, useState, useCallback } from "react";
import { X, MessageCircle, Clock, ExternalLink } from "lucide-react";
import { apiGet } from "../../../shared/apiClient";
import s from "./styles/MiniChatDrawer.module.css";

/**
 * MiniChatDrawer
 * - Preview somente-leitura da conversa (sem composer)
 * - Abre como painel lateral (right drawer)
 * - Busca mensagens do ticket e rola para o fim
 *
 * Props:
 *  - open: boolean
 *  - onClose: () => void
 *  - ticketId: string | number (ex: ticket_number)
 *  - cliente: string
 *  - canal: string (Whatsapp/Telegram/etc)
 */
export default function MiniChatDrawer({ open, onClose, ticketId, cliente, canal }) {
  const [loading, setLoading] = useState(false);
  const [ticket, setTicket] = useState(null);
  const [messages, setMessages] = useState([]);
  const viewportRef = useRef(null);

  const canShow = open && ticketId;

  const title = useMemo(() => {
    const t = `Ticket #${ticketId || "—"}`;
    return cliente ? `${t} — ${cliente}` : t;
  }, [ticketId, cliente]);

  // esc para fechar
  const onEsc = useCallback((e) => {
    if (e.key === "Escape") onClose?.();
  }, [onClose]);
  useEffect(() => {
    if (!canShow) return;
    window.addEventListener("keydown", onEsc);
    return () => window.removeEventListener("keydown", onEsc);
  }, [canShow, onEsc]);

  // scroll para o fim
  useEffect(() => {
    if (!canShow) return;
    const el = viewportRef.current;
    if (!el) return;
    // slight delay p/ DOM montar as bubbles
    const t = setTimeout(() => { el.scrollTop = el.scrollHeight; }, 50);
    return () => clearTimeout(t);
  }, [canShow, messages]);

  // carrega ticket + mensagens
  useEffect(() => {
    let mounted = true;
    async function load() {
      if (!canShow) return;
      setLoading(true);
      try {
        // Ajuste os endpoints abaixo se sua API for diferente:
        const [tkt, msgs] = await Promise.all([
          apiGet(`/tickets/${ticketId}`),               // detalhes do ticket
          apiGet(`/tickets/${ticketId}/messages`),      // mensagens do ticket
        ]);

        if (!mounted) return;
        setTicket(tkt || null);

        const arr = Array.isArray(msgs) ? msgs : (Array.isArray(msgs?.data) ? msgs.data : []);
        // normaliza campos esperados: { id, text, createdAt, fromMe | direction }
        const norm = arr.map((m) => {
          const fromMe = typeof m.fromMe === "boolean"
            ? m.fromMe
            : (m.direction ? String(m.direction).toLowerCase() === "out" : false);
          const text = m.text ?? m.body ?? m.message ?? "";
          const createdAt = m.createdAt ?? m.timestamp ?? m.date ?? Date.now();
          return {
            id: m.id ?? `${createdAt}-${Math.random().toString(36).slice(2,7)}`,
            fromMe,
            text: String(text),
            createdAt: createdAt,
          };
        });
        setMessages(norm);
      } catch (e) {
        console.error("Falha ao carregar conversa:", e);
        if (!mounted) {
          return;
        }
        setTicket(null);
        setMessages([]);
      } finally {
        if (mounted) setLoading(false);
      }
    }
    load();
    return () => { mounted = false; };
  }, [canShow, ticketId]);

  const createdAtFmt = (ts) => {
    try {
      const d = new Date(ts);
      if (Number.isNaN(d.getTime())) return "—";
      return d.toLocaleString("pt-BR", { hour: "2-digit", minute: "2-digit", day: "2-digit", month: "2-digit" });
    } catch {
      return "—";
    }
  };

  return (
    <>
      {/* overlay */}
      <div
        className={`${s.overlay} ${open ? s.open : ""}`}
        onMouseDown={(e) => { if (e.target === e.currentTarget) onClose?.(); }}
      />

      {/* drawer */}
      <aside className={`${s.drawer} ${open ? s.open : ""}`} aria-hidden={!open} aria-label="Mini chat">
        <header className={s.header}>
          <div className={s.hLeft}>
            <div className={s.hIcon}><MessageCircle size={16} /></div>
            <div className={s.hText}>
              <div className={s.hTitle}>{title}</div>
              <div className={s.hSub}>
                {canal ? `${canal} • ` : ""}{ticket?.status ? `Status: ${ticket.status}` : ""}
              </div>
            </div>
          </div>
          <div className={s.hRight}>
            {/* ir para página completa do histórico */}
            {!!ticketId && (
              <a className={s.fullBtn} href={`/admin/management/history/${ticketId}`} title="Abrir no histórico completo">
                <ExternalLink size={16} />
              </a>
            )}
            <button className={s.iconBtn} onClick={onClose} aria-label="Fechar mini chat"><X size={16} /></button>
          </div>
        </header>

        <div className={s.content}>
          {loading ? (
            <div className={s.loadingWrap}>
              <div className={s.spinner} />
              <div className={s.loadingTxt}>Carregando conversa…</div>
            </div>
          ) : messages.length === 0 ? (
            <div className={s.empty}>
              <MessageCircle size={18} />
              <div>Nenhuma mensagem neste ticket ainda.</div>
            </div>
          ) : (
            <div ref={viewportRef} className={s.viewport}>
              {messages.map((m) => (
                <div key={m.id} className={`${s.bubbleWrap} ${m.fromMe ? s.me : s.them}`}>
                  <div className={s.bubble}>
                    <div className={s.msg}>{m.text}</div>
                    <div className={s.meta}><Clock size={12} /> {createdAtFmt(m.createdAt)}</div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </aside>
    </>
  );
}
