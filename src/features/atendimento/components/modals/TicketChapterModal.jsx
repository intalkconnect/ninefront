import React, { useEffect, useMemo, useState, useCallback } from "react";
import { X } from "lucide-react";
import { apiGet } from "../../../../shared/apiClient";
import "./styles/TicketChapterModal.css";

/* ===== utils ===== */
function tsOf(m) {
  const t = m?.timestamp || m?.created_at || null;
  const n = t ? new Date(t).getTime() : NaN;
  return Number.isFinite(n) ? n : 0;
}
function sortAsc(a, b) { return tsOf(a) - tsOf(b); }
function msgText(m) {
  const c = m?.content;
  if (c == null) return "";
  if (typeof c === "string") {
    try { return msgText(JSON.parse(c)); } catch { return c.trim(); }
  }
  if (typeof c === "object") {
    return String(c.text || c.caption || c.body || c.filename || c.url || "").trim();
  }
  return String(c).trim();
}

/* ===== fetch exclusivo por ticket ===== */
async function fetchChapterMessagesByTicketId({ ticketId, messagesLimit = 2000 }) {
  const qs = new URLSearchParams({ include: "messages", messages_limit: String(messagesLimit) });
  const res = await apiGet(`/tickets/history/${encodeURIComponent(ticketId)}?${qs.toString()}`);
  const msgs = Array.isArray(res?.messages) ? res.messages : [];
  return msgs.sort(sortAsc);
}

/* ===== Modal ===== */
export default function TicketChapterModal({
  open,
  onClose,
  userId,          // mantido se precisar depois
  ticketId,        // usado no fetch
  ticketNumber,    // só título
}) {
  const [loading, setLoading] = useState(true);
  const [messages, setMessages] = useState([]);
  const [error, setError] = useState(null);

  const title = useMemo(() => `Capítulo • Ticket #${ticketNumber || "—"}`, [ticketNumber]);

  // reset sempre que trocar ticket
  useEffect(() => {
    setMessages([]);
    setError(null);
    setLoading(true);
  }, [ticketId]);

  const load = useCallback(async () => {
    if (!open || !ticketId) return;
    setLoading(true);
    setError(null);
    try {
      const msgs = await fetchChapterMessagesByTicketId({ ticketId });
      setMessages(msgs);
    } catch (e) {
      setError(e?.message || "Falha ao carregar capítulo");
    } finally {
      setLoading(false);
    }
  }, [open, ticketId]);

  useEffect(() => { load(); }, [load]);

  if (!open) return null;

  return (
    <div
      role="dialog"
      aria-modal="true"
      className="chapter-modal__backdrop"
      onClick={(e) => { if (e.target === e.currentTarget) onClose?.(); }}
    >
      <div className="chapter-modal__card">
        <div className="chapter-modal__header">
          <h3 className="chapter-modal__title">{title}</h3>
          <button onClick={onClose} className="chapter-modal__icon-btn" aria-label="Fechar">
            <X size={18} />
          </button>
        </div>

        <div className="chapter-modal__body">
          {loading && <div className="chapter-modal__center">Carregando capítulo…</div>}
          {error && <div className="chapter-modal__center chapter-modal__center--error">{error}</div>}
          {!loading && !error && messages.length === 0 && (
            <div className="chapter-modal__center">Nenhuma mensagem encontrada.</div>
          )}
          {!loading && !error && messages.length > 0 && (
            <div className="chapter-modal__list">
              {messages.map((m, i) => {
                const ts = new Date(tsOf(m)).toLocaleString('pt-BR');
                const who = m.direction === "outgoing" ? "Agente" :
                            (m.direction === "incoming" ? "Cliente" : "Sistema");
                return (
                  <div key={m.id || m.message_id || m.provider_id || i} className="chapter-modal__row">
                    <div className="chapter-modal__row-meta">
                      <span className="chapter-modal__pill">{who}</span>
                      <span className="chapter-modal__when">{ts}</span>
                    </div>
                    <div className="chapter-modal__text">{msgText(m) || "[mensagem]"}</div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        <div className="chapter-modal__footer">
          <div style={{ flex: 1 }} />
          <button onClick={onClose} className="chapter-modal__primary-btn">Fechar</button>
        </div>
      </div>
    </div>
  );
}
