import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { apiGet, apiPost, apiDelete } from '../../../shared/apiClient';
import styles from './styles/Templates.module.css';
import {
  FileText,
  Plus,
  RefreshCw,
  UploadCloud,
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
    approved:  { txt: 'Aprovado',  cls: styles.stApproved },
    rejected:  { txt: 'Rejeitado', cls: styles.stRejected },
    submitted: { txt: 'Em análise', cls: styles.stSubmitted },
    draft:     { txt: 'Rascunho',  cls: styles.stDraft },
  };
  const it = map[status] || { txt: status || '—', cls: styles.stDefault };
  return <span className={`${styles.statusChip} ${it.cls}`}>{it.txt}</span>;
}

function ScoreChip({ score }) {
  if (!score) return null;
  const low = /low|baixa/i.test(String(score));
  const med = /med|m[eé]dia/i.test(String(score));
  const cls = low ? styles.scoreLow : med ? styles.scoreMed : styles.scoreChip;
  return <span className={`${styles.statusChip} ${cls}`}>{String(score)}</span>;
}

export default function Templates() {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [okMsg, setOkMsg] = useState(null);

  const [query, setQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('');

  const [createOpen, setCreateOpen] = useState(false);
  const [preview, setPreview] = useState(null);

  // polling para 'submitted'
  const pollRef = useRef(null);
  const stopPolling = () => { if (pollRef.current){ clearInterval(pollRef.current); pollRef.current = null; } };

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
      console.error('Erro ao listar templates:', e);
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
      try {
        await Promise.all(ids.map(id => apiPost(`/templates/${id}/sync`, {})));
        load();
      } catch (e) {
        console.warn('Polling falhou:', e?.message || e);
      }
    }, 15000);
    return stopPolling;
  }, [items, load]);

  const filtered = useMemo(() =>
    [...items].sort((a, b) =>
      String(a.updated_at || '').localeCompare(String(b.updated_at || '')
    )).reverse(), [items]);

  async function handleSubmit(id) {
    try { setError(null); await apiPost(`/templates/${id}/submit`, {}); toastOK('Template submetido para aprovação.'); load(); }
    catch (e) { console.error(e); setError('Falha ao submeter template para a Meta.'); }
  }
  async function handleSync(id) {
    try { setError(null); await apiPost(`/templates/${id}/sync`, {}); toastOK('Status sincronizado com a Meta.'); load(); }
    catch (e) { console.error(e); setError('Falha ao sincronizar status.'); }
  }
  async function handleDelete(id, status) {
    if (!['draft','rejected'].includes(status)) { setError('Apenas rascunhos ou rejeitados podem ser removidos localmente.'); return; }
    if (!window.confirm('Tem certeza que deseja remover este template?')) return;
    try { setError(null); await apiDelete(`/templates/${id}`); toastOK('Template removido.'); load(); }
    catch (e) { console.error(e); setError('Falha ao excluir template.'); }
  }

  const clearSearch = () => setQuery('');

  return (
    <div className={styles.container}>
      {/* HEADER — padrão Filas */}
      <div className={styles.header}>
        <div>
          <h1 className={styles.title}><FileText size={22} aria-hidden="true" /> Templates</h1>

          {error && (
            <div className={styles.alertErr} role="alert">
              <span className={styles.alertIcon} aria-hidden="true"><AlertCircle size={16} /></span>
              <span>{error}</span>
              <button className={styles.alertClose} onClick={() => setError(null)} aria-label="Fechar">
                <XIcon size={14} />
              </button>
            </div>
          )}
          {okMsg && (
            <div className={styles.alertOk} role="status">
              <span className={styles.alertIcon} aria-hidden="true"><CheckCircle2 size={16} /></span>
              <span>{okMsg}</span>
              <button className={styles.alertClose} onClick={() => setOkMsg(null)} aria-label="Fechar">
                <XIcon size={14} />
              </button>
            </div>
          )}
        </div>

        <div className={styles.headerActions}>
          <button className={styles.btn} type="button" onClick={load} title="Atualizar lista">
            <RefreshCw size={16} /> Atualizar
          </button>
          <button className={styles.btnPrimary} type="button" onClick={() => setCreateOpen(true)}>
            <Plus size={16} /> Criar template
          </button>
        </div>
      </div>

      {/* FILTROS (fora do header) */}
      <div className={styles.filters}>
        <div className={styles.searchGroup}>
          <input
            className={styles.searchInput}
            placeholder="Buscar por nome ou conteúdo…"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
          {query && (
            <button className={styles.searchClear} onClick={clearSearch} aria-label="Limpar busca">
              <XIcon size={14} />
            </button>
          )}
        </div>

        <div className={styles.tabs}>
          {STATUS_TABS.map(tab => (
            <button
              key={tab.key || 'all'}
              className={`${styles.tab} ${statusFilter === tab.key ? styles.tabActive : ''}`}
              onClick={() => setStatusFilter(tab.key)}
              type="button"
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {/* LISTA */}
      <div className={styles.card}>
        <div className={styles.cardHead}>
          <div className={styles.cardTitle}>Templates cadastrados</div>
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
                <th>Score</th>
                <th style={{ minWidth: 320 }}>Prévia</th>
                <th style={{ width: 220, textAlign:'right' }}>Ações</th>
              </tr>
            </thead>
            <tbody>
              {loading && (
                <tr><td className={styles.loading} colSpan={8}>Carregando…</td></tr>
              )}

              {!loading && filtered.length === 0 && (
                <tr><td className={styles.empty} colSpan={8}>Nenhum template encontrado.</td></tr>
              )}

              {!loading && filtered.map(t => (
                <tr
                  key={t.id}
                  className={styles.rowHover}
                  onClick={(e) => {
                    const tag = (e.target.tagName || '').toLowerCase();
                    if (['button','svg','path'].includes(tag)) return;
                    setPreview(t);
                  }}
                >
                  <td data-label="Nome">
                    <div className={styles.keyTitle}>{t.name}</div>
                    {t.provider_id && <div className={styles.keySub}>provider_id: {t.provider_id}</div>}
                  </td>
                  <td data-label="Categoria">{t.category || '—'}</td>
                  <td data-label="Recategorizado">{t.recategorized ? 'Sim' : 'Não'}</td>
                  <td data-label="Idioma">{t.language_code || '—'}</td>
                  <td data-label="Status"><StatusChip status={t.status} /></td>
                  <td data-label="Score"><ScoreChip score={t.score} /></td>
                  <td data-label="Prévia">
                    <div className={styles.preview}>
                      {(t.header_type && t.header_type !== 'NONE' && t.header_text) ? (
                        <div className={styles.previewHeader}>[HEADER] {t.header_text}</div>
                      ) : null}
                      <pre className={styles.code}>{t.body_text || '—'}</pre>
                      {t.footer_text ? <div className={styles.previewFooter}>[FOOTER] {t.footer_text}</div> : null}
                    </div>
                  </td>
                  <td data-label="Ações" className={styles.actionsCell}>
                    <div className={styles.actions}>
                      <button
                        className={styles.qrIconBtn}
                        title="Sincronizar status"
                        onClick={() => handleSync(t.id)}
                        type="button"
                      >
                        <RefreshCw size={16} />
                      </button>
                      <button
                        className={`${styles.qrIconBtn} ${styles.success}`}
                        title="Submeter à Meta"
                        onClick={() => handleSubmit(t.id)}
                        disabled={!['draft','rejected'].includes(t.status)}
                        type="button"
                      >
                        <UploadCloud size={16} />
                      </button>
                      <button
                        className={`${styles.qrIconBtn} ${styles.danger}`}
                        title="Excluir"
                        onClick={() => handleDelete(t.id, t.status)}
                        disabled={!['draft','rejected'].includes(t.status)}
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

      {/* Modais */}
      <TemplateModal
        isOpen={createOpen}
        onClose={() => setCreateOpen(false)}
        onCreated={() => { setCreateOpen(false); load(); toastOK('Template criado.'); }}
      />
      <TemplatePreviewModal
        isOpen={!!preview}
        template={preview}
        onClose={() => setPreview(null)}
      />
    </div>
  );
}
