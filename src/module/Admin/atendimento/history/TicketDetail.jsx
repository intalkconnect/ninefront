import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams, useLocation } from 'react-router-dom';
import { ArrowLeft, Download, Paperclip } from 'lucide-react';
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
        if (alive) setErr('Falha ao carregar o ticket.');
      } finally {
        if (alive) setLoading(false);
      }
    })();
    return () => { alive = false; };
  }, [id]);

  const titleNum = data?.ticket_number ? String(data.ticket_number).padStart(6, '0') : '—';
  const messages = data?.messages || [];
  const attachments = data?.attachments || [];

  // PATCH #4: permitir exportar mesmo sem mensagens (somente precisa estar carregado e sem erro)
  const canExport = !loading && !err;

  // ===== Helpers para export local (HTML -> Imprimir/Salvar como PDF) =====
  const esc = (s) =>
    String(s ?? '').replace(/[&<>"']/g, (m) => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;', "'":'&#39;'}[m]));
  const br = (s) => esc(s).replace(/\n/g, '<br/>');

  const msgText   = (m) => m?.text ?? m?.body ?? m?.message ?? m?.content?.text ?? '';
  const msgSender = (m) => m?.sender_name ?? m?.sender ?? m?.author ?? m?.from ?? (m?.from_me ? 'Você' : 'Contato');
  const msgTime   = (m) => m?.timestamp ?? m?.created_at ?? m?.date ?? null;
  const msgRight  = (m) => Boolean(m?.from_me || m?.outbound || m?.direction === 'out');

  function buildTicketHtml({ data, messages, attachments, titleNum }) {
    const created = fmtDT(data?.created_at);
    const updated = fmtDT(data?.updated_at);
    const customerName = data?.customer_name || 'Cliente';
    const customerId = data?.customer_phone || data?.user_id || '—';
    const fila = data?.fila || '—';
    const atendente = data?.assigned_to || '—';
    const status = data?.status || '—';
    const tags = (data?.tags || [])
      .map((t) => `<span class="chip">${esc(t)}</span>`)
      .join('') || '<span class="muted">Sem tags</span>';

    const msgItems = (messages || []).map((m) => {
      const text = br(msgText(m));
      const who  = esc(msgSender(m));
      const when = fmtDT(msgTime(m));
      const side = msgRight(m) ? 'right' : 'left';
      return `
        <div class="msg ${side}">
          <div class="bubble">
            <div class="meta"><strong>${who}</strong> • ${when}</div>
            <div class="text">${text || '<span class="muted">[sem texto]</span>'}</div>
          </div>
        </div>`;
    }).join('');

    const attachItems = (attachments || []).length
      ? (attachments || []).map((a) => `
          <li>
            <strong>${esc(a?.filename || 'arquivo')}</strong>
            <span class="muted"> — ${esc(a?.mime_type || 'arquivo')}${a?.size ? ` • ${esc(fmtBytes(a.size))}` : ''} • ${fmtDT(a?.timestamp)}</span>
          </li>`).join('')
      : '<li class="muted">Nenhum anexo</li>';

    const generatedAt = fmtDT(new Date().toISOString());

    const css = `
:root{--ink:#0f172a;--muted:#64748b;--line:#e5e7eb;--primary:#2563eb;--pill:#eef2ff;--pillInk:#3730a3;--left:#f3f4f6;--right:#dbeafe;}
*{box-sizing:border-box}
body{margin:0;background:#fff;color:var(--ink);font:13px/1.55 -apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,Inter,system-ui,Arial}
.container{max-width:900px;margin:0 auto;padding:24px}
.header{display:flex;justify-content:space-between;align-items:flex-start;border-bottom:1px solid var(--line);padding-bottom:12px;margin-bottom:16px}
.title{font-size:24px;font-weight:800;margin:0;color:var(--ink)}
.badge{background:var(--pill);color:var(--pillInk);padding:3px 10px;border-radius:999px;font-weight:700;font-size:11px;display:inline-block;margin-left:8px}
.meta{color:var(--muted);font-size:12px}
.row{display:flex;gap:24px;flex-wrap:wrap;margin-top:8px}
.col{min-width:240px}
.label{font-size:11px;color:var(--muted);text-transform:uppercase;letter-spacing:.06em;margin-bottom:2px}
.value{font-weight:700}
.section-title{font-weight:800;margin:18px 0 8px;font-size:14px}
.hr{border:0;border-top:1px solid var(--line);margin:16px 0}
.chip{background:#f1f5f9;color:#334155;padding:2px 8px;border-radius:999px;font-size:11px;font-weight:700;margin:0 6px 6px 0;display:inline-block}
.muted{color:var(--muted)}
/* Conversa */
.msgs{display:flex;flex-direction:column;gap:10px}
.msg{display:flex}
.msg.left{justify-content:flex-start}
.msg.right{justify-content:flex-end}
.bubble{max-width:75%;border-radius:14px;padding:10px 12px;background:var(--left)}
.right .bubble{background:var(--right)}
.bubble .meta{font-size:11px;margin-bottom:4px;color:var(--muted)}
.bubble .text{white-space:pre-wrap;word-break:break-word}
.attach ul{margin:0;padding-left:18px}
.footer{margin-top:20px;color:var(--muted);font-size:11px;text-align:center}
/* PATCH #1: evitar quebras feias entre bolhas/seções ao imprimir */
.msg, .bubble { break-inside: avoid; page-break-inside: avoid; }
.section, .row, .header { break-inside: avoid; page-break-inside: avoid; }
@media print{
  @page{size:A4;margin:16mm}
  .container{padding:0}
  a{text-decoration:none;color:inherit}
}`;

    return `<!doctype html>
<html>
<head>
<meta charset="utf-8"/>
<title>Ticket #${esc(titleNum)}</title>
<style>${css}</style>
</head>
<body>
  <div class="container">
    <div class="header">
      <div>
        <h1 class="title">Ticket #${esc(titleNum)} <span class="badge">${esc(status)}</span></h1>
        <div class="meta">Criado em ${created} • Última atualização ${updated}</div>
      </div>
    </div>

    <div class="row">
      <div class="col">
        <div class="label">Cliente</div>
        <div class="value">${esc(customerName)}</div>
        <div class="meta">${esc(customerId)}</div>
      </div>
      <div class="col">
        <div class="label">Fila</div>
        <div class="value">${esc(fila)}</div>
      </div>
      <div class="col">
        <div class="label">Atendente</div>
        <div class="value">${esc(atendente)}</div>
      </div>
      <div class="col">
        <div class="label">Tags</div>
        <div>${tags}</div>
      </div>
    </div>

    <div class="hr"></div>

    <div class="section">
      <div class="section-title">Conversa</div>
      <div class="msgs">
        ${msgItems || '<div class="muted">Sem histórico de mensagens.</div>'}
      </div>
    </div>

    <div class="hr"></div>

    <div class="section attach">
      <div class="section-title">Anexos</div>
      <ul>${attachItems}</ul>
    </div>

    <div class="footer">Gerado em ${generatedAt}</div>
  </div>
</body>
</html>`;
  }

  function openPrintable(html, filename = 'ticket.html') {
    const w = window.open('', '_blank', 'noopener,noreferrer');
    if (!w) {
      // PATCH #2: fallback compatível (anexa <a> ao DOM antes de clicar)
      const blob = new Blob([html], { type: 'text/html;charset=utf-8' });
      const url  = URL.createObjectURL(blob);
      const a    = document.createElement('a');
      a.href = url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
      return;
    }
    w.document.open();
    w.document.write(html);
    w.document.close();
    w.focus();
    setTimeout(() => { try { w.print(); } catch {} }, 300);
  }

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
    } catch (e) {
      alert('Não foi possível baixar o arquivo.');
    }
  }

  async function handleExportPdf() {
    if (!canExport) return;
    // PATCH #3: nome de arquivo robusto (fallback para id quando ticket_number indisponível)
    const safeNum = (titleNum && titleNum !== '—') ? titleNum : id;
    const html = buildTicketHtml({ data, messages, attachments, titleNum: safeNum });
    openPrintable(html, `ticket-${safeNum}.html`);
  }

  return (
    <div className={styles.page}>
      {/* breadcrumbs (sem “Management”) */}
      <div className={styles.breadcrumbs}>
        <span className={styles.bcLink} onClick={() => nav('/management/history')}>History</span>
        <span className={styles.bcSep}>/</span>
        <span>Ticket #{titleNum}</span>
      </div>

      {/* header: título à esquerda, ações à direita (Voltar / Exportar PDF) */}
      <div className={styles.pageHeader}>
        <div className={styles.titleWrap}>
          <h1 className={styles.title}>Ticket #{titleNum}</h1>
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
            title={canExport ? 'Exportar PDF' : 'Sem dados para exportar'}
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
              ) : err ? (
                <div className={styles.error}>{err}</div>
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
