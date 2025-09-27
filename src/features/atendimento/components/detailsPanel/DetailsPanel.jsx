import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Mail, Phone, IdCard, IdCardLanyard, Search, Users, Share2, Tag } from 'lucide-react';
import './styles/DetailsPanel.css';
import { stringToColor } from '../../utils/color';
import { apiGet } from '../../../../shared/apiClient';
import TicketChapterModal from '../modals/TicketChapterModal';

/* ---------- helpers ---------- */
function padTicket(n) {
  if (n == null) return '—';
  try { return String(n).padStart(6, '0'); } catch { return String(n); }
}

/** dd/mm/aaaa -> yyyy-mm-dd (ou mantém vazio) */
function toIsoDate(s) {
  if (!s) return '';
  const t = String(s).trim();
  if (/^\d{4}-\d{2}-\d{2}$/.test(t)) return t;
  const m = t.match(/^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{4})$/);
  if (m) return `${m[3]}-${m[2].padStart(2,'0')}-${m[1].padStart(2,'0')}`;
  return '';
}

/** Analisa o campo único: extrai período (from/to) e tokens livres */
function parseSearch(q) {
  const raw = String(q || '').trim();
  if (!raw) return { tokens: [], from: '', to: '' };

  let from = ''; let to = ''; let text = raw;

  const range = raw.match(/(\d{1,2}[\/\-]\d{1,2}[\/\-]\d{4}|\d{4}-\d{2}-\d{2})\s*\.\.\s*(\d{1,2}[\/\-]\d{1,2}[\/\-]\d{4}|\d{4}-\d{2}-\d{2})/);
  if (range) { from = toIsoDate(range[1]); to = toIsoDate(range[2]); text = raw.replace(range[0], ' ').trim(); }

  const mFrom = raw.match(/(?:\bde:|\bfrom:)(\S+)/i);
  const mTo   = raw.match(/(?:\bate:|\bto:)(\S+)/i);
  if (mFrom) { const iso = toIsoDate(mFrom[1]); if (iso) from = iso; }
  if (mTo)   { const iso = toIsoDate(mTo[1]);   if (iso) to   = iso; }
  text = text.replace(/(?:\bde:|\bfrom:)(\S+)/i, ' ')
             .replace(/(?:\bate:|\bto:)(\S+)/i, ' ')
             .trim();

  const tokens = text.split(/\s+/).map(t => t.trim()).filter(Boolean);
  return { tokens, from, to };
}

/** Debounce simples */
function useDebounced(value, delay = 250) {
  const [v, setV] = useState(value);
  useEffect(() => { const id = setTimeout(() => setV(value), delay); return () => clearTimeout(id); }, [value, delay]);
  return v;
}

export default function DetailsPanel({ userIdSelecionado, conversaSelecionada }) {
  const [historico, setHistorico] = useState([]);
  const [loadingHistorico, setLoadingHistorico] = useState(true);
  const [chapterModal, setChapterModal] = useState({ open: false, ticketId: null, ticketNumber: null });

  // campo ÚNICO de busca + ajuda “i”
  const [query, setQuery] = useState('');
  const debouncedQuery = useDebounced(query, 250);
  const { tokens, from, to } = useMemo(() => parseSearch(debouncedQuery), [debouncedQuery]);

  // apenas LISTAGEM de tags do cliente (sem edição)
  const [customerTags, setCustomerTags] = useState([]);

  // reset ao mudar o cliente
  useEffect(() => {
    setChapterModal({ open: false, ticketId: null, ticketNumber: null });
    setHistorico([]);
    setQuery('');
    setCustomerTags([]);

    (async () => {
      if (!userIdSelecionado) return;
      try {
        // GET /clientes/:user_id/tags -> { user_id, tags: ["a","b"] } OU objetos
        const res = await apiGet(`/clientes/${encodeURIComponent(userIdSelecionado)}/tags`);
        const arr = Array.isArray(res?.tags)
          ? res.tags.map((t) => (typeof t === 'string' ? t : t?.tag)).filter(Boolean)
          : [];
        setCustomerTags(arr);
      } catch {
        setCustomerTags([]);
      }
    })();
  }, [userIdSelecionado]);

  // busca histórico de tickets fechados do usuário + período
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

  // filtro local: tokens em ticket_number, fila, assigned_to (AND)
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

          {/* ===== Tags do cliente — somente se existirem ===== */}
          {customerTags.length > 0 && (
            <div className="contact-tags">
              <div className="contact-tags__label">
                <Tag size={14} style={{ marginRight: 6 }} /> Tags do cliente
              </div>
              <div className="contact-tags__chips">
                {customerTags.map((t) => (
                  <span className="chip chip--client" key={t} title="Tag do cliente">
                    {t}
                  </span>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* ===== Histórico de tickets ===== */}
        <div className="card historico-card">
          <h4 className="card-title">Histórico de tickets</h4>

          {/* Busca única + “i” com tooltip nativo */}
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

      {/* Modal */}
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
