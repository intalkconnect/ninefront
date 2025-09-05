import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams, useLocation } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';
import ChatThread from './ChatThread';
import styles from './styles/TicketDetail.module.css';
import { apiGet } from '../../../../shared/apiClient'; // <- mantém o mesmo caminho do TicketsHistory.jsx

function fmtDT(iso) {
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
  const nav = useNavigate();
  const location = useLocation();

  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState(null);

  const backTo = useMemo(
    () => location.state?.returnTo || '/management/history',
    [location.state]
  );

  useEffect(() => {
    let alive = true;
    (async () => {
      setLoading(true); setErr(null);
      try {
        const res = await apiGet(`/tickets/history/${id}?include=messages&messages_limit=200`);
        if (alive) setData(res);
      } catch (e) {
        if (alive) setErr('Falha ao carregar o ticket.');
      } finally {
        if (alive) setLoading(false);
      }
    })();
    return () => { alive = false; };
  }, [id]);

  const titleNum = data?.ticket_number ? String(data.ticket_number).padStart(6, '0') : '—';
  const messages = data?.messages || [];

  return (
    <div className={styles.page}>
      <div className={styles.pageHeader}>
        <button className={styles.backBtn} onClick={() => nav(backTo)}>
          <ArrowLeft size={16}/> Voltar
        </button>
        <h1 className={styles.title}>Ticket #{titleNum}</h1>
      </div>

      <div className={styles.columns}>
        {/* ==== COLUNA ESQUERDA (SIDEBAR COM DADOS) ==== */}
        <aside className={styles.sidebar}>
          <div className={styles.card}>
            <div className={styles.cardTitle}>Dados do cliente</div>
            {loading ? (
              <div className={styles.loading}>Carregando…</div>
            ) : err ? (
              <div className={styles.error}>{err}</div>
            ) : (
              <div className={styles.infoList}>
                <div className={styles.infoRow}>
                  <span className={styles.k}>User ID</span>
                  <span className={styles.v}>{data?.user_id || '—'}</span>
                </div>
                <div className={styles.infoRow}>
                  <span className={styles.k}>Fila</span>
                  <span className={styles.v}>{data?.fila || '—'}</span>
                </div>
                <div className={styles.infoRow}>
                  <span className={styles.k}>Atendente</span>
                  <span className={styles.v}>{data?.assigned_to || '—'}</span>
                </div>
                <div className={styles.infoRow}>
                  <span className={styles.k}>Status</span>
                  <span className={styles.v}>{data?.status || '—'}</span>
                </div>
                <div className={styles.sep} />
                <div className={styles.infoRow}>
                  <span className={styles.k}>Criado</span>
                  <span className={styles.v}>{fmtDT(data?.created_at)}</span>
                </div>
                <div className={styles.infoRow}>
                  <span className={styles.k}>Atualizado</span>
                  <span className={styles.v}>{fmtDT(data?.updated_at)}</span>
                </div>
              </div>
            )}
          </div>
        </aside>

        {/* ==== COLUNA DIREITA (CHAT) ==== */}
        <section className={styles.main}>
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
        </section>
      </div>
    </div>
  );
}
