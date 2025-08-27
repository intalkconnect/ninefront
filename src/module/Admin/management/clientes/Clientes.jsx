// src/pages/Clients/Clients.jsx
import React, { useEffect, useMemo, useState, useCallback } from 'react';
import { Users as UsersIcon, RefreshCw, X as XIcon, ChevronDown, ChevronRight } from 'lucide-react';
import { apiGet } from '../../../../shared/apiClient';
import styles from './styles/Clientes.module.css';

const CHANNELS = [
  { key: '',           label: 'Todos' },
  { key: 'whatsapp',   label: 'WhatsApp' },
  { key: 'telegram',   label: 'Telegram' },
  { key: 'instagram',  label: 'Instagram' },
  { key: 'facebook',   label: 'Facebook' },
];

function prettyChannel(c) {
  const map = { whatsapp: 'WhatsApp', telegram: 'Telegram', instagram: 'Instagram', facebook: 'Facebook' };
  return map[(c || '').toLowerCase()] || (c ? String(c) : '—');
}
function phoneForDisplay(channel, phone) {
  return (String(channel).toLowerCase() === 'whatsapp' && phone) ? phone : '—';
}

export default function Clients() {
  // dados vindos do servidor
  const [rows, setRows]       = useState([]);
  const [page, setPage]       = useState(1);
  const [perPage, setPerPage] = useState(10); // 10 | 20 | 30 | 40
  const [total, setTotal]     = useState(0);
  const [totalPages, setTotalPages] = useState(1);

  // ui
  const [q, setQ] = useState('');
  const [chan, setChan] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError]     = useState(null);

  // acordeon (um aberto por vez)
  const [openId, setOpenId] = useState(null);

  const load = useCallback(async (opts = {}) => {
    const nextPage   = Number(opts.page ?? page);
    const nextLimit  = Number(opts.perPage ?? perPage);
    const nextQuery  = String(opts.q ?? q);

    setLoading(true);
    setError(null);
    try {
      const qs = new URLSearchParams({
        page: String(nextPage),
        page_size: String(nextLimit),
        q: nextQuery
      }).toString();

      const res = await apiGet(`/clientes?${qs}`);
      const data = res?.data ?? [];
      setRows(Array.isArray(data) ? data : []);
      setPage(Number(res?.page || nextPage) || 1);
      setPerPage(Number(res?.page_size || nextLimit) || 10);
      setTotal(Number(res?.total || 0));
      setTotalPages(Math.max(1, Number(res?.total_pages || 1)));
      // se a página mudou, fecha o acordeon
      setOpenId(null);
    } catch (e) {
      console.error(e);
      setError('Falha ao carregar clientes.');
      setRows([]);
      setTotal(0);
      setTotalPages(1);
      setOpenId(null);
    } finally {
      setLoading(false);
    }
  }, [page, perPage, q]);

  useEffect(() => { load(); }, []); // primeira carga

  // filtro por canal (client-side; se quiser server-side, passe ?channel= no backend e aplique no load)
  const filtered = useMemo(() => {
    if (!chan) return rows;
    return rows.filter(r => String(r.channel || '').toLowerCase() === chan);
  }, [rows, chan]);

  // paginação
  const gotoFirst = () => load({ page: 1 });
  const gotoPrev  = () => load({ page: Math.max(1, page - 1) });
  const gotoNext  = () => load({ page: Math.min(totalPages, page + 1) });
  const gotoLast  = () => load({ page: totalPages });

  const startIdx = total === 0 ? 0 : (page - 1) * perPage + 1;
  const endIdx   = Math.min(page * perPage, total);

  // render
  return (
    <div className={styles.container}>
      <div className={styles.header}>
        <div>
          <h1 className={styles.title}><UsersIcon size={22}/> Clientes</h1>
          <p className={styles.subtitle}>Listagem de clientes com paginação.</p>

          {error && (
            <div className={styles.alertErr} role="alert">
              <span>⚠️</span>
              <span>{error}</span>
              <button className={styles.alertClose} onClick={() => setError(null)} aria-label="Fechar">
                <XIcon size={14}/>
              </button>
            </div>
          )}
        </div>

        <div className={styles.headerActions}>
          <button className={styles.btn} onClick={() => load()}><RefreshCw size={16}/> Atualizar</button>
        </div>
      </div>

      <div className={styles.card}>
        <div className={styles.cardHead}>
          {/* filtros de canal */}
          <div className={styles.tabs} role="tablist" aria-label="Filtrar por canal">
            {CHANNELS.map(c => (
              <button
                key={c.key || 'all'}
                role="tab"
                aria-selected={chan === c.key}
                className={`${styles.tab} ${chan === c.key ? styles.tabActive : ''}`}
                onClick={() => setChan(c.key)}
                type="button"
              >
                {c.label}
              </button>
            ))}
          </div>

          {/* busca única */}
          <div className={styles.searchGroup}>
            <input
              className={styles.searchInput}
              placeholder="Buscar por nome, telefone ou user_id…"
              value={q}
              onChange={(e) => setQ(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter') load({ page: 1, q: e.currentTarget.value }); }}
            />
            {q && (
              <button
                className={styles.searchClear}
                onClick={() => { setQ(''); load({ page: 1, q: '' }); }}
                aria-label="Limpar busca"
              >
                <XIcon size={14}/>
              </button>
            )}
          </div>
        </div>

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

              {!loading && filtered.length === 0 && (
                <tr><td colSpan={4} className={styles.empty}>Nenhum cliente encontrado.</td></tr>
              )}

              {!loading && filtered.map(c => {
                const isOpen = openId === c.user_id;
                const NomeCell = (
                  <div style={{ display:'flex', alignItems:'center', gap:8 }}>
                    {isOpen ? <ChevronDown size={16}/> : <ChevronRight size={16}/>}
                    <span>{c.name || '—'}</span>
                  </div>
                );
                return (
                  <React.Fragment key={c.user_id}>
                    <tr
                      className={styles.rowHover}
                      onClick={() => setOpenId(isOpen ? null : c.user_id)}
                      style={{ cursor:'pointer' }}
                      title="Clique para ver detalhes"
                    >
                      <td data-label="Nome">{NomeCell}</td>
                      <td data-label="Canal">{prettyChannel(c.channel)}</td>
                    </tr>

                    {isOpen && (
                      <tr>
                        <td colSpan={4} style={{
                          background: '#fafafa',
                          borderBottom: '1px solid var(--qr-border-light)',
                          padding: 0
                        }}>
                          {/* conteúdo do acordeon */}
                          <div style={{
                            padding: '14px 18px',
                            display:'grid',
                            gridTemplateColumns:'repeat(2, minmax(0, 1fr))',
                            gap: '12px'
                          }}>
                            <Detail label="Nome" value={c.name || '—'} />
                            <Detail label="User ID" value={c.user_id || '—'} />
                            <Detail label="Telefone" value={phoneForDisplay(c.channel, c.phone)} />
                            <Detail label="Canal" value={prettyChannel(c.channel)} />
                            <Detail label="Criado em" value={c.created_at ? new Date(c.created_at).toLocaleString() : '—'} />
                            <Detail label="Atualizado em" value={c.updated_at ? new Date(c.updated_at).toLocaleString() : '—'} />
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

        {/* paginação */}
        <div style={{ display:'flex', alignItems:'center', gap:12, padding:'10px 16px' }}>
          <span className={styles.muted}>
            Mostrando {startIdx}–{endIdx} de {total}
          </span>

          <div style={{ marginLeft:'auto', display:'flex', alignItems:'center', gap:8 }}>
            <select
              className={styles.selectInline}
              value={perPage}
              onChange={(e) => load({ page: 1, perPage: Number(e.target.value) })}
            >
              {[10,20,30,40].map(n => <option key={n} value={n}>{n} por página</option>)}
            </select>

            <button className={styles.btn} onClick={gotoFirst} disabled={page <= 1}>« Primeiro</button>
            <button className={styles.btn} onClick={gotoPrev}  disabled={page <= 1}>Anterior</button>
            <span className={styles.muted}>Página {page} de {totalPages}</span>
            <button className={styles.btn} onClick={gotoNext}  disabled={page >= totalPages}>Próxima</button>
            <button className={styles.btn} onClick={gotoLast}  disabled={page >= totalPages}>Última »</button>
          </div>
        </div>
      </div>
    </div>
  );
}

function Detail({ label, value }) {
  return (
    <div>
      <div style={{ fontSize:12, fontWeight:800, color:'var(--qr-text-2)' }}>{label}</div>
      <div>{value}</div>
    </div>
  );
}
