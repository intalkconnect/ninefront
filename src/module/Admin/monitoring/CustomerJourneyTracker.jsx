// File: CustomerJourneyTracker.jsx
import React, { useState, useEffect, useMemo } from 'react';
import { apiGet } from '../../../shared/apiClient';
import {
  Clock, User, MessageCircle, AlertTriangle, CheckCircle, ArrowRight,
  BarChart3, Search, ChevronLeft, ChevronRight, Eye, RefreshCw
} from 'lucide-react';
import styles from './styles/CustomerJourneyTracker.module.css';

/**
 * Página integrada com endpoints:
 * GET  /tracert/stages
 * GET  /tracert/metrics
 * GET  /tracert/customers?q=&stage=&page=&pageSize=
 * GET  /tracert/customers/:userId
 */

// ícones por estágio (adicione conforme precisar)
const stageIcon = {
  default: MessageCircle,
  saudacao_inicial: MessageCircle,
  coleta: MessageCircle,
  identificacao: AlertTriangle,
  busca: BarChart3,
  apresentacao: CheckCircle,
  confirmacao: CheckCircle,
  finalizacao: CheckCircle,
};

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
  // filtros / UI
  const [searchTerm, setSearchTerm] = useState('');
  const [stageFilter, setStageFilter] = useState('all');
  const [stages, setStages] = useState([]);

  // paginação
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage] = useState(20);

  // dados
  const [rows, setRows] = useState([]);
  const [totalRows, setTotalRows] = useState(0);
  const [metrics, setMetrics] = useState({ total: 0, loopers: 0, topStage: null, byStage: [] });
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  // modal detalhe
  const [selectedCustomer, setSelectedCustomer] = useState(null);
  const [selectedDetail, setSelectedDetail] = useState(null);

  // stageConfig dinâmico (nome/ícone)
  const stageConfig = useMemo(() => {
    const cfg = {};
    (stages || []).forEach((k) => {
      const key = String(k || '');
      const Icon = stageIcon[key] || stageIcon.default;
      cfg[key.toLowerCase()] = {
        key,
        name: labelize(key),
        icon: Icon,
        textColor: styles.txtPrimary || '',
        bgColor: styles.bgStage || '',
      };
    });

    // defaults (caso view retorne block ids diferentes)
    if (!cfg.initial_contact) cfg.initial_contact = { name: 'Contato Inicial', icon: MessageCircle, textColor: styles.txtPrimary, bgColor: styles.bgStage };
    if (!cfg.bot_interaction) cfg.bot_interaction = { name: 'Bot', icon: MessageCircle, textColor: styles.txtPrimary, bgColor: styles.bgStage };
    if (!cfg.resolved) cfg.resolved = { name: 'Resolvido', icon: CheckCircle, textColor: styles.txtPrimary, bgColor: styles.bgStage };

    return cfg;
  }, [stages]);

  // carregar estágios + métricas iniciais
  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        const [stResp, mtResp] = await Promise.all([
          apiGet('/tracert/stages'),
          apiGet('/tracert/metrics'),
        ]);

        // apiGet pode retornar { data: ... } ou os dados diretamente
        const stData = (stResp && stResp.data) ? stResp.data : stResp;
        const mtData = (mtResp && mtResp.data) ? mtResp.data : mtResp;

        if (!mounted) return;

        setStages(Array.isArray(stData) ? stData : []);
        setMetrics({
          total: Number(mtData?.total || 0),
          loopers: Number(mtData?.loopers || 0),
          topStage: mtData?.topStage || mtData?.top_stage || null,
          byStage: Array.isArray(mtData?.byStage) ? mtData.byStage : (Array.isArray(mtData?.by_stage) ? mtData.by_stage : []),
        });
      } catch (e) {
        console.error('Erro carregando stages/metrics', e);
        if (!mounted) return;
        setStages([]);
        setMetrics({ total: 0, loopers: 0, topStage: null, byStage: [] });
      } finally {
        if (mounted) setLoading(false);
      }
    })();
    return () => { mounted = false; };
  }, []);

  // fetch list (server-side pagination)
  const fetchList = async (opts = {}) => {
    setRefreshing(true);
    try {
      const params = new URLSearchParams();
      if (searchTerm) params.set('q', searchTerm);
      if (stageFilter && stageFilter !== 'all') params.set('stage', stageFilter);
      params.set('page', String(currentPage));
      params.set('pageSize', String(itemsPerPage));

      const resp = await apiGet(`/tracert/customers?${params.toString()}`);
      const data = (resp && resp.data) ? resp.data : resp;

      setRows(Array.isArray(data?.rows) ? data.rows : []);
      setTotalRows(Number(data?.total || 0));
    } catch (e) {
      console.error('Erro fetching tracert list', e);
      setRows([]);
      setTotalRows(0);
    } finally {
      setRefreshing(false);
    }
  };

  useEffect(() => {
    fetchList();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchTerm, stageFilter, currentPage, itemsPerPage]);

  // KPI cards
  const kpiCards = useMemo(() => {
    return [
      { tone: 'red',    value: metrics.loopers || 0, label: 'Com loops (>1)' },
      { tone: 'orange', value: metrics.topStage?.users || 0, label: `Top Estágio: ${labelize(metrics.topStage?.block || metrics.topStage?.stage || '—')}` },
      { tone: 'yellow', value: (metrics.byStage || []).reduce((s, i) => s + (i.users || 0), 0), label: 'Usuários em fluxo' },
      { tone: 'green',  value: metrics.total || 0, label: 'Total (base atual)' },
    ];
  }, [metrics]);

  const totalPages = Math.max(1, Math.ceil(totalRows / itemsPerPage));
  const startIndex = (currentPage - 1) * itemsPerPage;

  // abrir modal detalhe
  const openDetails = async (row) => {
    setSelectedCustomer(row);
    setSelectedDetail(null);
    try {
      const resp = await apiGet(`/tracert/customers/${encodeURIComponent(row.user_id)}`);
      const det = (resp && resp.data) ? resp.data : resp;
      setSelectedDetail(det || null);
    } catch (e) {
      console.error('Erro fetch detalhe', e);
      setSelectedDetail(null);
    }
  };

  const PriorityPill = ({ loops }) => {
    const l = Number(loops || 0);
    let klass = styles.pillGreen;
    let txt = 'OK';
    if (l >= 3) { klass = styles.pillRed; txt = 'Crítico'; }
    else if (l === 2) { klass = styles.pillYellow; txt = 'Atenção'; }
    return <span className={`${styles.pill} ${klass}`}>{txt}</span>;
  };

  const StageCell = ({ block }) => {
    const key = String(block || '').toLowerCase();
    const cfg = stageConfig[key] || { name: labelize(block || '—'), icon: MessageCircle, textColor: styles.txtPrimary, bgColor: styles.bgStage };
    const Icon = cfg.icon || MessageCircle;
    return (
      <div className={styles.stageCell}>
        <span className={styles.stageIcon}><Icon size={14} /></span>
        <div>
          <div className={styles.stageName}>{cfg.name || labelize(key)}</div>
          <div className={styles.stageSub}>{String(block || '').slice(0, 40)}</div>
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
            <button onClick={onClose} className={styles.modalClose} aria-label="Fechar">✕</button>
          </div>

          <div className={styles.modalBody}>
            <section>
              <h3 className={styles.sectionTitle}>Jornada Completa</h3>
              <div className={styles.timeline}>
                {journey.length === 0 ? (
                  <div className={styles.emptyCell}>Sem histórico de estágios.</div>
                ) : journey.map((st, i) => {
                  const stKey = String(st.stage || '').toLowerCase();
                  const cfg = stageConfig[stKey] || {};
                  const Icon = cfg.icon || MessageCircle;
                  return (
                    <React.Fragment key={`${st.stage}-${i}`}>
                      <div className={`${styles.timelineItem} ${cfg.bgColor || ''}`}>
                        <div className={styles.timelineTop}>
                          <Icon size={16} className={cfg.textColor || ''} />
                          <span className={styles.timelineTitle}>{cfg.name || labelize(st.stage)}</span>
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
      {/* Header */}
      <div className={styles.header}>
        <div className={styles.headerInner}>
          <div className={styles.headerTitle}>
            <h1>Tracert do Bot</h1>
            <span className={styles.headerSub}>Estágio atual, tempo e loops</span>
          </div>

          <div className={styles.actions}>
            <button className={styles.refreshBtn} onClick={() => fetchList()} disabled={refreshing}>
              <RefreshCw size={16} className={refreshing ? styles.spin : ''} />
              Atualizar
            </button>
          </div>
        </div>

        {/* KPIs */}
        <div className={styles.metricsGrid}>
          {kpiCards.map((c, i) => (
            <div key={i} className={`${styles.kpiCard} ${styles['tone_' + c.tone]}`}>
              <div className={styles.kpiValue}>{c.value}</div>
              <div className={styles.kpiLabel}>{c.label}</div>
            </div>
          ))}
        </div>

        {/* filtros */}
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
              <option key={s} value={s}>{labelize(s)}</option>
            ))}
          </select>
        </div>
      </div>

      {/* Conteúdo */}
      <div className={styles.content}>
        <div className={styles.pageBar}>
          <p className={styles.pageInfo}>
            Mostrando {totalRows === 0 ? 0 : startIndex + 1}-{Math.min(startIndex + itemsPerPage, totalRows)} de {totalRows} clientes
          </p>

          <div className={styles.pager}>
            <button
              onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
              disabled={currentPage === 1}
              className={styles.pageBtn}
              title="Página anterior"
              aria-label="Página anterior"
            >
              <ChevronLeft size={16} />
            </button>

            <span className={styles.pageBadge}>{currentPage} / {totalPages}</span>

            <button
              onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
              disabled={currentPage === totalPages}
              className={styles.pageBtn}
              title="Próxima página"
              aria-label="Próxima página"
            >
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
                <tr><td colSpan={6} className={styles.emptyCell}>Sem resultados.</td></tr>
              ) : rows.map((r) => (
                <tr key={r.user_id} className={styles.row}>
                  <td className={styles.clientCell}>
                    <div className={styles.avatar}><User size={14} /></div>
                    <div>
                      <div className={styles.clientName}>{r.name || r.user_id}</div>
                      <div className={styles.clientSub}>{r.user_id}</div>
                    </div>
                  </td>

                  <td><StageCell block={r.current_stage || r.current_stage_label || r.current_stage_id} /></td>

                  <td><span className={styles.mono}>{fmtTime(r.time_in_stage_sec)}</span></td>

                  <td><PriorityPill loops={r.loops_in_stage ?? 0} /></td>

                  <td className={styles.subtle}>
                    {r.stage_entered_at ? new Date(r.stage_entered_at).toLocaleString('pt-BR', {
                      month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit'
                    }) : '—'}
                  </td>

                  <td>
                    <button
                      onClick={() => openDetails(r)}
                      className={styles.linkBtn}
                      title="Ver detalhes"
                    >
                      <Eye size={14} /> Ver
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Modal */}
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
