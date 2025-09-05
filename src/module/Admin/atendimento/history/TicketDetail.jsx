// src/pages/TicketDetail.jsx
import React, { useEffect, useState, useCallback } from 'react';
import { useParams, useNavigate, Link, useLocation } from 'react-router-dom';
import ChatThread from '../components/ChatThread';
import styles from './styles/TicketDetail.module.css';

// ajuste para seu http client
import { apiGet } from '../../shared/apiClient';

function fmtDateTime(iso) {
  if (!iso) return '—';
  try {
    const d = new Date(iso);
    return d.toLocaleString('pt-BR', {
      day: '2-digit', month: '2-digit', year: '2-digit',
      hour: '2-digit', minute: '2-digit'
    });
  } catch { return '—'; }
}

export default function TicketDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const location = useLocation();

  const [ticket, setTicket] = useState(null);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState(null);

  const load = useCallback(async () => {
    setLoading(true); setErr(null);
    try {
      const resp = await apiGet(`/tickets/history/${id}?include=messages&messages_limit=100`);
      setTicket(resp?.data || resp || null);
    } catch (e) {
      console.error(e);
      setErr('Não foi possível carregar o ticket.');
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => { load(); }, [load]);

  const handleBack = () => {
    const back = location.state?.returnTo || '/tickets';
    navigate(back);
  };

  if (loading) return <div className={styles.page}>Carregando…</div>;
  if (err) return (
    <div className={styles.page}>
      <div className={styles.header}>
        <button onClick={handleBack} className={styles.btnBack}>← Voltar</button>
        <div className={styles.actions}>
          <button onClick={load} className={styles.btn}>Tentar novamente</button>
          <Link to="/tickets" className={styles.link}>Histórico</Link>
        </div>
      </div>
      <p className={styles.error}>{err}</p>
    </div>
  );
  if (!ticket) return (
    <div className={styles.page}>
      <div className={styles.header}>
        <button onClick={handleBack} className={styles.btnBack}>← Voltar</button>
      </div>
      <p>Ticket não encontrado.</p>
    </div>
  );

  return (
    <div className={styles.page}>
      <div className={styles.header}>
        <div className={styles.titleRow}>
          <button onClick={handleBack} className={styles.btnBack} title="Voltar">←</button>
          <h1 className={styles.title}>
            Ticket #{String(ticket.ticket_number || id).padStart(6, '0')}
          </h1>
        </div>
        <div className={styles.actions}>
          <button onClick={load} className={styles.btn}>Atualizar</button>
          <Link to="/tickets" className={styles.link}>Histórico</Link>
        </div>
      </div>

      <div className={styles.card}>
        <div><strong>User ID:</strong> {ticket.user_id || '—'}</div>
        <div><strong>Fila:</strong> {ticket.fila || '—'}</div>
        <div><strong>Atendente:</strong> {ticket.assigned_to || '—'}</div>
        <div><strong>Status:</strong> {ticket.status || '—'}</div>
        <div><strong>Criado:</strong> {fmtDateTime(ticket.created_at)}</div>
        <div><strong>Atualizado:</strong> {fmtDateTime(ticket.updated_at)}</div>
        {ticket.closed_at && <div><strong>Fechado:</strong> {fmtDateTime(ticket.closed_at)}</div>}
      </div>

      <div className={styles.card}>
        <h2 className={styles.subtitle}>Conversa</h2>
        <ChatThread messages={ticket.messages || []} />
      </div>
    </div>
  );
}
