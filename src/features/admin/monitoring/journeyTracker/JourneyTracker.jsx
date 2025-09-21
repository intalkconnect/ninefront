// File: CustomerJourneyTracker.jsx
import React, { useEffect, useMemo, useState, useCallback } from 'react';
import debounce from 'lodash/debounce';
import { toast, ToastContainer } from 'react-toastify';
import { useConfirm } from '../../../../app/provider/ConfirmProvider';
import { apiGet, apiPost } from '../../../../shared/apiClient';
import { useNavigate } from 'react-router-dom';
import {
  User, MessageCircle, AlertTriangle, BarChart3, Search,
  Eye, RefreshCw, RefreshCcw, Plus, Headset
} from 'lucide-react';
import styles from './styles/CustomerJourneyTracker.module.css';
import 'react-toastify/dist/ReactToastify.css';

/* ---------------- helpers ---------------- */
const labelize = (s = '') =>
  String(s || '').replace(/_/g, ' ').replace(/^\w/u, c => c.toUpperCase());

const fmtTime = (sec = 0) => {
  const s = Math.max(0, Math.floor(Number(sec) || 0));
  const m = Math.floor(s / 60);
  const r = s % 60;
  return m > 0 ? `${m}m ${String(r).padStart(2, '0')}s` : `${r}s`;
};

/* ---------------- component ---------------- */
export default function CustomerJourneyTracker({ onOpenJourney }) {
  const confirm = useConfirm();
  const navigate = useNavigate();

  // filtros
  const [searchTerm, setSearchTerm] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const debouncedSet = useCallback(debounce((val) => setDebouncedSearch(val), 450), []);
  useEffect(() => { debouncedSet(searchTerm); }, [searchTerm, debouncedSet]);

  // paginação
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage] = useState(20);

  // dados
  const [rows, setRows] = useState([]);
  const [totalRows, setTotalRows] = useState(0);
  const [metrics, setMetrics] = useState({});
  const [refreshing, setRefreshing] = useState(false);

  // auto-refresh da LISTA (10s) – desligado por padrão
  const [autoRefresh, setAutoRefresh] = useState(false);

  /* ----- métricas (leve) ----- */
  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        const mtResp = await apiGet('/tracert/metrics').catch(() => null);
        const data = mtResp?.data ?? mtResp ?? {};
        if (mounted) setMetrics(data || {});
      } catch {
        if (mounted) setMetrics({});
      }
    })();
    return () => { mounted = false; };
  }, []);

  /* ----- lista ----- */
  const fetchList = useCallback(async () => {
    setRefreshing(true);
    try {
      const params = new URLSearchParams();
      if (debouncedSearch) params.set('q', debouncedSearch);
      params.set('page', String(currentPage));
      params.set('pageSize', String(itemsPerPage));
      const resp = await apiGet(`/tracert/customers?${params.toString()}`);
      const data = resp?.data ?? resp;
      setRows(Array.isArray(data?.rows) ? data.rows : []);
      setTotalRows(Number(data?.total || 0));
    } catch (e) {
      toast.error('Falha ao carregar lista do tracert');
      setRows([]); setTotalRows(0);
    } finally {
      setRefreshing(false);
    }
  }, [debouncedSearch, currentPage, itemsPerPage]);

  useEffect(() => { fetchList(); }, [fetchList]);

  // auto-refresh opcional (10s)
  useEffect(() => {
    if (!autoRefresh) return;
    const id = setInterval(fetchList, 10000);
    return () => clearInterval(id);
  }, [autoRefresh, fetchList]);

  /* ----- ações ----- */
  const resetSession = async (userId) => {
    if (!userId) return;
    const ok = await confirm({
      title: 'Resetar sessão?',
      description: 'Força o cliente a voltar ao início do fluxo. Confirma?',
      destructive: true, confirmText: 'Resetar', cancelText: 'Cancelar'
    });
    if (!ok) return;
    try {
      await apiPost(`/tracert/customers/${encodeURIComponent(userId)}/reset`, {});
      toast.success('Sessão resetada');
      fetchList();
    } catch (e) {

      toast.error('Falha ao resetar sessão');
    }
  };

  const createTicket = async (userId, queueName) => {
    if (!userId) return;
    const ok = await confirm({
      title: 'Criar ticket?',
      description: `Deseja criar ticket para ${userId}${queueName ? ' (' + queueName + ')' : ''}?`,
      destructive: false, confirmText: 'Criar Ticket', cancelText: 'Cancelar'
    });
    if (!ok) return;
    try {
      await apiPost(`/tracert/customers/${encodeURIComponent(userId)}/ticket`, { queue: queueName });
      toast.success('Ticket criado com sucesso');
      fetchList();
    } catch (e) {

      toast.error('Falha ao criar ticket');
    }
  };

  /* ----- KPIs curtos ----- */
  const kpis = useMemo(() => {
    const loopers = Number(metrics?.loopers || 0);
    const top = metrics?.topStage || metrics?.top_stage || null;
    const total = Number(metrics?.total || metrics?.total_users || 0);
    const usersInFlow = Array.isArray(metrics?.byStage)
      ? metrics.byStage.reduce((s, i) => s + (i.users || 0), 0) : 0;
    return [
      { tone: 'orange', icon: <AlertTriangle size={16} />, label: 'Com loops (>1)', value: loopers },
      { tone: 'blue',   icon: <BarChart3 size={16} />,     label: `Top Etapas: ${labelize(top?.block || top?.stage || '—')}`, value: top?.users || 0 },
      { tone: 'green',  icon: <MessageCircle size={16} />, label: 'Usuários no fluxo', value: usersInFlow },
      { tone: 'blue',   icon: <User size={16} />,          label: 'Total (base atual)', value: total },
    ];
  }, [metrics]);

  const totalPages = Math.max(1, Math.ceil(totalRows / itemsPerPage));
  const startIndex = (currentPage - 1) * itemsPerPage;

  /* ----- células auxiliares ----- */
  const StageCell = ({ label, type }) => {
    const key = String(label || '');
    let Icon = MessageCircle;
    let tone = styles.stageDefault;
    if (type === 'human') { Icon = Headset; tone = styles.stageHuman; }
    else if (type === 'interactive') { Icon = MessageCircle; tone = styles.stageInteractive; }
    else if (type === 'script' || type === 'api_call') { Icon = BarChart3; tone = styles.stageScript; }
    else if (type === 'condition') { Icon = AlertTriangle; tone = styles.stageCondition; }
    else if (type === 'input') { Icon = MessageCircle; tone = styles.stageInput; }

    return (
      <div className={`${styles.stageCell} ${tone}`}>
        <span className={styles.stageIcon}><Icon size={14} /></span>
        <div>
          <div className={styles.stageName}>{key || '—'}</div>
          {type && <div className={styles.stageType}>{type}</div>}
        </div>
      </div>
    );
  };

  const PriorityPill = ({ loops = 0 }) => {
    const l = Number(loops || 0);
    let klass = styles.st_online; let txt = 'OK';
    if (l >= 3) { klass = styles.st_offline; txt = 'Crítico'; }
    else if (l === 2) { klass = styles.st_pause; txt = 'Atenção'; }
    return <span className={`${styles.stPill} ${klass}`}>{txt}</span>;
  };

  /* ---------------- render ---------------- */
  return (
    <div className={styles.container}>
      <ToastContainer position="top-right" autoClose={2500} />

      {/* Header */}
<div className={styles.header}>
  <div className={styles.headerInfo}>
    {/* Toggle de auto refresh (10s, inicia OFF) */}
    <label className={styles.switch} title="Auto-refresh a cada 10s">
      <input
        type="checkbox"
        checked={autoRefresh}
        onChange={() => setAutoRefresh(v => !v)}
        aria-label="Ativar auto refresh a cada 10s"
      />
      <span className={styles.slider} />
    </label>
    <span className={styles.switchText}>Auto refresh (10s)</span>
  </div>

  <button className={styles.refreshBtn} onClick={fetchList} disabled={refreshing}>
    <RefreshCw size={16} className={refreshing ? styles.spinning : ''} />
    Atualizar
  </button>
</div>

      {/* KPIs */}
      <section className={styles.cardGroup}>
        {kpis.map((k, i) => (
          <div key={i} className={styles.card}>
            <div className={styles.cardHead}>
              <div className={styles.cardTitle}>
                <span className={styles.cardIcon}>{k.icon}</span>
                <span>{k.label}</span>
              </div>
            </div>
            <div className={styles.cardBody}>
              <div className={`${styles.kpiValue} ${styles[`tone_${k.tone}`]}`}>{k.value}</div>
            </div>
          </div>
        ))}
      </section>

      {/* Filtro */}
      <section className={styles.filters}>
        <div className={styles.filterGroupGrow}>
          <div className={styles.filterTitle}>Buscar</div>
          <div className={styles.searchWrap}>
            <Search size={16} className={styles.searchIcon} />
            <input
              type="text"
              placeholder="Buscar por nome ou user_id..."
              value={searchTerm}
              onChange={(e) => { setSearchTerm(e.target.value); setCurrentPage(1); }}
              className={styles.input}
            />
          </div>
        </div>
      </section>

      {/* Tabela */}
      <section className={styles.tableCard}>
        <div className={styles.tableHeader}>
          <h2 className={styles.tableTitle}>
            Jornadas
          </h2>
        </div>

        <div className={styles.tableScroll}>
          <table className={styles.table}>
            <thead>
              <tr>
                <th>Cliente</th>
                <th>Etapa Atual</th>
                <th>Tempo na Etapa</th>
                <th>Loops</th>
                <th>Última Entrada</th>
                <th>Ações</th>
              </tr>
            </thead>
            <tbody>
              {rows.length === 0 ? (
                <tr><td colSpan={6} className={styles.emptyCell}>{refreshing ? 'Carregando...' : 'Sem resultados.'}</td></tr>
              ) : rows.map((r) => (
                <tr key={r.user_id}>
                  <td>
                    <div className={styles.clientCell}>
                      <div className={styles.avatar}><User size={14} /></div>
                      <div>
                        <div className={styles.clientName}>{r.name || r.user_id}</div>
                        <div className={styles.clientSub}>{r.user_id}</div>
                      </div>
                    </div>
                  </td>

                  <td>
                    <StageCell
                      label={r.current_stage_label || r.current_stage}
                      type={r.current_stage_type || r.current_stage_type}
                    />
                  </td>

                  <td><span className={styles.mono}>{fmtTime(r.time_in_stage_sec)}</span></td>

                  <td><PriorityPill loops={r.loops_in_stage ?? 0} /></td>

                  <td className={styles.subtle}>
                    {r.stage_entered_at
                      ? new Date(r.stage_entered_at).toLocaleString('pt-BR', {
                          month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit'
                        })
                      : '—'}
                  </td>

                  <td className={styles.rowActions}>
                    <div className={styles.iconGroup}>
                      <button
                        className={styles.iconBtn}
                        title="Ver jornada"
                        aria-label="Ver jornada"
                        onClick={() => {
                          if (typeof onOpenJourney === 'function') {
                            onOpenJourney(r);
                          } else {
                            // navegação SPA para a rota registrada no Admin.jsx
                            navigate(`/development/tracker/${encodeURIComponent(r.user_id)}`);
                          }
                        }}
                      >
                        <Eye size={18} />
                      </button>
                      <button
                        className={styles.iconBtn}
                        title="Resetar sessão"
                        aria-label="Resetar sessão"
                        onClick={() => resetSession(r.user_id)}
                      >
                        <RefreshCcw size={18} />
                      </button>
                      <button
                        className={styles.iconBtn}
                        title="Criar ticket"
                        aria-label="Criar ticket"
                        onClick={() => createTicket(r.user_id, 'Recepção')}
                      >
                        <Plus size={18} />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* paginação */}
        <div className={styles.pagination}>
          <button
            className={styles.pageBtn}
            onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
            disabled={currentPage === 1}
          >‹ Anterior</button>
          <span className={styles.pageInfo}>
            Página {currentPage} de {Math.max(1, Math.ceil(totalRows / itemsPerPage))} • {totalRows} registro(s) — mostrando {totalRows === 0 ? 0 : startIndex + 1}-{Math.min(startIndex + itemsPerPage, totalRows)}
          </span>
          <button
            className={styles.pageBtn}
            onClick={() => setCurrentPage(p => Math.min(Math.max(1, Math.ceil(totalRows / itemsPerPage)), p + 1))}
            disabled={currentPage >= Math.max(1, Math.ceil(totalRows / itemsPerPage))}
          >Próxima ›</button>
        </div>
      </section>
    </div>
  );
}
