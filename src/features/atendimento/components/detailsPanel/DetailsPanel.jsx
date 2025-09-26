import React, { useEffect, useMemo, useState } from 'react';
import { Mail, Phone, IdCard, IdCardLanyard } from 'lucide-react';
import './styles/DetailsPanel.css';
import { stringToColor } from '../../utils/color';
import { apiGet } from '../../../../shared/apiClient';
import TicketChapterModal from '../modals/TicketChapterModal';

/** Debounce simples para inputs de texto */
function useDebounced(value, delay = 300) {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const id = setTimeout(() => setDebounced(value), delay);
    return () => clearTimeout(id);
  }, [value, delay]);
  return debounced;
}

function formatTicket(num) {
  if (num == null) return '—';
  try { return String(num).padStart(6, '0'); } catch { return String(num); }
}

export default function DetailsPanel({ userIdSelecionado, conversaSelecionada }) {
  const [historico, setHistorico] = useState([]);
  const [loadingHistorico, setLoadingHistorico] = useState(true);
  const [chapterModal, setChapterModal] = useState({ open: false, ticketId: null, ticketNumber: null });

  // ===== Filtros =====
  const [fltTicket, setFltTicket] = useState('');
  const [fltFila, setFltFila] = useState('');
  const [fltAgente, setFltAgente] = useState('');
  const [fltFrom, setFltFrom] = useState(''); // yyyy-mm-dd
  const [fltTo, setFltTo] = useState('');

  const debTicket = useDebounced(fltTicket, 200);
  const debFila   = useDebounced(fltFila, 200);
  const debAgente = useDebounced(fltAgente, 200);

  // sempre que trocar o cliente, reset
  useEffect(() => {
    setChapterModal({ open: false, ticketId: null, ticketNumber: null });
    setHistorico([]);
    setFltTicket('');
    setFltFila('');
    setFltAgente('');
    setFltFrom('');
    setFltTo('');
  }, [userIdSelecionado]);

  // Busca no servidor: SEMPRE filtra por userId (via q) e por período (from/to)
  useEffect(() => {
    if (!userIdSelecionado) return;
    setLoadingHistorico(true);

    const qs = new URLSearchParams({
      q: String(userIdSelecionado),
      page_size: '40', // permitido pela rota
      page: '1',
    });
    if (fltFrom) qs.set('from', fltFrom);
    if (fltTo)   qs.set('to', fltTo);

    apiGet(`/tickets/history?${qs.toString()}`)
      .then((res) => setHistorico(res?.data || []))
      .catch(() => setHistorico([]))
      .finally(() => setLoadingHistorico(false));
  }, [userIdSelecionado, fltFrom, fltTo]);

  // Filtros de ticket/fila/agente no cliente
  const historicoFiltrado = useMemo(() => {
    const t = debTicket.trim().toLowerCase();
    const f = debFila.trim().toLowerCase();
    const a = debAgente.trim().toLowerCase();

    return (historico || []).filter((item) => {
      const tk = String(item.ticket_number || '').toLowerCase();
      const fi = String(item.fila || '').toLowerCase();
      const ag = String(item.assigned_to || '').toLowerCase();

      if (t && !tk.includes(t)) return false;
      if (f && !fi.includes(f)) return false;
      if (a && !ag.includes(a)) return false;

      return true;
    });
  }, [historico, debTicket, debFila, debAgente]);

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
        {/* ===== Cartão de informações do contato ===== */}
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

        {/* ===== Histórico (Capítulos) ===== */}
        <div className="card historico-card">
          <h4 className="card-title">Capítulos (tickets fechados)</h4>

          {/* Filtros */}
          <div className="history-filter">
            <div className="hf-grid">
              <label className="hf-field">
                <span>Ticket</span>
                <input
                  className="hf-input"
                  type="text"
                  inputMode="numeric"
                  placeholder="Ex.: 000123"
                  value={fltTicket}
                  onChange={(e) => setFltTicket(e.target.value)}
                />
              </label>

              <label className="hf-field">
                <span>Fila</span>
                <input
                  className="hf-input"
                  type="text"
                  placeholder="Ex.: Agendamento"
                  value={fltFila}
                  onChange={(e) => setFltFila(e.target.value)}
                />
              </label>

              <label className="hf-field">
                <span>Atendente</span>
                <input
                  className="hf-input"
                  type="text"
                  placeholder="Ex.: Daniel"
                  value={fltAgente}
                  onChange={(e) => setFltAgente(e.target.value)}
                />
              </label>

              <label className="hf-field">
                <span>De</span>
                <input
                  className="hf-input hf-date"
                  type="date"
                  value={fltFrom}
                  onChange={(e) => setFltFrom(e.target.value)}
                />
              </label>

              <label className="hf-field">
                <span>Até</span>
                <input
                  className="hf-input hf-date"
                  type="date"
                  value={fltTo}
                  onChange={(e) => setFltTo(e.target.value)}
                />
              </label>

              {(fltTicket || fltFila || fltAgente || fltFrom || fltTo) && (
                <button
                  type="button"
                  className="hf-clear"
                  onClick={() => { setFltTicket(''); setFltFila(''); setFltAgente(''); setFltFrom(''); setFltTo(''); }}
                  title="Limpar filtros"
                >
                  Limpar
                </button>
              )}
            </div>
          </div>

          <div className="historico-content">
            {loadingHistorico ? (
              <p className="sem-historico">Carregando…</p>
            ) : historicoFiltrado.length === 0 ? (
              <p className="sem-historico">Nenhum capítulo encontrado</p>
            ) : (
              <ul className="historico-list">
                {historicoFiltrado.map((t) => {
                  const numFmt = formatTicket(t.ticket_number);
                  const when = t.updated_at || t.created_at;
                  return (
                    <li key={`${t.ticket_number}-${t.id}`} className="ticket-item">
                      <button
                        type="button"
                        className="ticket-card"
                        aria-label={`Abrir capítulo do ticket ${numFmt}`}
                        onClick={() => {
                          if (!t.id) return;
                          setChapterModal({ open: true, ticketId: t.id, ticketNumber: t.ticket_number });
                        }}
                      >
                        <div className="ticket-row">
                          <div className="ticket-title">
                            Ticket: <code>{numFmt}</code>
                          </div>
                          <div className="ticket-date">
                            {when ? new Date(when).toLocaleString('pt-BR') : '—'}
                          </div>
                        </div>

                        <div className="ticket-chips">
                          {t.fila && <span className="chip">Fila: {t.fila}</span>}
                          {t.assigned_to && <span className="chip chip--muted">Atendente: {t.assigned_to}</span>}
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

      {/* Modal de capítulo */}
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
