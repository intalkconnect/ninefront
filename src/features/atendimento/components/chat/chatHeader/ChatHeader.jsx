import React, { useEffect, useRef, useState } from 'react';
import { Share2, CheckCircle, Tag as TagIcon, X } from 'lucide-react';
import useConversationsStore from '../../../store/useConversationsStore';
import { apiGet, apiPost, apiDelete, apiPut } from '../../../../../shared/apiClient';
import { getSocket } from '../../../services/socket';
import TransferModal from '../modals/transfer/Transfer';
import { useConfirm } from '../../../../../app/provider/ConfirmProvider.jsx';
import './styles/ChatHeader.css';

/* ---------------- Listbox simples de adição (ticket) ---------------- */
function TicketTagsListbox({ options = [], selected = [], onAdd }) {
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState('');
  const ref = useRef(null);

  useEffect(() => {
    const onDoc = (e) => { if (!ref.current) return; if (!ref.current.contains(e.target)) setOpen(false); };
    document.addEventListener('mousedown', onDoc);
    return () => document.removeEventListener('mousedown', onDoc);
  }, []);

  if (!Array.isArray(options) || options.length === 0) return null;

  const s = q.trim().toLowerCase();
  const filtered = options
    .filter(o => !selected.includes(o.tag))
    .filter(o => !s || (String(o.tag).toLowerCase().includes(s) || String(o.label || '').toLowerCase().includes(s)));

  return (
    <div className="tags-lb" ref={ref}>
      <button
        type="button"
        className="tags-lb__button"
        onClick={() => setOpen(o => !o)}
        title="Adicionar tags do ticket"
      >
        <TagIcon size={14} />
        <span>Adicionar tags</span>
        <span className="tags-lb__caret">▾</span>
      </button>

      {open && (
        <div className="tags-lb__panel" role="listbox" aria-label="Tags do ticket">
          <input
            autoFocus
            className="hs-input"
            style={{ width: '100%', marginBottom: 8, padding: '8px 10px' }}
            placeholder="Procurar tag"
            value={q}
            onChange={(e) => setQ(e.target.value)}
          />
          {filtered.length === 0 ? (
            <div className="tags-lb__empty">Nenhuma tag encontrada</div>
          ) : (
            filtered.map(opt => (
              <button
                type="button"
                key={opt.tag}
                className="tags-lb__item"
                onClick={() => { onAdd(opt.tag); setQ(''); }}
                title={`Adicionar "${opt.label || opt.tag}"`}
              >
                <span>{opt.label || opt.tag}</span>
              </button>
            ))
          )}
        </div>
      )}
    </div>
  );
}

/* ------------ helpers para persistir tags do cliente com DIFF ----------- */
async function getCurrentCustomerTagsFromAPI(userId) {
  try {
    const r = await apiGet(`/tags/customer/${encodeURIComponent(userId)}`);
    return Array.isArray(r?.tags)
      ? r.tags.map(x => (typeof x === 'string' ? x : (x.tag || ''))).filter(Boolean)
      : [];
  } catch {
    return [];
  }
}

async function saveCustomerTagsDiff(userId, initialTags = [], selectedTags = []) {
  const initialSet  = new Set(initialTags);
  const selectedSet = new Set(selectedTags);

  const toAdd    = [...selectedSet].filter(t => !initialSet.has(t));
  const toRemove = [...initialSet].filter(t => !selectedSet.has(t));

  if (toAdd.length) {
    await apiPost(`/tags/customer/${encodeURIComponent(userId)}`, { tags: toAdd });
  }
  for (const t of toRemove) {
    await apiDelete(`/tags/customer/${encodeURIComponent(userId)}/${encodeURIComponent(t)}`);
  }
}

export default function ChatHeader({ userIdSelecionado }) {
  const confirm = useConfirm();
  const [showTransferModal, setShowTransferModal] = useState(false);

  const clienteAtivo       = useConversationsStore((s) => s.clienteAtivo);
  const mergeConversation  = useConversationsStore((s) => s.mergeConversation);
  const setSelectedUserId  = useConversationsStore((s) => s.setSelectedUserId);

  const ticketNumber = clienteAtivo?.ticket_number || '000000';
  const name         = clienteAtivo?.name || 'Cliente';
  const userId       = clienteAtivo?.user_id || userIdSelecionado;

  /* ======= TAGS do TICKET ======= */
  const [ticketCatalog, setTicketCatalog] = useState([]);
  const [ticketTags, setTicketTags] = useState([]); // seleção atual (começa vazio por ticket)

  useEffect(() => {
    let alive = true;
    setTicketTags([]); // novo ticket → zera seleção
    setTicketCatalog([]);
    (async () => {
      if (!ticketNumber) return;
      try {
        const r = await apiGet(`/tags/ticket/${encodeURIComponent(ticketNumber)}/catalog`);
        if (!alive) return;
        const cat = Array.isArray(r?.catalog) ? r.catalog : [];
        setTicketCatalog(cat);
      } catch {
        if (alive) setTicketCatalog([]);
      }
    })();
    return () => { alive = false; };
  }, [ticketNumber]);

  const addTicketTag = (tag) => {
    if (!tag) return;
    setTicketTags(prev => (prev.includes(tag) ? prev : [...prev, tag]));
  };
  const removeTicketTag = (tag) => setTicketTags(prev => prev.filter(t => t !== tag));

  if (!clienteAtivo) return null;

  /* ================== FINALIZAR ================== */
  const finalizarAtendimento = async () => {
    const ok = await confirm({
      title: 'Finalizar atendimento?',
      description: `Deseja finalizar o ticket #${String(ticketNumber).padStart(6,'0')}? As tags selecionadas serão salvas.`,
      confirmText: 'Finalizar',
      cancelText: 'Cancelar',
      tone: 'success',
    });
    if (!ok) return;

    try {
      // 1) Salva tags do ticket (se houver)
      if (ticketTags.length) {
        await apiPost(`/tags/ticket/${encodeURIComponent(ticketNumber)}`, { tags: ticketTags });
      }

      // 2) Salva tags do cliente com diff robusto (usa servidor como verdade)
      const serverCurrent = await getCurrentCustomerTagsFromAPI(userId);
      const state = useConversationsStore.getState();
      const selectedCustomer =
        Array.isArray(state?.clienteAtivo?.pending_customer_tags)
          ? state.clienteAtivo.pending_customer_tags
          : serverCurrent;

      await saveCustomerTagsDiff(userId, serverCurrent, selectedCustomer);

      // 3) Fecha o ticket
      await apiPut(`/tickets/${encodeURIComponent(userId)}`, { status: 'closed' });
      mergeConversation(userId, { status: 'closed' });

      // 4) socket + UI
      const socket = getSocket();
      if (socket?.connected) socket.emit('leave_room', userId);
      try { window.dispatchEvent(new CustomEvent('room-closed', { detail: { userId } })); } catch {}
      setSelectedUserId(null);
    } catch (err) {
      console.error('Erro ao finalizar:', err);
      await confirm({
        title: 'Erro ao finalizar',
        description: 'Não foi possível concluir a operação. Tente novamente.',
        confirmText: 'Ok',
        hideCancel: true,
        tone: 'danger',
      });
    }
  };

  return (
    <>
      <div className="chat-header">
        <div className="chat-header-left">
          <div className="nome-e-telefone">
            <span className="chat-header-nome">{name}</span>
            <span className="ticket-numero">#{String(ticketNumber).padStart(6, '0')}</span>
          </div>

          {/* Listbox para adicionar + chips com X (só mostra listbox se houver catálogo) */}
          <TicketTagsListbox
            options={ticketCatalog}
            selected={ticketTags}
            onAdd={addTicketTag}
          />

          {ticketTags.length > 0 && (
            <div className="ticket-chips-inline" aria-label="Tags do ticket selecionadas">
              {ticketTags.map(tag => (
                <span key={tag} className="chip chip--motivo">
                  {tag}
                  <button
                    type="button"
                    className="chip-x"
                    onClick={() => removeTicketTag(tag)}
                    title="Remover"
                    aria-label={`Remover ${tag}`}
                    style={{ marginLeft: 6 }}
                  >
                    <X size={12} />
                  </button>
                </span>
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

      {showTransferModal && (
        <TransferModal
          userId={userId}
          onClose={() => setShowTransferModal(false)}
        />
      )}
    </>
  );
}
