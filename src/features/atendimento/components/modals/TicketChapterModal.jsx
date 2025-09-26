import React, { useEffect, useMemo, useRef, useState, useCallback } from "react";
import { X } from "lucide-react";
import { apiGet } from "../../../../shared/apiClient";
import "./styles/TicketChapterModal.css";

/* utils (tsOf, sortAsc, msgText) mantidos como no seu arquivo */
/* ... utils iguais ... */

async function fetchChapterMessages({ userId, ticketNumber, messagesInMemory, beforeTsRef, pageLimit = 100 }) {
  const local = (messagesInMemory || []).filter(m => String(m.ticket_number) === String(ticketNumber));
  if (local.length) return local.sort(sortAsc);

  try {
    const byApi = await apiGet(`/tickets/${encodeURIComponent(ticketNumber)}/messages?user_id=${encodeURIComponent(userId)}`);
    const payload = Array.isArray(byApi) ? byApi : byApi?.data;
    if (Array.isArray(payload) && payload.length) return payload.sort(sortAsc);
  } catch (_) {}

  let found = [];
  let keep = true;

  while (keep) {
    const qs = new URLSearchParams({ limit: String(pageLimit), sort: "desc" });
    if (beforeTsRef.current) qs.set("before_ts", String(beforeTsRef.current));

    const older = await apiGet(`/messages/${encodeURIComponent(userId)}?${qs.toString()}`);
    const arr = Array.isArray(older) ? older : (older?.data || []);
    if (!arr.length) break;

    const olderAsc = [...arr].reverse();
    beforeTsRef.current = olderAsc[0]?.timestamp || olderAsc[0]?.created_at || null;

    const chunk = olderAsc.filter(m => String(m.ticket_number) === String(ticketNumber));
    if (chunk.length) found = [...chunk, ...found];

    if (!beforeTsRef.current || olderAsc.length < pageLimit) keep = false;
  }

  return found.sort(sortAsc);
}

export default function TicketChapterModal({
  open,
  onClose,
  userId,
  ticketNumber,
  messagesInMemory = [],
}) {
  const [loading, setLoading] = useState(true);
  const [messages, setMessages] = useState([]);
  const [error, setError] = useState(null);
  const beforeTsRef = useRef(null);

  const title = useMemo(() => `Capítulo • Ticket #${ticketNumber}`, [ticketNumber]);

  useEffect(() => {
    beforeTsRef.current = null;
    setMessages([]);
    setError(null);
    setLoading(true);
  }, [userId, ticketNumber]);

  const load = useCallback(async () => {
    if (!open || !userId || !ticketNumber) return;
    setLoading(true);
    setError(null);
    try {
      const msgs = await fetchChapterMessages({
        userId, ticketNumber, messagesInMemory, beforeTsRef,
      });
      setMessages(msgs);
    } catch (e) {
      setError(e?.message || "Falha ao carregar capítulo");
    } finally {
      setLoading(false);
    }
  }, [open, userId, ticketNumber, messagesInMemory]);

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
