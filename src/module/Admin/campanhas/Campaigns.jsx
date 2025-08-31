import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { RefreshCw, Plus, X as XIcon } from 'lucide-react';
import { apiGet } from '../../../shared/apiClient';
import styles from './styles/Campaigns.module.css';

/** Radios (options) do topo */
const FILTERS = [
  { key: 'all',       label: 'Todos' },
  { key: 'active',    label: 'Ativos' },     // queued/scheduled ou remaining > 0
  { key: 'finished',  label: 'Finalizados' },
  { key: 'failed',    label: 'Falhou' },
];

function StatusChip({ status }) {
  const s = String(status || '').toLowerCase();
  const map = {
    queued:     { txt: 'Imediata',  cls: styles.stQueued },
    scheduled:  { txt: 'Agendada',  cls: styles.stScheduled },
    processing: { txt: 'Processando', cls: styles.stProcessing },
    finished:   { txt: 'Concluída', cls: styles.stFinished },
    failed:     { txt: 'Falhou',    cls: styles.stFailed },
  };
  const it = map[s] || { txt: status || '—', cls: styles.stQueued };
  return <span className={`${styles.statusChip} ${it.cls}`}>{it.txt}</span>;
}

/** Cálculo robusto do processamento (evita 0/1 quando já há lidos/entregues) */
function useProcessed(c) {
  return useMemo(() => {
    const total = Number(c?.total_items || 0);
    const pc = Number(c?.processed_count);
    if (Number.isFinite(pc) && pc > 0) return { processed: pc, total };
    // fallback por remaining
    const rem = Number(c?.remaining);
    if (Number.isFinite(rem) && total > 0) {
      return { processed: Math.max(0, total - rem), total };
    }
    // fallback por soma de contadores
    const sum = (Number(c?.sent_count)||0) + (Number(c?.delivered_count)||0) + (Number(c?.read_count)||0) + (Number(c?.failed_count)||0);
    const safeTotal = total || sum;
    return { processed: Math.min(safeTotal, sum), total: safeTotal };
  }, [c]);
}

export default function Campaigns() {
  const [items, setItems] = useState([]);
  const [filter, setFilter] = useState('all');
  const [query, setQuery] = useState('');
  const [loading, setLoading] = useState(false);
  const [okMsg, setOkMsg] = useState(null);
  const [error, setError] = useState(null);

  const toastOK = useCallback((msg) => {
    setOkMsg(msg); setTimeout(() => setOkMsg(null), 2200);
  }, []);

  const load = useCallback(async () => {
    setLoading(true); setError(null);
    try {
      // GET agregado (o seu endpoint que retorna total_items, counts, etc.)
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

  // filtro client-side simples
  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return (items || [])
      .filter(c => {
        if (filter === 'finished')  return String(c.status).toLowerCase() === 'finished';
        if (filter === 'failed')    return String(c.status).toLowerCase() === 'failed';
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
      {/* Cabeçalho */}
      <div className={styles.header}>
        <div>
          <h1 className={styles.title}>Campanhas</h1>
          <p className={styles.subtitle}>Envie imediatamente ou agende. Acompanhe progresso e resultados.</p>
        </div>
      </div>

      {/* Barra com botões acima do card */}
      <div className={styles.toolbar}>
        <div className={styles.leftGroup}>
          {/* Aqui você pode manter um seletor de modelo, se desejar */}
        </div>
        <div className={styles.headerActions}>
          <button className={styles.btn} onClick={load}><RefreshCw size={16}/> Atualizar</button>
          <button className={styles.btnPrimary} onClick={() => window?.dispatchEvent?.(new CustomEvent('openCampaignCreate'))}>
            <Plus size={16}/> Nova campanha
          </button>
        </div>
      </div>

      {/* Card da lista */}
      <div className={styles.card}>
        {/* Header do card: options + busca */}
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
                <th>Status</th>
                <th>Lidos</th>
                <th>Entregues</th>
                <th>Falhas</th>
                <th>Restantes</th>
                <th>Progresso</th>
              </tr>
            </thead>
            <tbody>
              {loading && (
                <tr><td colSpan={8} className={styles.loading}>Carregando…</td></tr>
              )}

              {!loading && filtered.length === 0 && (
                <tr><td colSpan={8} className={styles.empty}>Nenhuma campanha encontrada.</td></tr>
              )}

              {!loading && filtered.map(c => {
                const { processed, total } = useProcessed(c);
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

                    <td data-label="Status">
                      <StatusChip status={c.status} />
                    </td>

                    <td data-label="Lidos">
                      <span className={`${styles.pill} ${styles.pillOk}`}>{c.read_count ?? 0}</span>
                    </td>

                    <td data-label="Entregues">
                      <span className={`${styles.pill} ${styles.pillWarn}`}>{c.delivered_count ?? 0}</span>
                    </td>

                    <td data-label="Falhas">
                      <span className={`${styles.pill} ${styles.pillErr}`}>{c.failed_count ?? 0}</span>
                    </td>

                    <td data-label="Restantes">{c.remaining ?? Math.max(0, (c.total_items||0) - processed)}</td>

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

        {/* feedbacks */}
        {error && (
          <div className={styles.alertErr} role="alert">
            <span>⚠️ {error}</span>
          </div>
        )}
        {okMsg && (
          <div className={styles.alertOk} role="status">
            <span>✅ {okMsg}</span>
          </div>
        )}
      </div>
    </div>
  );
}
