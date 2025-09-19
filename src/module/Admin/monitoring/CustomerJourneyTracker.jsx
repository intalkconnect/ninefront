// File: CustomerJourneyTracker.jsx
import React, { useEffect, useMemo, useState, useCallback } from 'react';
import debounce from 'lodash/debounce';
import { toast } from 'react-toastify';
import { useConfirm } from '../../../components/ConfirmProvider'; // ajuste o import conforme seu projeto
import { apiGet, apiPost } from '../../../shared/apiClient';
import {
  Clock, User, MessageCircle, AlertTriangle, CheckCircle, ArrowRight,
  BarChart3, Search, ChevronLeft, ChevronRight, Eye, RefreshCw, Headset, Trash2
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
  const [stageFilter, setStageFilter] = useState('all');
  const [excludeHuman, setExcludeHuman] = useState(true);
  const [stages, setStages] = useState([]);

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

  // load stages + metrics on mount
  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        const [stResp, mtResp] = await Promise.all([
          apiGet('/tracert/stages').catch(() => null),
          apiGet('/tracert/metrics').catch(() => null),
        ]);

        const stData = stResp && stResp.data ? stResp.data : stResp;
        const mtData = mtResp && mtResp.data ? mtResp.data : mtResp;

        if (!mounted) return;

        // stages endpoint might return: ["label1","label2"] or [{label,type},...]
        if (Array.isArray(stData)) {
          setStages(stData.map(s => (typeof s === 'string' ? { label: s } : s)));
        } else {
          setStages([]);
        }

        setMetrics(mtData || {});
      } catch (err) {
        console.error('Erro carregando stages/metrics:', err);
        if (!mounted) return;
        setStages([]);
        setMetrics({});
      } finally {
        if (mounted) setLoading(false);
      }
    })();
    return () => { mounted = false; };
  }, []);

  // fetch list
  const fetchList = useCallback(async () => {
    setRefreshing(true);
    try {
      const params = new URLSearchParams();
      if (debouncedSearch) params.set('q', debouncedSearch);
      if (stageFilter && stageFilter !== 'all') params.set('stage', stageFilter);
      if (excludeHuman) params.set('exclude_human', 'true');
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
  }, [debouncedSearch, stageFilter, excludeHuman, currentPage, itemsPerPage]);

  // auto fetch when filters/page change
  useEffect(() => {
    fetchList();
  }, [fetchList]);

  // open details modal and trim journey by last_reset_at
  const openDetails = async (row) => {
    setSelectedCustomer(row);
    setSelectedDetail(null);
    setDetailLoading(true);

    try {
      const resp = await apiGet(`/tracert/customers/${encodeURIComponent(row.user_id)}`);
      const det = resp && resp.data ? resp.data : resp;

      // normalize journey
      let journey = Array.isArray(det?.journey) ? det.journey : [];

      // if last_reset_at present, trim all events before that timestamp
      if (det?.last_reset_at) {
        const resetTs = new Date(det.last_reset_at).getTime();
        journey = journey.filter(j => {
          const t = j?.timestamp ? new Date(j.timestamp).getTime() : 0;
          return t >= resetTs;
        });

        // insert a RESET node at top so user sees reset happened
        journey.unshift({
          stage: 'RESET TO START',
          timestamp: det.last_reset_at,
          duration: 0,
          visits: 1,
        });
      }

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

  // transfer to human / create ticket
  const transferToHuman = async (userId, queueName) => {
    if (!userId) return;
    const ok = await confirm({
      title: 'Transferir para humano?',
      description: `Deseja abrir ticket e transferir ${userId} para atendimento humano${queueName ? ' (' + queueName + ')' : ''}?`,
      confirmText: 'Transferir',
      cancelText: 'Cancelar',
      destructive: false
    });
    if (!ok) return;

    try {
      // ajuste a URL se sua API usar outro caminho; o corpo abaixo é apenas ilustrativo
      const resp = await apiPost(`/tracert/customers/${encodeURIComponent(userId)}/transfer`, { queue: queueName });
      const data = resp && resp.data ? resp.data : resp;
      toast.success('Ticket criado e transferido para humano');
      // atualizar lista + detalhe
      await fetchList();
      if (selectedCustomer?.user_id === userId) {
        await openDetails(selectedCustomer);
      }
      return data;
    } catch (err) {
      console.error('Erro ao transferir para humano:', err);
      toast.error('Falha ao transferir para humano');
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
    // choose icon by type
    let Icon = MessageCircle;
    if (type === 'human') Icon = Headset;
    else if (type === 'interactive') Icon = MessageCircle;
    else if (type === 'script' || type === 'api_call') Icon = BarChart3;
    else Icon = MessageCircle;

    return (
      <div className={styles.stageCell}>
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
            <div>
              <button
                className={styles.resetBtn}
                onClick={() => resetSession(customer.user_id)}
                title="Reset para início"
              >
                <Trash2 size={14} /> Reset
              </button>

              <button
                className={styles.resetBtn}
                onClick={() => transferToHuman(customer.user_id, 'Recepção')}
                title="Criar ticket / Transferir para humano"
                style={{ marginLeft: 8 }}
              >
                <Headset size={14} /> To Human
              </button>

              <button onClick={onClose} className={styles.modalClose} aria-label="Fechar">✕</button>
            </div>
          </div>

          <div className={styles.modalBody}>
            <section>
              <h3 className={styles.sectionTitle}>Jornada Completa</h3>
              <div className={styles.timeline}>
                {detailLoading ? (
                  <div className={styles.emptyCell}>Carregando...</div>
                ) : journey.length === 0 ? (
                  <div className={styles.emptyCell}>Sem histórico de estágios.</div>
                ) : journey.map((st, i) => (
                  <React.Fragment key={`${st.stage}-${i}`}>
                    <div className={styles.timelineItem}>
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
                ))}
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
            <span className={styles.headerSub}>Estágio atual, tempo e loops</span>
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

          <select
            value={stageFilter}
            onChange={(e) => { setStageFilter(e.target.value); setCurrentPage(1); }}
            className={styles.select}
          >
            <option value="all">Todos os Estágios</option>
            {stages.map((s) => (
              <option key={s.label || s} value={s.label || s}>{labelize(s.label || s)}</option>
            ))}
          </select>

          <label className={styles.checkboxLabel}>
            <input
              type="checkbox"
              checked={excludeHuman}
              onChange={(e) => { setExcludeHuman(!!e.target.checked); setCurrentPage(1); }}
            />
            Ocultar sessões humanas
          </label>
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
                    <button onClick={() => openDetails(r)} className={styles.linkBtn} title="Ver detalhes"><Eye size={14} /> Ver</button>
                    <button onClick={() => resetSession(r.user_id)} className={styles.resetSmall} title="Resetar sessão"><Trash2 size={14} /></button>
                    <button onClick={() => transferToHuman(r.user_id, 'Recepção')} className={styles.transferSmall} title="Transferir para humano"> <Headset size={14} /> </button>
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
