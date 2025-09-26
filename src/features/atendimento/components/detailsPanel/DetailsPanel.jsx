import React, { useEffect, useMemo, useState } from 'react';
import { Mail, Phone, IdCard, IdCardLanyard, Search, Users, Share2 } from 'lucide-react';
import './styles/DetailsPanel.css';
import { stringToColor } from '../../utils/color';
import { apiGet } from '../../../../shared/apiClient';
import TicketChapterModal from '../modals/TicketChapterModal';

/* ------- helpers ------- */
function padTicket(n) {
  if (n == null) return '—';
  try { return String(n).padStart(6, '0'); } catch { return String(n); }
}

/** Converte dd/mm/aaaa -> yyyy-mm-dd (se possível) */
function toIsoDate(s) {
  if (!s) return '';
  const t = String(s).trim();
  // yyyy-mm-dd direto
  if (/^\d{4}-\d{2}-\d{2}$/.test(t)) return t;
  // dd/mm/aaaa
  const m = t.match(/^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{4})$/);
  if (m) {
    const d = m[1].padStart(2, '0');
    const mo = m[2].padStart(2, '0');
    const y = m[3];
    return `${y}-${mo}-${d}`;
  }
  return '';
}

/**
 * Analisa a busca livre e extrai:
 * - from / to se houver (suporta "de:", "ate:" ou intervalo "..")
 * - tokens de texto (para filtrar ticket/fila/agente localmente)
 */
function parseSearch(q) {
  const raw = String(q || '').trim();

  if (!raw) return { tokens: [], from: '', to: '' };

  let from = '';
  let to = '';
  let text = raw;

  // 1) intervalo "A..B" (A e/ou B podem ser dd/mm/aaaa ou yyyy-mm-dd)
  const range = raw.match(/(\d{1,2}[\/\-]\d{1,2}[\/\-]\d{4}|\d{4}-\d{2}-\d{2})\s*\.\.\s*(\d{1,2}[\/\-]\d{1,2}[\/\-]\d{4}|\d{4}-\d{2}-\d{2})/);
  if (range) {
    from = toIsoDate(range[1]);
    to   = toIsoDate(range[2]);
    text = raw.replace(range[0], ' ').trim();
  }

  // 2) de:/ate: (ou from:/to:) — última ocorrência prevalece
  const pairs = [
    /(?:\bde:|\bfrom:)(\S+)/i,
    /(?:\bate:|\bto:)(\S+)/i
  ];
  const mFrom = raw.match(pairs[0]);
  const mTo   = raw.match(pairs[1]);
  if (mFrom) { const iso = toIsoDate(mFrom[1]); if (iso) from = iso; }
  if (mTo)   { const iso = toIsoDate(mTo[1]);   if (iso) to   = iso; }
  text = text.replace(pairs[0], ' ').replace(pairs[1], ' ').trim();

  // 3) tokens “livres”: ticket, fila, agente
  const tokens = text
    .split(/\s+/)
    .map(t => t.trim())
    .filter(Boolean);

  return { tokens, from, to };
}

/** Debounce simples p/ a busca */
function useDebounced(value, delay = 250) {
  const [v, setV] = useState(value);
  useEffect(() => {
    const id = setTimeout(() => setV(value), delay);
    return () => clearTimeout(id);
  }, [value, delay]);
  return v;
}

export default function DetailsPanel({ userIdSelecionado, conversaSelecionada }) {
  const [historico, setHistorico] = useState([]);
  const [loadingHistorico, setLoadingHistorico] = useState(true);
  const [chapterModal, setChapterModal] = useState({ open: false, ticketId: null, ticketNumber: null });

  // campo ÚNICO de busca
  const [query, setQuery] = useState('');
  const debouncedQuery = useDebounced(query, 250);
  const { tokens, from, to } = useMemo(() => parseSearch(debouncedQuery), [debouncedQuery]);

  // reset ao trocar de cliente
  useEffect(() => {
    setChapterModal({ open: false, ticketId: null, ticketNumber: null });
    setHistorico([]);
    setQuery('');
  }, [userIdSelecionado]);

  // Busca no servidor: SEMPRE por userId (q) + período deduzido do campo único
  useEffect(() => {
    if (!userIdSelecionado) return;
    setLoadingHistorico(true);

    const qs = new URLSearchParams({
      q: String(userIdSelecionado),  // restringe ao cliente
      page_size: '40',
      page: '1',
    });
    if (from) qs.set('from', from);
    if (to)   qs.set('to', to);

    apiGet(`/tickets/history?${qs.toString()}`)
      .then((res) => setHistorico(res?.data || []))
      .catch(() => setHistorico([]))
      .finally(() => setLoadingHistorico(false));
  }, [userIdSelecionado, from, to]);

  // Filtro local: tokens aplicados em ticket_number, fila, assigned_to
  const historicoFiltrado = useMemo(() => {
    const toks = (tokens || []).map(t => t.toLowerCase());
    if (!toks.length) return historico;

    return historico.filter(item => {
      const tk = String(item.ticket_number || '').toLowerCase();
      const fi = String(item.fila || '').toLowerCase();
      const ag = String(item.assigned_to || '').toLowerCase();

      // cada token deve bater em ALGUM dos campos
      return toks.every(q =>
        tk.includes(q) || fi.includes(q) || ag.includes(q)
      );
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
        {/* Informações do contato */}
        <div className="card info-card">
          <h4 className="card-title">Informações de Contato</h4>
          <div className="circle-initial-box">
            <div className="circle-initial" style={{ backgroundColor: stringToColor(nome) }}>
              {inicial}
            </div>
          </div>
          <h4 className="name-label">{nome}</h4>

          <div className="info-row">
            <Mail size={16} className="info-icon" />
            <span className="info-value">{conversaSelecionada.email || 'Não informado'}</span>
          </div>

          <div className="info-row">
            <Phone size={16} className="info-icon" />
            <span className="info-value">{conversaSelecionada.phone || 'Não informado'}</span>
          </div>

          <div className="info-row">
            <IdCard size={16} className="info-icon" />
            <span className="info-value">{documento || 'Não informado'}</span>
          </div>

          <div className="info-row">
            <IdCardLanyard size={16} className="info-icon" />
            <span className="info-value">{conversaSelecionada.user_id || 'Não informado'}</span>
          </div>
        </div>

        {/* Capítulos */}
        <div className="card historico-card">
          <h4 className="card-title">Capítulos (tickets fechados)</h4>

          {/* Campo único de busca */}
          <div className="history-search">
            <Search size={16} className="hs-icon" aria-hidden="true" />
            <input
              type="text"
              className="hs-input"
              placeholder="Busque por ticket, fila, atendente ou período. Ex.: 000030 agendamento daniel 22/08/2025..28/08/2025"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              aria-label="Buscar capítulos por ticket, fila, atendente ou período"
            />
            {query && (
              <button className="hs-clear" onClick={() => setQuery('')} aria-label="Limpar busca">×</button>
            )}
          </div>

          <div className="historico-content">
            {loadingHistorico ? (
              <p className="sem-historico">Carregando…</p>
            ) : historicoFiltrado.length === 0 ? (
              <p className="sem-historico">Nenhum capítulo encontrado</p>
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
                          <div className="ticket-title">
                            Ticket: <code>{padTicket(t.ticket_number)}</code>
                          </div>
                          <div className="ticket-date">
                            {when ? new Date(when).toLocaleString('pt-BR') : '—'}
                          </div>
                        </div>

                        <div className="ticket-chips">
                          {t.fila && (
                            <span className="chip" title="Fila">
                              <Share2 size={14} className="chip-ic" /> {t.fila}
                            </span>
                          )}
                          {t.assigned_to && (
                            <span className="chip chip--muted" title="Atendente">
                              <Users size={14} className="chip-ic" /> {t.assigned_to}
                            </span>
                          )}
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

      {/* Modal do capítulo */}
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
