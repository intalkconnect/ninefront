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

function badgeClass(status) {
  const s = (status || '').toLowerCase();
  if (s.includes('andamento') || s.includes('pendente')) return `${styles.badge} ${styles.badgeWarn}`;
  if (s.includes('resolvido') || s.includes('ok')) return `${styles.badge} ${styles.badgeOk}`;
  return `${styles.badge} ${styles.badgeGray}`;
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

  // avatar iniciais
  const initials = (data?.name || 'Cliente')
    .split(' ')
    .filter(Boolean)
    .map(p => p[0])
    .slice(0, 2)
    .join('')
    .toUpperCase();

  function handleExport() {
    // plugar quando existir a rota de exportação
    // ex.: window.open(`/tickets/${id}/export`, '_blank');
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

      {/* header com título, badge e ações */}
      <div className={styles.pageHeader}>
        <div className={styles.titleWrap}>
          <div className={styles.titleRow}>
            <h1 className={styles.title}>Ticket #{titleNum}</h1>
            <span className={badgeClass(data?.status)}>
              <span className={styles.badgeDot} />
              {data?.status || '—'}
            </span>
          </div>
          <div className={styles.metaRow}>
            Criado em {fmtDT(data?.created_at)}
          </div>
        </div>

        <div className={styles.headerActions}>
          <button className={styles.backBtn} onClick={() => nav(backTo)}>
            <ArrowLeft size={16}/> Voltar
          </button>
          <button className={styles.exportBtn} onClick={handleExport}>
            {/* simples texto para manter dependências mínimas */}
            Exportar PDF
          </button>
        </div>
      </div>

      <div className={styles.columns}>
        {/* ==== COLUNA ESQUERDA (SIDEBAR COM DADOS) ==== */}
        <aside className={styles.sidebar}>
          <div className={styles.card}>
            {/* bloco "Cliente" com avatar e user_id */}
            <div className={styles.profile}>
              <div className={styles.avatar}>{initials}</div>
              <div>
                <div className={styles.personName}>{data?.name || 'Cliente'}</div>
                <div className={styles.personId}>{data?.user_id || '—'}</div>
              </div>
            </div>

            {loading ? (
              <div className={styles.loading}>Carregando…</div>
            ) : err ? (
              <div className={styles.error}>{err}</div>
            ) : (
              <>
                <div className={styles.infoList}>
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
                    <span className={styles.v}>
                      <span className={badgeClass(data?.status)}>
                        <span className={styles.badgeDot} />
                        {data?.status || '—'}
                      </span>
                    </span>
                  </div>
                  <div className={styles.infoRow}>
                    <span className={styles.k}>Última atualização</span>
                    <span className={styles.v}>{fmtDT(data?.updated_at)}</span>
                  </div>
                </div>

                <div className={styles.sep} />

                <div className={styles.cardTitle}>Tags</div>
                <div className={styles.tags}>
                  {tags.length
                    ? tags.map((t, i) => <span key={i} className={styles.chip}>{t}</span>)
                    : <span className={styles.personId}>Sem tags</span>}
                </div>
              </>
            )}
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
