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

function ScoreChip({ score }) {
  const norm = String(score || '').toUpperCase();
  if (!norm) return <span className={styles.scoreChip}>—</span>;
  if (norm === 'GREEN') return <span className={`${styles.scoreChip} ${styles.scGreen}`}>Alta qualidade</span>;
  if (norm === 'YELLOW') return <span className={`${styles.scoreChip} ${styles.scYellow}`}>Qualidade média</span>;
  if (norm === 'RED') return <span className={`${styles.scoreChip} ${styles.scRed}`}>Baixa qualidade</span>;
  return <span className={styles.scoreChip}>{score}</span>;
}

function langLabel(code) {
  if (!code) return '—';
  const map = {
    'pt_BR':'Português (BR)','pt_PT':'Português (PT)',
    'en_US':'Inglês (US)','es_ES':'Espanhol (ES)'
  };
  return map[code] || code;
}

function PreviewModal({ open, tpl, onClose }) {
  if (!open || !tpl) return null;
  return (
    <div className={styles.modalOverlay} role="dialog" aria-modal="true" aria-label={`Prévia ${tpl.name}`}>
      <div className={styles.modal}>
        <div className={styles.modalHeader}>
          <h3 className={styles.modalTitle}>Prévia — {tpl.name}</h3>
          <button className={styles.btn} onClick={onClose} aria-label="Fechar">
            <XIcon size={16} />
          </button>
        </div>

        <div className={styles.formGrid}>
          {tpl.header_type && tpl.header_type !== 'NONE' && tpl.header_text &&
            <div className={styles.previewHeader}>[HEADER] {tpl.header_text}</div>}
          <pre className={styles.code}>{tpl.body_text || '—'}</pre>
          {tpl.footer_text && <div className={styles.previewFooter}>[FOOTER] {tpl.footer_text}</div>}
        </div>

        <div className={styles.modalActions}>
          <button className={styles.btn} onClick={onClose}>Fechar</button>
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
  const [previewOf, setPreviewOf] = useState(null);

  // controle do auto-poll
  const pollTimer = useRef(null);
  const attempts = useRef({}); // id -> contagem

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

  // ordenação local
  const rows = useMemo(() => {
    return [...items].sort((a, b) =>
      String(a.updated_at || '').localeCompare(String(b.updated_at || '')
    )).reverse();
  }, [items]);

  async function handleSubmit(id) {
    try {
      setError(null);
      await apiPost(`/templates/${id}/submit`, {});
      toastOK('Template submetido para aprovação.');
      // começa a acompanhar
      startPolling([id]);
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

  // ---------- Auto-poll ----------
  function startPolling(idsFromAction) {
    // junta com os que já estão "submitted"
    const base = rows.filter(r => r.status === 'submitted').map(r => r.id);
    const ids = Array.from(new Set([...(idsFromAction || []), ...base]));
    if (!ids.length) return;

    // zera contadores para os que vieram agora
    ids.forEach(id => { if (!attempts.current[id]) attempts.current[id] = 0; });

    // limpa anterior
    if (pollTimer.current) clearInterval(pollTimer.current);

    // faz sync a cada 10s, por até 18 vezes (~3min)
    pollTimer.current = setInterval(async () => {
      try {
        await Promise.all(ids.map(async (id) => {
          attempts.current[id] = (attempts.current[id] || 0) + 1;
          await apiPost(`/templates/${id}/sync`, {});
        }));
        await load();
        // se todos saíram de "submitted" ou estourou tentativas, encerra
        const still = rows.filter(r => r.status === 'submitted').map(r => r.id);
        const over = ids.every(id => (attempts.current[id] || 0) >= 18);
        if (!still.length || over) {
          clearInterval(pollTimer.current);
          pollTimer.current = null;
        }
      } catch {
        /* silencia tentativa falha; próxima iteração tenta de novo */
      }
    }, 10000);
  }

  // sempre que a lista mudar, se existir "submitted", garante polling ativo
  useEffect(() => {
    const hasSubmitted = rows.some(r => r.status === 'submitted');
    if (hasSubmitted && !pollTimer.current) startPolling();
  }, [rows]);

  // ---------- Render ----------
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
                <th style={{ minWidth: 260 }}>Nome do modelo</th>
                <th>Categoria</th>
                <th>Recategorizado</th>
                <th>Idioma</th>
                <th>Status</th>
                <th>Score</th>
                <th style={{ width: 220, textAlign:'right' }}>Ações</th>
              </tr>
            </thead>
            <tbody>
              {loading && (
                <tr>
                  <td className={styles.loading} colSpan={7}>Carregando…</td>
                </tr>
              )}

              {!loading && rows.length === 0 && (
                <tr>
                  <td className={styles.empty} colSpan={7}>
                    Nenhum template encontrado.
                  </td>
                </tr>
              )}

              {!loading && rows.map(t => (
                <tr
                  key={t.id}
                  className={styles.rowHover}
                  onClick={(e) => {
                    // se clicou em botão/ícone, não abrir prévia
                    const tag = String(e.target.tagName).toLowerCase();
                    if (tag === 'button' || tag === 'svg' || tag === 'path') return;
                    setPreviewOf(t);
                  }}
                >
                  <td data-label="Nome">
                    <div className={styles.keyTitle}>{t.name}</div>
                    {t.provider_id && (
                      <div className={styles.keySub}>provider_id: {t.provider_id}</div>
                    )}
                  </td>
                  <td data-label="Categoria">{t.category || '—'}</td>
                  <td data-label="Recategorizado">{t.recategorized ? 'Sim' : 'Não'}</td>
                  <td data-label="Idioma">{langLabel(t.language_code)}</td>
                  <td data-label="Status"><StatusChip status={t.status} /></td>
                  <td data-label="Score"><ScoreChip score={t.quality_score} /></td>
                  <td data-label="Ações" className={styles.actionsCell}>
                    <div className={styles.actions} onClick={(e)=>e.stopPropagation()}>
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
        onCreated={async (created) => {
          setCreateOpen(false);
          toastOK('Template criado.');
          await load();
          // auto-submit + auto-poll do recém-criado (se desejar já enviar à Meta)
          if (created?.id) {
            try {
              await apiPost(`/templates/${created.id}/submit`, {});
              startPolling([created.id]);
              toastOK('Submetido para aprovação.');
            } catch { /* ignora, botão manual ainda existe */ }
          }
        }}
      />

      {/* Prévia */}
      <PreviewModal open={!!previewOf} tpl={previewOf} onClose={()=>setPreviewOf(null)} />
    </div>
  );
}
