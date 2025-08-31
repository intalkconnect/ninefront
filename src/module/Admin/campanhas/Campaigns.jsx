import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { apiGet } from '../../../shared/apiClient';
import { Plus, RefreshCw, X as XIcon, AlertCircle } from 'lucide-react';
import styles from './styles/Campaigns.module.css';

const FILTERS = [
  { key: '',            label: 'Todos' },
  { key: 'queued',      label: 'Imediatas (Em fila)' },
  { key: 'scheduled',   label: 'Agendadas' },
  { key: 'finished',    label: 'Finalizadas' },
  { key: 'failed',      label: 'Falhadas' },
];

function formatDate(d) {
  if (!d) return '—';
  const dt = new Date(d);
  if (Number.isNaN(dt.getTime())) return '—';
  return dt.toLocaleString('pt-BR');
}

function ProgressBar({ processed, total }) {
  const pct = total > 0 ? Math.round((processed / total) * 100) : 0;
  return (
    <div className={styles.progressWrap} title={`${processed}/${total} (${pct}%)`}>
      <div className={styles.progressBar}>
        <div className={styles.progressFill} style={{ width: `${pct}%` }} />
      </div>
      <div className={styles.progressText}>{processed}/{total}</div>
    </div>
  );
}

export default function Campaigns() {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState(null);

  const [q, setQ] = useState('');
  const [statusFilter, setStatusFilter] = useState('');

  const load = useCallback(async () => {
    setLoading(true); setErr(null);
    try {
      const params = new URLSearchParams();
      if (statusFilter) params.set('status', statusFilter);
      if (q.trim()) params.set('q', q.trim());
      const data = await apiGet(`/campaigns${params.toString() ? `?${params}` : ''}`);
      setItems(Array.isArray(data) ? data : []);
    } catch (e) {
      console.error(e);
      setErr('Falha ao carregar campanhas.');
    } finally {
      setLoading(false);
    }
  }, [q, statusFilter]);

  useEffect(() => { load(); }, [load]);

  const onCreate = () => {
    // acione sua navegação/modal de criação aqui
    window.dispatchEvent(new CustomEvent('open-campaign-create'));
  };

  const filtered = useMemo(() => {
    return [...items]
      .sort((a, b) => String(a.updated_at || '').localeCompare(String(b.updated_at || '')))
      .reverse();
  }, [items]);

  return (
    <div className={styles.container}>
      {/* Botões no topo (fora do card) */}
      <div className={styles.toolbar}>
        <div className={styles.headerActions}>
          <button className={styles.btn} onClick={load} type="button" title="Atualizar">
            <RefreshCw size={16} /> Atualizar
          </button>
          <button className={styles.btnPrimary} onClick={onCreate} type="button">
            <Plus size={16} /> Nova campanha
          </button>
        </div>
      </div>

      {/* Card: header com radios + busca */}
      <div className={styles.card}>
        <div className={styles.cardHead}>
          <div className={styles.optionGroup} role="radiogroup" aria-label="Filtrar por status">
            <div className={styles.optionTitle}>Filtrar por status</div>
            {FILTERS.map(f => (
              <label key={f.key || 'all'} className={styles.optionItem}>
                <input
                  type="radio"
                  name="status"
                  value={f.key}
                  checked={statusFilter === f.key}
                  onChange={() => setStatusFilter(f.key)}
                  className={styles.optionControl}
                />
                <span className={styles.optionLabel}>{f.label}</span>
              </label>
            ))}
          </div>

          <div className={styles.searchGroup}>
            <input
              className={styles.searchInput}
              placeholder="Buscar por nome..."
              value={q}
              onChange={(e) => setQ(e.target.value)}
            />
            {q && (
              <button
                className={styles.searchClear}
                onClick={() => setQ('')}
                type="button"
                aria-label="Limpar busca"
              >
                <XIcon size={14} />
              </button>
            )}
          </div>
        </div>

        {/* Alert de erro (se houver) */}
        {err && (
          <div className={styles.alertErr}>
            <span className={styles.alertIcon}><AlertCircle size={16} /></span>
            {err}
            <button className={styles.alertClose} onClick={() => setErr(null)}><XIcon size={14}/></button>
          </div>
        )}

        {/* Tabela */}
        <div className={styles.tableWrap}>
          <table className={styles.table}>
            <thead>
              <tr>
                <th>Campanha</th>
                <th>Agendada para</th>
                <th>Progresso</th>
                <th>Enviadas</th>
                <th>Entregues</th>
                <th>Lidas</th>
                <th>Falhas</th>
                <th>Atualizado em</th>
              </tr>
            </thead>
            <tbody>
              {loading && (
                <tr>
                  <td className={styles.loading} colSpan={8}>Carregando…</td>
                </tr>
              )}

              {!loading && filtered.length === 0 && (
                <tr>
                  <td className={styles.empty} colSpan={8}>Nenhuma campanha encontrada.</td>
                </tr>
              )}

              {!loading && filtered.map((c) => {
                const total = c.total_items || 0;
                const processed = (c.processed_count != null)
                  ? c.processed_count
                  : (c.sent_count + c.delivered_count + c.read_count + c.failed_count);

                return (
                  <tr key={c.id} className={styles.rowHover}>
                    <td>
                      <div className={styles.keyTitle}>{c.name}</div>
                      <div className={styles.keySub}>
                        {c.template_name ? `Modelo: ${c.template_name}` : '—'}
                      </div>
                    </td>
                    <td>{c.start_at ? formatDate(c.start_at) : '—'}</td>
                    <td><ProgressBar processed={processed} total={total} /></td>
                    <td>{c.sent_count || 0}</td>
                    <td>{c.delivered_count || 0}</td>
                    <td>{c.read_count || 0}</td>
                    <td>{c.failed_count || 0}</td>
                    <td>{formatDate(c.updated_at)}</td>
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
