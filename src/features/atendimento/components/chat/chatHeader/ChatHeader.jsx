import React, { useEffect, useRef, useState } from 'react';
import { Share2, CheckCircle, Tag as TagIcon } from 'lucide-react';
import useConversationsStore from '../../../store/useConversationsStore';
import { apiGet, apiPost, apiDelete, apiPut } from "../../../../../shared/apiClient";
import { getSocket } from '../../../services/socket';
import TransferModal from '../modals/transfer/Transfer';
import { useConfirm } from '../../../../../app/provider/ConfirmProvider.jsx';
import './styles/ChatHeader.css';

/* ---------- Listbox simples (aparece somente se houver catálogo) ---------- */
function TagsListbox({ label = 'Tags do ticket', options = [], selected = [], onChange }) {
  const [open, setOpen] = useState(false);
  const ref = useRef(null);

  useEffect(() => {
    const onDoc = (e) => {
      if (!ref.current) return;
      if (!ref.current.contains(e.target)) setOpen(false);
    };
    document.addEventListener('mousedown', onDoc);
    return () => document.removeEventListener('mousedown', onDoc);
  }, []);

  const toggle = (val) => {
    const has = selected.includes(val);
    const next = has ? selected.filter((t) => t !== val) : [...selected, val];
    onChange([...new Set(next)]); // sem duplicados
  };

  if (!options?.length) return null;

  return (
    <div className="tags-lb" ref={ref}>
      <button type="button" className="tags-lb__button" onClick={() => setOpen((o) => !o)}>
        <TagIcon size={14} /> <span>{label}</span> <span className="tags-lb__caret">▾</span>
      </button>
      {open && (
        <div className="tags-lb__panel" role="listbox" aria-label={label}>
          {options.map((opt) => (
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

/* salva diferenças de tags do cliente (rotas: /tags/customer/...) */
async function saveCustomerTagsDiff(userId, initialTags = [], selectedTags = []) {
  const initialSet = new Set(initialTags);
  const selectedSet = new Set(selectedTags);

  const toAdd = [...selectedSet].filter((t) => !initialSet.has(t));
  const toRemove = [...initialSet].filter((t) => !selectedSet.has(t));

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

  const clienteAtivo = useConversationsStore((s) => s.clienteAtivo);
  const mergeConversation = useConversationsStore((s) => s.mergeConversation);
  const setSelectedUserId = useConversationsStore((s) => s.setSelectedUserId);

  const ticketNumber = clienteAtivo?.ticket_number || '000000';
  const name = clienteAtivo?.name || 'Cliente';
  const user_id = clienteAtivo?.user_id || userIdSelecionado;

  /* ===== TAGS do TICKET ===== */
  const [ticketCatalog, setTicketCatalog] = useState([]);
  const [ticketTags, setTicketTags] = useState([]); // sempre começa vazio por ticket

  // carrega catálogo do ticket (fila do ticket)
  useEffect(() => {
    let alive = true;
    setTicketTags([]); // reset a cada ticket
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
    return () => {
      alive = false;
    };
  }, [ticketNumber]);

  if (!clienteAtivo) return null;

  /* ===== FINALIZAR ===== */
  const finalizarAtendimento = async () => {
    const ok = await confirm({
      title: 'Finalizar atendimento?',
      description: `Deseja finalizar o ticket #${String(ticketNumber).padStart(6, '0')}? As tags selecionadas serão salvas.`,
      confirmText: 'Finalizar',
      cancelText: 'Cancelar',
      tone: 'success',
    });
    if (!ok) return;

    try {
      // 1) Salva tags do ticket (se selecionadas)
      if (ticketTags.length) {
        await apiPost(`/tags/ticket/${encodeURIComponent(ticketNumber)}`, { tags: ticketTags });
      }

      // 2) Salva tags do cliente (diff)
      const initialCustomer = clienteAtivo?.customer_tags ?? [];
      const selectedCustomer = clienteAtivo?.pending_customer_tags ?? initialCustomer;
      await saveCustomerTagsDiff(user_id, initialCustomer, selectedCustomer);

      // 3) Fecha o ticket
      await apiPut(`/tickets/${encodeURIComponent(user_id)}`, { status: 'closed' });
      mergeConversation(user_id, { status: 'closed' });

      // 4) websocket + UI
      const socket = getSocket();
      if (socket?.connected) socket.emit('leave_room', user_id);
      try {
        window.dispatchEvent(new CustomEvent('room-closed', { detail: { userId: user_id } }));
      } catch {}

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
          {/* Nome + ticket (ticket embaixo do nome) */}
          <div className="nome-e-telefone">
            <span className="chat-header-nome">{name}</span>
            <span className="ticket-numero">#{String(ticketNumber).padStart(6, '0')}</span>
          </div>

          {/* Listbox de tags do ticket (só se houver catálogo); chips só se houver seleção */}
          <TagsListbox
            label="Tags do ticket"
            options={ticketCatalog}
            selected={ticketTags}
            onChange={setTicketTags}
          />
          {ticketTags.length > 0 && (
            <div className="ticket-tags-line">
              {ticketTags.map((t) => (
                <span className="chip chip--motivo" key={t}>
                  {t}
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
        <TransferModal userId={user_id} onClose={() => setShowTransferModal(false)} />
      )}
    </>
  );
}
