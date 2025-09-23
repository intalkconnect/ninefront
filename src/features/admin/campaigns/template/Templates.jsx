// src/pages/admin/management/templates/Templates.jsx
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Plus, RefreshCw, Trash2, X as XIcon } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { apiGet, apiPost, apiDelete } from '../../../../shared/apiClient';
import { useConfirm } from '../../../../app/provider/ConfirmProvider.jsx';
import { toast } from 'react-toastify';

import TemplatePreviewModal from './TemplatePreview';
import styles from './styles/Templates.module.css';

const STATUS_OPTIONS = [
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

function ScoreSemaforo({ value }) {
  // aceita GREEN/YELLOW/RED/UNKNOWN e variantes em objeto/JSON
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
    code === 'GREEN'  ? '#10B981' :
    code === 'YELLOW' ? '#F59E0B' :
    code === 'RED'    ? '#EF4444' : '#9CA3AF';
  return <span className={styles.qualityDot} style={{ backgroundColor: color }} title={`Qualidade ${code}`} />;
}

export default function Templates() {
  const navigate = useNavigate();
  const confirm = useConfirm();

  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [okMsg, setOkMsg] = useState(null);

  const [query, setQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('');

  // preview
  const [previewOpen, setPreviewOpen] = useState(false);
  const [previewItem, setPreviewItem] = useState(null);
  const openPreview  = (item) => { setPreviewItem(item); setPreviewOpen(true); };
  const closePreview = () => { setPreviewItem(null); setPreviewOpen(false); };

  // polling p/ “submitted”
  const pollRef = useRef(null);
  const stopPolling = () => { if (pollRef.current) { clearInterval(pollRef.current); pollRef.current = null; } };

  const toastOK = useCallback((msg) => { setOkMsg(msg); setTimeout(() => setOkMsg(null), 2200); }, []);

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
      console.error(e);
      setError('Falha ao carregar templates.');
    } finally {
      setLoading(false);
    }
  }, [statusFilter, query]);

  useEffect(() => { load(); }, [load]);

  useEffect(() => {
    const ids = items.filter(t => t.status === 'submitted').map(t => t.id);
    if (ids.length === 0) { stopPolling(); return; }
    if (pollRef.current) return;
    pollRef.current = setInterval(async () => {
      try { await Promise.all(ids.map(id => apiPost(`/templates/${id}/sync`, {}))); load(); }
      catch (e) { console.warn('Polling falhou:', e?.message || e); }
    }, 15000);
    return stopPolling;
  }, [items, load]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return [...items]
      .filter(t => !statusFilter || String(t.status).toLowerCase() === statusFilter)
      .filter(t => !q || String(t.name || '').toLowerCase().includes(q) || String(t.body_text || '').toLowerCase().includes(q))
      .sort((a, b) => String(a.updated_at || '').localeCompare(String(b.updated_at || '')))
      .reverse();
  }, [items, statusFilter, query]);

  async function handleDelete(id, status) {
    if (!['draft', 'rejected'].includes(status)) {
      setError('Apenas rascunhos ou rejeitados podem ser removidos localmente.');
      return;
    }
    const ok = await confirm({
      title: 'Remover template?',
      description: 'Esta ação remove o registro local (não afeta o status já enviado à Meta).',
      tone: 'danger',
      confirmText: 'Remover',
      cancelText: 'Cancelar',
    });
    if (!ok) return;

    try {
      setError(null);
      await apiDelete(`/templates/${id}`);
      toastOK('Template removido.');
      load();
    } catch (e) {
      console.error(e);
      setError('Falha ao excluir template.');
    }
  }

  const clearSearch = () => setQuery('');

  return (
    <div className={styles.container}>
      {/* Ações topo, direita */}
      <div className={styles.toolbar}>
        <div className={styles.headerActions}>
          <button className={styles.btn} type="button" onClick={load} title="Atualizar lista">
            <RefreshCw size={16} /> Atualizar
          </button>
          <button
            className={styles.btnPrimary}
            type="button"
            onClick={() => navigate('/management/templates/new')}
          >
            <Plus size={16} /> Criar Template
          </button>
        </div>
      </div>

      {/* Header */}
      <div className={styles.header}>
        <div><p className={styles.subtitle}>Crie seus templates e envie para aprovação da Meta.</p></div>
      </div>

      {/* Card da lista */}
      <div className={styles.card}>
        <div className={styles.cardHead}>
          {/* filtro por status */}
          <div className={styles.optionsRow} role="radiogroup" aria-label="Filtrar por status">
            {STATUS_OPTIONS.map(opt => (
              <label key={opt.key || 'all'} className={styles.opt} role="radio" aria-checked={statusFilter === opt.key}>
                <input
                  type="radio"
                  name="statusFilter"
                  value={opt.key}
                  checked={statusFilter === opt.key}
                  onChange={() => setStatusFilter(opt.key)}
                />
                <span>{opt.label}</span>
              </label>
            ))}
          </div>

          {/* busca */}
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
                <th style={{ width: 120 }}>Ações</th>
              </tr>
            </thead>
            <tbody>
              {loading && <tr><td className={styles.loading} colSpan={7}>Carregando…</td></tr>}
              {!loading && filtered.length === 0 && <tr><td className={styles.empty} colSpan={7}>Nenhum template encontrado.</td></tr>}

              {!loading && filtered.map(t => (
                <tr
                  key={t.id}
                  className={styles.rowHover}
                  style={{ cursor:'pointer' }}
                  onClick={() => openPreview(t)}
                  onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); openPreview(t); } }}
                  tabIndex={0}
                  role="button"
                  aria-label={`Abrir prévia de ${t.name}`}
                >
                  <td data-label="Nome"><div className={styles.keyTitle}>{t.name}</div></td>
                  <td data-label="Categoria">{t.category || '—'}</td>
                  <td data-label="Recategorizado">{t.recategorized ? 'Sim' : 'Não'}</td>
                  <td data-label="Idioma">{t.language_code || '—'}</td>
                  <td data-label="Status"><StatusChip status={t.status} /></td>
                  <td data-label="Qualidade"><ScoreSemaforo value={t.quality_score} /></td>
                  <td
                    data-label="Ações"
                    className={styles.actionsCell}
                    onClick={(e) => e.stopPropagation()}
                    onKeyDown={(e) => e.stopPropagation()}
                  >
                    <div className={styles.actions}>
                      <button
                        className={`${styles.qrIconBtn} ${styles.danger}`}
                        title="Excluir"
                        onClick={() => handleDelete(t.id, t.status)}
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

        {error && <div className={styles.alertErr} role="alert">⚠️ {error}</div>}
        {okMsg && <div className={styles.alertOk} role="status">✅ {okMsg}</div>}
      </div>

      {/* Preview em modal */}
      <TemplatePreviewModal isOpen={previewOpen} template={previewItem} onClose={closePreview}/>
    </div>
  );
}
