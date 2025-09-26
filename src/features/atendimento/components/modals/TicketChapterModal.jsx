import React, { useEffect, useMemo, useState, useCallback } from "react";
import { X } from "lucide-react";
import { apiGet } from "../../../../shared/apiClient";
import "./styles/TicketChapterModal.css";

// 👉 importe os componentes enviados
import MessageList from "../chat/message/MessageList";   // ajuste o caminho se necessário

/* ===== utils ===== */
function tsOf(m) {
  const t = m?.timestamp || m?.created_at || null;
  const n = t ? new Date(t).getTime() : NaN;
  return Number.isFinite(n) ? n : 0;
}
function sortAsc(a, b) { return tsOf(a) - tsOf(b); }

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

  // handlers opcionais para imagem/pdf (se você quiser abrir lightbox, por exemplo)
  const handleImageClick = (url) => { /* TODO: abrir preview se quiser */ };
  const handlePdfClick = (url) => { /* TODO: abrir visualizador se quiser */ };
  const handleReply = () => {}; // no modal normalmente não precisa responder

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
            // ⤵️ usa os componentes enviados para renderizar a conversa
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
