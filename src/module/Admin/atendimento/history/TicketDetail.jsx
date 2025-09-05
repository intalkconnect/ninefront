// src/pages/TicketDetail.jsx
import React, { useEffect, useState, useCallback } from 'react';
import { useParams, useNavigate, Link, useLocation } from 'react-router-dom';
import ChatThread from './components/ChatThread';

// ajuste este import para o seu cliente HTTP central
import { apiGet } from '../../shared/apiClient'; 

function fmtDateTime(iso) {
  if (!iso) return '—';
  try {
    const d = new Date(iso);
    return d.toLocaleString('pt-BR', {
      day:'2-digit', month:'2-digit', year:'2-digit',
      hour:'2-digit', minute:'2-digit'
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
      const resp = await apiGet(`/tickets/${id}?include=messages&messages_limit=100`);
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

  if (loading) return <div style={{ padding: 16 }}>Carregando…</div>;
  if (err) return (
    <div style={{ padding: 16 }}>
      <button onClick={handleBack} style={{ marginRight: 8 }}>← Voltar</button>
      <button onClick={load}>Tentar novamente</button>
      <p style={{ marginTop: 12 }}>{err}</p>
    </div>
  );
  if (!ticket) return (
    <div style={{ padding: 16 }}>
      <button onClick={handleBack} style={{ marginRight: 8 }}>← Voltar</button>
      <p>Ticket não encontrado.</p>
    </div>
  );

  return (
    <div style={{ padding: 16, display: 'grid', gap: 16 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          <button onClick={handleBack} title="Voltar">←</button>
          <h1 style={{ margin: 0, fontSize: 22, fontWeight: 800 }}>
            Ticket #{String(ticket.ticket_number || id).padStart(6, '0')}
          </h1>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <button onClick={load} title="Atualizar">Atualizar</button>
          <Link to="/tickets">Histórico</Link>
        </div>
      </div>

      <div style={{ display: 'grid', gap: 8, padding: 12, border: '1px solid #eef2f7', borderRadius: 12 }}>
        <div><strong>User ID:</strong> {ticket.user_id || '—'}</div>
        <div><strong>Fila:</strong> {ticket.fila || '—'}</div>
        <div><strong>Atendente:</strong> {ticket.assigned_to || '—'}</div>
        <div><strong>Status:</strong> {ticket.status || '—'}</div>
        <div><strong>Criado:</strong> {fmtDateTime(ticket.created_at)}</div>
        <div><strong>Atualizado:</strong> {fmtDateTime(ticket.updated_at)}</div>
        {ticket.closed_at && <div><strong>Fechado:</strong> {fmtDateTime(ticket.closed_at)}</div>}
      </div>

      <div style={{ border: '1px solid #eef2f7', borderRadius: 12, padding: 12 }}>
        <h2 style={{ marginTop: 0 }}>Conversa</h2>
        <ChatThread messages={ticket.messages || []} />
      </div>
    </div>
  );
}
