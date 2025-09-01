import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { RefreshCw, Plus, X as XIcon } from 'lucide-react';
import { apiGet } from '../../../shared/apiClient';
import styles from './styles/Campaigns.module.css';

/** Radios (options) do topo */
const FILTERS = [
  { key: 'all',       label: 'Todos' },
  { key: 'active',    label: 'Ativos' },      // queued/scheduled ou remaining > 0
  { key: 'finished',  label: 'Finalizados' },
  { key: 'failed',    label: 'Falhas' },
];

/** Processados/total (conta falhas como processadas para não virar “restante”) */
function calcProcessed(c) {
  const total = Number(c?.total_items || 0);
  const pc = Number(c?.processed_count);
  if (Number.isFinite(pc) && pc >= 0) return { processed: pc, total };

  const rem = Number(c?.remaining);
  if (Number.isFinite(rem) && total > 0) {
    return { processed: Math.max(0, total - rem), total };
  }

  const sent = Number(c?.sent_count || 0);
  const del  = Number(c?.delivered_count || 0);
  const read = Number(c?.read_count || 0);
  const fail = Number(c?.failed_count || 0);
  const sum  = sent + del + read + fail;
  const safeTotal = total || sum;
  return { processed: Math.min(safeTotal, sum), total: safeTotal };
}

function formatDate(v) {
  if (!v) return '—';
  const d = new Date(v);
  return isNaN(d.getTime()) ? '—' : d.toLocaleString('pt-BR');
}

/** Label + classe do chip de status */
function getStatusUi(c) {
  const st = String(c?.status || '').toLowerCase();
  const { processed, total } = calcProcessed(c);
  const remaining = Math.max(0, (total || 0) - processed);

  if (st === 'failed')   return { label: 'Falhou',     cls: styles.stFailed };
  if (st === 'finished') return { label: 'Concluída',  cls: styles.stFinished };
  if (st === 'scheduled')return { label: 'Agendada',   cls: styles.stScheduled };
  if (st === 'queued' || remaining > 0) return { label: 'Em andamento', cls: styles.stActive };
  return { label: st || '—', cls: styles.stDefault };
}

export default function Campaigns() {
  const [items, setItems]   = useState([]);
  const [filter, setFilter] = useState('all');
  const [query, setQuery]   = useState('');
  const [loading, setLoading] = useState(false);
  const [okMsg, setOkMsg]   = useState(null);
  const [error, setError]   = useState(null);

  const toastOK = useCallback((msg) => {
    setOkMsg(msg);
    setTimeout(() => setOkMsg(null), 2200);
  }, []);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await apiGet('/campaigns');
      setItems(Array.isArray(data) ? data : []);
    } catch (e) {
      console.error(e);
      setError('Falha ao carregar campanhas.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  // filtro client-side (busca só por NOME)
  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return (items || [])
      .filter(c => {
        if (filter === 'finished')  return String(c.status).toLowerCase() === 'finished';
        if (filter === 'failed')    return String(c.status).toLowerCase() === 'failed' || Number(c.failed_count || 0) > 0;
        if (filter === 'active') {
          const st = String(c.status).toLowerCase();
          const { processed, total } = calcProcessed(c);
          return st === 'queued' || st === 'scheduled' || (total > processed);
        }
        return true;
      })
      .filter(c => {
        if (!q) return true;
        return String(c.name || '').toLowerCase().includes(q); // 🔎 só nome
      })
      .sort((a, b) => String(a.updated_at || '').localeCompare(String(b.updated_at || '')))
      .reverse();
  }, [items, filter, query]);

  return (
    <div className={styles.container}>
      {/* Cabeçalho superior */}
      <div className={styles.header}>
        <div>
          <h1 className={styles.title}>Campanhas</h1>
          <p className={styles.subtitle}>Envie imediatamente ou agende. Acompanhe progresso e resultados.</p>
        </div>
      </div>

      {/* Botões acima do card (à direita) */}
      <div className={styles.toolbar}>
        <div className={styles.leftGroup} />
        <div className={styles.headerActions}>
          <button className={styles.btn} onClick={load}><RefreshCw size={16}/> Atualizar</button>
          <button
            className={styles.btnPrimary}
            onClick={() => window?.dispatchEvent?.(new CustomEvent('openCampaignCreate'))}
          >
            <Plus size={16}/> Nova campanha
          </button>
        </div>
      </div>

      {/* Card da lista */}
      <div className={styles.card}>
        {/* Header do card: radios + busca */}
        <div className={styles.cardHead}>
          <div className={styles.optionsRow} role="radiogroup" aria-label="Filtro de status">
            {FILTERS.map(f => (
              <label key={f.key} className={styles.opt}>
                <input
                  type="radio"
                  name="filter"
                  value={f.key}
                  checked={filter === f.key}
                  onChange={() => setFilter(f.key)}
                />
                <span>{f.label}</span>
              </label>
            ))}
          </div>

          <div className={styles.searchGroup}>
            <input
              className={styles.searchInput}
              placeholder="Buscar por nome…"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              aria-label="Buscar campanhas por nome"
            />
            {query && (
              <button className={styles.searchClear} onClick={() => setQuery('')} aria-label="Limpar busca" type="button">
                <XIcon size={14} />
              </button>
            )}
          </div>
        </div>

        {/* Tabela */}
        <div className={styles.tableWrap}>
          <table className={styles.table}>
            <thead>
              <tr>
                <th style={{minWidth:260}}>Campanha</th>
                <th>Status</th>
                <th>Carregados</th>
                <th>Lidos</th>
                <th>Entregues</th>
                <th>Falhas</th>
                <th>Restantes</th>
                <th>Execução</th>
                <th>Progresso</th>
              </tr>
            </thead>
            <tbody>
              {loading && (
                <tr><td colSpan={9} className={styles.loading}>Carregando…</td></tr>
              )}

              {!loading && filtered.length === 0 && (
                <tr><td colSpan={9} className={styles.empty}>Nenhuma campanha encontrada.</td></tr>
              )}

              {!loading && filtered.map(c => {
                const { processed, total } = calcProcessed(c);
                const pct = total ? Math.round((processed / total) * 100) : 0;
                const stUi = getStatusUi(c);
                const execAt = c.exec_at || c.started_at || c.start_at || c.updated_at; // ← “data de execução”

                return (
                  <tr key={c.id} className={styles.rowHover}>
                    <td data-label="Campanha">
                      <div className={styles.keyTitle}>{c.name || '—'}</div>
                    </td>

                    <td data-label="Status">
                      <span className={`${styles.statusBadge} ${stUi.cls}`}>{stUi.label}</span>
                    </td>

                    <td data-label="Carregados">{c.total_items ?? 0}</td>

                    <td data-label="Lidos">
                      <span className={`${styles.pill} ${styles.pillOk}`}>{c.read_count ?? 0}</span>
                    </td>

                    <td data-label="Entregues">
                      <span className={`${styles.pill} ${styles.pillWarn}`}>{c.delivered_count ?? 0}</span>
                    </td>

                    <td data-label="Falhas">
                      <span className={`${styles.pill} ${styles.pillErr}`}>{c.failed_count ?? 0}</span>
                    </td>

                    <td data-label="Restantes">
                      {Math.max(0, (c.total_items || 0) - (processed || 0))}
                    </td>

                    <td data-label="Execução" className={styles.execCell}>
                      {formatDate(execAt)}
                    </td>

                    <td data-label="Progresso">
                      <div className={styles.progressWrap}>
                        <div className={styles.progressBar} aria-label="Progresso">
                          <span className={styles.progressFill} style={{ width: `${pct}%` }} />
                        </div>
                        <div className={styles.progressInfo}>
                          {processed}/{total || 0}
                        </div>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        {error && <div className={styles.alertErr} role="alert">⚠️ {error}</div>}
        {okMsg && <div className={styles.alertOk} role="status">✅ {okMsg}</div>}
      </div>
    </div>
  );
}
