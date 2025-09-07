import React, { useEffect, useRef, useState, useCallback } from "react";
import { X, MessageCircle, ExternalLink } from "lucide-react";
import { apiGet } from "../../../shared/apiClient";
// MESMO ChatThread do histórico:
import ChatThread from "../atendimento/history/ChatThread";
import s from "./styles/MiniChatDrawer.module.css";

/**
 * MiniChatDrawer
 * - Preview somente-leitura da conversa
 * - Reaproveita 100% o ChatThread do histórico
 *
 * Props:
 *  - open, onClose
 *  - historyId?: string|number     -> ID interno (o mesmo do /tickets/history/:id)
 *  - ticketNumber?: string|number  -> número “humano”, fallback
 *  - cliente?, canal?
 *  - historyUrlBase?: string (default: "/admin/management/history")
 */
export default function MiniChatDrawer({
  open,
  onClose,
  historyId,
  ticketNumber,
  cliente,
  canal,
  historyUrlBase = "/admin/management/history",
}) {
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState(null);
  const [messages, setMessages] = useState([]);
  const viewportRef = useRef(null);

  const hasKey = historyId != null || ticketNumber != null;
  const canShow = open && hasKey;

  // ESC fecha
  const onEsc = useCallback((e) => { if (e.key === "Escape") onClose?.(); }, [onClose]);
  useEffect(() => {
    if (!canShow) return;
    window.addEventListener("keydown", onEsc);
    return () => window.removeEventListener("keydown", onEsc);
  }, [canShow, onEsc]);

  const is404 = (e) => {
    const s = e?.status ?? e?.response?.status;
    if (s === 404) return true;
    return /\b404\b/.test(String(e?.message || e || ""));
  };

  // normaliza shape mínimo p/ ChatThread
  const ensureShape = (arr) =>
    (Array.isArray(arr) ? arr : []).map((m) => ({
      id: m.id ?? `${(m.timestamp ?? m.created_at ?? Date.now())}-${Math.random().toString(36).slice(2,7)}`,
      timestamp: m.timestamp ?? m.created_at ?? m.date ?? Date.now(),
      ...m,
    }));

  // tenta diferentes endpoints (id interno primeiro, depois número)
  const fetchMessagesSmart = async () => {
    setErr(null);

    // 1) Tenta pelo ID interno no endpoint de histórico
    if (historyId != null) {
      try {
        const r = await apiGet(
          `/tickets/history/${historyId}?include=messages,attachments&messages_limit=500`
        );
        // ✅ Sucesso: mesmo que vazio, retorna o array
        return ensureShape(r?.messages || []);
      } catch (e) {
        if (!is404(e)) throw e; // erro real -> propaga
        // 404: cai no fallback
      }
      // 1b) Fallback (se você quiser manter) — ok se este 404:
      try {
        const r2 = await apiGet(`/tickets/${historyId}/messages`);
        return ensureShape(Array.isArray(r2) ? r2 : r2?.data || []);
      } catch (e2) {
        if (!is404(e2)) throw e2;
      }
    }

    // 2) Tenta pelo ticketNumber no endpoint de histórico
    if (ticketNumber != null) {
      try {
        const r3 = await apiGet(
          `/tickets/history/${ticketNumber}?include=messages,attachments&messages_limit=500`
        );
        // ✅ Sucesso: mesmo que vazio, retorna o array
        return ensureShape(r3?.messages || []);
      } catch (e3) {
        if (!is404(e3)) throw e3;
      }
      // 2b) Fallback por número (se existir na tua API)
      try {
        const r4 = await apiGet(`/tickets/${ticketNumber}/messages`);
        return ensureShape(Array.isArray(r4) ? r4 : r4?.data || []);
      } catch (e4) {
        if (!is404(e4)) throw e4;
      }
    }

    // Nada encontrado (id e número falharam)
    const label = historyId != null ? `ID ${historyId}` : `número ${ticketNumber}`;
    // 🔕 Não trata como erro fatal: retorna vazio para mostrar "Sem histórico"
    console.warn(`MiniChat: mensagens não encontradas para (${label}).`);
    return [];
  };

  useEffect(() => {
    let alive = true;
    async function load() {
      if (!canShow) return;
      setLoading(true);
      try {
        const msgs = await fetchMessagesSmart();
        if (alive) setMessages(msgs);
      } catch (e) {
        console.error("Falha ao carregar o ticket (mini):", e);
        if (alive) {
          setErr(e?.message || "Falha ao carregar a conversa.");
          setMessages([]);
        }
      } finally {
        if (alive) setLoading(false);
      }
    }
    load();
    return () => { alive = false; };
    // re-carrega quando alterar a chave do ticket
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [canShow, historyId, ticketNumber]);

  // auto-scroll
  useEffect(() => {
    if (!canShow) return;
    const el = viewportRef.current;
    if (!el) return;
    const t = setTimeout(() => { el.scrollTop = el.scrollHeight; }, 60);
    return () => clearTimeout(t);
  }, [canShow, messages]);

  const linkId = historyId ?? ticketNumber;
  const fullHistoryHref = `${historyUrlBase}/${linkId}`;

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
              <div className={s.hTitle}>{cliente || `Ticket #${linkId ?? "—"}`}</div>
              <div className={s.hSub}>{canal || "Pré-visualização"}</div>
            </div>
          </div>
          <div className={s.hRight}>
            {linkId != null && (
              <a className={s.fullBtn} href={fullHistoryHref} title="Abrir no histórico completo">
                <ExternalLink size={16} />
              </a>
            )}
            <button className={s.iconBtn} onClick={onClose} aria-label="Fechar mini chat">
              <X size={16} />
            </button>
          </div>
        </header>

        <div className={s.content}>
          {!hasKey ? (
            <div className={s.empty}>Ticket não informado.</div>
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
