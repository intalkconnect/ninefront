import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Share2, CheckCircle, Tag as TagIcon } from 'lucide-react';
import useConversationsStore from '../../../store/useConversationsStore';
import { apiGet, apiPost, apiDelete, apiPut } from '../../../../../shared/apiClient';
import { getSocket } from '../../../services/socket';
import TransferModal from '../modals/transfer/Transfer';
import { useConfirm } from '../../../../../app/provider/ConfirmProvider.jsx';
import './styles/ChatHeader.css';

/** Combobox/Listbox com filtro – sem digitação livre para salvar */
function ComboTags({ options = [], selected = [], onChange, placeholder = 'Procurar tag' }) {
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState('');
  const ref = useRef(null);

  useEffect(() => {
    const onDoc = (e) => { if (!ref.current) return; if (!ref.current.contains(e.target)) setOpen(false); };
    document.addEventListener('mousedown', onDoc);
    return () => document.removeEventListener('mousedown', onDoc);
  }, []);

  const filtered = useMemo(() => {
    const t = q.trim().toLowerCase();
    if (!t) return options;
    return options.filter(o => (o.label || o.tag).toLowerCase().includes(t));
  }, [q, options]);

  const toggle = (tag) => {
    const has = selected.includes(tag);
    const next = has ? selected.filter(x => x !== tag) : [...selected, tag];
    onChange([...new Set(next)]);
  };

  if (!options.length) return null;

  return (
    <div className="lb" ref={ref}>
      <button type="button" className="lb__control" onClick={() => setOpen(o => !o)} aria-haspopup="listbox">
        <TagIcon size={16} className="lb__icon" />
        <span className="lb__placeholder">{placeholder}</span>
        <span className="lb__caret">▾</span>
      </button>
      {open && (
        <div className="lb__panel" role="listbox" aria-label="Selecionar tags">
          <input className="lb__search" placeholder={placeholder} value={q} onChange={(e) => setQ(e.target.value)} />
          {filtered.length === 0 ? (
            <div className="lb__empty">Nenhuma tag encontrada</div>
          ) : (
            filtered.map(opt => (
              <label key={opt.tag} className="lb__item">
                <input
                  type="checkbox"
                  checked={selected.includes(opt.tag)}
                  onChange={() => toggle(opt.tag)}
                />
                <span>{opt.label || opt.tag}</span>
              </label>
            ))
          )}
        </div>
      )}
    </div>
  );
}

/* salva diff das tags do cliente (POST/DELETE conforme rotas) */
async function saveCustomerTagsDiff(userId, initialTags = [], selectedTags = []) {
  const initial = new Set(initialTags);
  const selected = new Set(selectedTags);
  const toAdd = [...selected].filter(t => !initial.has(t));
  const toRemove = [...initial].filter(t => !selected.has(t));

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

  const clienteAtivo      = useConversationsStore(s => s.clienteAtivo);
  const mergeConversation = useConversationsStore(s => s.mergeConversation);
  const setSelectedUserId = useConversationsStore(s => s.setSelectedUserId);

  if (!clienteAtivo) return null;

  const ticketNumber = clienteAtivo?.ticket_number || '000000';
  const name   = clienteAtivo?.name || 'Cliente';
  const userId = clienteAtivo?.user_id || userIdSelecionado;

  /* ======= TAGS do TICKET ======= */
  const [ticketCatalog, setTicketCatalog] = useState([]);
  const [ticketTags, setTicketTags] = useState([]); // começa vazio por ticket

  // carrega catálogo do ticket pela fila do ticket
  useEffect(() => {
    let alive = true;
    setTicketTags([]);
    setTicketCatalog([]);
    (async () => {
      if (!ticketNumber) return;
      try {
        // catálogo aplicável por fila do ticket
        const r = await apiGet(`/tags/ticket/${encodeURIComponent(ticketNumber)}/catalog`);
        if (!alive) return;
        setTicketCatalog(Array.isArray(r?.catalog) ? r.catalog : []);
      } catch {
        if (alive) setTicketCatalog([]);
      }
    })();
    return () => { alive = false; };
  }, [ticketNumber]);

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
      // 1) salva tags do ticket (se houver)
      if (ticketTags.length) {
        await apiPost(`/tags/ticket/${encodeURIComponent(ticketNumber)}`, { tags: ticketTags });
      }

      // 2) salva dif das tags do cliente (Details mantém em memória no store)
      const initialCustomer = clienteAtivo?.customer_tags ?? [];
      const selectedCustomer = clienteAtivo?.pending_customer_tags ?? initialCustomer;
      await saveCustomerTagsDiff(userId, initialCustomer, selectedCustomer);

      // 3) fecha ticket
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

          {/* Linha: “Adicionar tags” + listbox (se houver catálogo) + chips (se houver seleção) */}
          <div className="tags-row">
            <span className="tags-label"><TagIcon size={16}/> Adicionar tags</span>

            {ticketCatalog.length > 0 && (
              <ComboTags
                options={ticketCatalog}
                selected={ticketTags}
                onChange={setTicketTags}
                placeholder="Procurar tag"
              />
            )}

            {ticketTags.length > 0 && (
              <div className="chips">
                {ticketTags.map(t => (
                  <span key={t} className="chip">{t}</span>
                ))}
              </div>
            )}
          </div>
        </div>

        <div className="chat-header-right">
          <button className="btn-transferir" onClick={() => setShowTransferModal(true)}>
            <Share2 size={14} /> <span>Transferir</span>
          </button>
          <button className="btn-finalizar" onClick={finalizarAtendimento}>
            <CheckCircle size={14} /> <span>Finalizar</span>
          </button>
        </div>
      </div>

      {showTransferModal && (
        <TransferModal userId={userId} onClose={() => setShowTransferModal(false)} />
      )}
    </>
  );
}
