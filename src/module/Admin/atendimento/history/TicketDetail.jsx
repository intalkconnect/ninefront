// File: TicketDetail.jsx
import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams, useLocation } from 'react-router-dom';
import { ArrowLeft, Download, Paperclip } from 'lucide-react';
import ChatThread from './ChatThread';
import styles from './styles/TicketDetail.module.css';
import { apiGet } from '../../../../shared/apiClient';

// ===== PDF no cliente =====
import PDFDocument from 'pdfkit/js/pdfkit.standalone.js';
import blobStream from 'blob-stream';

// ========================= Helpers comuns =========================
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

// ========================= Helpers PDF (paridade com o back) =========================
const softWrapLongTokens = (str, max = 28) => {
  if (!str) return str;
  return String(str)
    .split(/(\s+)/)
    .map(tok => (tok.trim().length > max ? tok.replace(new RegExp(`(.{1,${max}})`, 'g'), '$1\u200B') : tok))
    .join('');
};

const safeParse = (raw) => {
  if (raw == null) return null;
  if (typeof raw === 'object') return raw;
  const s = String(raw);
  try { return JSON.parse(s); } catch {
    if (/^https?:\/\//i.test(s)) return { url: s };
    return s;
  }
};

const normalizeContent = (raw, meta, type) => {
  const c = safeParse(raw);
  const base = (c && typeof c === 'object' && !Array.isArray(c)) ? { ...c } :
               (typeof c === 'string' ? { text: c } : {});
  const m = meta || {};
  base.url       ??= m.url || m.file_url || m.download_url || m.signed_url || m.public_url || null;
  base.filename  ??= m.filename || m.name || null;
  base.mime_type ??= m.mime || m.mimetype || m.content_type || null;
  base.caption   ??= m.caption || null;
  base.size      ??= m.size || m.filesize || null;
  return base;
};

// Retângulo arredondado compatível
function fillRoundedRect(doc, x, y, w, h, r, color) {
  doc.save();
  doc.fillColor(color);
  doc.moveTo(x + r, y);
  doc.lineTo(x + w - r, y);
  doc.quadraticCurveTo(x + w, y, x + w, y + r);
  doc.lineTo(x + w, y + h - r);
  doc.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
  doc.lineTo(x + r, y + h);
  doc.quadraticCurveTo(x, y + h, x, y + h - r);
  doc.lineTo(x, y + r);
  doc.quadraticCurveTo(x, y, x + r, y);
  doc.fill();
  doc.restore();
}

// Conteúdo do PDF (espelha a rota do Fastify)
function buildTicketPdf(doc, { ticket, rows, resolveAgent, fmtDT }) {
  // ---------- Layout/Cores ----------
  const M = 40;
  const pageW = doc.page.width;
  const pageH = doc.page.height;
  const contentW = pageW - M * 2;

  const gapY = 10;
  const bubblePadX = 12;
  const bubblePadY = 8;
  const maxBubbleW = Math.min(340, contentW * 0.66);

  const colText       = '#1F2937';
  const colMeta       = '#8A8F98';
  const colSep        = '#E5E7EB';
  const colDayPill    = '#EEF2F7';
  const colIncomingBg = '#F6F7F9';
  const colOutgoingBg = '#ECEFF3';
  const colLink       = '#4B5563';

  const num = ticket.ticket_number ? String(ticket.ticket_number).padStart(6, '0') : '—';

  // Header
  const headerAgent = resolveAgent(ticket.assigned_to);
  doc.fillColor(colText).font('Helvetica-Bold').fontSize(18)
     .text(`Ticket #${num}`, M, undefined, { width: contentW });
  doc.moveDown(0.2);
  doc.fillColor(colMeta).font('Helvetica').fontSize(10)
     .text(`Criado em: ${fmtDT(ticket.created_at)}`, { width: contentW });
  doc.moveDown(0.6);

  // Dados (duas colunas)
  const leftX  = M;
  const rightX = M + contentW / 2;
  const lh = 14;
  function labelValue(label, value, x, y) {
    doc.fillColor(colMeta).font('Helvetica-Bold').fontSize(9).text(label, x, y);
    doc.fillColor(colText).font('Helvetica').fontSize(11).text(value || '—', x, y + 10);
    return y + 10 + lh;
  }
  let y1 = doc.y, y2 = doc.y;
  y1 = labelValue('Cliente',   ticket.customer_name || ticket.user_id, leftX,  y1);
  y1 = labelValue('Contato',   ticket.customer_phone || ticket.customer_email || '—', leftX,  y1);
  y2 = labelValue('Fila',      ticket.fila,          rightX, y2);
  y2 = labelValue('Atendente', headerAgent,          rightX, y2);

  const yMax = Math.max(y1, y2);
  doc.strokeColor(colSep).lineWidth(1)
     .moveTo(M, yMax + 8).lineTo(M + contentW, yMax + 8).stroke();
  doc.y = yMax + 16;

  // Título conversa
  doc.fillColor(colText).font('Helvetica-Bold').fontSize(12).text('Conversa');
  doc.moveDown(0.3);

  if (!rows.length) {
    doc.fillColor(colMeta).font('Helvetica').fontSize(11)
       .text('Não há histórico de mensagens neste ticket.', { width: contentW, align: 'center' });
    return;
  }

  function ensureSpace(need) {
    if (doc.y + need <= pageH - M) return;
    doc.addPage();
    doc.fillColor(colMeta).font('Helvetica').fontSize(10)
       .text(`Ticket #${num} — continuação`, M, M);
    doc.moveDown(0.5);
  }

  // Separador por dia
  let lastDay = '';
  function daySeparator(date) {
    const label = new Date(date).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric' });
    const padX = 8, padY = 3;
    const w = doc.widthOfString(label) + padX * 2;
    const h = doc.currentLineHeight() + padY * 2;
    const x = M + (contentW - w) / 2;
    ensureSpace(h + 8);
    fillRoundedRect(doc, x, doc.y, w, h, 6, colDayPill);
    doc.fillColor('#4B5563').font('Helvetica').fontSize(9)
       .text(label, x + padX, doc.y + padY, { width: w - padX * 2, align: 'center' });
    doc.moveDown(0.6);
  }

  const calculateTextHeight = (text, { width, fontSize = 11, font = 'Helvetica' }) => {
    doc.save(); doc.font(font).fontSize(fontSize);
    const h = doc.heightOfString(text || '', { width, align: 'left' });
    doc.restore(); return h;
  };

  const buildLinkLabels = (links) =>
    (links || []).map(l => {
      const base = l?.filename ? `${l.filename} — Clique aqui para abrir a mídia`
                               : 'Clique aqui para abrir a mídia';
      return softWrapLongTokens(base, 28);
    });

  function drawBubble({ who, when, side, body, links }) {
    const isRight = side === 'right';
    const bg = isRight ? colOutgoingBg : colIncomingBg;
    const metaLine = softWrapLongTokens(`${who} — ${when}`, 36);
    const innerW = maxBubbleW - bubblePadX * 2;

    const txt = softWrapLongTokens((body || '').toString().trim(), 28);
    const linkLabels = buildLinkLabels(links);
    if (!txt && !linkLabels.length) return;

    const metaH = calculateTextHeight(metaLine, { width: innerW, fontSize: 9,  font: 'Helvetica' });
    const bodyH = txt ? calculateTextHeight(txt,      { width: innerW, fontSize: 11, font: 'Helvetica' }) : 0;

    let linksH = 0;
    if (linkLabels.length) {
      doc.save(); doc.font('Helvetica').fontSize(10);
      linkLabels.forEach(label => { linksH += doc.heightOfString(label, { width: innerW }) + 4; });
      doc.restore();
    }

    const totalH = bubblePadY + metaH + (txt ? 6 + bodyH : 0)
                 + (linkLabels.length ? 8 + linksH : 0) + bubblePadY;

    ensureSpace(totalH + gapY);

    const bx = isRight ? (M + contentW - maxBubbleW) : M;
    const by = doc.y;

    fillRoundedRect(doc, bx, by, maxBubbleW, totalH, 10, bg);

    doc.fillColor(colMeta).font('Helvetica').fontSize(9)
       .text(metaLine, bx + bubblePadX, by + bubblePadY, { width: innerW, align: 'left' });

    let cy = by + bubblePadY + metaH;

    if (txt) {
      cy += 6;
      doc.fillColor(colText).font('Helvetica').fontSize(11)
         .text(txt, bx + bubblePadX, cy, { width: innerW, align: 'left' });
      cy = doc.y;
    }

    if (linkLabels.length) {
      cy += 8;
      doc.fillColor(colLink).font('Helvetica').fontSize(10);
      for (let i = 0; i < linkLabels.length; i++) {
        doc.text(linkLabels[i], bx + bubblePadX, cy, {
          width: innerW,
          link: links[i].url,
          underline: true,
          align: 'left'
        });
        cy = doc.y + 4;
      }
    }

    doc.y = by + totalH + gapY;
  }

  // Loop mensagens
  for (const m of rows) {
    const ts = new Date(m.timestamp);
    const dayKey = ts.toISOString().slice(0,10);
    if (dayKey !== lastDay) { daySeparator(ts); lastDay = dayKey; }

    const dir  = String(m.direction || '').toLowerCase(); // incoming | outgoing | system
    const type = String(m.type || '').toLowerCase();
    const meta = typeof m.metadata === 'string' ? safeParse(m.metadata) : (m.metadata || {});
    const c = normalizeContent(m.content, meta, type);

    const rawText = (typeof c === 'string' ? c : (c?.text || c?.body || c?.caption || '')) || '';
    const trimmed = rawText.toString().trim();

    if (dir === 'system') {
      // pílula central
      const text = softWrapLongTokens(trimmed || '[evento]', 36);
      const padX = 10, padY = 6;
      const w = Math.min(320, contentW * 0.6);
      const txtH = calculateTextHeight(text, { width: w - padX * 2, fontSize: 10 });
      const h = padY * 2 + txtH;
      ensureSpace(h + gapY);
      const x = M + (contentW - w) / 2;
      fillRoundedRect(doc, x, doc.y, w, h, 8, colDayPill);
      doc.fillColor('#4B5563').font('Helvetica').fontSize(10)
         .text(text, x + padX, doc.y + padY, { width: w - padX * 2, align: 'center' });
      doc.moveDown(0.5);
      continue;
    }

    const who = dir === 'outgoing'
      ? resolveAgent(m.assigned_to || ticket.assigned_to)
      : (ticket.customer_name || ticket.user_id || 'Cliente');

    const when = ts.toLocaleString('pt-BR');
    const url = c?.url || null;
    const links = url ? [{ url, filename: c?.filename || null }] : [];

    drawBubble({
      who,
      when,
      side: dir === 'outgoing' ? 'right' : 'left',
      body: trimmed,
      links
    });
  }
}

// ========================= Componente =========================
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

  // Pode exportar quando carregado e sem erro (mesmo sem mensagens)
  const canExport = !loading && !err;

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

    // Monta "ticket" + "rows" no formato do back
    const ticket = {
      ticket_number : data?.ticket_number,
      user_id       : data?.user_id,
      fila          : data?.fila,
      assigned_to   : data?.assigned_to,
      status        : data?.status,
      created_at    : data?.created_at,
      updated_at    : data?.updated_at,
      customer_name : data?.customer_name,
      customer_email: data?.customer_email,
      customer_phone: data?.customer_phone
    };

    const rows = (messages || []).map(m => ({
      id         : m.id,
      direction  : m.direction,           // incoming | outgoing | system
      type       : m.type,
      content    : m.content,
      timestamp  : m.timestamp || m.created_at,
      metadata   : m.metadata,
      assigned_to: m.assigned_to
    }));

    // Resolver nomes de atendentes (se backend não trouxe mapeado)
    const agentNameByEmail = new Map();
    if (data?.agents && Array.isArray(data.agents)) {
      data.agents.forEach(a => {
        const key = String(a.email || '').toLowerCase();
        if (key) agentNameByEmail.set(key, a.full_name || a.name || a.lastname || a.email);
      });
    }
    const resolveAgent = (email) => {
      if (!email) return 'Atendente';
      const key = String(email).toLowerCase();
      return agentNameByEmail.get(key) || email;
    };

    const safeNum = data?.ticket_number ? String(data.ticket_number).padStart(6, '0') : String(id);

    // Gera PDF no browser (PDFKit + blob-stream)
    const doc = new PDFDocument({ size: 'A4', margin: 40 });
    const stream = doc.pipe(blobStream());

    buildTicketPdf(doc, { ticket, rows, resolveAgent, fmtDT });
    doc.end();

    stream.on('finish', () => {
      const blob = stream.toBlob('application/pdf');
      const url  = URL.createObjectURL(blob);
      const a    = document.createElement('a');
      a.href = url;
      a.download = `ticket-${safeNum}.pdf`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
    });
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
