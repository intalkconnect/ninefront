import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Mail, Phone, IdCard, IdCardLanyard, Search, Users, Share2, Tag as TagIcon, ChevronDown } from 'lucide-react';
import './styles/DetailsPanel.css';
import { stringToColor } from '../../utils/color';
import { apiGet } from '../../../../shared/apiClient';
import TicketChapterModal from '../modals/TicketChapterModal';
import useConversationsStore from '../../store/useConversationsStore';

/* ---------- helpers ---------- */
function padTicket(n) { return n == null ? '—' : String(n).padStart(6, '0'); }
function toIsoDate(s) {
  if (!s) return '';
  const t = String(s).trim();
  if (/^\d{4}-\d{2}-\d{2}$/.test(t)) return t;
  const m = t.match(/^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{4})$/);
  return m ? `${m[3]}-${m[2].padStart(2,'0')}-${m[1].padStart(2,'0')}` : '';
}
function parseSearch(q) {
  const raw = String(q || '').trim();
  if (!raw) return { tokens: [], from: '', to: '' };
  let from = ''; let to = ''; let text = raw;
  const range = raw.match(/(\d{1,2}[\/\-]\d{1,2}[\/\-]\d{4}|\d{4}-\d{2}-\d{2})\s*\.\.\s*(\d{1,2}[\/\-]\d{1,2}[\/\-]\d{4}|\d{4}-\d{2}-\d{2})/);
  if (range) { from = toIsoDate(range[1]); to = toIsoDate(range[2]); text = raw.replace(range[0], ' ').trim(); }
  const mFrom = raw.match(/(?:\bde:|\bfrom:)(\S+)/i);
  const mTo   = raw.match(/(?:\bate:|\bto:)(\S+)/i);
  if (mFrom) from = toIsoDate(mFrom[1]) || from;
  if (mTo)   to   = toIsoDate(mTo[1])   || to;
  text = text.replace(/(?:\bde:|\bfrom:)(\S+)/i, ' ').replace(/(?:\bate:|\bto:)(\S+)/i, ' ').trim();
  const tokens = text.split(/\s+/).map(t => t.trim()).filter(Boolean);
  return { tokens, from, to };
}

/* ----------------- Modal seletor de tags do cliente ----------------- */
function CustomerTagSelector({ open, onClose, userId, onApply }) {
  const [loading, setLoading] = useState(false);
  const [catalog, setCatalog] = useState([]); // catálogo global de cliente
  const [selected, setSelected] = useState(new Set()); // seleção local

  useEffect(() => {
    if (!open || !userId) return;
    let alive = true;
    (async () => {
      try {
        setLoading(true);
        // catálogo de cliente (global)
        const catRes = await apiGet(`/tags/customer/catalog?active=true&page_size=100`);
        const cat = Array.isArray(catRes?.data) ? catRes.data : [];

        // tags já vinculadas ao cliente
        const curRes = await apiGet(`/tags/customer/${encodeURIComponent(userId)}`);
        const cur = Array.isArray(curRes?.tags) ? curRes.tags.map(r => r.tag) : [];

        if (!alive) return;
        setCatalog(cat);
        setSelected(new Set(cur));
      } finally {
        if (alive) setLoading(false);
      }
    })();
    return () => { alive = false; };
  }, [open, userId]);

  const toggle = (tag) => {
    setSelected(prev => {
      const next = new Set(prev);
      next.has(tag) ? next.delete(tag) : next.add(tag);
      return next;
    });
  };

  const apply = () => { onApply([...selected]); onClose(); };

  if (!open) return null;
  return (
    <div className="modal-overlay" role="dialog" aria-modal="true" aria-label="Selecionar tags do cliente">
      <div className="modal-card">
        <div className="modal-header">
          <h3>Tags do cliente</h3>
          <button className="modal-close" onClick={onClose} aria-label="Fechar">×</button>
        </div>
        <div className="modal-body">
          {loading ? (
            <p>Carregando catálogo…</p>
          ) : catalog.length === 0 ? (
            <p>Nenhuma tag disponível no catálogo.</p>
          ) : (
            <ul className="tag-checklist">
              {catalog.map((item) => {
                const key = String(item?.tag || '').trim();
                if (!key) return null;
                const label = item?.label || key;
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

/* ======================= Painel ======================= */
export default function DetailsPanel({ userIdSelecionado, conversaSelecionada }) {
  const [historico, setHistorico] = useState([]);
  const [loadingHistorico, setLoadingHistorico] = useState(true);
  const [chapterModal, setChapterModal] = useState({ open: false, ticketId: null, ticketNumber: null });

  // busca única
  const [query, setQuery] = useState('');
  const [debounced, setDebounced] = useState(query);
  useEffect(() => { const id = setTimeout(() => setDebounced(query), 250); return () => clearTimeout(id); }, [query]);
  const { tokens, from, to } = useMemo(() => parseSearch(debounced), [debounced]);

  // seletor/estado de tags do cliente
  const [openCustomerSelector, setOpenCustomerSelector] = useState(false);
  const [customerTags, setCustomerTags] = useState([]); // exibição
  const mergeConversation = useConversationsStore((s) => s.mergeConversation);

  // reset ao mudar o cliente
  useEffect(() => {
    setChapterModal({ open: false, ticketId: null, ticketNumber: null });
    setHistorico([]);
    setQuery('');
    setCustomerTags([]);

    (async () => {
      if (!userIdSelecionado) return;
      try {
        const res = await apiGet(`/tags/customer/${encodeURIComponent(userIdSelecionado)}`);
        const arr = Array.isArray(res?.tags) ? res.tags.map(r => r.tag) : [];
        setCustomerTags(arr);
        // não persiste; guarda como "seleção atual" no store para o ChatHeader salvar no Finalizar
        mergeConversation(userIdSelecionado, { customer_tags_draft: arr });
      } catch {
        setCustomerTags([]);
        mergeConversation(userIdSelecionado, { customer_tags_draft: [] });
      }
    })();
  }, [userIdSelecionado, mergeConversation]);

  // histórico de tickets do usuário
  useEffect(() => {
    if (!userIdSelecionado) return;
    setLoadingHistorico(true);

    const qs = new URLSearchParams({ q: String(userIdSelecionado), page_size: '40', page: '1' });
    if (from) qs.set('from', from);
    if (to)   qs.set('to', to);

    apiGet(`/tickets/history?${qs.toString()}`)
      .then(res => setHistorico(res?.data || []))
      .catch(() => setHistorico([]))
      .finally(() => setLoadingHistorico(false));
  }, [userIdSelecionado, from, to]);

  const historicoFiltrado = useMemo(() => {
    const toks = (tokens || []).map(t => t.toLowerCase());
    if (!toks.length) return historico;
    return historico.filter(item => {
      const tk = String(item.ticket_number || '').toLowerCase();
      const fi = String(item.fila || '').toLowerCase();
      const ag = String(item.assigned_to || '').toLowerCase();
      return toks.every(q => tk.includes(q) || fi.includes(q) || ag.includes(q));
    });
  }, [historico, tokens]);

  if (!userIdSelecionado || !conversaSelecionada) {
    return (
      <div className="card painel-vazio">
        <div className="conteudo-vazio">
          <p className="mensagem-vazia">Nenhum cliente selecionado.</p>
          <p className="submensagem-vazia">Selecione um cliente na lista para exibir os dados.</p>
        </div>
      </div>
    );
  }

  const nome = conversaSelecionada.name || 'Não identificado';
  const inicial = nome.charAt(0).toUpperCase();
  const documento = conversaSelecionada.documento;

  const hasCustomerTags = customerTags.length > 0;

  const applyCustomerTags = (arr) => {
    setCustomerTags(arr);
    mergeConversation(userIdSelecionado, { customer_tags_draft: arr });
  };

  return (
    <>
      <div className="details-panel-container full-layout">
        {/* ===== Informações de contato ===== */}
        <div className="card info-card">
          <h4 className="card-title">Informações de Contato</h4>
          <div className="circle-initial-box">
            <div className="circle-initial" style={{ backgroundColor: stringToColor(nome) }}>
              {inicial}
            </div>
          </div>
          <h4 className="name-label">{nome}</h4>

          <div className="info-row"><Mail size={16} className="info-icon" /><span className="info-value">{conversaSelecionada.email || 'Não informado'}</span></div>
          <div className="info-row"><Phone size={16} className="info-icon" /><span className="info-value">{conversaSelecionada.phone || 'Não informado'}</span></div>
          <div className="info-row"><IdCardLanyard size={16} className="info-icon" /><span className="info-value">{conversaSelecionada.user_id || 'Não informado'}</span></div>

          {/* ===== Tags do cliente ===== */}
          <div className="contact-tags">
            <div className="contact-tags__label">
              <TagIcon size={14} style={{ marginRight: 6 }} /> Tags do cliente
              <button
                className="btn-tags btn-tags--small"
                onClick={() => setOpenCustomerSelector(true)}
                title="Selecionar tags do cliente"
                aria-label="Selecionar tags do cliente"
              >
                <span>Selecionar</span>
                <ChevronDown size={14} />
              </button>
            </div>

            {hasCustomerTags && (
              <div className="contact-tags__chips">
                {customerTags.map((t) => (
                  <span className="chip chip--client" key={t}>{t}</span>
                ))}
              </div>
            )}
            {!hasCustomerTags && (
              <div className="chips-empty">Nenhuma tag</div>
            )}
          </div>
        </div>

        {/* ===== Histórico de tickets ===== */}
        <div className="card historico-card">
          <h4 className="card-title">Histórico de tickets</h4>

          <div className="history-search">
            <Search size={16} className="hs-icon" aria-hidden="true" />
            <input
              type="text"
              className="hs-input"
              placeholder="Buscar por número do ticket, fila, atendente ou período…"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              aria-label="Buscar por número do ticket, fila, atendente ou período"
            />
            {query && (<button className="hs-clear" onClick={() => setQuery('')} aria-label="Limpar busca">×</button>)}
          </div>

          <div className="historico-content">
            {loadingHistorico ? (
              <p className="sem-historico">Carregando…</p>
            ) : historicoFiltrado.length === 0 ? (
              <p className="sem-historico">Nenhum ticket encontrado</p>
            ) : (
              <ul className="historico-list">
                {historicoFiltrado.map((t) => {
                  const when = t.updated_at || t.created_at;
                  return (
                    <li key={`${t.ticket_number}-${t.id}`} className="ticket-item">
                      <button
                        type="button"
                        className="ticket-card"
                        aria-label={`Abrir capítulo do ticket ${padTicket(t.ticket_number)}`}
                        onClick={() => setChapterModal({ open: true, ticketId: t.id, ticketNumber: t.ticket_number })}
                      >
                        <div className="ticket-row">
                          <div className="ticket-title">Ticket: <code>{padTicket(t.ticket_number)}</code></div>
                          <div className="ticket-date">{when ? new Date(when).toLocaleString('pt-BR') : '—'}</div>
                        </div>
                        <div className="ticket-chips">
                          {t.fila && <span className="chip"><Share2 size={14} className="chip-ic" />{t.fila}</span>}
                          {t.assigned_to && <span className="chip chip--muted"><Users size={14} className="chip-ic" />{t.assigned_to}</span>}
                        </div>
                      </button>
                    </li>
                  );
                })}
              </ul>
            )}
          </div>
        </div>
      </div>

      {/* Modais */}
      <TicketChapterModal
        open={chapterModal.open}
        onClose={() => setChapterModal({ open: false, ticketId: null, ticketNumber: null })}
        userId={userIdSelecionado}
        ticketId={chapterModal.ticketId}
        ticketNumber={chapterModal.ticketNumber}
      />

      <CustomerTagSelector
        open={openCustomerSelector}
        onClose={() => setOpenCustomerSelector(false)}
        userId={userIdSelecionado}
        onApply={applyCustomerTags}
      />
    </>
  );
}
