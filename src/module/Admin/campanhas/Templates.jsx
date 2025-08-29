import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { apiGet, apiPost, apiDelete } from '../../../shared/apiClient';
import styles from './styles/Templates.module.css';
import {
  FileText,
  Plus,
  RefreshCw,
  Trash2,
  X as XIcon,
  AlertCircle,
  CheckCircle2
} from 'lucide-react';

import TemplateModal from './TemplateModal';
import TemplatePreviewModal from './TemplatePreviewModal';

const STATUS_TABS = [
  { key: '',          label: 'Todos' },
  { key: 'approved',  label: 'Aprovados' },
  { key: 'rejected',  label: 'Rejeitados' },
  { key: 'submitted', label: 'Em análise' },
  { key: 'draft',     label: 'Rascunhos' },
];

function StatusChip({ status }) {
  const map = {
    approved:  { txt: 'Aprovado',   cls: styles.stApproved },
    rejected:  { txt: 'Rejeitado',  cls: styles.stRejected },
    submitted: { txt: 'Em análise', cls: styles.stSubmitted },
    draft:     { txt: 'Rascunho',   cls: styles.stDraft },
  };
  const it = map[status] || { txt: status || '—', cls: styles.stDefault };
  return <span className={`${styles.statusChip} ${it.cls}`}>{it.txt}</span>;
}

/** Semáforo de qualidade (GREEN/YELLOW/RED/UNKNOWN) */
function ScoreSemaforo({ value }) {
  function parseQuality(raw) {
    if (!raw) return { score: null, date: null };
    if (typeof raw === 'object') {
      return { score: raw.score ?? raw.quality ?? raw.value ?? null, date: raw.date ?? raw.timestamp ?? null };
    }
    const s = String(raw).trim();
    try { return parseQuality(JSON.parse(s)); } catch { return { score: s, date: null }; }
  }

  const q = parseQuality(value);
  if (!q.score) return null;
  const code = String(q.score).trim().toUpperCase();

  const color =
    code === 'GREEN'   ? '#10B981' :
    code === 'YELLOW'  ? '#F59E0B' :
    code === 'RED'     ? '#EF4444' :
                         '#9CA3AF';

  const label = code === 'UNKNOWN' ? 'Qualidade desconhecida' : `Qualidade ${code}`;
  let dateInfo = '';
  if (q.date != null && q.date !== '') {
    let ms = Number(q.date);
    if (!Number.isNaN(ms)) {
      if (ms < 1e12) ms *= 1000;
      const d = new Date(ms);
      if (!Number.isNaN(d.getTime())) dateInfo = ` • Atualizado em ${d.toLocaleString('pt-BR')}`;
    }
  }

  return (
    <span
      className={styles.qualityDot}
      role="img"
      aria-label={label}
      title={`${label}${dateInfo}`}
      style={{ backgroundColor: color }}
    />
  );
}

/** Modal simples de pré-visualização do template */
function TemplatePreview({ isOpen, item, onClose }) {
  if (!isOpen || !item) return null;

  // normaliza buttons (string JSON / array / objeto)
  let buttons = [];
  try {
    if (Array.isArray(item.buttons)) buttons = item.buttons;
    else if (item.buttons && typeof item.buttons === 'string') buttons = JSON.parse(item.buttons);
    else if (item.buttons && typeof item.buttons === 'object') buttons = item.buttons.buttons || [];
  } catch (_) { /* ignora parse */ }

  return (
    <div className={styles.modalOverlay} onClick={onClose}>
      <div className={styles.modal} onClick={(e) => e.stopPropagation()} role="dialog" aria-modal="true">
        <div className={styles.modalHeader}>
          <h2 className={styles.modalTitle}>Prévia: {item.name}</h2>
          <button className={styles.alertClose} onClick={onClose} aria-label="Fechar">
            <XIcon size={16} />
          </button>
        </div>

        <div className={styles.modalBody}>
          <div style={{ display:'grid', gap:12 }}>
            <div style={{ display:'flex', gap:10, alignItems:'center', justifyContent:'center' }}>
              <StatusChip status={item.status} />
              <ScoreSemaforo value={item.quality_score} />
            </div>

            <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:12 }}>
              <div>
                <div className={styles.label}>Categoria</div>
                <div>{item.category || '—'}</div>
              </div>
              <div>
                <div className={styles.label}>Idioma</div>
                <div>{item.language_code || '—'}</div>
              </div>
            </div>

            {item.header_type && item.header_type !== 'NONE' && (
              <div>
                <div className={styles.label}>Cabeçalho</div>
                <div className={styles.inputHelper} style={{ marginBottom:6 }}>
                  Tipo: {item.header_type}{item.header_text ? ' • Texto' : ''}
                </div>
                {item.header_text && (
                  <div style={{ whiteSpace:'pre-wrap', border:'1px solid var(--qr-border)', borderRadius:10, padding:'10px 12px' }}>
                    {item.header_text}
                  </div>
                )}
              </div>
            )}

            <div>
              <div className={styles.label}>Corpo</div>
              <div style={{ whiteSpace:'pre-wrap', border:'1px solid var(--qr-border)', borderRadius:10, padding:'10px 12px' }}>
                {item.body_text || '—'}
              </div>
            </div>

            {item.footer_text && (
              <div>
                <div className={styles.label}>Rodapé</div>
                <div style={{ whiteSpace:'pre-wrap', border:'1px solid var(--qr-border)', borderRadius:10, padding:'10px 12px' }}>
                  {item.footer_text}
                </div>
              </div>
            )}

            {buttons?.length > 0 && (
              <div>
                <div className={styles.label}>Botões</div>
                <div style={{ display:'flex', flexWrap:'wrap', gap:8 }}>
                  {buttons.map((b, i) => (
                    <span key={i} className={styles.pill} style={{ cursor:'default' }}>
                      {b?.type || 'BUTTON'}{b?.text ? `: ${b.text}` : ''}
                    </span>
                  ))}
                </div>
              </div>
            )}

            {item.provider_id && (
              <div className={styles.inputHelper} style={{ textAlign:'center' }}>
                provider_id: {item.provider_id}
              </div>
            )}
          </div>
        </div>

        <div className={styles.modalActions}>
          <button className={styles.btn} onClick={onClose}><XIcon size={14}/> Fechar</button>
        </div>
      </div>
    </div>
  );
}

export default function Templates() {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(false);

  const [error, setError] = useState(null);
  const [okMsg, setOkMsg] = useState(null);

  const [query, setQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('');

  const [createOpen, setCreateOpen] = useState(false);

  // preview
  const [previewOpen, setPreviewOpen] = useState(false);
  const [previewItem, setPreviewItem] = useState(null);
  const openPreview = (item) => { setPreviewItem(item); setPreviewOpen(true); };
  const closePreview = () => { setPreviewItem(null); setPreviewOpen(false); };

  // auto polling (sincroniza "submitted")
  const pollRef = useRef(null);
  const stopPolling = () => { if (pollRef.current) { clearInterval(pollRef.current); pollRef.current = null; } };

  const toastOK = useCallback((msg) => {
    setOkMsg(msg);
    setTimeout(() => setOkMsg(null), 2200);
  }, []);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const qs = new URLSearchParams();
      if (statusFilter) qs.set('status', statusFilter);
      if (query.trim()) qs.set('q', query.trim());

      const data = await apiGet(`/templates${qs.toString() ? `?${qs}` : ''}`);
      setItems(Array.isArray(data) ? data : []);
    } catch (e) {
      console.error('Erro ao listar templates:', e);
      setError('Falha ao carregar templates.');
    } finally {
      setLoading(false);
    }
  }, [statusFilter, query]);

  useEffect(() => { load(); }, [load]);

  useEffect(() => {
    const idsToPoll = items.filter(t => t.status === 'submitted').map(t => t.id);
    if (idsToPoll.length === 0) { stopPolling(); return; }
    if (pollRef.current) return;

    pollRef.current = setInterval(async () => {
      try {
        await Promise.all(idsToPoll.map(id => apiPost(`/templates/${id}/sync`, {})));
        load();
      } catch (e) {
        console.warn('Polling falhou:', e?.message || e);
      }
    }, 15000);
    return stopPolling;
  }, [items, load]);

  const filtered = useMemo(() => {
    return [...items]
      .sort((a, b) => String(a.updated_at || '').localeCompare(String(b.updated_at || '')))
      .reverse();
  }, [items]);

  // REMOVIDO: handleSubmit (o adicionar já submete)

  async function handleSync(id) {
    try {
      setError(null);
      await apiPost(`/templates/${id}/sync`, {});
      toastOK('Status sincronizado com a Meta.');
      load();
    } catch (e) {
      console.error('Erro ao sincronizar:', e);
      setError('Falha ao sincronizar status.');
    }
  }

  async function handleDelete(id, status) {
    if (!['draft', 'rejected'].includes(status)) {
      setError('Apenas rascunhos ou rejeitados podem ser removidos localmente.');
      return;
    }
    if (!window.confirm('Tem certeza que deseja remover este template?')) return;
    try {
      setError(null);
      await apiDelete(`/templates/${id}`);
      toastOK('Template removido.');
      load();
    } catch (e) {
      console.error('Erro ao excluir:', e);
      setError('Falha ao excluir template.');
    }
  }

  const clearSearch = () => setQuery('');

  return (
    <div className={styles.container}>
      {/* Header da página */}
             <div className={styles.toolbar}>
        <div className={styles.headerActions}>

        <div className={styles.headerActions}>
          <button className={styles.btn} type="button" onClick={load} title="Atualizar lista">
            <RefreshCw size={16} /> Atualizar
          </button>
          <button className={styles.btnPrimary} type="button" onClick={() => setCreateOpen(true)}>
            <Plus size={16} /> Criar Template
          </button>
        </div>
      </div>
               </div>

      {/* Card da lista — tabs + busca */}
      <div className={styles.card}>
        <div className={styles.cardHead}>
          <div className={styles.tabs} role="tablist" aria-label="Filtrar por status">
            {STATUS_TABS.map(tab => (
              <button
                key={tab.key || 'all'}
                className={`${styles.tab} ${statusFilter === tab.key ? styles.tabActive : ''}`}
                onClick={() => setStatusFilter(tab.key)}
                type="button"
                role="tab"
                aria-selected={statusFilter === tab.key}
              >
                {tab.label}
              </button>
            ))}
          </div>

          <div className={styles.searchGroup}>
            <input
              className={styles.searchInput}
              placeholder="Buscar por nome ou conteúdo…"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              aria-label="Buscar templates"
            />
            {query && (
              <button className={styles.searchClear} onClick={clearSearch} aria-label="Limpar busca" type="button">
                <XIcon size={14} />
              </button>
            )}
          </div>
        </div>

        <div className={styles.tableWrap}>
          <table className={styles.table}>
            <thead>
              <tr>
                <th style={{ minWidth: 240 }}>Nome do modelo</th>
                <th>Categoria</th>
                <th>Recategorizado</th>
                <th>Idioma</th>
                <th>Status</th>
                <th>Qualidade</th>
                <th style={{ width: 220 }}>Ações</th>
              </tr>
            </thead>
            <tbody>
              {loading && (
                <tr>
                  <td className={styles.loading} colSpan={7}>Carregando…</td>
                </tr>
              )}

              {!loading && filtered.length === 0 && (
                <tr>
                  <td className={styles.empty} colSpan={7}>Nenhum template encontrado.</td>
                </tr>
              )}

              {!loading && filtered.map(t => (
                <tr
                  key={t.id}
                  className={styles.rowHover}
                  style={{ cursor:'pointer' }}
                  onClick={() => openPreview(t)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' || e.key === ' ') {
                      e.preventDefault();
                      openPreview(t);
                    }
                  }}
                  tabIndex={0}
                  role="button"
                  aria-label={`Abrir prévia de ${t.name}`}
                >
                  <td data-label="Nome">
                    <div className={styles.keyTitle}>{t.name}</div>
                  </td>
                  <td data-label="Categoria">{t.category || '—'}</td>
                  <td data-label="Recategorizado">{t.recategorized ? 'Sim' : 'Não'}</td>
                  <td data-label="Idioma">{t.language_code || '—'}</td>
                  <td data-label="Status"><StatusChip status={t.status} /></td>
                  <td data-label="Qualidade">
                    <ScoreSemaforo value={t.quality_score} />
                  </td>
                  <td data-label="Ações" className={styles.actionsCell}
                      onClick={(e) => e.stopPropagation()} onKeyDown={(e) => e.stopPropagation()}>
                    <div className={styles.actions}>
                      <button
                        className={styles.qrIconBtn}
                        title="Sincronizar status"
                        onClick={(e) => { e.stopPropagation(); handleSync(t.id); }}
                        type="button"
                      >
                        <RefreshCw size={16} />
                      </button>

                      <button
                        className={`${styles.qrIconBtn} ${styles.danger}`}
                        title="Excluir"
                        onClick={(e) => { e.stopPropagation(); handleDelete(t.id, t.status); }}
                        disabled={!['draft', 'rejected'].includes(t.status)}
                        type="button"
                      >
                        <Trash2 size={16} />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Modal de criação */}
      <TemplateModal
        isOpen={createOpen}
        onClose={() => setCreateOpen(false)}
        onCreated={() => { setCreateOpen(false); load(); toastOK('Template criado.'); }}
      />

 {/* Modal de preview (estilo WhatsApp) */}
 <TemplatePreviewModal
   isOpen={previewOpen}
   template={previewItem}
   onClose={closePreview}
 />
    </div>
  );
}
