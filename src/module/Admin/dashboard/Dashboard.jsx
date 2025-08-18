import React, { useEffect, useMemo, useRef, useState } from 'react';
import { apiGet } from '../../../shared/apiClient';
import {
  Info,
  TrendingUp,
  Clock,
  Users,
  BarChart2,
  LineChart as LineIcon,
  Activity,
  AlertTriangle,
  Gauge,
} from 'lucide-react';
import styles from './styles/Dashboard.module.css';

/* ========================= Helpers ========================= */
const toISO = (v) => (v ? new Date(v).toISOString() : null);
const fmtInt = (n) => (Number.isFinite(+n) ? Math.round(+n) : 0);
const fmtPct = (n, digits = 1) =>
  Number.isFinite(+n) ? `${(+n).toFixed(digits)}%` : '—';
const fmtMin = (m) => {
  if (!Number.isFinite(+m)) return '—';
  const mins = Math.max(0, Math.floor(+m));
  const h = Math.floor(mins / 60);
  const r = mins % 60;
  return h > 0 ? `${h}h ${r}m` : `${r}m`;
};
const qs = (obj) =>
  Object.entries(obj)
    .filter(([, v]) => v !== null && v !== undefined && v !== '')
    .map(([k, v]) => `${encodeURIComponent(k)}=${encodeURIComponent(v)}`)
    .join('&');

const useDebounce = (value, delay = 300) => {
  const [deb, setDeb] = useState(value);
  useEffect(() => {
    const t = setTimeout(() => setDeb(value), delay);
    return () => clearTimeout(t);
  }, [value, delay]);
  return deb;
};

/* ========================= Tooltip que se ajusta às bordas ========================= */
const HelpIcon = ({ text, className }) => {
  const ref = useRef(null);
  const [pos, setPos] = useState('top'); // 'top' | 'top-left' | 'top-right'

  const handleEnter = () => {
    const el = ref.current;
    if (!el) return;

    const TIP_W = 260;   // manter igual ao CSS (--tipw)
    const PADDING = 12;
    const rect = el.getBoundingClientRect();
    const midX = rect.left + rect.width / 2;
    const left = midX - TIP_W / 2;
    const right = midX + TIP_W / 2;
    const vw = window.innerWidth;

    if (right + PADDING > vw) setPos('top-right');
    else if (left - PADDING < 0) setPos('top-left');
    else setPos('top');
  };

  return (
    <span
      ref={ref}
      onMouseEnter={handleEnter}
      className={`${styles.help} ${className || ''}`}
      data-tooltip={text}
      data-pos={pos}
      aria-label="Ajuda"
    >
      <Info size={16} />
    </span>
  );
};

/* ========================= UI ========================= */
const Card = ({ title, icon, help, children }) => (
  <div className={styles.card}>
    <div className={styles.cardHead}>
      <div className={styles.cardTitle}>
        {icon ? <span className={styles.cardIcon}>{icon}</span> : null}
        <span>{title}</span>
      </div>
      {help ? <HelpIcon text={help} /> : null}
    </div>
    <div className={styles.cardBody}>{children}</div>
  </div>
);

const Stat = ({ label, value, tone = 'default' }) => (
  <div className={`${styles.stat} ${styles[`tone_${tone}`]}`}>
    <div className={styles.statValue}>{value}</div>
    <div className={styles.statLabel}>{label}</div>
  </div>
);

/* ========================= Gráficos (SVG leve) ========================= */
const BarChart = ({ data, maxValue, height = 140, formatter = (v) => v }) => {
  const max = Math.max(1, maxValue ?? Math.max(...data.map((d) => +d.value || 0)));
  return (
    <div className={styles.barWrap}>
      {data.map((d, i) => {
        const h = Math.round(((+d.value || 0) / max) * height);
        return (
          <div className={styles.barCol} key={`${d.label}-${i}`} title={`${d.label}: ${formatter(d.value)}`}>
            <div className={styles.bar} style={{ height: `${h}px` }} />
            <div className={styles.barValue}>{formatter(d.value)}</div>
            <div className={styles.barLabel} title={d.label}>{d.label}</div>
          </div>
        );
      })}
    </div>
  );
};

const LineChart = ({ data, height = 160, formatter = (v) => v }) => {
  const max = Math.max(1, Math.max(...data.map((d) => +d.y || 0)));
  const stepX = 48;
  const padding = 10;
  const width = Math.max(2 * padding + stepX * Math.max(0, data.length - 1), 100);
  const points = data.map((d, i) => {
    const x = padding + i * stepX;
    const y = padding + (1 - (+d.y || 0) / max) * (height - 2 * padding);
    return `${x},${y}`;
  });
  return (
    <div className={styles.lineWrap}>
      <svg width={width} height={height} className={styles.lineSvg}>
        <polyline
          points={points.join(' ')}
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          className={styles.lineStroke}
        />
        {data.map((d, i) => {
          const x = padding + i * stepX;
          const y = padding + (1 - (+d.y || 0) / max) * (height - 2 * padding);
          return (
            <g key={`${d.xLabel}-${i}`}>
              <circle cx={x} cy={y} r="3" className={styles.lineDot} />
              <title>{`${d.xLabel}: ${formatter(d.y)}`}</title>
            </g>
          );
        })}
      </svg>
      <div className={styles.lineXAxis}>
        {data.map((d, i) => (
          <div key={`${d.xLabel}-tick-${i}`} className={styles.lineTick} style={{ width: stepX }}>
            {d.xLabel}
          </div>
        ))}
      </div>
    </div>
  );
};

const Donut = ({ percent = 0, size = 132, stroke = 14, label }) => {
  const p = Math.min(100, Math.max(0, +percent || 0));
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const dash = (p / 100) * c;
  return (
    <div className={styles.donutWrap} title={`${label || 'Percentual'}: ${fmtPct(p)}`}>
      <svg width={size} height={size}>
        <circle className={styles.donutBg} cx={size / 2} cy={size / 2} r={r} strokeWidth={stroke} fill="none" />
        <circle
          className={styles.donutFg}
          cx={size / 2}
          cy={size / 2}
          r={r}
          strokeWidth={stroke}
          fill="none"
          strokeDasharray={`${dash} ${c - dash}`}
          strokeLinecap="round"
          transform={`rotate(-90 ${size / 2} ${size / 2})`}
        />
        <text x="50%" y="50%" textAnchor="middle" dominantBaseline="central" className={styles.donutText}>
          {fmtPct(p)}
        </text>
      </svg>
      {label ? <div className={styles.donutLabel}>{label}</div> : null}
    </div>
  );
};

/* ========================= Página ========================= */
const Dashboard = () => {
  // últimos 7 dias por padrão
  const d7 = new Date(Date.now() - 6 * 24 * 60 * 60 * 1000);
  const [from, setFrom] = useState(new Date(d7.getFullYear(), d7.getMonth(), d7.getDate(), 0, 0, 0).toISOString().slice(0, 16));
  const [to, setTo] = useState(new Date().toISOString().slice(0, 16));

  const debFrom = useDebounce(from, 300);
  const debTo = useDebounce(to, 300);

  const [summary, setSummary] = useState(null);
  const [queues, setQueues] = useState([]);
  const [frtDay, setFrtDay] = useState([]);
  const [artAgents, setArtAgents] = useState([]);
  const [durationByQueue, setDurationByQueue] = useState([]);
  const [abandonment, setAbandonment] = useState({ taxa_pct: 0, abandonados: 0, total: 0, threshold_min: 15 });
  const [aging, setAging] = useState([]);
  const [loading, setLoading] = useState(false);
  const [erro, setErro] = useState(null);

  useEffect(() => {
    const fetchAll = async () => {
      setLoading(true);
      setErro(null);
      try {
        const params = { from: toISO(debFrom), to: toISO(debTo) };
        const s = await apiGet(`/analytics/metrics/summary?${qs(params)}`);
        const q = await apiGet(`/analytics/metrics/queues?${qs(params)}`);
        const frt = await apiGet(`/analytics/metrics/frt?group=day&${qs(params)}`);
        const art = await apiGet(`/analytics/metrics/agents/art?${qs(params)}`);
        const dur = await apiGet(`/analytics/metrics/duration-by-queue?${qs(params)}`);
        const abd = await apiGet(`/analytics/metrics/abandonment?threshold_min=15&${qs(params)}`);
        const ag = await apiGet(`/analytics/metrics/aging-by-queue`);

        setSummary(s || null);
        setQueues(Array.isArray(q) ? q : []);
        setFrtDay(Array.isArray(frt?.metrics) ? frt.metrics : []);
        setArtAgents(Array.isArray(art) ? art : []);
        setDurationByQueue(Array.isArray(dur) ? dur : []);
        setAbandonment(abd || { taxa_pct: 0, abandonados: 0, total: 0, threshold_min: 15 });
        setAging(Array.isArray(ag) ? ag : []);
      } catch (e) {
        console.error(e);
        setErro('Falha ao carregar métricas. Tente ajustar o período.');
      } finally {
        setLoading(false);
      }
    };
    if (debFrom && debTo) fetchAll();
  }, [debFrom, debTo]);

  // Derivados
  const totalCriados =
    (
      summary?.total_criados_no_periodo ??
      summary?.total_criados ??
      queues?.reduce(
        (acc, r) => acc + fmtInt(r.total_criados_no_periodo ?? r.total_criados ?? 0),
        0
      )
    ) ?? 0;

  const backlogAberto = fmtInt(summary?.backlog_aberto);
  const aguardando = fmtInt(summary?.aguardando);
  const emAtendimento = fmtInt(summary?.em_atendimento);

  const frtSerie = useMemo(() => {
    const items = frtDay
      .filter((d) => d.group_key)
      .map((d) => {
        const date = new Date(d.group_key);
        return {
          sort: +date,
          xLabel: date.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' }),
          y: d.frt_media_min ?? null,
        };
      })
      .sort((a, b) => a.sort - b.sort);
    return items;
  }, [frtDay]);

  const slaDia = useMemo(() => {
    const items = frtDay
      .filter((d) => d.group_key)
      .map((d) => {
        const date = new Date(d.group_key);
        return {
          sort: +date,
          xLabel: date.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' }),
          y: d.sla_15min_pct ?? null,
        };
      })
      .sort((a, b) => a.sort - b.sort);
    return items;
  }, [frtDay]);

  const artBars = useMemo(() => {
    const top = [...artAgents].sort((a, b) => (a.art_media_min ?? 0) - (b.art_media_min ?? 0)).slice(0, 8);
    return top.map((r, i) => ({
      label: r.agente || `— ${i + 1}`,
      value: r.art_media_min ?? 0,
      extra: r.interacoes ?? 0,
    }));
  }, [artAgents]);

  const queuesBacklog = useMemo(
    () =>
      [...queues]
        .sort((a, b) => (b.backlog_aberto ?? 0) - (a.backlog_aberto ?? 0))
        .slice(0, 8)
        .map((r, i) => ({
          label: r.fila || `— ${i + 1}`,
          value: r.backlog_aberto ?? 0,
        })),
    [queues]
  );

  const durationBars = useMemo(
    () =>
      [...durationByQueue]
        .sort((a, b) => (b.duracao_media_min ?? 0) - (a.duracao_media_min ?? 0))
        .slice(0, 8)
        .map((r, i) => ({
          label: r.fila || `— ${i + 1}`,
          value: r.duracao_media_min ?? 0,
          p90: r.duracao_p90_min ?? 0,
        })),
    [durationByQueue]
  );

  /* ========================= Render ========================= */
  return (
    <div className={styles.container}>
      <div className={styles.header}>
        <div>
          <h1 className={styles.title}>Dashboard Analítico</h1>
          <p className={styles.subtitle}>Visão consolidada de métricas (sem tempo real)</p>
          {erro ? <p className={styles.error}>{erro}</p> : null}
        </div>

        {/* Filtros de período */}
        <div className={styles.filters}>
          <div className={styles.filterItem}>
            <label>De</label>
            <input type="datetime-local" value={from} onChange={(e) => setFrom(e.target.value)} />
          </div>
          <div className={styles.filterItem}>
            <label>Até</label>
            <input type="datetime-local" value={to} onChange={(e) => setTo(e.target.value)} />
          </div>
        </div>
      </div>

      {/* Linha de Cards principais */}
      <div className={styles.statRow}>
        <Card
          title="Tickets criados (período)"
          icon={<TrendingUp size={18} />}
          help="Quantidade total de tickets criados no intervalo selecionado."
        >
          <Stat label="Criados" value={fmtInt(totalCriados)} tone="blue" />
        </Card>

        <Card
          title="Backlog atual"
          icon={<Activity size={18} />}
          help="Quantidade de tickets abertos no momento (snapshot)."
        >
          <div className={styles.statsGrid3}>
            <Stat label="Abertos" value={backlogAberto} tone="purple" />
            <Stat label="Aguardando" value={aguardando} tone="amber" />
            <Stat label="Em atendimento" value={emAtendimento} tone="green" />
          </div>
        </Card>

        <Card
          title="SLA de 1ª resposta (15m)"
          icon={<Gauge size={18} />}
          help="Percentual de tickets respondidos em até 15 minutos (por dia), no período. Abaixo, donut mostra o inverso do abandono."
        >
          <Donut
            percent={
              abandonment && Number.isFinite(+abandonment.taxa_pct)
                ? (100 - +abandonment.taxa_pct)
                : 0
            }
            label="Dentro do SLA"
          />
          <div className={styles.subtleCenter}>
            Abandono: {fmtPct(abandonment?.taxa_pct ?? 0)} • Limite {abandonment?.threshold_min ?? 15}m
          </div>
        </Card>
      </div>

      {/* Linha de gráficos */}
      <div className={styles.gridTwo}>
        <Card
          title="FRT diário (média em minutos)"
          icon={<LineIcon size={18} />}
          help="FRT (First Response Time) médio por dia: tempo da primeira mensagem do cliente até a primeira resposta do agente."
        >
          {loading && frtSerie.length === 0 ? (
            <div className={styles.loading}>Carregando…</div>
          ) : frtSerie.length === 0 ? (
            <div className={styles.empty}>Sem dados para o período.</div>
          ) : (
            <LineChart data={frtSerie} formatter={fmtMin} />
          )}
        </Card>

        <Card
          title="SLA 15m por dia"
          icon={<Clock size={18} />}
          help="Percentual de tickets respondidos em até 15 minutos (por dia) no período selecionado."
        >
          {loading && slaDia.length === 0 ? (
            <div className={styles.loading}>Carregando…</div>
          ) : slaDia.length === 0 ? (
            <div className={styles.empty}>Sem dados para o período.</div>
          ) : (
            <LineChart data={slaDia} formatter={(v) => fmtPct(v, 0)} />
          )}
        </Card>
      </div>

      <div className={styles.gridTwo}>
        <Card
          title="Tempo de resposta por agente (ART médio)"
          icon={<Users size={18} />}
          help="ART (Agent Response Time) médio por agente — tempo entre uma mensagem do cliente e a primeira resposta do agente."
        >
          {loading && artBars.length === 0 ? (
            <div className={styles.loading}>Carregando…</div>
          ) : artBars.length === 0 ? (
            <div className={styles.empty}>Sem dados para o período.</div>
          ) : (
            <>
              <BarChart data={artBars} formatter={(v) => fmtMin(v)} />
              <div className={styles.tableWrap}>
                <table className={styles.table}>
                  <thead>
                    <tr>
                      <th>Agente</th>
                      <th>ART médio</th>
                      <th>Interações</th>
                    </tr>
                  </thead>
                  <tbody>
                    {artBars.map((r) => (
                      <tr key={r.label}>
                        <td>{r.label}</td>
                        <td>{fmtMin(r.value)}</td>
                        <td>{fmtInt(r.extra)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </>
          )}
        </Card>

        <Card
          title="Backlog por fila (snapshot)"
          icon={<BarChart2 size={18} />}
          help="Quantidade de tickets abertos por fila no momento (snapshot atual)."
        >
          {loading && queuesBacklog.length === 0 ? (
            <div className={styles.loading}>Carregando…</div>
          ) : queuesBacklog.length === 0 ? (
            <div className={styles.empty}>Sem dados.</div>
          ) : (
            <BarChart data={queuesBacklog} formatter={(v) => fmtInt(v)} />
          )}
        </Card>
      </div>

      <div className={styles.gridTwo}>
        <Card
          title="Duração média das conversas por fila"
          icon={<AlertTriangle size={18} />}
          help="Tempo médio do ciclo de conversa por fila (diferença entre a primeira e a última mensagem) no período selecionado."
        >
          {loading && durationBars.length === 0 ? (
            <div className={styles.loading}>Carregando…</div>
          ) : durationBars.length === 0 ? (
            <div className={styles.empty}>Sem dados para o período.</div>
          ) : (
            <>
              <BarChart
                data={durationBars.map((d) => ({ label: d.label, value: d.value }))}
                formatter={(v) => fmtMin(v)}
              />
              <div className={styles.tableWrap}>
                <table className={styles.table}>
                  <thead>
                    <tr>
                      <th>Fila</th>
                      <th>Duração média</th>
                      <th>P90</th>
                    </tr>
                  </thead>
                  <tbody>
                    {durationBars.map((d) => (
                      <tr key={d.label}>
                        <td>{d.label}</td>
                        <td>{fmtMin(d.value)}</td>
                        <td>{fmtMin(d.p90)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </>
          )}
        </Card>

        <Card
          title="Aging do backlog por fila (snapshot)"
          icon={<Activity size={18} />}
          help="Distribuição dos tickets abertos por faixas de idade (0–15m, 15–30m, 30–60m, 1–4h, >4h) por fila — estado atual."
        >
          {aging.length === 0 ? (
            <div className={styles.empty}>Sem dados.</div>
          ) : (
            <div className={styles.tableWrap}>
              <table className={styles.table}>
                <thead>
                  <tr>
                    <th>Fila</th>
                    <th>≤15m</th>
                    <th>15–30m</th>
                    <th>30–60m</th>
                    <th>1–4h</th>
                    <th>&gt;4h</th>
                    <th>Total</th>
                  </tr>
                </thead>
                <tbody>
                  {aging.map((r, i) => {
                    const total =
                      fmtInt(r.ate_15m) +
                      fmtInt(r.m15_a_30m) +
                      fmtInt(r.m30_a_60m) +
                      fmtInt(r.h1_a_h4) +
                      fmtInt(r.acima_4h);
                    return (
                      <tr key={(r.fila || '-') + i}>
                        <td>{r.fila || '—'}</td>
                        <td>{fmtInt(r.ate_15m)}</td>
                        <td>{fmtInt(r.m15_a_30m)}</td>
                        <td>{fmtInt(r.m30_a_60m)}</td>
                        <td>{fmtInt(r.h1_a_h4)}</td>
                        <td>{fmtInt(r.acima_4h)}</td>
                        <td><strong>{total}</strong></td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </Card>
      </div>
    </div>
  );
};

export default Dashboard;

