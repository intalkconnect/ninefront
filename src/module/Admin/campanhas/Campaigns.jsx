import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { RefreshCw, Plus, X as XIcon } from 'lucide-react';
import { apiGet } from '../../../shared/apiClient';
import styles from './styles/Campaigns.module.css';

/** Radios (options) do topo */
const FILTERS = [
  { key: 'all',       label: 'Todos' },
  { key: 'active',    label: 'Ativos' },      // queued/scheduled ou remaining > 0
  { key: 'finished',  label: 'Finalizados' },
  { key: 'failed',    label: 'Falhas' },      // renomeado de “Falhou” -> “Falhas”
];

/** Função pura para calcular processados/total (evita 0/1 indevido) */
function calcProcessed(c) {
  const total = Number(c?.total_items || 0);
  const pc = Number(c?.processed_count);
  if (Number.isFinite(pc) && pc > 0) return { processed: pc, total };

  const rem = Number(c?.remaining);
  if (Number.isFinite(rem) && total > 0) {
    return { processed: Math.max(0, total - rem), total };
  }

  const sum =
    (Number(c?.sent_count) || 0) +
    (Number(c?.delivered_count) || 0) +
    (Number(c?.read_count) || 0) +
    (Number(c?.failed_count) || 0);

  const safeTotal = total || sum;
  return { processed: Math.min(safeTotal, sum), total: safeTotal };
}

export default function Campaigns() {
  const [items, setItems] = useState([]);
  const [filter, setFilter] = useState('all');
  const [query, setQuery] = useState('');
  const [loading, setLoading] = useState(false);
  const [okMsg, setOkMsg] = useState(null);
  const [error, setError] = useState(null);

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

  // filtro client-side
  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return (items || [])
      .filter(c => {
        if (filter === 'finished')  return String(c.status).toLowerCase() === 'finished';
        if (filter === 'failed')    return String(c.status).toLowerCase() === 'failed' || Number(c.failed_count || 0) > 0;
        if (filter === 'active') {
          const st = String(c.status).toLowerCase();
          return st === 'queued' || st === 'scheduled' || (Number(c.remaining || 0) > 0);
        }
        return true;
      })
      .filter(c => {
        if (!q) return true;
        return (
          String(c.name || '').toLowerCase().includes(q) ||
          String(c.template_name || '').toLowerCase().includes(q)
        );
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

      {/* Botões acima do card */}
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
        {/* Header do card: options (radios) + busca */}
        <div className={styles.cardHead}>
          <div className={styles.optionsRow} role="radiogroup" aria-label="Filtro de status">
            {FILTERS.map(f => (
              <label key={f.key} className={styles.opt} role="radio" aria-checked={filter === f.key}>
                <input
                  type="radio"
                  name="filter"
                  value={f.key}
                  checked={filter === f.key}
                  onChange={() => setFilter(f.key)}
                />
                {f.label}
              </label>
            ))}
          </div>

          <div className={styles.searchGroup}>
            <input
              className={styles.searchInput}
              placeholder="Buscar por nome ou modelo…"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              aria-label="Buscar campanhas"
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
                <th style={{minWidth:240}}>Campanha</th>
                <th>Carregados</th>
                <th>Lidos</th>
                <th>Entregues</th>
                <th>Falhas</th>
                <th>Restantes</th>
                <th>Progresso</th>
              </tr>
            </thead>
            <tbody>
              {loading && (
                <tr><td colSpan={7} className={styles.loading}>Carregando…</td></tr>
              )}

              {!loading && filtered.length === 0 && (
                <tr><td colSpan={7} className={styles.empty}>Nenhuma campanha encontrada.</td></tr>
              )}

              {!loading && filtered.map(c => {
                const { processed, total } = calcProcessed(c);
                const pct = total ? Math.round((processed / total) * 100) : 0;

                return (
                  <tr key={c.id} className={styles.rowHover}>
                    <td data-label="Campanha">
                      <div className={styles.keyTitle}>{c.name || '—'}</div>
                      <div className={styles.keySub}>
                        modelo: {c.template_name || '—'} • {new Date(c.updated_at).toLocaleString('pt-BR')}
                      </div>
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
                      {c.remaining ?? Math.max(0, (c.total_items||0) - processed)}
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
