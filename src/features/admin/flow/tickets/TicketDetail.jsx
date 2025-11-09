import React, { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate, useParams, useLocation } from 'react-router-dom';
import { ArrowLeft, Download, Paperclip } from 'lucide-react';
import { toast } from 'react-toastify';
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
const fmtBytes = (n) => {
  if (!n && n !== 0) return '';
  const u = ['B','KB','MB','GB','TB']; let i = 0; let b = Number(n);
  while (b >= 1024 && i < u.length - 1) { b /= 1024; i++; }
  return `${b.toFixed(b < 10 && i > 0 ? 1 : 0)} ${u[i]}`;
};

export default function TicketDetail() {
  const { id } = useParams();
  const nav = useNavigate();
  const location = useLocation();

  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState(null);
  const [activeTab, setActiveTab] = useState('conversation');

  const backTo = useMemo(
    () => location.state?.returnTo || '/management/history',
    [location.state]
  );

  useEffect(() => {
    let alive = true;
    (async () => {
      setLoading(true); setErr(null);
      try {
        // já retorna messages e attachments prontos
        const res = await apiGet(`/tickets/history/${id}?include=messages,attachments&messages_limit=500`);
        if (alive) setData(res);
      } catch (e) {
        if (alive) toast.error('Falha ao carregar o ticket.');
      } finally {
        if (alive) setLoading(false);
      }
    })();
    return () => { alive = false; };
  }, [id]);

  const titleNum = data?.ticket_number ? String(data.ticket_number).padStart(6, '0') : '—';
  const messages = data?.messages || [];
  const attachments = data?.attachments || [];

  // Pode exportar somente se carregado, sem erro e houver ao menos 1 mensagem
  const canExport = !loading && !err && messages.length > 0;

  async function downloadFile(url, filename = 'arquivo') {
    try {
      const resp = await fetch(url, { credentials: 'include' });
      if (!resp.ok) throw new Error('Falha no download');
      const blob = await resp.blob();
      const a = document.createElement('a');
      a.href = URL.createObjectURL(blob);
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(a.href);
      
      toast.success('Download iniciado!');
} catch (e) {
    toast.error('Não foi possível baixar o arquivo.');
  }
  }

  async function handleExportPdf() {
    if (!canExport) return; // proteção extra
    try {
      const resp = await fetch(`/api/v1/tickets/history/${id}/pdf`, {
        credentials: 'include'
      });
      if (!resp.ok) throw new Error('Falha ao gerar PDF');
      const blob = await resp.blob();
      const a = document.createElement('a');
      a.href = URL.createObjectURL(blob);
      a.download = `ticket-${titleNum}.pdf`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(a.href);
      toast.success(`PDF do ticket #${titleNum} gerado!`);
  } catch {
    toast.error('Não foi possível exportar o PDF.');
  }
  }

  return (
    <div className={styles.page}>
      {/* breadcrumbs (sem “Management”) */}
            <nav className={styles.breadcrumbs} aria-label="Breadcrumb">
        <ol className={styles.bcList}>
          <li><Link to="/management/history" className={styles.bcLink}>History</Link></li>
          <li className={styles.bcSep}>/</li>
          <li><span className={styles.bcCurrent}>Ticket #{titleNum}</span></li>
        </ol>
      </nav>

      {/* header: título à esquerda, ações à direita (Voltar / Exportar PDF) */}
      <div className={styles.pageHeader}>
        <div className={styles.titleWrap}>
          <div className={styles.metaRow}>Criado em {fmtDT(data?.created_at)}</div>
        </div>

        <div className={styles.headerActions}>
          <button className={styles.backBtn} onClick={() => nav(backTo)}>
            <ArrowLeft size={16}/> Voltar
          </button>
          <button
            className={styles.btnPrimary}
            onClick={handleExportPdf}
            disabled={!canExport}
            title={canExport ? 'Exportar PDF' : 'Sem mensagens para exportar'}
            aria-disabled={!canExport}
          >
            Exportar PDF
          </button>
        </div>
      </div>

      <div className={styles.columns}>
        {/* ==== COLUNA ESQUERDA (SIDEBAR COM DADOS) ==== */}
        <aside className={styles.sidebar}>
          <div className={styles.card}>
            <div className={styles.section}>
              {/* topo do card: avatar + nome + id/contato */}
              <div className={styles.profile}>
                <div className={styles.avatar}>
                  {(data?.customer_name || 'C').slice(0,2).toUpperCase()}
                </div>
                <div>
                  <div className={styles.personName}>{data?.customer_name || 'Cliente'}</div>
                  <div className={styles.personId}>
                    {data?.customer_phone || data?.user_id || '—'}
                  </div>
                </div>
              </div>

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
                  <div className={styles.value}>
                    <span className={styles.pill}>{data?.status || '—'}</span>
                  </div>
                </div>

                <div className={styles.infoItem}>
                  <div className={styles.label}>Última atualização</div>
                  <div className={styles.value}>{fmtDT(data?.updated_at)}</div>
                </div>
              </div>
            </div>

            <div className={styles.divider} />

            <div className={styles.tagsWrap}>
              <div className={styles.tagsTitle}>Tags</div>
              <div className={styles.tags}>
                {(data?.tags && data.tags.length) ? (
                  data.tags.map((t, i) => <span key={i} className={styles.chip}>{t}</span>)
                ) : (
                  <span className={styles.personId}>Sem tags</span>
                )}
              </div>
            </div>
          </div>
        </aside>

        {/* ==== COLUNA DIREITA (CHAT + ANEXOS) ==== */}
        <section className={styles.main}>
          <div className={styles.chatCard}>
            <div className={styles.cardHead}>
              <div className={styles.tabs}>
                <button
                  className={`${styles.tab} ${activeTab==='conversation' ? styles.tabActive : ''}`}
                  onClick={() => setActiveTab('conversation')}
                >
                  Conversa
                </button>
                <button
                  className={`${styles.tab} ${activeTab==='attachments' ? styles.tabActive : ''}`}
                  onClick={() => setActiveTab('attachments')}
                >
                  <Paperclip size={14} style={{marginRight:6}}/> Anexos
                </button>
              </div>
            </div>

            <div className={styles.chatBody}>
              {loading ? (
                <div className={styles.loading}>Carregando…</div>
              ) : activeTab === 'conversation' ? (
                messages.length ? (
                  <ChatThread messages={messages} />
                ) : (
                  <div className={styles.emptyState}>
                    <div>
                      <div className={styles.emptyTitle}>Sem histórico de mensagens</div>
                      <div className={styles.emptySub}>Este ticket não possui mensagens.</div>
                    </div>
                  </div>
                )
              ) : (
                <div className={styles.attachWrap}>
                  {attachments.length ? (
                    <div className={styles.attachList}>
                      {attachments.map((a) => (
                        <div key={a.id} className={styles.attachItem}>
                          <div className={styles.attachLeft}>
                            <div className={styles.fileIcon}>
                              {(a.type || 'file').slice(0,1).toUpperCase()}
                            </div>
                            <div className={styles.fileText}>
                              <div className={styles.fileName}>{a.filename || 'arquivo'}</div>
                              <div className={styles.fileMeta}>
                                {a.mime_type || 'arquivo'}{a.size ? ` • ${fmtBytes(a.size)}` : ''} • {fmtDT(a.timestamp)}
                              </div>
                            </div>
                          </div>
                          <div className={styles.attachActions}>
                            <button
                              className={`${styles.btnPrimary} ${styles.btnSm}`}
                              onClick={() => downloadFile(a.url, a.filename || 'arquivo')}
                              title="Baixar"
                              aria-label={`Baixar ${a.filename || 'arquivo'}`}
                            >
                              <Download size={16} style={{ marginRight: 6 }} /> Baixar
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className={styles.emptyState}>
                      <div>
                        <div className={styles.emptyTitle}>Nenhum anexo</div>
                        <div className={styles.emptySub}>Arquivos enviados aparecerão aqui.</div>
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
