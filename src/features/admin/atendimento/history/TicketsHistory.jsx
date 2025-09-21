import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { RefreshCw, X as XIcon } from 'lucide-react';
import styles from './styles/TicketsHistory.module.css';
import { toast } from 'react-toastify';
import { apiGet } from '../../../../shared/apiClient';
import { useNavigate } from 'react-router-dom';

const PAGE_SIZES = [10, 20, 30, 40];

function fmtDateTime(iso) {
  if (!iso) return '—';
  try {
    const d = new Date(iso);
    return d.toLocaleString('pt-BR', {
      day: '2-digit', month: '2-digit', year: '2-digit',
      hour: '2-digit', minute: '2-digit'
    });
  } catch { return '—'; }
}

export default function TicketsHistory() {
  const [items, setItems]   = useState([]);
  const [page, setPage]     = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [total, setTotal]   = useState(0);
  const totalPages          = Math.max(1, Math.ceil(total / pageSize));

  const [q, setQ]           = useState('');
  const [qDeb, setQDeb]     = useState('');
  const [fromDate, setFromDate] = useState('');
  const [toDate, setToDate] = useState('');

  const [loading, setLoading] = useState(false);
  const [error, setError]   = useState(null);
  const navigate = useNavigate();

  // debounce
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
      const resp = await apiGet(`/tickets/history?${queryString}`);
      const { data = [], total = 0, page = 1 } = resp || {};
      setItems(Array.isArray(data) ? data : []);
      setTotal(Number(total) || 0);
      setPage(Number(page) || 1);
    } catch (e) {
      console.error(e);
      toast.error('Falha ao carregar histórico de tickets.');
    } finally {
      setLoading(false);
    }
  }, [queryString]);

  useEffect(() => { load(); }, [load]);

  const startIdx = total === 0 ? 0 : (page - 1) * pageSize + 1;
  const endIdx   = Math.min(total, page * pageSize);

  return (
    <div className={styles.container}>
      <div className={styles.toolbar}>
        <div className={styles.headerActions}>
          <button className={styles.btn} onClick={load}><RefreshCw size={16}/> Atualizar</button>
        </div>
      </div>

      <div className={styles.header}>
        <div>
          <p className={styles.subtitle}>
            Revise interações e responsáveis: filtre por período, ticket, cliente, fila ou atendente.
          </p>
        </div>
      </div>

      <div className={styles.card}>
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
              placeholder="Buscar por número, cliente, fila ou atendente…"
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

        <div className={styles.tableWrap}>
          <table className={styles.table}>
            <thead>
              <tr>
                <th className={styles.colNum}>Ticket</th>
                <th className={styles.colClient}>Cliente</th>
                <th className={styles.colFila}>Fila</th>
                <th className={styles.colAgent}>Atendente</th>
                <th className={styles.colWhen}>Fechado em</th>
              </tr>
            </thead>

            <tbody>
              {loading && (
                <tr><td colSpan={5} className={styles.loading}>Carregando…</td></tr>
              )}

              {!loading && !error && items.length === 0 && (
                <tr><td colSpan={5} className={styles.empty}>Nenhum ticket encontrado.</td></tr>
              )}

              {!loading && !error && items.map((t) => {
                const num = t.ticket_number ? String(t.ticket_number).padStart(5, '0') : '—';
                const client = t.client_name || t.user_name || t.user_id || '—';
                const agent  = t.agent_name  || t.assigned_to || '—';

                return (
                  <tr
                    key={t.id}
                    className={`${styles.rowHover} ${styles.rowClickable}`}
                    role="button"
                    tabIndex={0}
                    onClick={() => navigate(`/management/history/${t.id}`, {
                      state: { returnTo: window.location.pathname + window.location.search }
                    })}
                  >
                    <td className={styles.nowrap}>{num}</td>
                    <td className={styles.truncate}>{client}</td>
                    <td className={styles.truncate}>{t.fila || '—'}</td>
                    <td className={styles.truncate}>{agent}</td>
                    <td className={`${styles.nowrap} ${styles.textRight}`}>
                      {fmtDateTime(t.closed_at || t.updated_at)}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

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
