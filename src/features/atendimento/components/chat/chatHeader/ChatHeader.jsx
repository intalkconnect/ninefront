import React, { useEffect, useRef, useState } from 'react';
import { Share2, CheckCircle, Tag, X } from 'lucide-react';
import useConversationsStore from '../../../store/useConversationsStore';
import { apiGet, apiPost, apiPut } from "../../../../../shared/apiClient";
import { getSocket } from '../../../services/socket';
import TransferModal from '../modals/transfer/Transfer';
import { useConfirm } from '../../../../app/provider/ConfirmProvider.jsx';
import './styles/ChatHeader.css';

function normalizeTag(raw) {
  if (raw == null) return null;
  const t = String(raw).trim().replace(/\s+/g, ' ');
  if (!t) return null;
  if (t.length > 40) return t.slice(0, 40);
  if (/[^\S\r\n]*[\r\n]/.test(t)) return null;
  return t;
}

export default function ChatHeader({ userIdSelecionado }) {
  const [showTransferModal, setShowTransferModal] = useState(false);
  const confirm = useConfirm();

  const clienteAtivo       = useConversationsStore((state) => state.clienteAtivo);
  const mergeConversation  = useConversationsStore((state) => state.mergeConversation);
  const setSelectedUserId  = useConversationsStore((state) => state.setSelectedUserId);

  const [tags, setTags] = useState([]);
  const [draft, setDraft] = useState('');
  const inputRef = useRef(null);

  const ticketNumber = clienteAtivo?.ticket_number || '';
  const name         = clienteAtivo?.name || 'Cliente';
  const user_id      = clienteAtivo?.user_id || userIdSelecionado;

  // carrega tags atuais do ticket (apenas para exibir/editar localmente)
  useEffect(() => {
    let alive = true;
    async function load() {
      if (!ticketNumber) { setTags([]); return; }
      try {
        // usamos o endpoint que retorna catálogo aplicado ao ticket
        // GET /tags/ticket/:ticket_number  -> { ticket_number, fila, tags: [{tag, ...}] }
        const res = await apiGet(`/tags/ticket/${encodeURIComponent(ticketNumber)}`);
        const arr = Array.isArray(res?.tags) ? res.tags.map(r => r.tag) : [];
        if (!alive) return;
        setTags(arr);
        mergeConversation(user_id, { motivo_tags: arr });
      } catch {
        if (!alive) return;
        setTags([]);
      }
    }
    load();
    return () => { alive = false; };
  }, [ticketNumber, user_id, mergeConversation]);

  // helpers de edição local (NÃO persistem até finalizar)
  const addTag = (raw) => {
    const v = normalizeTag(raw);
    if (!v) { setDraft(''); return; }
    if (tags.includes(v)) { setDraft(''); return; }
    const next = [...tags, v];
    setTags(next);
    setDraft('');
    mergeConversation(user_id, { motivo_tags: next });
  };
  const removeTag = (t) => {
    const next = tags.filter(x => x !== t);
    setTags(next);
    mergeConversation(user_id, { motivo_tags: next });
  };
  const handleKeyDown = (e) => {
    if (e.key === 'Enter') { e.preventDefault(); addTag(draft); }
    if (e.key === ',' || e.key === ';') { e.preventDefault(); addTag(draft); }
    if (e.key === 'Backspace' && !draft && tags.length) { e.preventDefault(); removeTag(tags[tags.length - 1]); }
  };

  if (!clienteAtivo) return null;

  const finalizarAtendimento = async () => {
    const ok = await confirm({
      title: 'Finalizar atendimento?',
      description: 'As tags informadas serão salvas no ticket e o atendimento será encerrado.',
      confirmText: 'Finalizar',
      cancelText: 'Cancelar',
      tone: 'confirm',
    });
    if (!ok) return;

    try {
      // 1) salva as tags do ticket (se houver)
      if (ticketNumber && tags.length) {
        await apiPost(`/tags/ticket/${encodeURIComponent(ticketNumber)}`, { tags });
      }

      // 2) encerra o ticket
      await apiPut(`/tickets/${encodeURIComponent(user_id)}`, { status: 'closed' });
      mergeConversation(user_id, { status: 'closed' });

      // 3) housekeeping de socket/UX
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

  return (
    <>
      <div className="chat-header">
        <div className="chat-header-left">
          <div className="nome-e-telefone">
            <span className="chat-header-nome">{name}</span>
            {ticketNumber && <a className="ticket-numero" title="Abrir histórico">{`#${String(ticketNumber).padStart(6,'0')}`}</a>}
          </div>

          {/* ===== Tags do ticket (chips + input — sem botão “Adicionar”) ===== */}
          <div className="ticket-tags">
            <Tag size={14} className="ticket-tags__icon" aria-hidden="true" />
            <div className="ticket-tags__chips">
              {/* lista as tags existentes */}
              {tags.map((t) => (
                <span className="chip chip--motivo" key={t} title="Tag do ticket">
                  {t}
                  <button
                    type="button"
                    className="chip-x"
                    onClick={() => removeTag(t)}
                    aria-label={`Remover tag ${t}`}
                    title="Remover"
                  >
                    <X size={12} />
                  </button>
                </span>
              ))}

              {/* campo único — adicionar com Enter, vírgula ou ponto-e-vírgula */}
              <input
                ref={inputRef}
                className="ticket-tags__input"
                placeholder={tags.length ? "Adicionar outra tag e Enter…" : "Adicionar tags do ticket e Enter…"}
                value={draft}
                onChange={(e) => setDraft(e.target.value)}
                onKeyDown={handleKeyDown}
                aria-label="Adicionar tag do ticket"
              />
            </div>
          </div>
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
