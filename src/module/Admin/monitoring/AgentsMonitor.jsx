import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { apiGet } from '../../../shared/apiClient';
import { RefreshCw, User, Clock, Pause, Power } from 'lucide-react';
import styles from './styles/AgentsMonitor.module.css';

/* helpers */
const cap = (s='') => String(s).replace('_',' ').replace(/^\w/u, c => c.toUpperCase());
const fmtRel = (d) => {
  if (!d) return '—';
  const ms = Date.now() - new Date(d).getTime();
  if (ms < 0) return 'agora';
  const m = Math.floor(ms/60000);
  if (m < 1) return 'agora';
  if (m < 60) return `${m}m`;
  const h = Math.floor(m/60), r = m%60;
  return `${h}h ${r}m`;
};
const formatMins = (mins) => {
  const m = Math.max(0, Math.floor(mins || 0));
  const h = Math.floor(m/60), r = m%60;
  return h ? `${h}h ${r}m` : `${r}m`;
};

export default function AgentsMonitor() {
  const [currentTime, setCurrentTime] = useState(new Date());
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [erro, setErro] = useState(null);

  const [agents, setAgents] = useState([]);

  // filtros
  const [statusFilter, setStatusFilter] = useState('todos'); // todos|online|pause|offline|inativo
  const [queueFilter, setQueueFilter]   = useState('todas'); // todas|<nome da fila>
  const [q, setQ] = useState('');

  // paginação
  const PAGE_SIZE = 30;
  const [page, setPage] = useState(1);

  const fetchAll = useCallback(async () => {
    setRefreshing(true);
    try {
      const data = await apiGet('/analytics/agents/realtime');
      const arr = Array.isArray(data) ? data : (Array.isArray(data?.data) ? data.data : []);
      setAgents(arr);
      setErro(null);
      setCurrentTime(new Date());
    } catch (e) {
      console.error(e);
      setErro('Falha ao atualizar. Tentaremos novamente em 10s.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    let mounted = true;
    const run = async () => { if (!mounted) return; await fetchAll(); };
    run();
    const interval = setInterval(run, 10000);
    return () => { mounted = false; clearInterval(interval); };
  }, [fetchAll]);

  // filas únicas (para o filtro)
  const allQueues = useMemo(() => {
    const set = new Set();
    for (const a of agents) (a.filas || []).forEach(f => f && set.add(String(f)));
    return Array.from(set).sort((a,b) => a.localeCompare(b, 'pt-BR'));
  }, [agents]);

  // KPIs
  const kpis = useMemo(() => {
    const online  = agents.filter(a => a.status === 'online').length;
    const pause   = agents.filter(a => a.status === 'pause').length;
    const inactive= agents.filter(a => a.status === 'inativo').length;
    const tickets = agents.reduce((s,a) => s + (Number(a.tickets_abertos)||0), 0);
    return { online, pause, inactive, tickets };
  }, [agents]);

  // aplica filtros
  const filtered = useMemo(() => {
    const t = q.trim().toLowerCase();
    return agents.filter(a => {
      if (statusFilter !== 'todos' && String(a.status) !== statusFilter) return false;
      if (queueFilter !== 'todas') {
        const filas = Array.isArray(a.filas) ? a.filas.map(String) : [];
        if (!filas.includes(queueFilter)) return false;
      }
      if (!t) return true;
      const hay = `${a.agente||''} ${a.email||''}`.toLowerCase();
      return hay.includes(t);
    });
  }, [agents, statusFilter, queueFilter, q]);

  // paginação derivada
  const totalItems = filtered.length;
  const totalPages = Math.max(1, Math.ceil(totalItems / PAGE_SIZE));
  const pageSafe   = Math.min(page, totalPages);
  const start      = (pageSafe - 1) * PAGE_SIZE;
  const end        = start + PAGE_SIZE;
  const paged      = useMemo(() => filtered.slice(start, end), [filtered, start, end]);

  // reset página quando filtros mudam
  useEffect(() => { setPage(1); }, [statusFilter, queueFilter, q, agents]);

  // mapeia status -> classe da pílula
  const statusClass = (s) => {
    switch (String(s)) {
      case 'online':  return styles.stOnline;
      case 'pause':   return styles.stPause;
      case 'offline': return styles.stOffline;
      case 'inativo': return styles.stInactive;
      default:        return styles.stOffline;
    }
  };

  return (
    <div className={styles.container}>
      {/* Header */}
      <div className={styles.header}>
        <div className={styles.headerInfo}>
          <div className={styles.kpillBlue}>
            Última atualização: {currentTime.toLocaleTimeString('pt-BR')}
          </div>
          {erro && <div className={styles.kpill}>{erro}</div>}
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
        <p className={styles.subtitle}>
          Quem está online, em pausa, inativo ou offline — com filas e tickets abertos.
        </p>
      </div>

      {/* KPIs */}
      <section className={styles.cardGroup}>
        {loading ? (
          <>
            <KpiSkeleton /><KpiSkeleton /><KpiSkeleton /><KpiSkeleton />
          </>
        ) : (
          <>
            <KpiCard icon={<User />}  label="Online"         value={kpis.online}   tone="green" />
            <KpiCard icon={<Pause />} label="Em Pausa"       value={kpis.pause}    tone="amber" />
            <KpiCard icon={<Clock />} label="Inativos"       value={kpis.inactive} tone="orange" />
            <KpiCard icon={<Power />} label="Tickets Abertos" value={kpis.tickets} tone="blue" />
          </>
        )}
      </section>

      {/* Filtros */}
      <section className={styles.filters}>
        <div className={styles.filterGroup}>
          <h4 className={styles.filterTitle}>Status</h4>
          <div className={styles.filterChips}>
            {['todos','online','pause','inativo','offline'].map(s => (
              <button
                key={s}
                onClick={() => setStatusFilter(s)}
                className={`${styles.chip} ${statusFilter===s ? styles.chipActive : ''}`}
              >
                {cap(s)}
              </button>
            ))}
          </div>
        </div>

        <div className={styles.filterGroup}>
          <h4 className={styles.filterTitle}>Filtrar por Fila</h4>
          <select
            value={queueFilter}
            onChange={e => setQueueFilter(e.target.value)}
            className={styles.inputSearch}
            style={{ minWidth: 220 }}
          >
            <option value="todas">Todas as filas</option>
            {allQueues.map(f => (
              <option key={f} value={f}>{f}</option>
            ))}
          </select>
        </div>

        <div className={styles.filterGroup}>
          <h4 className={styles.filterTitle}>Buscar</h4>
          <input
            className={styles.inputSearch}
            placeholder="Nome ou e-mail do agente"
            value={q}
            onChange={e => setQ(e.target.value)}
          />
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
                Array.from({length:6}).map((_,i)=>(
                  <tr key={`sk-${i}`} className={styles.skelRow}>
                    <td colSpan={7}><div className={styles.skeletonRow} /></td>
                  </tr>
                ))
              ) : paged.length === 0 ? (
                <tr>
                  <td colSpan={7} className={styles.emptyCell}>Nenhum agente no filtro atual.</td>
                </tr>
              ) : (
                paged.map((a, idx) => (
                  <tr key={`${a.email}-${idx}`}>
                    <td>
                      <div className={styles.clientCell}>
                        <div className={styles.avatar}><User size={14}/></div>
                        <div className={styles.clientName}>{a.agente || '—'}</div>
                      </div>
                    </td>
                    <td>{a.email || '—'}</td>
                    <td>
                      <span className={`${styles.status} ${statusClass(a.status)}`}>
                        {cap(a.status || '—')}
                      </span>
                    </td>
                    <td>
                      {a.status === 'pause' && a.pausa
                        ? <>
                            <div className={styles.bold}>{a.pausa.motivo || 'Pausa'}</div>
                            <div className={styles.subtle}>Há {formatMins(a.pausa.duracao_min)}</div>
                          </>
                        : <span className={styles.subtle}>—</span>}
                    </td>
                    <td>
                      {(a.filas || []).length === 0
                        ? <span className={styles.subtle}>—</span>
                        : (a.filas || []).map(f => (
                            <span key={f} className={styles.queuePill} style={{marginRight:6}}>{f}</span>
                          ))}
                    </td>
                    <td>{Number(a.tickets_abertos) || 0}</td>
                    <th>Última atividade</th>
…
<td title={a.last_seen ? new Date(a.last_seen).toLocaleString('pt-BR') : ''}>
  {fmtRel(a.last_seen)}
</td>

                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Paginação */}
        <div className={styles.pagination}>
          <button
            className={styles.pageBtn}
            onClick={() => setPage(p => Math.max(1, p - 1))}
            disabled={pageSafe <= 1}
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
          >
            Próxima ›
          </button>
        </div>
      </section>
    </div>
  );
}

/* Subcomponents */
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
        <div className={`${styles.kpiValue} ${styles[`tone_${tone}`]}`}>{value}</div>
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
