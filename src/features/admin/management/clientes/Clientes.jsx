import React, { useEffect, useMemo, useState, useCallback } from 'react';
import { Users as UsersIcon, ChevronRight, RefreshCw, X as XIcon } from 'lucide-react';
import { apiGet } from '../../../../shared/apiClient';
import { toast } from 'react-toastify';
import styles from './styles/Clientes.module.css';

const CHANNELS = [
  { key: '',          label: 'Todos' },
  { key: 'whatsapp',  label: 'WhatsApp' },
  { key: 'telegram',  label: 'Telegram' },
  { key: 'instagram', label: 'Instagram' },
  { key: 'facebook',  label: 'Facebook' },
];
const PAGE_SIZES = [10, 20, 30, 40];

function labelChannel(c) {
  const m = {
    whatsapp: 'WhatsApp',
    telegram: 'Telegram',
    instagram: 'Instagram',
    facebook: 'Facebook',
  };
  return m[(c || '').toLowerCase()] || '—';
}

export default function Clientes() {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(false);

  const [q, setQ] = useState('');
  const [channel, setChannel] = useState('');
  const [pageSize, setPageSize] = useState(10);
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [openRow, setOpenRow] = useState(null); // user_id aberto

  const load = useCallback(async (opts = {}) => {
    const nextPage     = opts.page ?? page;
    const nextPageSize = opts.pageSize ?? pageSize;
    const nextQ        = opts.q ?? q;

    setLoading(true);
    try {
      const resp = await apiGet('/customers', {
        params: { q: nextQ, page: nextPage, page_size: nextPageSize }
      });

      // API retorna: { data, page, page_size, total, total_pages }
      const data = Array.isArray(resp?.data) ? resp.data : resp?.data ?? [];
      setItems(data);
      setPage(resp?.page || nextPage);
      setPageSize(resp?.page_size || nextPageSize);
      const totalFound = Number(resp?.total || data.length || 0);
      setTotal(totalFound);
      return { data, total: totalFound };
    } catch (e) {
      toast.error('Falha ao carregar clientes.');
      setItems([]);
      setTotal(0);
      return { data: [], total: 0 };
    } finally {
      setLoading(false);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [page, pageSize, q]);

  useEffect(() => { load(); }, []); // primeira carga

  // filtro por canal (client-side, já que a rota não o recebe)
  const visible = useMemo(() => {
    const c = (channel || '').toLowerCase();
    return c ? items.filter(it => String(it.channel || '').toLowerCase() === c) : items;
  }, [items, channel]);

  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  const showingFrom = total === 0 ? 0 : (page - 1) * pageSize + 1;
  const showingTo   = total === 0 ? 0 : Math.min(page * pageSize, total);

  const onSearch = async (e) => {
    e?.preventDefault?.();
    setPage(1);
    const res = await load({ page: 1, q });
    if (res?.total === 0) {
      toast.info('Nenhum cliente encontrado para a busca.');
    }
  };

  const phoneFor = (row) => {
    const ch = String(row?.channel || '').toLowerCase();
    if (ch !== 'whatsapp') return '—';
    const p = (row?.phone || '').trim();
    return p || '—';
  };

  return (
    <div className={styles.container}>
      {/* Header */}
                     <div className={styles.toolbar}>
        <div className={styles.headerActions}>
          <button className={styles.btn} onClick={()=> load()} title="Atualizar">
            <RefreshCw size={16}/> Atualizar
          </button>
        </div>
      </div>

                  <div className={styles.header}>
        <div>
          <p className={styles.subtitle}>Gestão de clientes: veja cadastro, segmento e última atividade.</p>
        </div>
      </div>

      {/* Card */}
      <div className={styles.card}>
        {/* filtros + busca (interno) */}
        <div className={styles.cardHead}>

          <form onSubmit={onSearch} className={styles.searchGroup}>
            <input
              className={styles.searchInput}
              placeholder="Buscar por nome, telefone ou user_id…"
              value={q}
              onChange={(e)=> setQ(e.target.value)}
            />
            {q && (
              <button type="button" className={styles.searchClear} onClick={()=> setQ('')} aria-label="Limpar">
                <XIcon size={14}/>
              </button>
            )}
          </form>
        </div>

        <div className={styles.tableWrap}>
          <table className={styles.table}>
            <colgroup>
              <col className={styles.colNome}/>
              <col className={styles.colCanal}/>
            </colgroup>
            <thead>
              <tr>
                <th>Nome</th>
                <th>Canal</th>
              </tr>
            </thead>
            <tbody>
              {loading && (
                <tr><td colSpan={2} className={styles.loading}>Carregando…</td></tr>
              )}

              {!loading && visible.length === 0 && (
                <tr><td colSpan={2} className={styles.empty}>Nenhum cliente encontrado.</td></tr>
              )}

              {!loading && visible.map((row) => {
                const uid = row.user_id;
                const isOpen = openRow === uid;
                return (
                  <React.Fragment key={uid}>
                    {/* summary row: só Nome + Canal */}
                    <tr
                      className={`${styles.rowHover} ${styles.accRow}`}
                      onClick={() => setOpenRow(isOpen ? null : uid)}
                    >
                      <td className={styles.summaryCell}>
                        <span className={`${styles.chev} ${isOpen ? styles.chevOpen : ''}`}>
                          <ChevronRight size={16}/>
                        </span>
                        <span className={styles.nameText}>{row.name || '—'}</span>
                      </td>
                      <td className={styles.summaryRight}>
                        <span className={styles.chip}>{labelChannel(row.channel)}</span>
                      </td>
                    </tr>

                    {/* details row */}
                    {isOpen && (
                      <tr className={styles.rowDetails}>
                        <td colSpan={2}>
                          <div className={styles.detailsBox}>
                            <div className={styles.detailsGrid}>
                              <div className={styles.item}>
                                <div className={styles.k}>User ID</div>
                                <div className={styles.v}>{row.user_id || '—'}</div>
                              </div>
                              <div className={styles.item}>
                                <div className={styles.k}>Telefone</div>
                                <div className={styles.v}>{phoneFor(row)}</div>
                              </div>
                              <div className={styles.item}>
                                <div className={styles.k}>Canal</div>
                                <div className={styles.v}>{labelChannel(row.channel)}</div>
                              </div>
                              <div className={styles.item}>
                                <div className={styles.k}>Atualizado em</div>
                                <div className={styles.v}>
                                  {row.updated_at ? new Date(row.updated_at).toLocaleString() : '—'}
                                </div>
                              </div>
                              <div className={styles.item}>
                                <div className={styles.k}>Criado em</div>
                                <div className={styles.v}>
                                  {row.created_at ? new Date(row.created_at).toLocaleString() : '—'}
                                </div>
                              </div>
                            </div>
                          </div>
                        </td>
                      </tr>
                    )}
                  </React.Fragment>
                );
              })}
            </tbody>
          </table>
        </div>

        {/* footer paginador */}
        <div className={styles.tableFooter}>
          <div className={styles.leftInfo}>
            Mostrando {showingFrom}–{showingTo} de {total}
          </div>

          <div className={styles.pager}>
            <select
              className={styles.pageSize}
              value={pageSize}
              onChange={async (e) => { 
                const ps = Number(e.target.value);
                setPageSize(ps); setPage(1);
                await load({ page: 1, pageSize: ps });
              }}
            >
              {PAGE_SIZES.map(n => <option key={n} value={n}>{n} por página</option>)}
            </select>

            <button className={styles.pBtn} disabled={page <= 1} onClick={()=> load({ page: 1 })}>« Primeiro</button>
            <button className={styles.pBtn} disabled={page <= 1} onClick={()=> load({ page: page - 1 })}>Anterior</button>
            <span className={styles.pInfo}>Página {page} de {totalPages}</span>
            <button className={styles.pBtn} disabled={page >= totalPages} onClick={()=> load({ page: page + 1 })}>Próxima</button>
            <button className={styles.pBtn} disabled={page >= totalPages} onClick={()=> load({ page: totalPages })}>Última »</button>
          </div>
        </div>
      </div>
    </div>
  );
}
