import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { History as HistoryIcon, RefreshCw, X as XIcon } from 'lucide-react';
import styles from './styles/TicketsHistory.module.css';
import { apiGet } from '../../../../shared/apiClient';

const PAGE_SIZES = [10, 20, 30, 40];

function fmtDateTime(iso) {
  if (!iso) return '—';
  try {
    const d = new Date(iso);
    return d.toLocaleString('pt-BR', {
      day: '2-digit', month: '2-digit', year: '2-digit',
      hour: '2-digit', minute: '2-digit'
    });
  } catch {
    return '—';
  }
}

export default function TicketsHistory() {
  const [items, setItems]           = useState([]);
  const [page, setPage]             = useState(1);
  const [pageSize, setPageSize]     = useState(10);
  const [total, setTotal]           = useState(0);
  const totalPages                  = Math.max(1, Math.ceil(total / pageSize));

  const [q, setQ]                   = useState('');
  const [qDeb, setQDeb]             = useState('');
  const [fromDate, setFromDate]     = useState('');
  const [toDate, setToDate]         = useState('');

  const [loading, setLoading]       = useState(false);
  const [error, setError]           = useState(null);

  // debounce da busca
  useEffect(() => {
    const t = setTimeout(() => setQDeb(q.trim()), 350);
    return () => clearTimeout(t);
  }, [q]);

  const queryString = useMemo(() => {
    const p = new URLSearchParams();
    p.set('page', String(page));
    p.set('page_size', String(pageSize));
    if (qDeb)     p.set('q', qDeb);
    if (fromDate) p.set('from', fromDate);
    if (toDate)   p.set('to', toDate);
    return p.toString();
  }, [page, pageSize, qDeb, fromDate, toDate]);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      // Ajuste a rota se necessário no seu backend.
      const url = `/tickets/history?${queryString}`;
      const resp = await apiGet(url);
      const { data = [], total = 0, page = 1 } = resp || {};
      setItems(Array.isArray(data) ? data : []);
      setTotal(Number(total) || 0);
      setPage(Number(page) || 1);
    } catch (e) {
      console.error(e);
      setError('Falha ao carregar histórico de tickets.');
    } finally {
      setLoading(false);
    }
  }, [queryString]);

  useEffect(() => { load(); }, [load]);

  // helpers de paginação
  const startIdx = total === 0 ? 0 : (page - 1) * pageSize + 1;
  const endIdx   = Math.min(total, page * pageSize);

  return (
    <div className={styles.container}>
      {/* Header da página */}
      <div className={styles.header}>
        <div>
          <h1 className={styles.title}><HistoryIcon size={22}/> Histórico de tickets</h1>
          <p className={styles.subtitle}>
            Listagem de tickets com status fechado.
          </p>
        </div>

        <div className={styles.headerActions}>
          <button className={styles.btn} onClick={load}><RefreshCw size={16}/> Atualizar</button>
        </div>
      </div>

      {/* Card */}
      <div className={styles.card}>
        {/* Filtros (busca movida para baixo) */}
        <div className={styles.cardHead}>
          <div className={styles.filtersLeft}>
            <div className={styles.inputGroupSm}>
              <label className={styles.labelSm}>De</label>
              <input
                type="date"
                className={styles.inputSm}
                value={fromDate}
                onChange={(e) => { setFromDate(e.target.value); setPage(1); }}
              />
            </div>
            <div className={styles.inputGroupSm}>
              <label className={styles.labelSm}>Até</label>
              <input
                type="date"
                className={styles.inputSm}
                value={toDate}
                onChange={(e) => { setToDate(e.target.value); setPage(1); }}
              />
            </div>
          </div>

          <div className={styles.searchGroup}>
            <input
              className={styles.searchInput}
              placeholder="Buscar por número, user_id, fila ou atendente…"
              value={q}
              onChange={(e) => { setQ(e.target.value); setPage(1); }}
            />
            {q && (
              <button className={styles.searchClear} onClick={() => setQ('')} aria-label="Limpar busca">
                <XIcon size={14}/>
              </button>
            )}
          </div>
        </div>

        {/* Tabela */}
        <div className={styles.tableWrap}>
          <table className={styles.table}>
            <thead>
              <tr>
                <th className={styles.colNum}>Número</th>
                <th className={styles.colUser}>User ID</th>
                <th className={styles.colFila}>Fila</th>
                <th className={styles.colAgent}>Atendente</th>
                <th className={styles.colWhen}>Fechado em</th>
              </tr>
            </thead>
            <tbody>
              {loading && (
                <tr><td colSpan={5} className={styles.loading}>Carregando…</td></tr>
              )}

              {!loading && error && (
                <tr><td colSpan={5} className={styles.empty}>{error}</td></tr>
              )}

              {!loading && !error && items.length === 0 && (
                <tr><td colSpan={5} className={styles.empty}>Nenhum ticket encontrado.</td></tr>
              )}

              {!loading && !error && items.map((t) => (
                <tr key={t.id || t.ticket_number} className={styles.rowHover}>
                  <td>{t.ticket_number?.toString().padStart(6, '0') || '—'}</td>
                  <td>{t.user_id || '—'}</td>
                  <td>{t.fila || '—'}</td>
                  <td>{t.assigned_to || '—'}</td>
                  <td>{fmtDateTime(t.closed_at || t.updated_at)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Footer / paginação */}
        <div className={styles.tableFooter}>
          <div className={styles.leftInfo}>
            {`Mostrando ${startIdx}–${endIdx} de ${total}`}
          </div>

          <div className={styles.pager}>
            <select
              className={styles.pageSize}
              value={pageSize}
              onChange={(e) => { setPageSize(Number(e.target.value)); setPage(1); }}
            >
              {PAGE_SIZES.map(n => <option key={n} value={n}>{n} por página</option>)}
            </select>

            <button className={styles.pBtn} onClick={() => setPage(1)} disabled={page <= 1}>« Primeiro</button>
            <button className={styles.pBtn} onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page <= 1}>Anterior</button>
            <span className={styles.pInfo}>Página {page} de {totalPages}</span>
            <button className={styles.pBtn} onClick={() => setPage(p => Math.min(totalPages, p + 1))} disabled={page >= totalPages}>Próxima</button>
            <button className={styles.pBtn} onClick={() => setPage(totalPages)} disabled={page >= totalPages}>Última »</button>
          </div>
        </div>
      </div>
    </div>
  );
}
