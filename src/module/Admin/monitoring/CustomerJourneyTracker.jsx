import React, { useState, useEffect, useMemo } from 'react';
import { apiGet } from '../../../shared/apiClient';
import {
  Clock, User, MessageCircle, AlertTriangle, CheckCircle, ArrowRight,
  BarChart3, Search, ChevronLeft, ChevronRight, Eye, RefreshCw
} from 'lucide-react';
import styles from './styles/CustomerJourneyTracker.module.css';

/**
 * Página no mesmo modelo do seu exemplo (header, cards, filtros, tabela, modal),
 * mas integrando com os endpoints do tracert (rota SEM /bot):
 *
 *  GET /tracert/stages                  -> ["saudacao_inicial", "coleta", ...]
 *  GET /tracert/metrics                 -> { total, loopers, topStage:{block,users,p95_sec}, byStage:[{block,users}] }
 *  GET /tracert/customers?q=&stage=&page=&pageSize= -> { total, rows:[{ user_id,name,channel,current_stage,stage_entered_at,time_in_stage_sec,loops_in_stage }] }
 *  GET /tracert/customers/:userId       -> { user_id,name,journey:[{stage,timestamp,duration,visits}], dwell:{...} }
 */

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
  String(s).replace(/_/g, ' ')
    .replace(/^\w/u, c => c.toUpperCase());

const fmtTime = (sec = 0) => {
  const s = Math.max(0, Number(sec) | 0);
  const m = Math.floor(s / 60);
  const r = s % 60;
  return m > 0 ? `${m}min` : `${r}s`;
};

export default function CustomerJourneyTracker() {
  // filtros/estado geral
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

  // modal
  const [selectedCustomer, setSelectedCustomer] = useState(null);
  const [selectedDetail, setSelectedDetail] = useState(null);

  // stageConfig dinâmico para nome/cor/ícone
  const stageConfig = useMemo(() => {
    const make = (key) => {
      const Icon = stageIcon[key] || stageIcon.default;
      return {
        name: labelize(key),
        icon: Icon,
        textColor: styles.txtPrimary,
        bgColor: styles.bgStage,
      };
    };
    const cfg = {};
    (stages || []).forEach((k) => { cfg[k] = make(k); });
    // fallback comuns
    if (!cfg.initial_contact) cfg.initial_contact = { ...make('saudacao_inicial'), name: 'Contato Inicial' };
    if (!cfg.bot_interaction) cfg.bot_interaction = { ...make('coleta'), name: 'Bot' };
    if (!cfg.resolved) cfg.resolved = { ...make('finalizacao'), name: 'Resolvido' };
    return cfg;
  }, [stages]);

  // carregar estágios + métricas
  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        const [st, mt] = await Promise.all([
          apiGet('/tracert/stages'),
          apiGet('/tracert/metrics'),
        ]);
        if (!mounted) return;
        setStages(Array.isArray(st?.data) ? st.data : (Array.isArray(st) ? st : []));
        const m = mt?.data ?? mt ?? {};
        setMetrics({
          total: Number(m.total || 0),
          loopers: Number(m.loopers || 0),
          topStage: m.topStage || null,
          byStage: Array.isArray(m.byStage) ? m.byStage : [],
        });
      } catch (e) {
        // silencioso
      } finally {
        if (mounted) setLoading(false);
      }
    })();
    return () => { mounted = false; };
  }, []);

  // carregar lista (server-side pagination)
  const fetchList = async () => {
    setRefreshing(true);
    try {
      const params = new URLSearchParams();
      if (searchTerm) params.set('q', searchTerm);
      if (stageFilter !== 'all') params.set('stage', stageFilter);
      params.set('page', String(currentPage));
      params.set('pageSize', String(itemsPerPage));

      const resp = await apiGet(`/tracert/customers?${params.toString()}`);
      const data = resp?.data ?? resp ?? {};
      setRows(Array.isArray(data.rows) ? data.rows : []);
      setTotalRows(Number(data.total || 0));
    } catch (e) {
      setRows([]);
      setTotalRows(0);
    } finally {
      setRefreshing(false);
    }
  };

  useEffect(() => { fetchList(); /* eslint-disable-next-line */ }, [searchTerm, stageFilter, currentPage, itemsPerPage]);

  // KPIs (no mesmo “espírito” do exemplo)
  const kpiCards = useMemo(() => {
    const byStageMap = Object.fromEntries((metrics.byStage || []).map(i => [i.block, i.users]));
    return [
      { tone: 'red',    value: metrics.loopers || 0, label: 'Com loops (>1)' },
      { tone: 'orange', value: metrics.topStage?.users || 0, label: `Top Estágio: ${labelize(metrics.topStage?.block || '—')}` },
      { tone: 'yellow', value: (metrics.byStage || []).reduce((s, i) => s + (i.users || 0), 0), label: 'Usuários em fluxo' },
      { tone: 'green',  value: metrics.total || 0, label: 'Total (base atual)' },
    ];
  }, [metrics]);

  // paginação
  const totalPages = Math.max(1, Math.ceil(totalRows / itemsPerPage));
  const startIndex = (currentPage - 1) * itemsPerPage;

  // detalhe modal
  const openDetails = async (row) => {
    setSelectedCustomer(row);
    try {
      const det = await apiGet(`/tracert/customers/${encodeURIComponent(row.user_id)}`);
      setSelectedDetail(det?.data ?? det ?? null);
    } catch (e) {
      setSelectedDetail(null);
    }
  };

  const PriorityPill = ({ loops }) => {
    let klass = styles.pillGreen;
    let txt = 'OK';
    if (loops >= 3) { klass = styles.pillRed; txt = 'Crítico'; }
    else if (loops === 2) { klass = styles.pillYellow; txt = 'Atenção'; }
    return <span className={`${styles.pill} ${klass}`}>{txt}</span>;
  };

  const StageCell = ({ block }) => {
    const key = String(block || '').toLowerCase();
    const cfg = stageConfig[key] || { name: labelize(key), icon: MessageCircle, bgColor: styles.bgStage, textColor: styles.txtPrimary };
    const Icon = cfg.icon || MessageCircle;
    return (
      <div className={styles.stageCell}>
        <span className={styles.stageIcon}><Icon size={14} /></span>
        <div>
          <div className={styles.stageName}>{cfg.name || labelize(key) }</div>
        </div>
      </div>
    );
  };

  const CustomerModal = ({ customer, detail, onClose }) => {
    if (!customer) return null;
    const journey = Array.isArray(detail?.journey) ? detail.journey : [];
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
            <div>
              <h3 className={styles.sectionTitle}>Jornada Completa</h3>
              <div className={styles.timeline}>
                {journey.length === 0 ? (
                  <div className={styles.emptyCell}>Sem histórico de estágios.</div>
                ) : journey.map((st, i) => {
                  const key = String(st.stage || '').toLowerCase();
                  const cfg = stageConfig[key] || {};
                  const Icon = cfg.icon || MessageCircle;
                  return (
                    <React.Fragment key={`${st.stage}-${i}`}>
                      <div className={`${styles.timelineItem} ${cfg.bgColor || ''}`}>
                        <div className={styles.timelineTop}>
                          <Icon size={16} className={cfg.textColor || ''} />
                          <span className={styles.timelineTitle}>{cfg.name || labelize(key)}</span>
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
            </div>

            {/* Diagnóstico atual, se veio no detalhe */}
            {detail?.dwell && (
              <div className={styles.dwellBox}>
                <h4 className={styles.sectionTitle}>Diagnóstico do estágio atual</h4>
                <div className={styles.dgrid}>
                  <Stat label="Estágio" value={labelize(detail.dwell.block)} />
                  <Stat label="Desde" value={new Date(detail.dwell.entered_at).toLocaleString('pt-BR')} />
                  <Stat label="Duração" value={fmtTime(detail.dwell.duration_sec)} />
                  <Stat label="Msgs Bot" value={detail.dwell.bot_msgs ?? 0} />
                  <Stat label="Msgs Usuário" value={detail.dwell.user_msgs ?? 0} />
                  <Stat label="Falhas Validação" value={detail.dwell.validation_fails ?? 0} />
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    );
  };

  return (
    <div className={styles.page}>
      {/* Header fixo */}
      <div className={styles.header}>
        <div className={styles.headerInner}>
          <div className={styles.headerTitle}>
            <h1>Tracert do Bot</h1>
            <span className={styles.headerSub}>Estágio atual, tempo e loops</span>
          </div>
          <div className={styles.actions}>
            <button className={styles.refreshBtn} onClick={fetchList} disabled={refreshing}>
              <RefreshCw size={16} className={refreshing ? styles.spin : ''} />
              Atualizar
            </button>
          </div>
        </div>

        {/* Métricas (cards) */}
        <div className={styles.metricsGrid}>
          {kpiCards.map((c, i) => (
            <div key={i} className={`${styles.kpiCard} ${styles['tone_' + c.tone]}`}>
              <div className={styles.kpiValue}>{c.value}</div>
              <div className={styles.kpiLabel}>{c.label}</div>
            </div>
          ))}
        </div>

        {/* Filtros */}
        <div className={styles.filters}>
          <div className={styles.searchWrap}>
            <Search size={16} className={styles.searchIcon} />
            <input
              type="text"
              placeholder="Buscar por nome ou user_id..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className={styles.searchInput}
            />
          </div>

          <select
            value={stageFilter}
            onChange={(e) => setStageFilter(e.target.value)}
            className={styles.select}
          >
            <option value="all">Todos os Estágios</option>
            {stages.map((s) => (
              <option key={s} value={s}>{labelize(s)}</option>
            ))}
          </select>
        </div>
      </div>

      {/* Lista Principal */}
      <div className={styles.content}>
        {/* Info da Página + Paginação */}
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

        {/* Tabela */}
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

                  <td><StageCell block={r.current_stage} /></td>

                  <td><span className={styles.mono}>{fmtTime(r.time_in_stage_sec)}</span></td>

                  <td><PriorityPill loops={r.loops_in_stage ?? 1} /></td>

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
