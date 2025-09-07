// File: src/pages/admin/monitoring/MiniChatDrawerEmbed.jsx
import React, { useEffect, useCallback } from "react";
import { X, MessageCircle, ExternalLink } from "lucide-react";
import { MemoryRouter, Routes, Route } from "react-router-dom";
import TicketDetail from "../atendimento/history/TicketDetail"; // <-- mesmo componente do histórico
import s from "./styles/MiniChatDrawer.module.css";

/**
 * MiniChatDrawerEmbed
 * - Abre um painel lateral com o TicketDetail renderizado dentro de um MemoryRouter.
 * - Dessa forma, o próprio TicketDetail (com TODOS os tipos de mensagem) é utilizado.
 *
 * Props:
 *  - open: boolean
 *  - onClose: () => void
 *  - ticketId: string | number (id do TicketDetail; use o mesmo id que a rota espera)
 *  - cliente?: string (opcional, só para header)
 *  - canal?: string (opcional, só para header)
 */
export default function MiniChatDrawerEmbed({ open, onClose, ticketId, cliente, canal }) {
  const canShow = open && ticketId;

  // ESC fecha
  const onEsc = useCallback((e) => { if (e.key === "Escape") onClose?.(); }, [onClose]);
  useEffect(() => {
    if (!canShow) return;
    window.addEventListener("keydown", onEsc);
    return () => window.removeEventListener("keydown", onEsc);
  }, [canShow, onEsc]);

  // caminho completo para abrir no histórico “de verdade”
  const fullHistoryHref = `/admin/management/history/${ticketId}`;

  return (
    <>
      <div
        className={`${s.overlay} ${open ? s.open : ""}`}
        onMouseDown={(e) => { if (e.target === e.currentTarget) onClose?.(); }}
      />

      <aside className={`${s.drawer} ${open ? s.open : ""}`} aria-hidden={!open} aria-label="Mini chat">
        <header className={s.header}>
          <div className={s.hLeft}>
            <div className={s.hIcon}><MessageCircle size={16} /></div>
            <div className={s.hText}>
              <div className={s.hTitle}>
                {cliente ? `${cliente}` : `Ticket #${ticketId}`}
              </div>
              <div className={s.hSub}>
                {canal ? `${canal}` : "Pré-visualização"}
              </div>
            </div>
          </div>
          <div className={s.hRight}>
            {ticketId && (
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
          {/* 
            Importante:
            - Usamos MemoryRouter com a MESMA rota que o Admin usa para o TicketDetail.
            - initialEntries aponta direto para o path que o TicketDetail espera (useParams('id')).
            - Isso faz o TicketDetail renderizar normalmente, com todos os seus subcomponentes.
          */}
          {canShow ? (
            <MemoryRouter initialEntries={[`/management/history/${ticketId}`]}>
              <Routes>
                <Route path="/management/history/:id" element={<TicketDetail />} />
              </Routes>
            </MemoryRouter>
          ) : null}
        </div>
      </aside>
    </>
  );
}
