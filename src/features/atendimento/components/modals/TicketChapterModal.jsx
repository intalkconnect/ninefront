// src/app/features/chat/components/modals/TicketChapterModal.jsx
import React, { useEffect, useMemo, useState, useCallback } from "react";
import { X } from "lucide-react";
import { apiGet } from "../../../../shared/apiClient";
import "./styles/TicketChapterModal.css";

// Componentes do chat
import MessageList from "../chat/message/MessageList";

/* ===== utils ===== */
function tsOf(m) {
  const t = m?.timestamp || m?.created_at || null;
  const n = t ? new Date(t).getTime() : NaN;
  return Number.isFinite(n) ? n : 0;
}
function sortAsc(a, b) { return tsOf(a) - tsOf(b); }

/* ===== fetch exclusivo por ticket (com flow_id) ===== */
async function fetchChapterMessagesByTicketId({ ticketId, flowId, messagesLimit = 2000 }) {
  if (!ticketId) throw new Error("ticketId obrigatório");
  if (!flowId)   throw new Error("flow_id é obrigatório para carregar o histórico do ticket");

  const qs = new URLSearchParams({
    include: "messages",
    messages_limit: String(messagesLimit),
    flow_id: String(flowId),
  });

  const res = await apiGet(`/tickets/history/${encodeURIComponent(ticketId)}?${qs.toString()}`);

  // Em /tickets/history/:id o backend retorna { ...ticket, messages: [] }
  const msgs = Array.isArray(res?.messages) ? res.messages : [];
  return msgs.sort(sortAsc);
}

/* ===== Modal ===== */
export default function TicketChapterModal({
  open,
  onClose,
  ticketId,       // usado no fetch
  ticketNumber,   // só para título
  flowId,         // 🔴 OBRIGATÓRIO: escopo do flow
}) {
  const [loading, setLoading]   = useState(true);
  const [messages, setMessages] = useState([]);
  const [error, setError]       = useState(null);

  const title = useMemo(
    () => `Histórico • Ticket #${ticketNumber || "—"}`,
    [ticketNumber]
  );

  // reset sempre que trocar ticket/flow
  useEffect(() => {
    setMessages([]);
    setError(null);
    setLoading(true);
  }, [ticketId, flowId]);

  const load = useCallback(async () => {
    if (!open) return;
    if (!ticketId || !flowId) {
      setLoading(false);
      setError(!ticketId ? "ticketId ausente" : "flow_id ausente");
      return;
    }

    setLoading(true);
    setError(null);
    try {
      const msgs = await fetchChapterMessagesByTicketId({ ticketId, flowId });
      setMessages(msgs);
    } catch (e) {
      setError(e?.message || "Falha ao carregar histórico");
    } finally {
      setLoading(false);
    }
  }, [open, ticketId, flowId]);

  useEffect(() => { load(); }, [load]);

  if (!open) return null;

  // handlers opcionais para imagem/pdf
  const handleImageClick = () => {};
  const handlePdfClick   = () => {};
  const handleReply      = () => {};

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
          {loading && <div className="chapter-modal__center">Carregando histórico…</div>}
          {error && <div className="chapter-modal__center chapter-modal__center--error">{error}</div>}
          {!loading && !error && messages.length === 0 && (
            <div className="chapter-modal__center">Nenhuma mensagem encontrada.</div>
          )}

          {!loading && !error && messages.length > 0 && (
            <MessageList
              messages={messages}
              onImageClick={handleImageClick}
              onPdfClick={handlePdfClick}
              onReply={handleReply}
            />
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
