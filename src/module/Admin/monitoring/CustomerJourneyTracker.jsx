// File: CustomerJourneyTracker.jsx
import React, { useEffect, useMemo, useState, useCallback } from 'react';
import debounce from 'lodash/debounce';
import { toast } from 'react-toastify';
import { useConfirm } from '../../../components/ConfirmProvider'; // ajuste o import conforme seu projeto
import { apiGet, apiPost } from '../../../shared/apiClient';
import {
  Clock, User, MessageCircle, AlertTriangle, CheckCircle, ArrowRight,
  BarChart3, Search, ChevronLeft, ChevronRight, Eye, RefreshCw, Headset, Trash2, Plus
} from 'lucide-react';
import styles from './styles/CustomerJourneyTracker.module.css';
import 'react-toastify/dist/ReactToastify.css';

// inicializa Toast (faça isso apenas uma vez em seu app raiz idealmente)
import { ToastContainer } from 'react-toastify';

const labelize = (s = '') =>
  String(s || '').replace(/_/g, ' ').replace(/^\w/u, c => c.toUpperCase());

const fmtTime = (sec = 0) => {
  const s = Math.max(0, Math.floor(Number(sec) || 0));
  const m = Math.floor(s / 60);
  const r = s % 60;
  if (m > 0) return `${m}m ${String(r).padStart(2, '0')}s`;
  return `${r}s`;
};

export default function CustomerJourneyTracker() {
  const confirm = useConfirm();

  // UI state
  const [searchTerm, setSearchTerm] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');

  // pagination
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage] = useState(20);

  // data
  const [rows, setRows] = useState([]);
  const [totalRows, setTotalRows] = useState(0);
  const [metrics, setMetrics] = useState({});
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  // modal detail
  const [selectedCustomer, setSelectedCustomer] = useState(null);
  const [selectedDetail, setSelectedDetail] = useState(null);
  const [detailLoading, setDetailLoading] = useState(false);

  // debounce search input -> setDebouncedSearch
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const debouncedSet = useCallback(debounce((val) => setDebouncedSearch(val), 450), []);

  useEffect(() => {
    debouncedSet(searchTerm);
  }, [searchTerm, debouncedSet]);

  // load metrics on mount
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

  // fetch list (always excludes human sessions)
  const fetchList = useCallback(async () => {
    setRefreshing(true);
    try {
      const params = new URLSearchParams();
      if (debouncedSearch) params.set('q', debouncedSearch);
      // Always exclude human sessions - remove include_human parameter
      params.set('page', String(currentPage));
      params.set('pageSize', String(itemsPerPage));

      const resp = await apiGet(`/tracert/customers?${params.toString()}`);
      const data = resp && resp.data ? resp.data : resp;
      setRows(Array.isArray(data?.rows) ? data.rows : []);
      setTotalRows(Number(data?.total || 0));
    } catch (err) {
      console.error('Erro ao buscar lista de tracert:', err);
      toast.error('Falha ao carregar lista do tracert');
      setRows([]);
      setTotalRows(0);
    } finally {
      setRefreshing(false);
    }
  }, [debouncedSearch, currentPage, itemsPerPage]);

  // auto fetch when filters/page change
  useEffect(() => {
    fetchList();
  }, [fetchList]);

  // open details modal and show only journey after reset
  const openDetails = async (row) => {
    setSelectedCustomer(row);
    setSelectedDetail(null);
    setDetailLoading(true);

    try {
      const resp = await apiGet(`/tracert/customers/${encodeURIComponent(row.user_id)}`);
      const det = resp && resp.data ? resp.data : resp;

      // A jornada já vem filtrada do backend - apenas eventos após o reset
      // Se houve reset, mostra só o que aconteceu depois
      // Se não houve reset, mostra a jornada completa desde o início
      const journey = Array.isArray(det?.journey) ? det.journey : [];

      setSelectedDetail({ ...det, journey });
    } catch (err) {
      console.error('Erro ao buscar detalhe do cliente:', err);
      toast.error('Falha ao carregar detalhe do cliente');
      setSelectedDetail(null);
    } finally {
      setDetailLoading(false);
    }
  };

  // reset session action (calls POST /tracert/customers/:userId/reset)
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
      const resp = await apiPost(`/tracert/customers/${encodeURIComponent(userId)}/reset`);
      const data = resp && resp.data ? resp.data : resp;
      toast.success('Sessão resetada');
      // atualizar lista + reabrir detalhe se estiver aberto
      await fetchList();
      if (selectedCustomer?.user_id === userId) {
        await openDetails(selectedCustomer);
      }
      return data;
    } catch (err) {
      console.error('Erro ao resetar sessão:', err);
      toast.error('Falha ao resetar sessão');
      throw err;
    }
  };

  // create ticket (not transfer)
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
      // ajuste a URL se sua API usar outro caminho; o corpo abaixo é apenas ilustrativo
      const resp = await apiPost(`/tracert/customers/${encodeURIComponent(userId)}/ticket`, { queue: queueName });
      const data = resp && resp.data ? resp.data : resp;
      toast.success('Ticket criado com sucesso');
      // atualizar lista + detalhe
      await fetchList();
      if (selectedCustomer?.user_id === userId) {
        await openDetails(selectedCustomer);
      }
      return data;
    } catch (err) {
      console.error('Erro ao criar ticket:', err);
      toast.error('Falha ao criar ticket');
      throw err;
    }
  };

  // KPI cards computed
  const kpiCards = useMemo(() => {
    const loopers = Number(metrics?.loopers || 0);
    const top = metrics?.topStage || metrics?.top_stage || null;
    const total = Number(metrics?.total || metrics?.total_users || 0);
    const usersInFlow = Array.isArray(metrics?.byStage) ? metrics.byStage.reduce((s, i) => s + (i.users || 0), 0) : 0;
    return [
      { tone: 'red', value: loopers, label: 'Com loops (>1)' },
      { tone: 'orange', value: top?.users || 0, label: `Top Estágio: ${labelize(top?.block || top?.stage || '—')}` },
      { tone: 'yellow', value: usersInFlow, label: 'Usuários em fluxo' },
      { tone: 'green', value: total, label: 'Total (base atual)' },
    ];
  }, [metrics]);

  const totalPages = Math.max(1, Math.ceil(totalRows / itemsPerPage));
  const startIndex = (currentPage - 1) * itemsPerPage;

  // small presentational components
  const PriorityPill = ({ loops = 0 }) => {
    const l = Number(loops || 0);
    let klass = styles.pillGreen;
    let txt = 'OK';
    if (l >= 3) { klass = styles.pillRed; txt = 'Crítico'; }
    else if (l === 2) { klass = styles.pillYellow; txt = 'Atenção'; }
    return <span className={`${styles.pill} ${klass}`}>{txt}</span>;
  };

  const StageCell = ({ label, type }) => {
    const key = String(label || '');
    // choose icon and color by type
    let Icon = MessageCircle;
    let colorClass = styles.stageDefault;
    
    if (type === 'human') {
      Icon = Headset;
      colorClass = styles.stageHuman;
    } else if (type === 'interactive') {
      Icon = MessageCircle;
      colorClass = styles.stageInteractive;
    } else if (type === 'script' || type === 'api_call') {
      Icon = BarChart3;
      colorClass = styles.stageScript;
    } else if (type === 'condition') {
      Icon = AlertTriangle;
      colorClass = styles.stageCondition;
    } else if (type === 'input') {
      Icon = MessageCircle;
      colorClass = styles.stageInput;
    }

    return (
      <div className={`${styles.stageCell} ${colorClass}`}>
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

    return (
      <div className={styles.modalBackdrop}>
        <div className={styles.modalCard}>
          <div className={styles.modalHead}>
            <div>
              <h2 className={styles.modalTitle}>{customer.name || customer.user_id}</h2>
              <p className={styles.modalSub}>ID: {customer.user_id}</p>
            </div>
            <div className={styles.modalActions}>
              <button
                className={styles.actionBtn}
                onClick={() => resetSession(customer.user_id)}
                title="Reset para início"
              >
                <Trash2 size={16} />
                Reset
              </button>

              <button
                className={styles.actionBtn}
                onClick={() => createTicket(customer.user_id, 'Recepção')}
                title="Criar ticket"
              >
                <Plus size={16} />
                Criar Ticket
              </button>

              <button onClick={onClose} className={styles.modalClose} aria-label="Fechar">✕</button>
            </div>
          </div>

          <div className={styles.modalBody}>
            <section>
              <h3 className={styles.sectionTitle}>Jornada (após último reset)</h3>
              <div className={styles.timeline}>
                {detailLoading ? (
                  <div className={styles.emptyCell}>Carregando...</div>
                ) : journey.length === 0 ? (
                  <div className={styles.emptyCell}>Sem histórico de estágios após reset.</div>
                ) : journey.map((st, i) => {
                  // Determine color class based on stage name/type patterns
                  let timelineColorClass = styles.timelineDefault;
                  const stageName = String(st.stage || '').toLowerCase();
                  
                  if (stageName.includes('human') || stageName.includes('atendimento')) {
                    timelineColorClass = styles.timelineHuman;
                  } else if (stageName.includes('input') || stageName.includes('entrada')) {
                    timelineColorClass = styles.timelineInput;
                  } else if (stageName.includes('condition') || stageName.includes('decisao') || stageName.includes('validacao')) {
                    timelineColorClass = styles.timelineCondition;
                  } else if (stageName.includes('script') || stageName.includes('api') || stageName.includes('webhook')) {
                    timelineColorClass = styles.timelineScript;
                  } else if (stageName.includes('interactive') || stageName.includes('menu') || stageName.includes('opcao')) {
                    timelineColorClass = styles.timelineInteractive;
                  }

                  return (
                    <React.Fragment key={`${st.stage}-${i}`}>
                      <div className={`${styles.timelineItem} ${timelineColorClass}`}>
                        <div className={styles.timelineTop}>
                          <MessageCircle size={16} />
                          <span className={styles.timelineTitle}>{labelize(st.stage)}</span>
                        </div>
                        <div className={styles.timelineMeta}>
                          <div>Tempo: {fmtTime(st.duration)}</div>
                          <div>Visitas: {st.visits ?? 1}x</div>
                          <div>Início: {st.timestamp ? new Date(st.timestamp).toLocaleString('pt-BR') : '—'}</div>
                        </div>
                      </div>
                      {i < journey.length - 1 && <ArrowRight className={styles.timelineArrow} size={16} />}
                    </React.Fragment>
                  );
                })}
              </div>
            </section>

            {dwell && (
              <section className={styles.dwellBox}>
                <h4 className={styles.sectionTitle}>Diagnóstico do estágio atual</h4>
                <div className={styles.dgrid}>
                  <Stat label="Estágio" value={labelize(dwell.block || detail?.current_stage || '')} />
                  <Stat label="Desde" value={dwell.entered_at ? new Date(dwell.entered_at).toLocaleString('pt-BR') : '—'} />
                  <Stat label="Duração" value={fmtTime(dwell.duration_sec)} />
                  <Stat label="Msgs Bot" value={dwell.bot_msgs ?? 0} />
                  <Stat label="Msgs Usuário" value={dwell.user_msgs ?? 0} />
                  <Stat label="Falhas Validação" value={dwell.validation_fails ?? 0} />
                  <Stat label="Maior gap (usuário)" value={fmtTime(dwell.max_user_response_gap_sec)} />
                </div>
              </section>
            )}
          </div>
        </div>
      </div>
    );
  };

  return (
    <div className={styles.page}>
      <ToastContainer position="top-right" autoClose={2500} />

      <div className={styles.header}>
        <div className={styles.headerInner}>
          <div className={styles.headerTitle}>
            <h1>Tracert do Bot</h1>
            <span className={styles.headerSub}>Estágio atual, tempo e loops (sessões humanas ocultas)</span>
          </div>

          <div className={styles.actions}>
            <button className={styles.refreshBtn} onClick={() => fetchList()} disabled={refreshing}>
              <RefreshCw size={16} className={refreshing ? styles.spin : ''} /> Atualizar
            </button>
          </div>
        </div>

        <div className={styles.metricsGrid}>
          {kpiCards.map((c, i) => (
            <div key={i} className={`${styles.kpiCard} ${styles['tone_' + c.tone]}`}>
              <div className={styles.kpiValue}>{c.value}</div>
              <div className={styles.kpiLabel}>{c.label}</div>
            </div>
          ))}
        </div>

        <div className={styles.filters}>
          <div className={styles.searchWrap}>
            <Search size={16} className={styles.searchIcon} />
            <input
              type="text"
              placeholder="Buscar por nome ou user_id..."
              value={searchTerm}
              onChange={(e) => { setSearchTerm(e.target.value); setCurrentPage(1); }}
              className={styles.searchInput}
            />
          </div>
        </div>
      </div>

      <div className={styles.content}>
        <div className={styles.pageBar}>
          <p className={styles.pageInfo}>
            Mostrando {totalRows === 0 ? 0 : startIndex + 1}-{Math.min(startIndex + itemsPerPage, totalRows)} de {totalRows} clientes
          </p>

          <div className={styles.pager}>
            <button onClick={() => setCurrentPage(p => Math.max(1, p - 1))} disabled={currentPage === 1} className={styles.pageBtn} title="Página anterior" aria-label="Página anterior">
              <ChevronLeft size={16} />
            </button>

            <span className={styles.pageBadge}>{currentPage} / {totalPages}</span>

            <button onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))} disabled={currentPage === totalPages} className={styles.pageBtn} title="Próxima página" aria-label="Próxima página">
              <ChevronRight size={16} />
            </button>
          </div>
        </div>

        <div className={styles.tableCard}>
          <table className={styles.table}>
            <thead>
              <tr>
                <th>Cliente</th>
                <th>Estágio Atual</th>
                <th>Tempo no Estágio</th>
                <th>Loops</th>
                <th>Última Entrada</th>
                <th>Ações</th>
              </tr>
            </thead>
            <tbody>
              {rows.length === 0 ? (
                <tr><td colSpan={6} className={styles.emptyCell}>{refreshing ? 'Carregando...' : 'Sem resultados.'}</td></tr>
              ) : rows.map((r) => (
                <tr key={r.user_id} className={styles.row}>
                  <td className={styles.clientCell}>
                    <div className={styles.avatar}><User size={14} /></div>
                    <div>
                      <div className={styles.clientName}>{r.name || r.user_id}</div>
                      <div className={styles.clientSub}>{r.user_id}</div>
                    </div>
                  </td>

                  <td>
                    <StageCell label={r.current_stage_label || r.current_stage} type={r.current_stage_type || r.current_stage_type} />
                  </td>

                  <td><span className={styles.mono}>{fmtTime(r.time_in_stage_sec)}</span></td>

                  <td><PriorityPill loops={r.loops_in_stage ?? 0} /></td>

                  <td className={styles.subtle}>
                    {r.stage_entered_at ? new Date(r.stage_entered_at).toLocaleString('pt-BR', {
                      month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit'
                    }) : '—'}
                  </td>

                  <td className={styles.rowActions}>
                    <button onClick={() => openDetails(r)} className={styles.actionBtn} title="Ver detalhes">
                      <Eye size={16} /> Ver
                    </button>
                    <button onClick={() => resetSession(r.user_id)} className={styles.actionBtn} title="Resetar sessão">
                      <Trash2 size={16} /> Reset
                    </button>
                    <button onClick={() => createTicket(r.user_id, 'Recepção')} className={styles.actionBtn} title="Criar ticket">
                      <Plus size={16} /> Ticket
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

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
