import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Share2, CheckCircle, Tag as TagIcon } from 'lucide-react';
import useConversationsStore from '../../../store/useConversationsStore';
import { apiGet, apiPost, apiDelete, apiPut } from "../../../../../shared/apiClient";
import { getSocket } from '../../../services/socket';
import TransferModal from '../modals/transfer/Transfer';
import { useConfirm } from '../../../../../app/provider/ConfirmProvider.jsx';
import './styles/ChatHeader.css';

/* helpers */
function padTicket(n) {
  if (n == null) return '000000';
  try { return String(n).padStart(6, '0'); } catch { return String(n); }
}

/** Listbox simples com checkboxes (sem modal) */
function TagsListbox({ label = 'Tags', options = [], selected = [], onChange }) {
  const [open, setOpen] = useState(false);
  const boxRef = useRef(null);

  useEffect(() => {
    const onDoc = (e) => {
      if (!boxRef.current) return;
      if (!boxRef.current.contains(e.target)) setOpen(false);
    };
    document.addEventListener('mousedown', onDoc);
    return () => document.removeEventListener('mousedown', onDoc);
  }, []);

  const toggle = (val) => {
    const has = selected.includes(val);
    const next = has ? selected.filter(t => t !== val) : [...selected, val];
    onChange(next);
  };

  return (
    <div className="tags-lb" ref={boxRef}>
      <button type="button" className="tags-lb__button" onClick={() => setOpen(o => !o)}>
        <TagIcon size={14} /> <span>{label}</span> <span className="tags-lb__caret">▾</span>
      </button>

      {open && (
        <div className="tags-lb__panel" role="listbox" aria-label={label}>
          {options.length === 0 ? (
            <div className="tags-lb__empty">Nenhuma tag disponível</div>
          ) : options.map(opt => (
            <label key={opt.tag} className="tags-lb__item">
              <input
                type="checkbox"
                checked={selected.includes(opt.tag)}
                onChange={() => toggle(opt.tag)}
              />
              <span>{opt.label || opt.tag}</span>
            </label>
          ))}
        </div>
      )}
    </div>
  );
}

export default function ChatHeader({ userIdSelecionado }) {
  const confirm = useConfirm();
  const [showTransferModal, setShowTransferModal] = useState(false);
  const clienteAtivo       = useConversationsStore((state) => state.clienteAtivo);
  const mergeConversation  = useConversationsStore((state) => state.mergeConversation);
  const setSelectedUserId  = useConversationsStore((state) => state.setSelectedUserId);

  const ticketNumber = clienteAtivo?.ticket_number || '000000';
  const name         = clienteAtivo?.name || 'Cliente';
  const user_id      = clienteAtivo?.user_id || userIdSelecionado;

  /* ===== Ticket tags (chips + listbox) ===== */
  const [ticketTags, setTicketTags] = useState([]);
  const [ticketCatalog, setTicketCatalog] = useState([]);

  // carrega catálogo e tags atuais
  useEffect(() => {
    let alive = true;

    async function load() {
      if (!ticketNumber) return;
      try {
        const [cur, cat] = await Promise.all([
          apiGet(`/tickets/tags/ticket/${encodeURIComponent(ticketNumber)}`),
          apiGet(`/tickets/tags/ticket/${encodeURIComponent(ticketNumber)}/catalog`)
        ]);

        const current = Array.isArray(cur?.tags) ? cur.tags.map(x => x.tag || x) : [];
        const catalog = Array.isArray(cat?.catalog) ? cat.catalog : [];

        if (!alive) return;
        setTicketTags(current);
        setTicketCatalog(catalog);
        mergeConversation(user_id, { motivo_tags: current });
      } catch {
        if (!alive) return;
        setTicketTags([]);
        setTicketCatalog([]);
      }
    }
    load();
    return () => { alive = false; };
  }, [ticketNumber, user_id, mergeConversation]);

  // aplica alterações (diferença incremental usando POST + DELETE)
  const applyTicketTags = async (next) => {
    const toAdd = next.filter(t => !ticketTags.includes(t));
    const toDel = ticketTags.filter(t => !next.includes(t));

    try {
      if (toAdd.length) {
        await apiPost(`/tickets/tags/ticket/${encodeURIComponent(ticketNumber)}`, { tags: toAdd });
      }
      for (const t of toDel) {
        // remover vínculos inexistentes não dá erro (404 vira ignorado aqui)
        try { await apiDelete(`/tickets/tags/ticket/${encodeURIComponent(ticketNumber)}/${encodeURIComponent(t)}`); } catch {}
      }
      setTicketTags(next);
      mergeConversation(user_id, { motivo_tags: next });
    } catch (err) {
      console.error('Falha ao salvar tags do ticket', err);
    }
  };

  // finalizar (com ConfirmProvider) — também garante salvar tags do cliente (store -> API) se existir
  const finalizarAtendimento = async () => {
    const ok = await confirm({
      title: 'Finalizar atendimento?',
      description: `Deseja finalizar o atendimento do ticket #${padTicket(ticketNumber)}?`,
      confirmText: 'Finalizar',
      cancelText: 'Cancelar',
      tone: 'success',
    });
    if (!ok) return;

    try {
      // fecha ticket
      await apiPut(`/tickets/${encodeURIComponent(user_id)}`, { status: 'closed' });

      // salva estado atual de tags do ticket (no caso de alguém esquecer de clicar fora do listbox)
      if (ticketTags?.length) {
        await apiPost(`/tickets/tags/ticket/${encodeURIComponent(ticketNumber)}`, { tags: ticketTags });
      }

      // salva tags do cliente (se existirem no objeto do store)
      const customerTags = Array.isArray(clienteAtivo?.customer_tags) ? clienteAtivo.customer_tags : [];
      if (customerTags.length) {
        await apiPost(`/clientes/${encodeURIComponent(user_id)}/tags`, { tags: customerTags });
      }

      mergeConversation(user_id, { status: 'closed' });

      const socket = getSocket();
      if (socket?.connected) socket.emit('leave_room', user_id);
      try { window.dispatchEvent(new CustomEvent('room-closed', { detail: { userId: user_id } })); } catch {}

      setSelectedUserId(null);
    } catch (err) {
      console.error('Erro ao finalizar ticket:', err);
      await confirm({
        title: 'Erro',
        description: 'Não foi possível finalizar. Tente novamente.',
        confirmText: 'Ok',
        cancelText: null,
        tone: 'danger',
      });
    }
  };

  if (!clienteAtivo) return null;

  // chips somente se houver
  const chosen = ticketTags;
  const chosenChips = useMemo(() => {
    if (!chosen?.length) return [];
    const map = new Map(ticketCatalog.map(x => [x.tag, x]));
    return chosen.map(t => ({ tag: t, label: map.get(t)?.label || t }));
  }, [chosen, ticketCatalog]);

  return (
    <>
      <div className="chat-header">
        <div className="chat-header-left">
          <div className="nome-e-telefone">
            <span className="chat-header-nome">{name}</span>
            <span className="ticket-numero">#{padTicket(ticketNumber)}</span>

            {/* chips aparecem logo abaixo do número */}
            {chosenChips.length > 0 && (
              <div className="ticket-chips-inline">
                {chosenChips.map(c => (
                  <span key={c.tag} className="chip chip--motivo">{c.label}</span>
                ))}
              </div>
            )}
          </div>

          {/* listbox de tags sempre visível; chips ficam no bloco acima */}
          <TagsListbox
            label="Tags"
            options={ticketCatalog}
            selected={ticketTags}
            onChange={applyTicketTags}
          />
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

      {showTransferModal && (
        <TransferModal
          userId={user_id}
          onClose={() => setShowTransferModal(false)}
        />
      )}
    </>
  );
}
