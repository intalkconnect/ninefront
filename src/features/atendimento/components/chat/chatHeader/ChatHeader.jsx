import React, { useEffect, useState } from 'react';
import { Share2, CheckCircle, Tag as TagIcon, ChevronDown } from 'lucide-react';
import useConversationsStore from '../../../store/useConversationsStore';
import { apiGet, apiPost, apiPut } from "../../../../../shared/apiClient";
import { getSocket } from '../../../services/socket';
import TransferModal from '../modals/transfer/Transfer';
import { useConfirm } from '../../../../app/provider/ConfirmProvider.jsx';
import './styles/ChatHeader.css';

const pad = (n) => (n ? String(n).padStart(6, '0') : '');

function normalizeTag(raw) {
  if (raw == null) return null;
  const t = String(raw).trim();
  return t || null;
}

/* ---------- Seletor de tags do ticket (catálogo por Fila) ---------- */
function TagSelectorModal({ open, onClose, ticketNumber, onApply }) {
  const [loading, setLoading] = useState(false);
  const [catalog, setCatalog] = useState([]);
  const [selected, setSelected] = useState(new Set());

  useEffect(() => {
    if (!open || !ticketNumber) return;
    let alive = true;
    (async () => {
      try {
        setLoading(true);
        const catRes = await apiGet(`/tags/ticket/${encodeURIComponent(ticketNumber)}/catalog`);
        const cat = Array.isArray(catRes?.catalog) ? catRes.catalog : [];

        const curRes = await apiGet(`/tags/ticket/${encodeURIComponent(ticketNumber)}`);
        const cur = Array.isArray(curRes?.tags) ? curRes.tags.map(r => r.tag) : [];

        if (!alive) return;
        setCatalog(cat);
        setSelected(new Set(cur));
      } finally {
        if (alive) setLoading(false);
      }
    })();
    return () => { alive = false; };
  }, [open, ticketNumber]);

  const toggle = (tag) => {
    setSelected(prev => {
      const next = new Set(prev);
      next.has(tag) ? next.delete(tag) : next.add(tag);
      return next;
    });
  };

  const apply = () => {
    onApply([...selected]);
    onClose();
  };

  if (!open) return null;

  return (
    <div className="modal-overlay" role="dialog" aria-modal="true" aria-label="Selecionar tags do ticket">
      <div className="modal-card">
        <div className="modal-header">
          <h3>Tags do ticket</h3>
          <button className="modal-close" onClick={onClose} aria-label="Fechar">×</button>
        </div>
        <div className="modal-body">
          {loading ? (
            <p>Carregando catálogo…</p>
          ) : catalog.length === 0 ? (
            <p>Nenhuma tag disponível para a fila deste ticket.</p>
          ) : (
            <ul className="tag-checklist">
              {catalog.map(item => {
                const key = normalizeTag(item?.tag);
                const label = item?.label || key;
                if (!key) return null;
                const checked = selected.has(key);
                return (
                  <li key={key}>
                    <label className="check-row">
                      <input type="checkbox" checked={checked} onChange={() => toggle(key)} />
                      <span className="check-row__label">
                        {label}
                        {item?.color && <i className="tag-dot" style={{ backgroundColor: item.color }} />}
                      </span>
                    </label>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
        <div className="modal-footer">
          <button className="btn-secondary" onClick={onClose}>Cancelar</button>
          <button className="btn-primary" onClick={apply} disabled={loading}>Aplicar</button>
        </div>
      </div>
    </div>
  );
}

/* ======================= Header ======================= */
export default function ChatHeader({ userIdSelecionado }) {
  const [showTransferModal, setShowTransferModal] = useState(false);
  const [showSelector, setShowSelector] = useState(false);

  const confirm = useConfirm();

  const clienteAtivo       = useConversationsStore((s) => s.clienteAtivo);
  const mergeConversation  = useConversationsStore((s) => s.mergeConversation);
  const setSelectedUserId  = useConversationsStore((s) => s.setSelectedUserId);

  const [ticketTags, setTicketTags] = useState([]);

  const ticketNumber = clienteAtivo?.ticket_number || '';
  const name         = clienteAtivo?.name || 'Cliente';
  const user_id      = clienteAtivo?.user_id || userIdSelecionado;

  // carrega tags atuais do ticket para listar
  useEffect(() => {
    let alive = true;
    (async () => {
      if (!ticketNumber) { setTicketTags([]); return; }
      try {
        const res = await apiGet(`/tags/ticket/${encodeURIComponent(ticketNumber)}`);
        const arr = Array.isArray(res?.tags) ? res.tags.map(r => r.tag) : [];
        if (!alive) return;
        setTicketTags(arr);
        mergeConversation(user_id, { motivo_tags: arr });
      } catch {
        if (!alive) return;
        setTicketTags([]);
      }
    })();
    return () => { alive = false; };
  }, [ticketNumber, user_id, mergeConversation]);

  const handleApplyTicketTags = (arr) => {
    setTicketTags(arr);
    mergeConversation(user_id, { motivo_tags: arr });
  };

  const finalizarAtendimento = async () => {
    // recupera draft de tags do cliente (DetailsPanel grava no store)
    const customerDraft = Array.isArray(clienteAtivo?.customer_tags_draft)
      ? clienteAtivo.customer_tags_draft
      : null;

    // se não houver draft, busca as atuais para persistir junto
    let customerTags = customerDraft;
    if (!customerTags) {
      try {
        const res = await apiGet(`/tags/customer/${encodeURIComponent(user_id)}`);
        customerTags = Array.isArray(res?.tags) ? res.tags.map(r => r.tag) : [];
      } catch {
        customerTags = [];
      }
    }

    const msgDesc = [
      ticketTags?.length ? `• Tags do ticket: ${ticketTags.join(', ')}` : '• Ticket sem tags',
      customerTags?.length ? `• Tags do cliente: ${customerTags.join(', ')}` : '• Cliente sem tags'
    ].join('\n');

    const ok = await confirm({
      title: 'Finalizar atendimento?',
      description: `As seleções abaixo serão salvas e o atendimento será encerrado:\n\n${msgDesc}`,
      confirmText: 'Finalizar',
      cancelText: 'Cancelar',
      tone: 'confirm',
    });
    if (!ok) return;

    try {
      // 1) Salva tags do ticket (se houver)
      if (ticketNumber && ticketTags.length) {
        await apiPost(`/tags/ticket/${encodeURIComponent(ticketNumber)}`, { tags: ticketTags });
      }

      // 2) Salva tags do cliente (se houver)
      if (user_id && customerTags.length) {
        await apiPost(`/tags/customer/${encodeURIComponent(user_id)}`, { tags: customerTags });
      }

      // 3) Fecha o ticket
      await apiPut(`/tickets/${encodeURIComponent(user_id)}`, { status: 'closed' });
      mergeConversation(user_id, { status: 'closed' });

      // 4) housekeeping
      const socket = getSocket();
      if (socket?.connected) socket.emit('leave_room', user_id);
      try { window.dispatchEvent(new CustomEvent('room-closed', { detail: { userId: user_id } })); } catch {}
      setSelectedUserId(null);
    } catch (err) {
      console.error('Erro ao finalizar ticket:', err);
      await confirm({
        title: 'Erro ao finalizar',
        description: 'Não foi possível finalizar o atendimento. Tente novamente.',
        confirmText: 'Ok',
        hideCancel: true,
        tone: 'danger',
      });
    }
  };

  if (!clienteAtivo) return null;

  const hasTicketTags = ticketTags.length > 0;

  return (
    <>
      <div className="chat-header">
        <div className="chat-header-left">
          <div className="row-primary">
            <span className="chat-header-nome">{name}</span>
            {ticketNumber && <span className="ticket-numero">#{pad(ticketNumber)}</span>}

            <button
              className="btn-tags"
              onClick={() => setShowSelector(true)}
              aria-label="Selecionar tags do ticket"
              title="Selecionar tags do ticket"
            >
              <TagIcon size={14} />
              <span>Tags</span>
              <ChevronDown size={14} />
            </button>
          </div>

          {hasTicketTags && (
            <div className="ticket-tags-line">
              {ticketTags.map((t) => (
                <span className="chip chip--motivo chip--compact" key={t}>{t}</span>
              ))}
            </div>
          )}
        </div>

        <div className="chat-header-right">
          <button className="btn-transferir" onClick={() => setShowTransferModal(true)}>
            <Share2 size={14} />
            <span>Transferir</span>
          </button>
          <button className="btn-finalizar" onClick={finalizarAtendimento}>
            <CheckCircle size={14} />
            <span>Finalizar</span>
          </button>
        </div>
      </div>

      <TagSelectorModal
        open={showSelector}
        onClose={() => setShowSelector(false)}
        ticketNumber={ticketNumber}
        onApply={handleApplyTicketTags}
      />

      {showTransferModal && (
        <TransferModal userId={user_id} onClose={() => setShowTransferModal(false)} />
      )}
    </>
  );
}
