// File: CustomerJourneyTracker.jsx
import React, { useEffect, useMemo, useState, useCallback } from 'react';
import debounce from 'lodash/debounce';
import { toast, ToastContainer } from 'react-toastify';
import { useConfirm } from '../../../components/ConfirmProvider';
import { apiGet, apiPost } from '../../../shared/apiClient';
import {
  User, MessageCircle, AlertTriangle, CheckCircle, BarChart3, Search,
  Eye, RefreshCw, Headset, RefreshCcw, Plus
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

// normaliza jornada para o formato do frontend
const transformJourneyData = (journeyData) => {
  if (!Array.isArray(journeyData)) return [];
  return journeyData.map(item => ({
    stage: item.stage,
    timestamp: item.entered_at,
    duration: item.duration_sec,
    visits: 1,
    entered_at: item.entered_at,
    duration_sec: item.duration_sec
  }));
};

/* ---------------- componente ---------------- */
export default function CustomerJourneyTracker() {
  const confirm = useConfirm();

  // UI state
  const [searchTerm, setSearchTerm] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const debouncedSet = useCallback(debounce((val) => setDebouncedSearch(val), 450), []);
  useEffect(() => { debouncedSet(searchTerm); }, [searchTerm, debouncedSet]);

  // paginação
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage] = useState(20);

  // data
  const [rows, setRows] = useState([]);
  const [totalRows, setTotalRows] = useState(0);
  const [metrics, setMetrics] = useState({});
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  // auto-refresh (10s) – desativado por padrão
  const [autoRefresh, setAutoRefresh] = useState(false);

  // modal detail
  const [selectedCustomer, setSelectedCustomer] = useState(null);
  const [selectedDetail, setSelectedDetail] = useState(null);
  const [detailLoading, setDetailLoading] = useState(false);

  /* ----- métricas na montagem ----- */
  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        const mtResp = await apiGet('/tracert/metrics').catch(() => null);
        const mtData = mtResp && mtResp.data ? mtResp.data : mtResp;
        if (!mounted) return;
        setMetrics(mtData || {});
      } catch (err) {
        console.error('Erro carregando metrics:', err);
        if (!mounted) return;
        setMetrics({});
      } finally {
        if (mounted) setLoading(false);
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
      const data = resp && resp.data ? resp.data : resp;
      setRows(Array.isArray(data?.rows) ? data.rows : []);
      setTotalRows(Number(data?.total || 0));
    } catch (err) {
      console.error(err);
      toast.error('Falha ao carregar lista do tracert');
      setRows([]);
      setTotalRows(0);
    } finally {
      setRefreshing(false);
    }
  }, [debouncedSearch, currentPage, itemsPerPage]);

  useEffect(() => { fetchList(); }, [fetchList]);

  // auto-refresh opcional (10s)
  useEffect(() => {
    if (!autoRefresh) return;
    const id = setInterval(() => { fetchList(); }, 10000);
    return () => clearInterval(id);
  }, [autoRefresh, fetchList]);

  /* ----- detalhes ----- */
  const openDetails = async (row) => {
    setSelectedCustomer(row);
    setSelectedDetail(null);
    setDetailLoading(true);
    try {
      const resp = await apiGet(`/tracert/customers/${encodeURIComponent(row.user_id)}`);
      const det = resp && resp.data ? resp.data : resp;
      const journey = Array.isArray(det?.journey) ? transformJourneyData(det.journey) : [];
      setSelectedDetail({ ...det, journey });
    } catch (err) {
      console.error('Erro ao buscar detalhe do cliente:', err);
      toast.error('Falha ao carregar detalhe do cliente');
      setSelectedDetail(null);
    } finally {
      setDetailLoading(false);
    }
  };

  /* ----- ações ----- */
  const resetSession = async (userId) => {
    if (!userId) return;
    const ok = await confirm({
      title: 'Resetar sessão?',
      description: 'Força o cliente a voltar ao início do fluxo. Confirma?',
      destructive: true,
      confirmText: 'Resetar',
      cancelText: 'Cancelar'
    });
    if (!ok) return;
    try {
      const resp = await apiPost(`/tracert/customers/${encodeURIComponent(userId)}/reset`, {});
      toast.success('Sessão resetada');
      await fetchList();
      if (selectedCustomer?.user_id === userId) await openDetails(selectedCustomer);
      return resp?.data ?? resp;
    } catch (err) {
      console.error('Erro ao resetar sessão:', err);
      toast.error('Falha ao resetar sessão');
      throw err;
    }
  };

  const createTicket = async (userId, queueName) => {
    if (!userId) return;
    const ok = await confirm({
      title: 'Criar ticket?',
      description: `Deseja criar ticket para ${userId}${queueName ? ' (' + queueName + ')' : ''}?`,
      confirmText: 'Criar Ticket',
      cancelText: 'Cancelar',
      destructive: false
    });
    if (!ok) return;
    try {
      const resp = await apiPost(`/tracert/customers/${encodeURIComponent(userId)}/ticket`, { queue: queueName });
      toast.success('Ticket criado com sucesso');
      await fetchList();
      if (selectedCustomer?.user_id === userId) await openDetails(selectedCustomer);
      return resp?.data ?? resp;
    } catch (err) {
      console.error('Erro ao criar ticket:', err);
      toast.error('Falha ao criar ticket');
      throw err;
    }
  };

  /* ----- KPIs ----- */
  const kpiCards = useMemo(() => {
    const loopers = Number(metrics?.loopers || 0);
    const top = metrics?.topStage || metrics?.top_stage || null;
    const total = Number(metrics?.total || metrics?.total_users || 0);
    const usersInFlow = Array.isArray(metrics?.byStage) ? metrics.byStage.reduce((s, i) => s + (i.users || 0), 0) : 0;
    return [
      { tone: 'orange', value: loopers, label: 'Com loops (>1)', icon: <AlertTriangle size={16}/> },
      { tone: 'blue',   value: top?.users || 0, label: `Top Etapas: ${labelize(top?.block || top?.stage || '—')}`, icon: <BarChart3 size={16}/> },
      { tone: 'amber',  value: usersInFlow, label: 'Usuários no fluxo', icon: <MessageCircle size={16}/> },
      { tone: 'green',  value: total, label: 'Total (base atual)', icon: <CheckCircle size={16}/> },
    ];
  }, [metrics]);

  const totalPages = Math.max(1, Math.ceil(totalRows / itemsPerPage));
  const startIndex = (currentPage - 1) * itemsPerPage;

  /* ----- mini componentes ----- */
  const PriorityPill = ({ loops = 0 }) => {
    const l = Number(loops || 0);
    let klass = styles.st_online; let txt = 'OK';
    if (l >= 3) { klass = styles.st_offline; txt = 'Crítico'; }
    else if (l === 2) { klass = styles.st_pause; txt = 'Atenção'; }
    return <span className={`${styles.stPill} ${klass}`}>{txt}</span>;
  };

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

  const CustomerModal = ({ customer, detail, onClose }) => {
    if (!customer) return null;
    const journey = Array.isArray(detail?.journey) ? detail.journey : [];
    const dwell = detail?.dwell || null;

    // gera a lista com quebras a cada 10 blocos, sem setas (para não bagunçar a contagem)
    const journeyBlocks = journey.map((st, i) => {
      let timelineColorClass = styles.timelineDefault;
      const stageName = String(st.stage || '').toLowerCase();
      if (stageName.includes('human') || stageName.includes('atendimento')) timelineColorClass = styles.timelineHuman;
      else if (stageName.includes('input') || stageName.includes('entrada')) timelineColorClass = styles.timelineInput;
      else if (stageName.includes('condition') || stageName.includes('decisao') || stageName.includes('validacao')) timelineColorClass = styles.timelineCondition;
      else if (stageName.includes('script') || stageName.includes('api') || stageName.includes('webhook')) timelineColorClass = styles.timelineScript;
      else if (stageName.includes('interactive') || stageName.includes('menu') || stageName.includes('opcao')) timelineColorClass = styles.timelineInteractive;

      const block = (
        <div className={`${styles.timelineItem} ${timelineColorClass}`} key={`${st.stage}-${i}`}>
          <div className={styles.timelineTop}>
            <MessageCircle size={16} />
            <span className={styles.timelineTitle}>{labelize(st.stage)}</span>
          </div>
          <div className={styles.timelineMeta}>
            <div>Tempo: {fmtTime(st.duration_sec || st.duration)}</div>
            <div>Visitas: {st.visits ?? 1}x</div>
            <div>Início: {st.entered_at ? new Date(st.entered_at).toLocaleString('pt-BR') : st.timestamp ? new Date(st.timestamp).toLocaleString('pt-BR') : '—'}</div>
          </div>
        </div>
      );

      const withBreak = ((i + 1) % 10 === 0 && i < journey.length - 1)
        ? [block, <span className={styles.timelineBreak} key={`br-${i}`} aria-hidden="true" />]
        : [block];

      return withBreak;
    }).flat();

    return (
      <div className={styles.modalBackdrop}>
        <div className={styles.modalCard}>
          <div className={styles.modalHead}>
            <div>
              <h2 className={styles.modalTitle}>{customer.name || customer.user_id}</h2>
              <p className={styles.modalSub}>ID: {customer.user_id}</p>
            </div>
            <div className={styles.modalActions}>
              <div className={styles.iconGroup}>
                <button
                  className={styles.iconBtn}
                  onClick={() => resetSession(customer.user_id)}
                  title="Reset para início"
                  aria-label="Reset para início"
                >
                  <RefreshCw size={18} />
                </button>
                <button
                  className={styles.iconBtn}
                  onClick={() => createTicket(customer.user_id, 'Recepção')}
                  title="Criar ticket"
                  aria-label="Criar ticket"
                >
                  <Plus size={18} />
                </button>
              </div>
              <button onClick={onClose} className={styles.modalClose} aria-label="Fechar">✕</button>
            </div>
          </div>

          <div className={styles.modalBody}>
            <section>
              <h3 className={styles.sectionTitle}>Jornada do Usuário</h3>

              {/* container com scroll vertical */}
              <div className={styles.timelineScroll}>
                <div className={styles.timeline}>
                  {detailLoading ? (
                    <div className={styles.emptyCell}>Carregando...</div>
                  ) : journeyBlocks.length === 0 ? (
                    <div className={styles.emptyCell}>Sem histórico de etapas.</div>
                  ) : (
                    journeyBlocks
                  )}
                </div>
              </div>
            </section>

            {dwell && (
              <section className={styles.dwellBox}>
                <h4 className={styles.sectionTitle}>Diagnóstico da etapa atual</h4>
                <div className={styles.dgrid}>
                  <Stat label="Etapa" value={labelize(dwell.block || selectedDetail?.current_stage || '')} />
                  <Stat label="Desde" value={dwell.entered_at ? new Date(dwell.entered_at).toLocaleString('pt-BR') : '—'} />
                  <Stat label="Duração" value={fmtTime(dwell.duration_sec)} />
                  <Stat label="Msgs Bot" value={dwell.bot_msgs ?? 0} />
                  <Stat label="Msgs Usuário" value={dwell.user_msgs ?? 0} />
                  <Stat label="Falhas Validação" value={dwell.validation_fails ?? 0} />
                  <Stat label="Maior gap (usuário)" value={fmtTime(dwell.max_user_response_gap_sec ?? 0)} />
                </div>
              </section>
            )}
          </div>
        </div>
      </div>
    );
  };

  /* ---------------- render ---------------- */
  return (
    <div className={styles.container}>
      <ToastContainer position="top-right" autoClose={2500} />

      {/* Header (switch + Refresh) */}
      <div className={styles.header}>
        <div className={styles.headerInfo}>
          <label className={styles.switch} title="Auto-refresh a cada 10s">
            <input
              type="checkbox"
              checked={autoRefresh}
              onChange={() => setAutoRefresh(v => !v)}
            />
            <span className={styles.slider} />
          </label>
          <span className={styles.switchText}>Auto refresh (10s)</span>
        </div>

        <button className={styles.refreshBtn} onClick={() => fetchList()} disabled={refreshing}>
          <RefreshCw size={16} className={refreshing ? styles.spinning : ''} /> Atualizar
        </button>
      </div>

      {/* Filtros */}
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

      {/* KPIs (opcional: mantém estrutura para quando quiser exibir) */}
      <section className={styles.cardGroup}>
        {loading ? (
          <>
            <KpiSkeleton /> <KpiSkeleton /> <KpiSkeleton />
          </>
        ) : (
          kpiCards.map((c, i) => (
            <KpiCard key={i} icon={c.icon} label={c.label} value={c.value} tone={c.tone} />
          ))
        )}
      </section>

      {/* Tabela */}
      <section className={styles.tableCard}>
        <div className={styles.tableHeader}>
          <h2 className={styles.tableTitle}>
            Clientes no Fluxo <span className={styles.kpill}>{totalRows}</span>
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
                    <StageCell label={r.current_stage_label || r.current_stage} type={r.current_stage_type || r.current_stage_type} />
                  </td>

                  <td><span className={styles.mono}>{fmtTime(r.time_in_stage_sec)}</span></td>

                  <td><PriorityPill loops={r.loops_in_stage ?? 0} /></td>

                  <td className={styles.subtle}>
                    {r.stage_entered_at ? new Date(r.stage_entered_at).toLocaleString('pt-BR', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' }) : '—'}
                  </td>

                  <td className={styles.rowActions}>
                    <div className={styles.iconGroup}>
                      <button onClick={() => openDetails(r)} className={styles.iconBtn} title="Ver detalhes" aria-label="Ver detalhes">
                        <Eye size={18} />
                      </button>
                      <button onClick={() => resetSession(r.user_id)} className={styles.iconBtn} title="Resetar sessão" aria-label="Resetar sessão">
                        <RefreshCcw size={18} />
                      </button>
                      <button onClick={() => createTicket(r.user_id, 'Recepção')} className={styles.iconBtn} title="Criar ticket" aria-label="Criar ticket">
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
          <button className={styles.pageBtn} onClick={() => setCurrentPage(p => Math.max(1, p - 1))} disabled={currentPage === 1}>‹ Anterior</button>
          <span className={styles.pageInfo}>Página {currentPage} de {totalPages} • {totalRows} registro(s) — mostrando {totalRows === 0 ? 0 : startIndex + 1}-{Math.min(startIndex + itemsPerPage, totalRows)}</span>
          <button className={styles.pageBtn} onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))} disabled={currentPage === totalPages}>Próxima ›</button>
        </div>
      </section>

      {selectedCustomer && (
        <CustomerModal
          customer={selectedCustomer}
          detail={selectedDetail}
          onClose={() => { setSelectedCustomer(null); setSelectedDetail(null); }}
        />
      )}
    </div>
  );
}

function Stat({ label, value }) {
  return (
    <div className={styles.stat}>
      <div className={styles.statLabel}>{label}</div>
      <div className={styles.statValue}>{value}</div>
    </div>
  );
}

function KpiCard({ icon, label, value, tone = 'blue' }) {
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
