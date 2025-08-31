import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { apiGet } from '../../../shared/apiClient';
import styles from './Campaigns.module.css';
import { Plus, RefreshCw, X as XIcon } from 'lucide-react';

const STATUS_OPTIONS = [
  { key: '',           label: 'Todos' },
  { key: 'queued',     label: 'Imediatas (Em fila)' },
  { key: 'scheduled',  label: 'Agendadas' },
  { key: 'finished',   label: 'Finalizadas' },
  { key: 'failed',     label: 'Falhadas' },
];

function StatusChip({ status }) {
  const map = {
    queued:     styles.stQueued,
    scheduled:  styles.stScheduled,
    finished:   styles.stFinished,
    failed:     styles.stFailed,
  };
  const cls = map[status] || styles.stDefault;
  return <span className={`${styles.statusChip} ${cls}`}>{status || '—'}</span>;
}

function fmtDateTime(v) {
  if (!v) return '—';
  try {
    const d = new Date(v);
    if (Number.isNaN(d.getTime())) return '—';
    return d.toLocaleString('pt-BR');
  } catch { return '—'; }
}

export default function Campaigns() {
  const [items, setItems] = useState([]);
  const [query, setQuery] = useState('');
  const [status, setStatus] = useState('');
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState(null);

  const load = useCallback(async () => {
    setLoading(true);
    setErr(null);
    try {
      const qs = new URLSearchParams();
      if (status) qs.set('status', status);
      if (query.trim()) qs.set('q', query.trim());
      const data = await apiGet(`/campaigns${qs.toString() ? `?${qs}` : ''}`);
      setItems(Array.isArray(data) ? data : []);
    } catch (e) {
      console.error(e);
      setErr('Falha ao carregar campanhas.');
    } finally {
      setLoading(false);
    }
  }, [status, query]);

  useEffect(() => { load(); }, [load]);

  const filtered = useMemo(() => {
    return [...items]
      .sort((a, b) => String(a.updated_at || '').localeCompare(String(b.updated_at || '')))
      .reverse();
  }, [items]);

  function progressOf(c) {
    const total = Number(c.total_items || c.total || 0);
    const sent = Number(c.sent_count || c.sent || 0);
    const delivered = Number(c.delivered_count || c.delivered || 0);
    const read = Number(c.read_count || c.read || 0);
    const processed = c.processed_count != null
      ? Number(c.processed_count)
      : sent + delivered + read;
    if (!total) return 0;
    return Math.max(0, Math.min(100, Math.round((processed / total) * 100)));
  }

  const clearSearch = () => setQuery('');

  return (
    <div className={styles.container}>
      <div className={styles.card}>
        {/* Linha superior: filtros (esq) + ações (dir) */}
        <div className={styles.cardHead}>
          <div className={styles.headLeft}>
            <div className={styles.groupTitle}>Filtrar por status</div>
            <div className={styles.radioGroup} role="radiogroup" aria-label="Filtrar por status">
              {STATUS_OPTIONS.map(opt => (
                <label key={opt.key || 'all'} className={styles.radioOption}>
                  <input
                    type="radio"
                    name="status"
                    value={opt.key}
                    checked={status === opt.key}
                    onChange={() => setStatus(opt.key)}
                    className={styles.radioInput}
                  />
                  <span className={styles.radioControl} aria-hidden />
                  <span className={styles.radioLabel}>{opt.label}</span>
                </label>
              ))}
            </div>
          </div>

          <div className={styles.headerActions}>
            <button className={styles.btn} onClick={load} type="button" title="Atualizar lista">
              <RefreshCw size={16}/> Atualizar
            </button>
            <button
              className={styles.btnPrimary}
              type="button"
              onClick={() => { try { window.location.href = '/campaigns/new'; } catch {} }}
              title="Criar nova campanha"
            >
              <Plus size={16}/> Nova campanha
            </button>
          </div>
        </div>

        {/* Linha inferior: somente a busca, alinhada à direita (como no print) */}
        <div className={styles.subToolbar}>
          <div className={styles.searchGroup}>
            <input
              className={styles.searchInput}
              placeholder="Buscar por nome…"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              aria-label="Buscar campanhas"
            />
            {query && (
              <button
                className={styles.searchClear}
                onClick={clearSearch}
                aria-label="Limpar busca"
                type="button"
              >
                <XIcon size={14} />
              </button>
            )}
          </div>
        </div>

        {err && (
          <div className={styles.alertErr}>
            <span className={styles.alertIcon}>⚠️</span>
            {err}
            <button className={styles.alertClose} onClick={() => setErr(null)} aria-label="Fechar aviso">
              <XIcon size={14} />
            </button>
          </div>
        )}

        {/* Tabela */}
        <div className={styles.tableWrap}>
          <table className={styles.table}>
            <thead>
              <tr>
                <th style={{minWidth:260}}>Campanha</th>
                <th style={{width:180}}>Agendada para</th>
                <th style={{width:140}}>Status</th>
                <th style={{width:260}}>Progresso</th>
                <th style={{width:180}}>Atualizado em</th>
              </tr>
            </thead>
            <tbody>
              {loading && (
                <tr><td className={styles.loading} colSpan={5}>Carregando…</td></tr>
              )}

              {!loading && filtered.length === 0 && (
                <tr><td className={styles.empty} colSpan={5}>Nenhuma campanha encontrada.</td></tr>
              )}

              {!loading && filtered.map((c) => {
                const pct = progressOf(c);
                return (
                  <tr key={c.id} className={styles.rowHover}>
                    <td data-label="Campanha">
                      <div className={styles.keyTitle}>{c.name}</div>
                      {c.description && <div className={styles.keySub}>{c.description}</div>}
                    </td>
                    <td data-label="Agendada para">{fmtDateTime(c.start_at)}</td>
                    <td data-label="Status"><StatusChip status={c.status} /></td>
                    <td data-label="Progresso">
                      <div className={styles.progress}>
                        <div className={styles.progressValue} style={{ width: `${pct}%` }} />
                      </div>
                      <div className={styles.keySub} style={{ marginTop: 6 }}>
                        {pct}% • {(c.sent_count ?? c.sent ?? 0)}/{c.total_items ?? c.total ?? 0}
                      </div>
                    </td>
                    <td data-label="Atualizado em">{fmtDateTime(c.updated_at)}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
