import React, { useEffect, useState } from 'react';
import { Mail, Phone, IdCard, IdCardLanyard } from 'lucide-react';
import './styles/DetailsPanel.css';
import { stringToColor } from '../../utils/color';
import { apiGet } from '../../../../shared/apiClient';
import TicketChapterModal from '../modals/TicketChapterModal';

export default function DetailsPanel({ userIdSelecionado, conversaSelecionada }) {
  const [historico, setHistorico] = useState([]);
  const [loadingHistorico, setLoadingHistorico] = useState(true);
  const [chapterModal, setChapterModal] = useState({ open: false, ticketId: null, ticketNumber: null });

  // limpa modal e histórico ao trocar de cliente
  useEffect(() => {
    setChapterModal({ open: false, ticketId: null, ticketNumber: null });
    setHistorico([]);
  }, [userIdSelecionado]);

  // busca capítulos no /tickets/history filtrando por user_id no "q"
  useEffect(() => {
    if (!userIdSelecionado) return;
    setLoadingHistorico(true);

    const qs = new URLSearchParams({
      q: String(userIdSelecionado),
      page_size: '40', // permitido: 10, 20, 30, 40
      page: '1',
    });

    apiGet(`/tickets/history?${qs.toString()}`)
      .then((res) => setHistorico(res?.data || []))
      .catch(() => setHistorico([]))
      .finally(() => setLoadingHistorico(false));
  }, [userIdSelecionado]);

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

        <div className="card historico-card">
          <h4 className="card-title">Capítulos (tickets fechados)</h4>
          <div className="historico-content">
            {loadingHistorico ? (
              <p className="sem-historico">Carregando…</p>
            ) : historico.length === 0 ? (
              <p className="sem-historico">Sem capítulos encontrados</p>
            ) : (
              <ul className="historico-list">
                {historico.map((t) => {
                  const ticketNum = t.ticket_number;
                  const when = t.updated_at || t.created_at;
                  return (
                    <li key={`${ticketNum}-${t.id}`} className="ticket-item">
                      <button
                        type="button"
                        className="ticket-card"
                        onClick={() => {
                          if (!t.id) return;
                          setChapterModal({
                            open: true,
                            ticketId: t.id,               // usado para /tickets/history/:id
                            ticketNumber: t.ticket_number // só título
                          });
                        }}
                        style={{ width: '100%', textAlign: 'left', background: 'transparent', border: 0, cursor: 'pointer' }}
                      >
                        <div className="ticket-title">Ticket: {ticketNum || '—'}</div>
                        <div className="ticket-date">
                          {when ? new Date(when).toLocaleString('pt-BR') : '—'}
                        </div>
                        {t.fila && <div className="ticket-queue">Fila: {t.fila}</div>}
                        {t.assigned_to && <div className="ticket-agent">Atendente: {t.assigned_to}</div>}
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
        messagesInMemory={conversaSelecionada?.messages || []}
      />
    </>
  );
}
