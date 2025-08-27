// src/pages/clientes/Clientes.jsx
import React, { useEffect, useMemo, useState, useCallback } from 'react';
import { Users as UsersIcon, RefreshCw, X as XIcon, AlertCircle } from 'lucide-react';
import { apiGet } from '../../../../shared/apiClient';
import styles from './styles/Clientes.module.css';

function DetailsModal({ open, onClose, userId }) {
  const [data, setData] = useState(null);
  const [err, setErr] = useState(null);

  const load = useCallback(async () => {
    if (!userId || !open) return;
    try {
      setErr(null);
      const d = await apiGet(`/clientes/${encodeURIComponent(userId)}`);
      setData(d || null);
    } catch (e) {
      console.error(e);
      setErr('Falha ao carregar detalhes.');
    }
  }, [open, userId]);

  useEffect(() => { load(); }, [load]);

  if (!open) return null;

  return (
    <div className={styles.modalOverlay} role="dialog" aria-modal="true" onMouseDown={onClose}>
      <div className={styles.modal} onMouseDown={(e) => e.stopPropagation()}>
        <div className={styles.modalHeader}>
          <h3 className={styles.modalTitle}>Detalhes do cliente</h3>
          <button className={styles.btn} onClick={onClose} aria-label="Fechar">
            <XIcon size={14} />
          </button>
        </div>
        <div className={styles.modalBody}>
          {err && (
            <div className={styles.alertErr} role="alert">
              <span className={styles.alertIcon}><AlertCircle size={16} /></span>
              <span>{err}</span>
            </div>
          )}
          {!err && !data && <div className={styles.loading}>Carregando…</div>}
          {data && (
            <div className={styles.formGrid} style={{ maxWidth: 520 }}>
              <div className={styles.inputGroup}>
                <label className={styles.label}>User ID</label>
                <input className={styles.input} value={data.user_id || ''} disabled />
              </div>
              <div className={styles.inputGroup}>
                <label className={styles.label}>Nome</label>
                <input className={styles.input} value={data.name || ''} disabled />
              </div>
              <div className={styles.inputGroup}>
                <label className={styles.label}>Telefone</label>
                <input className={styles.input} value={data.phone || ''} disabled />
              </div>
              <div className={styles.inputGroup}>
                <label className={styles.label}>Canal</label>
                <input className={styles.input} value={data.channel || ''} disabled />
              </div>
              <div className={styles.inputGroup}>
                <label className={styles.label}>Criado em</label>
                <input className={styles.input} value={data.created_at || ''} disabled />
              </div>
              <div className={styles.inputGroup}>
                <label className={styles.label}>Atualizado em</label>
                <input className={styles.input} value={data.updated_at || ''} disabled />
              </div>
            </div>
          )}
        </div>
        <div className={styles.modalActions}>
          <button className={styles.btn} onClick={onClose}>Fechar</button>
        </div>
      </div>
    </div>
  );
}

export default function Clientes() {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState(null);

  const [q, setQ] = useState('');
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10); // 10,20,30,40
  const [total, setTotal] = useState(0);
  const [totalPages, setTotalPages] = useState(1);

  const [detailsId, setDetailsId] = useState(null);

  const fetchList = useCallback(async () => {
    setLoading(true);
    setErr(null);
    try {
      const qs = new URLSearchParams({
        page: String(page),
        page_size: String(pageSize),
        ...(q.trim() ? { q: q.trim() } : {}),
      }).toString();
      const res = await apiGet(`/clientes?${qs}`);
      setItems(Array.isArray(res?.data) ? res.data : []);
      setTotal(Number(res?.total || 0));
      setTotalPages(Number(res?.total_pages || 1));
    } catch (e) {
      console.error(e);
      setErr('Falha ao carregar clientes.');
    } finally {
      setLoading(false);
    }
  }, [page, pageSize, q]);

  useEffect(() => { fetchList(); }, [fetchList]);

  // para o "Mostrando X–Y de Z"
  const range = useMemo(() => {
    if (total === 0) return { from: 0, to: 0 };
    const from = (page - 1) * pageSize + 1;
    const to = Math.min(page * pageSize, total);
    return { from, to };
  }, [page, pageSize, total]);

  return (
    <div className={styles.container}>
      {/* Header */}
      <div className={styles.header}>
        <div>
          <h1 className={styles.title}><UsersIcon size={22}/> Clientes</h1>
          <p className={styles.subtitle}>Listagem de clientes com paginação.</p>

          {err && (
            <div className={styles.alertErr} role="alert">
              <span className={styles.alertIcon}><AlertCircle size={16} /></span>
              <span>{err}</span>
              <button className={styles.alertClose} onClick={() => setErr(null)} aria-label="Fechar"><XIcon size={14} /></button>
            </div>
          )}
        </div>

        <div className={styles.headerActions}>
          <div className={styles.searchGroup}>
            <input
              className={styles.searchInput}
              placeholder="Buscar por nome, telefone ou user_id…"
              value={q}
              onChange={(e) => { setPage(1); setQ(e.target.value); }}
            />
            {q && (
              <button className={styles.searchClear} onClick={() => { setQ(''); setPage(1); }} aria-label="Limpar busca">
                <XIcon size={14} />
              </button>
            )}
          </div>
          <button className={styles.btn} onClick={fetchList}><RefreshCw size={16}/> Atualizar</button>
        </div>
      </div>

      {/* Card / Lista */}
      <div className={styles.card}>
        <div className={styles.tableWrap}>
          <table className={styles.table}>
            <thead>
              <tr>
                <th>Nome</th>
                <th>User ID</th>
                <th>Telefone</th>
                <th>Canal</th>
              </tr>
            </thead>
            <tbody>
              {loading && (
                <tr><td colSpan={4} className={styles.loading}>Carregando…</td></tr>
              )}

              {!loading && items.length === 0 && (
                <tr><td colSpan={4} className={styles.empty}>Nenhum cliente encontrado.</td></tr>
              )}

              {!loading && items.map((c) => (
                <tr
                  key={c.user_id}
                  className={styles.rowHover}
                  onClick={() => setDetailsId(c.user_id)}
                  style={{ cursor: 'pointer' }}
                  title="Ver detalhes"
                >
                  <td data-label="Nome">{c.name || '—'}</td>
                  <td data-label="User ID">{c.user_id || '—'}</td>
                  <td data-label="Telefone">{c.phone || '—'}</td>
                  <td data-label="Canal">{c.channel ? (String(c.channel).charAt(0).toUpperCase() + String(c.channel).slice(1)) : '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Barra de paginação */}
        <div className={styles.pagerBar}>
          <div className={styles.pagerLeft}>
            <span className={styles.pagerInfo}>
              {total > 0 ? `Mostrando ${range.from}–${range.to} de ${total}` : '—'}
            </span>
          </div>
          <div className={styles.pagerRight}>
            <select
              className={styles.pageSizeSelect}
              value={pageSize}
              onChange={(e) => { setPageSize(Number(e.target.value)); setPage(1); }}
            >
              {[10,20,30,40].map(n => <option key={n} value={n}>{n} por página</option>)}
            </select>
            <div className={styles.pagerBtns}>
              <button className={styles.pagerBtn} onClick={() => setPage(1)} disabled={page <= 1}>&laquo; Primeiro</button>
              <button className={styles.pagerBtn} onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page <= 1}>Anterior</button>
              <span className={styles.pagerInfo}>Página {page} de {totalPages}</span>
              <button className={styles.pagerBtn} onClick={() => setPage(p => Math.min(totalPages, p + 1))} disabled={page >= totalPages}>Próxima</button>
              <button className={styles.pagerBtn} onClick={() => setPage(totalPages)} disabled={page >= totalPages}>Última &raquo;</button>
            </div>
          </div>
        </div>
      </div>

      {/* Modal de detalhes */}
      <DetailsModal
        open={!!detailsId}
        userId={detailsId}
        onClose={() => setDetailsId(null)}
      />
    </div>
  );
}
