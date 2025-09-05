import React, { useEffect, useState, useMemo } from 'react';
import { useNavigate, useParams, useLocation } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';
import ChatThread from './ChatThread';

import styles from './styles/TicketDetail.module.css';
import { apiGet } from '../../../../shared/apiClient'; // ajuste o caminho se necessário

function fmtDT(iso) {
  if (!iso) return '—';
  try {
    const d = new Date(iso);
    return d.toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', year: '2-digit', hour: '2-digit', minute: '2-digit' });
  } catch { return '—'; }
}

export default function TicketDetail() {
  const { id } = useParams();
  const nav = useNavigate();
  const location = useLocation();

  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState(null);

  const backTo = useMemo(() => location.state?.returnTo || '/management/history', [location.state]);

  useEffect(() => {
    let mounted = true;
    (async () => {
      setLoading(true);
      setErr(null);
      try {
        const res = await apiGet(`/tickets/history/${id}?include=messages&messages_limit=200`);
        if (mounted) setData(res);
      } catch (e) {
        if (mounted) setErr('Falha ao carregar o ticket.');
      } finally {
        if (mounted) setLoading(false);
      }
    })();
    return () => { mounted = false; };
  }, [id]);

  const messages = data?.messages || [];

  return (
    <div className={styles.page}>
      <div className={styles.header}>
        <button className={styles.backBtn} onClick={() => nav(backTo)}>
          <ArrowLeft size={16}/> Voltar
        </button>
        <h1 className={styles.title}>Ticket #{String(data?.ticket_number || '').padStart(6, '0')}</h1>
      </div>

      <div className={styles.card}>
        <div className={styles.infoGrid}>
          <div><span className={styles.k}>User ID:</span> <span className={styles.v}>{data?.user_id || '—'}</span></div>
          <div><span className={styles.k}>Fila:</span> <span className={styles.v}>{data?.fila || '—'}</span></div>
          <div><span className={styles.k}>Atendente:</span> <span className={styles.v}>{data?.assigned_to || '—'}</span></div>
          <div><span className={styles.k}>Status:</span> <span className={styles.v}>{data?.status || '—'}</span></div>
          <div><span className={styles.k}>Criado:</span> <span className={styles.v}>{fmtDT(data?.created_at)}</span></div>
          <div><span className={styles.k}>Atualizado:</span> <span className={styles.v}>{fmtDT(data?.updated_at)}</span></div>
        </div>
      </div>

      <div className={styles.chatCard}>
        <div className={styles.cardHead}>Conversa</div>
        <div className={styles.chatBody}>
          {loading ? (
            <div className={styles.loading}>Carregando…</div>
          ) : err ? (
            <div className={styles.error}>{err}</div>
          ) : (
            <ChatThread messages={messages} />
          )}
        </div>
      </div>
    </div>
  );
}
