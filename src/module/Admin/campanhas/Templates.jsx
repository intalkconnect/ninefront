// src/pages/Templates/Templates.jsx
import React, { useCallback, useEffect, useMemo, useState } from 'react';
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

const STATUS_TABS = [
  { key: '', label: 'Todos' },
  { key: 'approved', label: 'Aprovados' },
  { key: 'rejected', label: 'Rejeitados' },
  { key: 'submitted', label: 'Em análise' },
  { key: 'draft', label: 'Rascunhos' },
];

function StatusChip({ status }) {
  const map = {
    approved: { txt: 'Aprovado', cls: styles.stApproved },
    rejected: { txt: 'Rejeitado', cls: styles.stRejected },
    submitted: { txt: 'Em análise', cls: styles.stSubmitted },
    draft: { txt: 'Rascunho', cls: styles.stDraft },
  };
  const it = map[status] || { txt: status || '—', cls: styles.stDefault };
  return <span className={`${styles.statusChip} ${it.cls}`}>{it.txt}</span>;
}

export default function Templates() {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(false);

  const [error, setError] = useState(null);
  const [okMsg, setOkMsg] = useState(null);

  const [query, setQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('');

  const [createOpen, setCreateOpen] = useState(false);

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

  const filtered = useMemo(() => {
    // servidor já filtra por q/status; isso mantém o sort local
    return [...items].sort((a, b) =>
      String(a.updated_at || '').localeCompare(String(b.updated_at || ''))
    ).reverse();
  }, [items]);

  async function handleSubmit(id) {
    try {
      setError(null);
      await apiPost(`/templates/${id}/submit`, {});
      toastOK('Template submetido para aprovação.');
      load();
    } catch (e) {
      console.error('Erro ao submeter:', e);
      setError('Falha ao submeter template para a Meta.');
    }
  }

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
      <div className={styles.header}>
        <div>
          <h1 className={styles.title}>
            <FileText size={22} aria-hidden="true" /> Templates
          </h1>
          <p className={styles.subtitle}>
            Crie, envie para aprovação e acompanhe o status dos templates do WhatsApp.
          </p>

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

      {/* Filtros */}
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

      {/* Lista */}
      <div className={styles.card}>
        <div className={styles.cardHead}>
          <div className={styles.cardTitle}>Templates cadastrados</div>
        </div>

        <div className={styles.tableWrap}>
          <table className={styles.table}>
            <thead>
              <tr>
                <th style={{ minWidth: 260 }}>Nome</th>
                <th>Linguagem</th>
                <th>Categoria</th>
                <th>Status</th>
                <th style={{ minWidth: 320 }}>Prévia</th>
                <th style={{ width: 220 }}>Ações</th>
              </tr>
            </thead>
            <tbody>
              {loading && (
                <tr>
                  <td className={styles.loading} colSpan={6}>Carregando…</td>
                </tr>
              )}

              {!loading && filtered.length === 0 && (
                <tr>
                  <td className={styles.empty} colSpan={6}>
                    Nenhum template encontrado.
                  </td>
                </tr>
              )}

              {!loading && filtered.map(t => (
                <tr key={t.id} className={styles.rowHover}>
                  <td data-label="Nome">
                    <div className={styles.keyTitle}>{t.name}</div>
                    {t.provider_id && (
                      <div className={styles.keySub}>provider_id: {t.provider_id}</div>
                    )}
                  </td>
                  <td data-label="Linguagem">{t.language_code || '—'}</td>
                  <td data-label="Categoria">{t.category || '—'}</td>
                  <td data-label="Status"><StatusChip status={t.status} /></td>
                  <td data-label="Prévia">
                    <div className={styles.preview}>
                      {t.header_type && t.header_type !== 'NONE' && t.header_text ? (
                        <div className={styles.previewHeader}>[HEADER] {t.header_text}</div>
                      ) : null}
                      <pre className={styles.code}>{t.body_text || '—'}</pre>
                      {t.footer_text ? (
                        <div className={styles.previewFooter}>[FOOTER] {t.footer_text}</div>
                      ) : null}
                    </div>
                  </td>
                  <td data-label="Ações" className={styles.actionsCell}>
                    <div className={styles.actions}>
                      <button
                        className={`${styles.btn} ${styles.iconOnly}`}
                        title="Sincronizar status"
                        onClick={() => handleSync(t.id)}
                        type="button"
                      >
                        <RefreshCw size={16} />
                      </button>

                      <button
                        className={`${styles.btnSecondary} ${styles.iconOnly}`}
                        title="Submeter à Meta"
                        onClick={() => handleSubmit(t.id)}
                        disabled={!['draft', 'rejected'].includes(t.status)}
                        type="button"
                      >
                        <UploadCloud size={16} />
                      </button>

                      <button
                        className={`${styles.btnDanger} ${styles.iconOnly}`}
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
      </div>

      {/* Modal de criação */}
      <TemplateModal
        isOpen={createOpen}
        onClose={() => setCreateOpen(false)}
        onCreated={() => { setCreateOpen(false); load(); toastOK('Template criado.'); }}
      />
    </div>
  );
}
