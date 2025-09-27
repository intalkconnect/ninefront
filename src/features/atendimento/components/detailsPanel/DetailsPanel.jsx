import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Mail, Phone, IdCard, IdCardLanyard, Search, Users, Share2, Tag as TagIcon } from 'lucide-react';
import './styles/DetailsPanel.css';
import { stringToColor } from '../../utils/color';
import { apiGet, apiPost, apiDelete } from '../../../../shared/apiClient';
import TicketChapterModal from '../modals/TicketChapterModal';

/* helpers */
function padTicket(n) { if (n == null) return '—'; try { return String(n).padStart(6, '0'); } catch { return String(n); } }
function toIsoDate(s){ if(!s)return''; const t=String(s).trim(); if(/^\d{4}-\d{2}-\d{2}$/.test(t))return t; const m=t.match(/^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{4})$/); return m?`${m[3]}-${m[2].padStart(2,'0')}-${m[1].padStart(2,'0')}`:'';}
function parseSearch(q){ const raw=String(q||'').trim(); if(!raw) return {tokens:[],from:'',to:''}; let from='',to='',text=raw; const range=raw.match(/(\d{1,2}[\/\-]\d{1,2}[\/\-]\d{4}|\d{4}-\d{2}-\d{2})\s*\.\.\s*(\d{1,2}[\/\-]\d{1,2}[\/\-]\d{4}|\d{4}-\d{2}-\d{2})/); if(range){from=toIsoDate(range[1]); to=toIsoDate(range[2]); text=raw.replace(range[0],' ').trim();} const mFrom=raw.match(/(?:\bde:|\bfrom:)(\S+)/i); const mTo=raw.match(/(?:\bate:|\bto:)(\S+)/i); if(mFrom){const iso=toIsoDate(mFrom[1]); if(iso) from=iso;} if(mTo){const iso=toIsoDate(mTo[1]); if(iso) to=iso;} text=text.replace(/(?:\bde:|\bfrom:)(\S+)/i,' ').replace(/(?:\bate:|\bto:)(\S+)/i,' ').trim(); const tokens=text.split(/\s+/).map(t=>t.trim()).filter(Boolean); return {tokens,from,to};}
function useDebounced(value, delay=250){ const [v,setV]=useState(value); useEffect(()=>{const id=setTimeout(()=>setV(value),delay); return ()=>clearTimeout(id);},[value,delay]); return v;}

/** Listbox de catálogo para cliente */
function CustomerTagsListbox({ userId, selected, onChange }) {
  const [open, setOpen] = useState(false);
  const [catalog, setCatalog] = useState([]);
  const ref = useRef(null);

  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const r = await apiGet('/clientes/catalog?active=true&page_size=100');
        const data = Array.isArray(r?.data) ? r.data : [];
        if (!alive) return;
        setCatalog(data);
      } catch { setCatalog([]); }
    })();
    return () => { alive = false; };
  }, [userId]);

  useEffect(() => {
    const onDoc = (e) => { if (!ref.current) return; if (!ref.current.contains(e.target)) setOpen(false); };
    document.addEventListener('mousedown', onDoc);
    return () => document.removeEventListener('mousedown', onDoc);
  }, []);

  const toggle = (val) => {
    const has = selected.includes(val);
    const next = has ? selected.filter(t => t !== val) : [...selected, val];
    onChange(next);
  };

  return (
    <div className="tags-lb" ref={ref}>
      <button type="button" className="tags-lb__button" onClick={() => setOpen(o => !o)}>
        <TagIcon size={14} /> <span>Tags</span> <span className="tags-lb__caret">▾</span>
      </button>
      {open && (
        <div className="tags-lb__panel" role="listbox" aria-label="Tags do cliente">
          {catalog.length === 0 ? (
            <div className="tags-lb__empty">Nenhuma tag disponível</div>
          ) : catalog.map(opt => (
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

export default function DetailsPanel({ userIdSelecionado, conversaSelecionada }) {
  const [historico, setHistorico] = useState([]);
  const [loadingHistorico, setLoadingHistorico] = useState(true);
  const [chapterModal, setChapterModal] = useState({ open: false, ticketId: null, ticketNumber: null });

  // busca única
  const [query, setQuery] = useState('');
  const debouncedQuery = useDebounced(query, 250);
  const { tokens, from, to } = useMemo(() => parseSearch(debouncedQuery), [debouncedQuery]);

  // tags do cliente
  const [customerTags, setCustomerTags] = useState([]);

  // reset ao mudar cliente
  useEffect(() => {
    setChapterModal({ open: false, ticketId: null, ticketNumber: null });
    setHistorico([]);
    setQuery('');

    (async () => {
      if (userIdSelecionado) {
        try {
          const r = await apiGet(`/clientes/${encodeURIComponent(userIdSelecionado)}/tags`);
          const arr = Array.isArray(r?.tags) ? r.tags.map(x => x.tag || x) : [];
          setCustomerTags(arr);
        } catch { setCustomerTags([]); }
      } else {
        setCustomerTags([]);
      }
    })();
  }, [userIdSelecionado]);

  // expõe no store para o ChatHeader salvar ao finalizar
  useEffect(() => {
    // opcional: sincronizar no store global se você usa isso em outros lugares
    // useConversationsStore.getState().mergeConversation(userIdSelecionado, { customer_tags: customerTags });
    const merge = require('../../../store/useConversationsStore').default.getState().mergeConversation;
    if (userIdSelecionado) merge(userIdSelecionado, { customer_tags: customerTags });
  }, [customerTags, userIdSelecionado]);

  // salvar incremental cliente (POST adiciona várias; DELETE por item removido)
  const applyCustomerTags = async (next) => {
    const toAdd = next.filter(t => !customerTags.includes(t));
    const toDel = customerTags.filter(t => !next.includes(t));
    try {
      if (toAdd.length) await apiPost(`/clientes/${encodeURIComponent(userIdSelecionado)}/tags`, { tags: toAdd });
      for (const t of toDel) { try { await apiDelete(`/clientes/${encodeURIComponent(userIdSelecionado)}/tags/${encodeURIComponent(t)}`); } catch {} }
      setCustomerTags(next);
    } catch (e) {
      console.error('Falha ao salvar tags do cliente', e);
    }
  };

  // busca histórico
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
          <div className="info-row"><IdCard size={16} className="info-icon" /><span className="info-value">{documento || 'Não informado'}</span></div>
          <div className="info-row"><IdCardLanyard size={16} className="info-icon" /><span className="info-value">{conversaSelecionada.user_id || 'Não informado'}</span></div>

          {/* ===== Tags do cliente ===== */}
          <div className="contact-tags">
            <div className="contact-tags__label">
              <TagIcon size={14} style={{ marginRight: 6 }} /> Tags do cliente
            </div>

            {/* chips apenas se houver selecionadas */}
            {customerTags.length > 0 && (
              <div className="contact-tags__chips" style={{ marginBottom: 8 }}>
                {customerTags.map((t) => (
                  <span className="chip chip--client" key={t}>{t}</span>
                ))}
              </div>
            )}

            {/* listbox sempre visível (sem digitação livre) */}
            <CustomerTagsListbox
              userId={userIdSelecionado}
              selected={customerTags}
              onChange={applyCustomerTags}
            />
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
              placeholder="Buscar por número do ticket, fila, atendente ou período. Ex.: 000030 agendamento daniel 22/08/2025..28/08/2025"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              aria-label="Buscar por número do ticket, fila, atendente ou período"
            />
            {query && (
              <button className="hs-clear" onClick={() => setQuery('')} aria-label="Limpar busca">×</button>
            )}
            <i
              className="hs-help-i"
              title={[
                "Use um único campo para filtrar por ticket, fila, atendente e período.",
                "Os termos se combinam (AND).",
                "",
                "Exemplos:",
                "• 000030 agendamento daniel",
                "• agendamento 22/08/2025..28/08/2025",
                "• de:2025-08-20 ate:2025-08-28",
                "",
                "Datas: dd/mm/aaaa ou aaaa-mm-dd. Intervalo com .."
              ].join("\n")}
            />
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

      <TicketChapterModal
        open={chapterModal.open}
        onClose={() => setChapterModal({ open: false, ticketId: null, ticketNumber: null })}
        userId={userIdSelecionado}
        ticketId={chapterModal.ticketId}
        ticketNumber={chapterModal.ticketNumber}
      />
    </>
  );
}
