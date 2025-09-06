import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams, useLocation } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';
import ChatThread from './ChatThread';
import styles from './styles/TicketDetail.module.css';
import { apiGet } from '../../../../shared/apiClient';

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
  const [activeTab, setActiveTab] = useState('conversa');

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
  const tags = Array.isArray(data?.tags) ? data.tags : [];

  // nome do cliente vindo do endpoint (use o campo que você for retornar)
  const customerName =
    data?.customer_name || data?.cliente_nome || data?.name || 'Cliente';

  // iniciais para avatar
  const initials = (customerName || 'C')
    .split(' ')
    .filter(Boolean)
    .map(p => p[0])
    .slice(0, 2)
    .join('')
    .toUpperCase();

  function handleExport() {
    alert('Exportar PDF ainda não está disponível.');
  }

  return (
    <div className={styles.page}>
      {/* breadcrumbs */}
      <div className={styles.breadcrumbs}>
        <a className={styles.bcLink} onClick={() => nav('/management')}>Management</a>
        <span className={styles.bcSep}>/</span>
        <a className={styles.bcLink} onClick={() => nav('/management/history')}>History</a>
        <span className={styles.bcSep}>/</span>
        <span>Ticket #{titleNum}</span>
      </div>

      {/* header (sem badge de status aqui, para evitar redundância) */}
      <div className={styles.pageHeader}>
        <div className={styles.titleWrap}>
          <h1 className={styles.title}>Ticket #{titleNum}</h1>
          <div className={styles.metaRow}>
            Criado em {fmtDT(data?.created_at)}
          </div>
        </div>

        <div className={styles.headerActions}>
          <button className={styles.backBtn} onClick={() => nav(backTo)}>
            <ArrowLeft size={16}/> Voltar
          </button>
          <button className={styles.exportBtn} onClick={handleExport}>
            Exportar PDF
          </button>
        </div>
      </div>

      <div className={styles.columns}>
        {/* ==== COLUNA ESQUERDA (SIDEBAR) ==== */}
        <aside className={styles.sidebar}>
          <div className={styles.card}>
            {/* topo: avatar + nome + user_id */}
            <div className={styles.section}>
              <div className={styles.profile}>
                <div className={styles.avatar}>{initials}</div>
                <div>
                  <div className={styles.personName}>{customerName}</div>
                  <div className={styles.personId}>{data?.user_id || '—'}</div>
                </div>
              </div>

              {loading ? (
                <div className={styles.loading}>Carregando…</div>
              ) : err ? (
                <div className={styles.error}>{err}</div>
              ) : (
                <div className={styles.infoList}>
                  <div className={styles.infoItem}>
                    <div className={styles.label}>Fila</div>
                    <div className={styles.value}>{data?.fila || '—'}</div>
                  </div>

                  <div className={styles.infoItem}>
                    <div className={styles.label}>Atendente</div>
                    <div className={styles.value}>{data?.assigned_to || '—'}</div>
                  </div>

                  <div className={styles.infoItem}>
                    <div className={styles.label}>Status</div>
                    <div>
                      <span className={styles.pill}>{data?.status || '—'}</span>
                    </div>
                  </div>

                  <div className={styles.infoItem}>
                    <div className={styles.label}>Última atualização</div>
                    <div className={styles.value}>{fmtDT(data?.updated_at)}</div>
                  </div>
                </div>
              )}
            </div>

            {/* divisória e Tags */}
            <div className={styles.divider} />
            <div className={styles.tagsWrap}>
              <div className={styles.tagsTitle}>Tags</div>
              <div className={styles.tags}>
                {tags.length
                  ? tags.map((t, i) => <span key={i} className={styles.chip}>{t}</span>)
                  : <span className={styles.personId}>Sem tags</span>}
              </div>
            </div>
          </div>
        </aside>

        {/* ==== COLUNA DIREITA (CHAT + ABAS) ==== */}
        <section className={styles.main}>
          <div className={styles.chatCard}>
            <div className={styles.cardHead}>
              <div className={styles.tabs}>
                <button
                  className={`${styles.tab} ${activeTab === 'conversa' ? styles.tabActive : ''}`}
                  onClick={() => setActiveTab('conversa')}
                >
                  Conversa
                </button>
                <button
                  className={`${styles.tab} ${activeTab === 'anexos' ? styles.tabActive : ''}`}
                  onClick={() => setActiveTab('anexos')}
                >
                  Anexos
                </button>
              </div>
            </div>

            <div className={styles.chatBody}>
              {loading ? (
                <div className={styles.loading}>Carregando…</div>
              ) : err ? (
                <div className={styles.error}>{err}</div>
              ) : activeTab === 'conversa' ? (
                <ChatThread messages={messages} />
              ) : (
                <div className={styles.loading}>Nenhum anexo encontrado.</div>
              )}
            </div>
          </div>
        </section>
      </div>
    </div>
  );
}
