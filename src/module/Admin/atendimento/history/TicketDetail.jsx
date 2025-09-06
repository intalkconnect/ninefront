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

// util simples pra tamanho
function fmtSize(bytes) {
  const n = Number(bytes || 0);
  if (!n) return null;
  const units = ['B','KB','MB','GB','TB'];
  let i = 0, v = n;
  while (v >= 1024 && i < units.length - 1) { v /= 1024; i++; }
  return `${v.toFixed(v < 10 && i ? 1 : 0)} ${units[i]}`;
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

  // campos retornados pelo endpoint
  const customerName   = data?.customer_name || data?.name || 'Cliente';
  const customerEmail  = data?.customer_email || null;
  const customerPhone  = data?.customer_phone || null;
  const customerId     = data?.user_id || '—';
  const customerContact = customerEmail || customerPhone || null;

  // anexos vindos do backend OU derivados das mensagens
  const attachments = useMemo(() => {
    if (Array.isArray(data?.attachments) && data.attachments.length) return data.attachments;

    const pick = (m) => {
      const type = String(m.type || '').toLowerCase();
      const c = m?.content || {};
      const url = c?.url;
      const looksFile = ['document','image','audio','video','sticker','file'].includes(type) || !!url;
      if (!looksFile || !url) return null;
      const nameFromUrl = (() => {
        try { return decodeURIComponent(new URL(url).pathname.split('/').pop() || 'arquivo'); }
        catch { return 'arquivo'; }
      })();
      return {
        id: m.id,
        type,
        url,
        filename: c.filename || nameFromUrl,
        mime_type: c.mime_type || null,
        size: c.size || null,
        timestamp: m.timestamp,
        direction: m.direction,
        sender_name: m.sender_name || (m.from_agent ? 'Atendente' : null)
      };
    };

    return (messages || []).map(pick).filter(Boolean);
  }, [data?.attachments, messages]);

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

      {/* Header amplo: título à esquerda e ações à direita */}
      <div className={styles.pageHeader}>
        <div className={styles.titleWrap}>
          <h1 className={styles.title}>Ticket #{titleNum}</h1>
          <div className={styles.metaRow}>Criado em {fmtDT(data?.created_at)}</div>
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
        {/* === ESQUERDA: card do cliente === */}
        <aside className={styles.sidebar}>
          <div className={styles.card}>
            <div className={styles.section}>
              <div className={styles.profile}>
                <div className={styles.avatar}>{initials}</div>
                <div>
                  <div className={styles.personName}>{customerName}</div>
                  <div className={styles.personId}>
                    {customerContact || customerId}
                  </div>
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
                    <div><span className={styles.pill}>{data?.status || '—'}</span></div>
                  </div>

                  <div className={styles.infoItem}>
                    <div className={styles.label}>Última atualização</div>
                    <div className={styles.value}>{fmtDT(data?.updated_at)}</div>
                  </div>
                </div>
              )}
            </div>

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

        {/* === DIREITA: conversa (abas) === */}
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
                messages.length ? (
                  <ChatThread messages={messages} />
                ) : (
                  <div className={styles.emptyState}>
                    <div>
                      <div className={styles.emptyTitle}>Sem histórico de mensagens</div>
                      <div className={styles.emptySub}>Este ticket ainda não possui mensagens.</div>
                    </div>
                  </div>
                )
              ) : (
                <div className={styles.attachWrap}>
                  {attachments.length ? (
                    <div className={styles.attachList}>
                      {attachments.map((a) => (
                        <div key={`${a.id}-${a.url}`} className={styles.attachItem}>
                          <div className={styles.attachLeft}>
                            <div className={styles.fileIcon}>
                              {(a.mime_type || a.type || 'file').split('/')[0][0].toUpperCase()}
                            </div>
                            <div className={styles.fileText}>
                              <div className={styles.fileName}>{a.filename || 'arquivo'}</div>
                              <div className={styles.fileMeta}>
                                {a.mime_type ? `${a.mime_type} · ` : ''}
                                {fmtSize(a.size) ? `${fmtSize(a.size)} · ` : ''}
                                {fmtDT(a.timestamp)}
                                {a.sender_name ? ` · ${a.sender_name}` : ''}
                              </div>
                            </div>
                          </div>
                          <div className={styles.attachActions}>
                            <a
                              className={styles.btnGhost}
                              href={a.url || '#'}
                              target="_blank"
                              rel="noopener noreferrer"
                              download
                              onClick={e => { if (!a.url) e.preventDefault(); }}
                            >
                              Baixar
                            </a>
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className={styles.emptyState}>
                      <div>
                        <div className={styles.emptyTitle}>Nenhum anexo encontrado</div>
                        <div className={styles.emptySub}>Este ticket não possui arquivos enviados.</div>
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        </section>
      </div>
    </div>
  );
}
