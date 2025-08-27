// src/pages/Tickets/TicketsHistory.jsx
import React, { useEffect, useMemo, useState, useCallback } from 'react';
import { Clock4 as HistoryIcon, RefreshCw, Search, Calendar, ChevronLeft, ChevronRight } from 'lucide-react';
import { apiGet } from '../../../shared/apiClient';
import styles from './styles/TicketsHistory.module.css';

const PAGE_SIZES = [10, 20, 30, 40];

function fmtDt(v) {
  if (!v) return '—';
  try {
    return new Date(v).toLocaleString('pt-BR', {
      year: '2-digit', month: '2-digit', day: '2-digit',
      hour: '2-digit', minute: '2-digit'
    });
  } catch { return v; }
}

export default function TicketsHistory() {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(false);

  const [q, setQ]               = useState('');
  const [from, setFrom]         = useState('');
  const [to, setTo]             = useState('');
  const [page, setPage]         = useState(1);
  const [pageSize, setPageSize] = useState(10);

  const [total, setTotal]       = useState(0);
  const totalPages = useMemo(() => Math.max(1, Math.ceil(total / pageSize)), [total, pageSize]);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const qs = new URLSearchParams({
        page: String(page),
        page_size: String(pageSize),
        q: q || '',
        from: from || '',
        to: to || ''
      }).toString();

      const resp = await apiGet(`/tickets/history?${qs}`);
      setItems(Array.isArray(resp?.data) ? resp.data : []);
      setTotal(Number(resp?.total || 0));
    } catch (e) {
      console.error('Falha ao carregar histórico:', e);
      setItems([]); setTotal(0);
    } finally {
      setLoading(false);
    }
  }, [page, pageSize, q, from, to]);

  useEffect(() => { load(); }, [load]);

  // ao mudar page size, volta pra página 1
  function onPageSizeChange(e) {
    setPageSize(Number(e.target.value) || 10);
    setPage(1);
  }

  function clearDates() {
    setFrom(''); setTo(''); setPage(1);
  }

  return (
    <div className={styles.container}>
      {/* Header */}
      <div className={styles.header}>
        <div>
          <h1 className={styles.title}><HistoryIcon size={22}/> Histórico de tickets</h1>
          <p className={styles.subtitle}>Listagem de tickets com status fechado.</p>
        </div>

        <div className={styles.headerActions}>
          <div className={styles.searchGroupTop}>
            <input
              className={styles.searchInput}
              placeholder="Buscar por número, user_id, fila ou atendente…"
              value={q}
              onChange={(e)=>{ setQ(e.target.value); setPage(1); }}
            />
            {q && (
              <button className={styles.searchClear} onClick={()=>{ setQ(''); setPage(1); }} aria-label="Limpar busca">
                <Search size={14}/>
              </button>
            )}
          </div>

          <button className={styles.btn} onClick={load}><RefreshCw size={16}/> Atualizar</button>
        </div>
      </div>

      {/* Card com filtros + tabela */}
      <div className={styles.card}>
        <div className={styles.cardHead}>
          {/* Filtro por data */}
          <div className={styles.dateRow}>
            <div className={styles.dateField}>
              <label className={styles.label}><Calendar size={14}/> De</label>
              <input type="date" className={styles.input} value={from} onChange={(e)=>{ setFrom(e.target.value); setPage(1); }} />
            </div>
            <div className={styles.dateField}>
              <label className={styles.label}><Calendar size={14}/> Até</label>
              <input type="date" className={styles.input} value={to} onChange={(e)=>{ setTo(e.target.value); setPage(1); }} />
            </div>

            {(from || to) && (
              <button className={styles.btn} onClick={clearDates}>Limpar datas</button>
            )}
          </div>

          {/* busca interna (opcional — já temos no topo) */}
          {/* mantive slot vazio para alinhamento */}
          <div style={{minWidth:12}} />
        </div>

        <div className={styles.tableWrap}>
          <table className={styles.table}>
            <thead>
              <tr>
                <th className={styles.colNum}>Número</th>
                <th className={styles.colUser}>User ID</th>
                <th className={styles.colFila}>Fila</th>
                <th className={styles.colAt}>Atendente</th>
                <th className={styles.colDt}>Fechado em</th>
              </tr>
            </thead>
            <tbody>
              {loading && (
                <tr><td colSpan={5} className={styles.loading}>Carregando…</td></tr>
              )}
              {!loading && items.length === 0 && (
                <tr><td colSpan={5} className={styles.empty}>Nenhum ticket encontrado.</td></tr>
              )}
              {!loading && items.map(t => (
                <tr key={t.id} className={styles.rowHover}>
                  <td data-label="Número">{t.ticket_number ?? '—'}</td>
                  <td data-label="User ID" className={styles.mono}>{t.user_id ?? '—'}</td>
                  <td data-label="Fila" className={styles.center}>{t.fila ?? '—'}</td>
                  <td data-label="Atendente" className={styles.center}>{t.assigned_to ?? '—'}</td>
                  <td data-label="Fechado em" className={styles.center}>{fmtDt(t.updated_at || t.created_at)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Footer / Paginação */}
        <div className={styles.tableFooter}>
          <div className={styles.leftInfo}>
            {total > 0
              ? <>Mostrando {(page-1)*pageSize + 1}–{Math.min(page*pageSize, total)} de {total}</>
              : <>Mostrando 0–0 de 0</>}
          </div>

          <div className={styles.pager}>
            <select className={styles.pageSize} value={pageSize} onChange={onPageSizeChange}>
              {PAGE_SIZES.map(s => <option key={s} value={s}>{s} por página</option>)}
            </select>

            <button className={styles.pBtn} onClick={()=>setPage(1)} disabled={page<=1}>« Primeiro</button>
            <button className={styles.pBtn} onClick={()=>setPage(p=>Math.max(1,p-1))} disabled={page<=1}>
              <ChevronLeft size={16}/> Anterior
            </button>

            <span className={styles.pInfo}>Página {page} de {totalPages}</span>

            <button className={styles.pBtn} onClick={()=>setPage(p=>Math.min(totalPages,p+1))} disabled={page>=totalPages}>
              Próxima <ChevronRight size={16}/>
            </button>
            <button className={styles.pBtn} onClick={()=>setPage(totalPages)} disabled={page>=totalPages}>Última »</button>
          </div>
        </div>
      </div>
    </div>
  );
}
