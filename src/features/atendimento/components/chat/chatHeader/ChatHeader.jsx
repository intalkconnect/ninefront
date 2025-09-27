import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Share2, CheckCircle, Tag, X, Plus } from 'lucide-react';
import useConversationsStore from '../../../store/useConversationsStore';
import { apiGet, apiPut } from "../../../../../shared/apiClient";
import { getSocket } from '../../../services/socket';
import TransferModal from '../modals/transfer/Transfer';
import './styles/ChatHeader.css';

/* =========================================================
   ADAPTER DE PERSISTÊNCIA (pronto p/ endpoints, com fallback)
   ========================================================= */
const USE_API = false; // ⬅️ quando criar os endpoints, troque para true

const LS_TICKET_KEY = (ticketNumber) => `ticket:tags:${String(ticketNumber || '')}`;

async function fetchTicketTags(ticketNumber) {
  if (USE_API) {
    // ⬇️ EXEMPLO (ajuste para o seu endpoint)
    // const res = await apiGet(`/tickets/${encodeURIComponent(ticketNumber)}/tags`);
    // return Array.isArray(res?.tags) ? res.tags : [];
    return []; // placeholder até endpoints existirem
  }
  try {
    const raw = localStorage.getItem(LS_TICKET_KEY(ticketNumber));
    const arr = raw ? JSON.parse(raw) : [];
    return Array.isArray(arr) ? arr : [];
  } catch {
    return [];
  }
}
async function updateTicketTags(ticketNumber, tags) {
  if (USE_API) {
    // ⬇️ EXEMPLO (ajuste para o seu endpoint)
    // await apiPut(`/tickets/${encodeURIComponent(ticketNumber)}/tags`, { tags });
    return;
  }
  try { localStorage.setItem(LS_TICKET_KEY(ticketNumber), JSON.stringify(tags)); } catch {}
}

/* SUGESTÕES (ajuste livre para o seu negócio) */
const MOTIVO_SUGESTOES = [
  'Suporte',
  'Cobrança',
  'Troca',
  'Cancelamento',
  'Informação',
  'Reclamação',
  'Proposta',
  'Acompanhamento',
  'Financeiro',
  'Técnico',
];

export default function ChatHeader({ userIdSelecionado }) {
  const [showTransferModal, setShowTransferModal] = useState(false);
  const clienteAtivo       = useConversationsStore((state) => state.clienteAtivo);
  const mergeConversation  = useConversationsStore((state) => state.mergeConversation);
  const setSelectedUserId  = useConversationsStore((state) => state.setSelectedUserId);

  const [tags, setTags] = useState([]);
  const [draft, setDraft] = useState('');
  const inputRef = useRef(null);

  const ticketNumber = clienteAtivo?.ticket_number || '000000';
  const name         = clienteAtivo?.name || 'Cliente';
  const user_id      = clienteAtivo?.user_id || userIdSelecionado;

  // carrega tags do ticket ao trocar de ticket
  useEffect(() => {
    let alive = true;
    (async () => {
      const t = await fetchTicketTags(ticketNumber);
      if (!alive) return;
      setTags(t);
      // propaga no store (útil para listagens, se quiser exibir)
      mergeConversation(user_id, { motivo_tags: t });
    })();
    return () => { alive = false; };
  }, [ticketNumber, user_id, mergeConversation]);

  // salvar
  const persist = async (next) => {
    setTags(next);
    await updateTicketTags(ticketNumber, next);
    mergeConversation(user_id, { motivo_tags: next });
  };

  // adicionar/remover
  const addTag = async (raw) => {
    const v = String(raw || '').trim();
    if (!v) return;
    if (tags.includes(v)) { setDraft(''); return; }
    await persist([...tags, v]);
    setDraft('');
  };
  const removeTag = async (t) => {
    await persist(tags.filter(x => x !== t));
  };

  // atalhos do input
  const handleKeyDown = (e) => {
    if (e.key === 'Enter') { e.preventDefault(); addTag(draft); }
    if (e.key === ',' || e.key === ';') { e.preventDefault(); addTag(draft); }
    if (e.key === 'Backspace' && !draft && tags.length) { e.preventDefault(); removeTag(tags[tags.length - 1]); }
  };

  if (!clienteAtivo) return null;

  const finalizarAtendimento = async () => {
    const confirm = window.confirm('Deseja finalizar este atendimento?');
    if (!confirm) return;

    try {
      await apiPut(`/tickets/${user_id}`, { status: 'closed' });
      mergeConversation(user_id, { status: 'closed' });

      const socket = getSocket();
      if (socket?.connected) socket.emit('leave_room', user_id);

      try { window.dispatchEvent(new CustomEvent('room-closed', { detail: { userId: user_id } })); } catch {}

      setSelectedUserId(null);
    } catch (err) {
      console.error('Erro ao finalizar ticket:', err);
      alert('Erro ao finalizar atendimento.');
    }
  };

  return (
    <>
      <div className="chat-header">
        <div className="chat-header-left">
          <div className="nome-e-telefone">
            <span className="chat-header-nome">{name}</span>
            <span className="ticket-numero">#{ticketNumber}</span>
          </div>

          {/* ===== Tags de MOTIVO (múltiplas) ===== */}
          <div className="ticket-tags">
            <Tag size={14} className="ticket-tags__icon" aria-hidden="true" />
            <div className="ticket-tags__chips">
              {tags.map((t) => (
                <span className="chip chip--motivo" key={t} title="Tag de motivo">
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
              <input
                ref={inputRef}
                list="motivo-sugestoes"
                className="ticket-tags__input"
                placeholder={tags.length ? "Adicionar outra tag…" : "Adicionar tags de motivo…"}
                value={draft}
                onChange={(e) => setDraft(e.target.value)}
                onKeyDown={handleKeyDown}
                aria-label="Adicionar tag de motivo"
              />
              <datalist id="motivo-sugestoes">
                {MOTIVO_SUGESTOES.map((opt) => (
                  <option key={opt} value={opt} />
                ))}
              </datalist>
              <button type="button" className="ticket-tags__add" onClick={() => addTag(draft)} aria-label="Adicionar tag">
                <Plus size={14} /> <span>Adicionar</span>
              </button>
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
