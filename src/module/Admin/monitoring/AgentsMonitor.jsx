// /app/src/module/Admin/monitoring/AgentsMonitor.jsx
import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { apiGet } from '../../../shared/apiClient';
import {
  User, Clock, Pause, CheckCircle, RefreshCw, Headphones
} from 'lucide-react';
import styles from './styles/AgentsMonitor.module.css';

/* Helpers -------------------------------------------------- */
const PAGE_SIZE = 30;

const labelStatus = (s='') => {
  const v = String(s || '').toLowerCase();
  if (v === 'pause') return 'Pausa';
  if (v === 'online') return 'Online';
  if (v === 'inativo') return 'Inativo';
  if (v === 'offline') return 'Offline';
  return v;
};

const statusToneCls = (s='') => {
  const v = String(s || '').toLowerCase();
  if (v === 'online') return styles.statusLive;   // verde
  if (v === 'pause')  return styles.statusWait;   // amber
  // inativo/offline → cinza
  return styles.statusDone;
};

const formatHM = (mins = 0) => {
  const m = Math.max(0, Math.floor(mins || 0));
  const h = Math.floor(m / 60);
  const r = m % 60;
  return h > 0 ? `${h}h ${r}m` : `${r}m`;
};

const timeSince = (iso) => {
  if (!iso) return '—';
  const t = new Date(iso).getTime();
  if (Number.isNaN(t)) return '—';
  const diffMin = Math.max(0, Math.floor((Date.now() - t) / 60000));
  return formatHM(diffMin);
};

/* Componente ----------------------------------------------- */
export default function AgentsMonitor() {
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [erro, setErro] = useState(null);
  const [currentTime, setCurrentTime] = useState(new Date());

  // filtros
  const [filterStatus, setFilterStatus] = useState('todos'); // todos|online|pause|inativo|offline
  const [q, setQ] = useState('');

  // paginação
  const [page, setPage] = useState(1);

  const fetchAll = useCallback(async () => {
    setRefreshing(true);
    try {
      const r = await apiGet('/agents/realtime');
      // sua rota devolve um array puro; mas se vier {data: [...]}, cobre também
      const list = Array.isArray(r) ? r : (Array.isArray(r?.data) ? r.data : []);
      setRows(list);
      setErro(null);
      setCurrentTime(new Date());
    } catch (e) {
      console.error('[AgentsMonitor] Erro ao buscar /agents/realtime', e);
      setErro('Falha ao atualizar. Tentaremos novamente em 10s.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    let alive = true;
    (async () => { if (!alive) return; await fetchAll(); })();
    const id = setInterval(fetchAll, 10000);
    return () => { alive = false; clearInterval(id); };
  }, [fetchAll]);

  // derivados: filtros + busca
  const filtered = useMemo(() => {
    const term = q.trim().toLowerCase();
    return rows.filter(a => {
      const s = String(a.status || '').toLowerCase();
      if (filterStatus !== 'todos') {
        if (filterStatus === 'offline') {
          if (['online','pause','inativo'].includes(s)) return false;
        } else if (s !== filterStatus) {
          return false;
        }
      }
      if (!term) return true;
      const name = String(a.agente || '').toLowerCase();
      const email = String(a.email || '').toLowerCase();
      return name.includes(term) || email.includes(term);
    });
  }, [rows, filterStatus, q]);

  // reset de página quando filtro/dados mudam
  useEffect(() => { setPage(1); }, [filterStatus, q, rows]);

  // paginação
  const totalItems = filtered.length;
  const totalPages = Math.max(1, Math.ceil(totalItems / PAGE_SIZE));
  const pageSafe = Math.min(page, totalPages);
  const start = (pageSafe - 1) * PAGE_SIZE;
  const end = start + PAGE_SIZE;
  const paged = useMemo(() => filtered.slice(start, end), [filtered, start, end]);

  // KPIs
  const k = useMemo(() => {
    const out = { online: 0, pause: 0, inativo: 0, offline: 0, tickets: 0 };
    for (const a of rows) {
      const s = String(a.status || '').toLowerCase();
      if (s === 'online') out.online++;
      else if (s === 'pause') out.pause++;
      else if (s === 'inativo') out.inativo++;
      else out.offline++;
      out.tickets += Number(a.tickets_abertos || 0);
    }
    return out;
  }, [rows]);

  return (
    <div className={styles.container}>

      {/* Header */}
      <div className={styles.header}>
        <div className={styles.headerInfo}>
          <div className={styles.kpillBlue}>Última atualização: {currentTime.toLocaleTimeString('pt-BR')}</div>
          {erro && <div className="crumbError">{erro}</div>}
        </div>
        <button
          className={styles.refreshBtn}
          onClick={fetchAll}
          disabled={refreshing}
          title="Atualizar agora"
        >
          <RefreshCw size={16} className={refreshing ? styles.spinning : ''} />
          Atualizar
        </button>
      </div>

      <div className={styles.subHeader}>
        <div>
          <p className={styles.subtitle}>Quem está online, em pausa, inativo ou offline — com filas e tickets abertos.</p>
        </div>
      </div>

      {/* KPIs */}
      <section className={styles.cardGroup}>
        {loading ? (
          <>
            <KpiSkeleton/><KpiSkeleton/><KpiSkeleton/>
          </>
        ) : (
          <>
            <KpiCard icon={<CheckCircle/>} label="Online"   value={k.online}  tone="green" />
            <KpiCard icon={<Pause/>}       label="Em Pausa" value={k.pause}   tone="amber" />
            <KpiCard icon={<Clock/>}       label="Inativos" value={k.inativo} tone="orange" />
            <KpiCard icon={<Headphones/>}  label="Tickets Abertos" value={k.tickets} tone="indigo" />
          </>
        )}
      </section>

      {/* Filtros */}
      <section className={styles.filters}>
        <div className={styles.filterGroup}>
          <h4 className={styles.filterTitle}>Status</h4>
          <div className={styles.filterChips}>
            {[
              {v:'todos', t:'Todos'},
              {v:'online', t:'Online'},
              {v:'pause',  t:'Pausa'},
              {v:'inativo',t:'Inativo'},
              {v:'offline',t:'Offline'},
            ].map(x => (
              <button
                key={x.v}
                onClick={() => setFilterStatus(x.v)}
                className={`${styles.chip} ${filterStatus === x.v ? styles.chipActive : ''}`}
              >
                {x.t}
              </button>
            ))}
          </div>
        </div>
        <div className={styles.filterGroup}>
          <h4 className={styles.filterTitle}>Buscar</h4>
          <div className={styles.filterChips} style={{gap:12}}>
            <input
              value={q}
              onChange={e => setQ(e.target.value)}
              placeholder="Nome ou e-mail do agente"
              style={{padding:'8px 12px', borderRadius:12, border:'1px solid #e5e7eb', minWidth:260}}
            />
          </div>
        </div>
      </section>

      {/* Tabela */}
      <section className={styles.tableCard}>
        <div className={styles.tableHeader}>
          <h2 className={styles.tableTitle}>
            Agentes em Tempo Real <span className={styles.kpill}>{totalItems}</span>
          </h2>
        </div>

        <div className={styles.tableScroll}>
          <table className={styles.table}>
            <thead>
              <tr>
                <th>Agente</th>
                <th>E-mail</th>
                <th>Status</th>
                <th>Detalhe</th>
                <th>Filas</th>
                <th>Tickets Abertos</th>
                <th>Último Ping</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                Array.from({ length: 6 }).map((_, i) => (
                  <tr key={`sk-${i}`} className={styles.skelRow}>
                    <td colSpan={7}><div className={styles.skeletonRow}/></td>
                  </tr>
                ))
              ) : paged.length === 0 ? (
                <tr><td colSpan={7} className={styles.emptyCell}>Nenhum agente no filtro atual.</td></tr>
              ) : paged.map((a) => (
                <tr key={a.email}>
                  <td>
                    <div className={styles.clientCell}>
                      <div className={styles.avatar}><User size={14} /></div>
                      <div className={styles.clientName}>{a.agente || '—'}</div>
                    </div>
                  </td>
                  <td className={styles.subtle}>{a.email || '—'}</td>
                  <td>
                    <span className={`${styles.status} ${statusToneCls(a.status)}`}>
                      {labelStatus(a.status)}
                    </span>
                  </td>
                  <td>
                    {/* Se estiver em pausa, mostra motivo e duração; senão, traço */}
                    {String(a.status).toLowerCase() === 'pause' && a.pausa ? (
                      <div>
                        <div className={styles.bold}>
                          {a.pausa.motivo ? a.pausa.motivo : 'Pausa'}
                        </div>
                        <div className={styles.subtle}>
                          {a.pausa.inicio ? `Desde ${new Date(a.pausa.inicio).toLocaleTimeString('pt-BR',{hour:'2-digit', minute:'2-digit'})}` : '—'}
                          {typeof a.pausa.duracao_min === 'number' && (
                            <> • {formatHM(a.pausa.duracao_min)}</>
                          )}
                        </div>
                      </div>
                    ) : '—'}
                  </td>
                  <td>
                    {(a.filas || []).slice(0,3).map((f) => (
                      <span key={f} className={styles.queuePill} style={{marginRight:6}}>{f}</span>
                    ))}
                    {(a.filas || []).length > 3 && (
                      <span className={styles.subtle}>+{(a.filas || []).length - 3}</span>
                    )}
                  </td>
                  <td className={styles.bold}>{a.tickets_abertos || 0}</td>
                  <td className={styles.subtle}>
                    {a.last_seen ? `${timeSince(a.last_seen)} atrás` : '—'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Paginação */}
        <div className={styles.pagination}>
          <button
            className={styles.pageBtn}
            onClick={() => setPage(p => Math.max(1, p - 1))}
            disabled={pageSafe <= 1}
            aria-label="Página anterior"
            title="Página anterior"
          >
            ‹ Anterior
          </button>

          <span className={styles.pageInfo}>
            Página {pageSafe} de {totalPages} • {totalItems} registro(s)
          </span>

          <button
            className={styles.pageBtn}
            onClick={() => setPage(p => Math.min(totalPages, p + 1))}
            disabled={pageSafe >= totalPages}
            aria-label="Próxima página"
            title="Próxima página"
          >
            Próxima ›
          </button>
        </div>
      </section>
    </div>
  );
}

/* Subcomponents (reuso do ClientsMonitor) ------------------ */
function KpiCard({ icon, label, value, tone='blue' }) {
  return (
    <div className={styles.card}>
      <div className={styles.cardHead}>
        <div className={styles.cardTitle}>
          <span className={styles.cardIcon}>{icon}</span>
          <span>{label}</span>
        </div>
      </div>
      <div className={styles.cardBody}>
        <div className={`${styles.kpiValue} ${styles['tone_'+tone]}`}>{value}</div>
      </div>
    </div>
  );
}
function KpiSkeleton() {
  return (
    <div className={styles.card}>
      <div className={styles.cardHead}>
        <div className={styles.cardTitle}>
          <span className={`${styles.skeleton} ${styles.sq16}`} />
          <span className={`${styles.skeleton} ${styles.sq120}`} />
        </div>
      </div>
      <div className={styles.cardBody}>
        <div className={`${styles.skeleton} ${styles.sq48}`} />
      </div>
    </div>
  );
}
