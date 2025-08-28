// File: dashboard/Dashboard.jsx
import React, { useEffect, useMemo, useRef, useState } from 'react';
import { apiGet } from '../../../shared/apiClient';
import {
  Info, TrendingUp, Clock, Users, BarChart2,
  LineChart as LineIcon, Activity, AlertTriangle, Gauge, Smile, LayoutDashboard,
  RefreshCcw
} from 'lucide-react';
import styles from './styles/Dashboard.module.css';

/* ========================= Helpers ========================= */
const toISO = (v) => (v ? new Date(v).toISOString() : null);
const fmtInt = (n) => (Number.isFinite(+n) ? Math.round(+n) : 0);
const fmtPct = (n, d = 0) => (Number.isFinite(+n) ? `${(+n).toFixed(d)}%` : '—');
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

const safeGet = async (url) => { try { return await apiGet(url); } catch { return null; } };
const avg = (arr) => {
  const v = arr.map((d) => Number(d.y || 0)).filter(Number.isFinite);
  return v.length ? v.reduce((a, b) => a + b, 0) / v.length : 0;
};

/* ========================= Resize ========================= */
const useMeasure = () => {
  const ref = useRef(null);
  const [rect, setRect] = useState({ width: 0, height: 0 });
  useEffect(() => {
    if (!ref.current) return;
    const ro = new ResizeObserver(([entry]) => {
      const { width, height } = entry.contentRect;
      setRect({ width, height });
    });
    ro.observe(ref.current);
    return () => ro.disconnect();
  }, []);
  return [ref, rect];
};

/* ========================= Tooltip de ajuda ========================= */
const HelpIcon = ({ text, className }) => {
  if (!text) return null;
  const ref = useRef(null);
  const [pos, setPos] = useState('top'); // 'top' | 'top-left' | 'top-right'
  const onEnter = () => {
    const el = ref.current; if (!el) return;
    const TIP_W = 260, PAD = 12;
    const rect = el.getBoundingClientRect();
    const midX = rect.left + rect.width / 2;
    const vw = window.innerWidth;
    if (midX + TIP_W / 2 + PAD > vw) setPos('top-right');
    else if (midX - TIP_W / 2 - PAD < 0) setPos('top-left');
    else setPos('top');
  };
  return (
    <span ref={ref} onMouseEnter={onEnter}
      className={`${styles.help} ${className || ''}`} data-tooltip={text} data-pos={pos} aria-label="Ajuda" role="img">
      <Info size={16} />
    </span>
  );
};

/* ========================= UI base ========================= */
const Card = ({ title, icon, help, right, children }) => (
  <div className={styles.card}>
    <div className={styles.cardHead}>
      <div className={styles.cardTitle}>
        {icon ? <span className={styles.cardIcon}>{icon}</span> : null}
        <span>{title}</span>
      </div>
      <div className={styles.cardRight}>
        {right}
        {help ? <HelpIcon text={help} /> : null}
      </div>
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

/* ========================= Skeleton ========================= */
const Skeleton = ({ w = '100%', h = 14, r = 10, className }) =>
  <div className={`${styles.skeleton} ${className || ''}`} style={{ width: w, height: h, borderRadius: r }} />;
const SkeletonCard = () => (
  <div className={styles.card}>
    <div className={styles.cardHead}>
      <div className={styles.cardTitle}>
        <Skeleton w={18} h={18} r={6} />
        <Skeleton w={120} h={16} />
      </div>
      <Skeleton w={80} h={16} />
    </div>
    <div className={styles.cardBody}><Skeleton w="100%" h={120} /></div>
  </div>
);

/* ========================= Charts ========================= */
const AreaLineChart = ({ series = [], height = 180, valueFormatter = (v) => v, yMax }) => {
  const [hostRef, { width }] = useMeasure();
  const [hover, setHover] = useState(null); // {i, x, y}
  const padding = { top: 18, right: 12, bottom: 24, left: 36 };
  const W = Math.max(160, width || 160);
  const H = height;

  const X = series.length ? (W - padding.left - padding.right) / Math.max(1, series.length - 1) : 0;
  const maxY = Math.max(1, yMax ?? Math.max(...series.map((d) => Number(d.y || 0))));
  const yTo = (v) => padding.top + (1 - Number(v) / maxY) * (H - padding.top - padding.bottom);
  const xTo = (i) => padding.left + i * X;

  const pts = series.map((d, i) => `${xTo(i)},${yTo(d.y || 0)}`).join(' ');
  const area = `M${xTo(0)},${yTo(series[0]?.y || 0)} L${series.map((d, i) => `${xTo(i)},${yTo(d.y || 0)}`).join(' ')} L${xTo(series.length - 1)},${H - padding.bottom} L${xTo(0)},${H - padding.bottom} Z`;

  const axesY = 4;
  const yTicks = [...Array(axesY + 1)].map((_, i) => Math.round((maxY / axesY) * i));

  const onMove = (e) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const x = e.clientX - rect.left - padding.left;
    const idx = Math.min(series.length - 1, Math.max(0, Math.round(x / X)));
    const rx = xTo(idx);
    const ry = yTo(series[idx]?.y || 0);
    setHover({ i: idx, x: rx, y: ry });
  };

  return (
    <div ref={hostRef} className={styles.chartRoot} style={{ height }}>
      <svg width={W} height={H} className={styles.chartSvg}>
        {yTicks.map((t, i) => {
          const y = yTo(t);
          return <line key={i} x1={padding.left} y1={y} x2={W - padding.right} y2={y} className={styles.grid} />;
        })}
        <line x1={padding.left} y1={padding.top} x2={padding.left} y2={H - padding.bottom} className={styles.axis} />
        <line x1={padding.left} y1={H - padding.bottom} x2={W - padding.right} y2={H - padding.bottom} className={styles.axis} />
        {yTicks.map((t, i) => (
          <text key={i} x={padding.left - 8} y={yTo(t)} className={styles.tick} textAnchor="end" dy="0.35em">
            {valueFormatter(t)}
          </text>
        ))}
        <path d={area} className={styles.areaFill} />
        <polyline points={pts} className={styles.lineStroke} />
        {series.map((d, i) => (
          <circle key={i} cx={xTo(i)} cy={yTo(d.y || 0)} r={2.5} className={styles.lineDot} />
        ))}
        {hover && (
          <>
            <line x1={hover.x} y1={padding.top} x2={hover.x} y2={H - padding.bottom} className={styles.crosshair} />
            <circle cx={hover.x} cy={hover.y} r={4} className={styles.lineDotActive} />
          </>
        )}
      </svg>
      {hover && series[hover.i] && (
        <div className={styles.tt} style={{ left: hover.x, top: hover.y }}>
          <div className={styles.ttLine}>{series[hover.i].xLabel}</div>
          <div className={styles.ttValue}>{valueFormatter(series[hover.i].y)}</div>
        </div>
      )}
      <div className={styles.hit} onMouseMove={onMove} onMouseLeave={() => setHover(null)} />
    </div>
  );
};

const BarChart = ({ data = [], height = 180, formatter = (v) => v }) => {
  const [hostRef, { width }] = useMeasure();
  const [hover, setHover] = useState(null);
  const padding = { top: 12, right: 12, bottom: 26, left: 36 };
  const W = Math.max(160, width || 160);
  const H = height;

  const max = Math.max(1, ...data.map((d) => Number(d.value || 0)));
  const bw = 22;
  const gap = 18;
  const plotW = W - padding.left - padding.right;
  const totalBarsW = data.length * bw + (data.length - 1) * gap;
  const offsetX = padding.left + Math.max(0, (plotW - totalBarsW) / 2);

  const yTo = (v) => padding.top + (1 - Number(v) / max) * (H - padding.top - padding.bottom);

  return (
    <div ref={hostRef} className={styles.chartRoot} style={{ height }}>
      <svg width={W} height={H} className={styles.chartSvg}>
        {[0, 0.25, 0.5, 0.75, 1].map((p, i) => {
          const y = padding.top + p * (H - padding.top - padding.bottom);
          return <line key={i} x1={padding.left} y1={y} x2={W - padding.right} y2={y} className={styles.grid} />;
        })}
        <line x1={padding.left} y1={H - padding.bottom} x2={W - padding.right} y2={H - padding.bottom} className={styles.axis} />
        {data.map((d, i) => {
          const x = offsetX + i * (bw + gap);
          const y = yTo(d.value || 0);
          const h = H - padding.bottom - y;
          return (
            <g key={i}>
              <rect
                x={x}
                y={y}
                width={bw}
                height={h}
                rx="6"
                className={styles.barRect}
                onMouseEnter={() => setHover({ i, x: x + bw / 2, y })}
                onMouseLeave={() => setHover(null)}
              />
              <text x={x + bw / 2} y={H - 8} className={styles.tick} textAnchor="middle">
                {d.xLabel}
              </text>
            </g>
          );
        })}
      </svg>
      {hover && data[hover.i] && (
        <div className={styles.tt} style={{ left: hover.x, top: hover.y }}>
          <div className={styles.ttLine}>{data[hover.i].xLabel}</div>
          <div className={styles.ttValue}>{formatter(data[hover.i].value)}</div>
        </div>
      )}
    </div>
  );
};

const RankList = ({ items = [], unit = '' }) => {
  const max = Math.max(1, ...items.map((i) => Number(i.value || 0)));
  return (
    <ul className={styles.rankList}>
      {items.map((it, idx) => {
        const w = (Number(it.value || 0) / max) * 100;
        return (
          <li key={it.label + idx} className={styles.rankItem}>
            <span className={styles.rankLabel} title={it.label}>{it.label}</span>
            <div className={styles.rankBarWrap}><div className={styles.rankBar} style={{ width: `${w}%` }} /></div>
            <span className={styles.rankValue}>{fmtInt(it.value)}{unit}</span>
          </li>
        );
      })}
    </ul>
  );
};

const Donut = ({ percent = 0, size = 136, stroke = 12, label }) => {
  const p = Math.min(100, Math.max(0, +percent || 0));
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const dash = (p / 100) * c;
  return (
    <div className={styles.donutWrap} title={`${label || 'Percentual'}: ${fmtPct(p)}`}>
      <svg width={size} height={size}>
        <circle className={styles.donutBg} cx={size/2} cy={size/2} r={r} />
        <circle className={styles.donutFg} cx={size/2} cy={size/2} r={r}
                strokeDasharray={`${dash} ${c - dash}`} strokeLinecap="round"
                transform={`rotate(-90 ${size/2} ${size/2})`} />
        <text x="50%" y="50%" textAnchor="middle" dominantBaseline="central" className={styles.donutText}>
          {fmtPct(p)}
        </text>
      </svg>
      {label ? <div className={styles.donutLabel}>{label}</div> : null}
    </div>
  );
};

/* ========================= NPS / CSAT ========================= */
const NpsGauge = ({ score = 0 }) => {
  const s = Math.max(-100, Math.min(100, Number(score) || 0));
  const pct = (s + 100) / 200;
  return (
    <div className={styles.npsWrap} title={`NPS: ${s}`}>
      <div className={styles.npsScale}>
        <div className={styles.npsTrack} />
        <div className={styles.npsMarker} style={{ left: `${pct * 100}%` }} />
        <div className={styles.npsLabels}><span>−100</span><span>0</span><span>100</span></div>
      </div>
      <div className={styles.npsValue}>{s}</div>
    </div>
  );
};

const CsatDistribution = ({ counts = {} }) => {
  const total = [1,2,3,4,5].reduce((a,k) => a + (counts[k] || 0), 0);
  return (
    <div className={styles.csatDist}>
      <div className={styles.csatBar}>
        {[1,2,3,4,5].map((k) => {
          const v = counts[k] || 0, w = total ? (v / total) * 100 : 0;
          return <span key={k} className={`${styles.csatSeg} ${styles[`csat${k}`]}`} style={{ width: `${w}%` }} title={`${k}★: ${v}`} />;
        })}
      </div>
      <div className={styles.csatLegend}>
        {[1,2,3,4,5].map((k) => <span key={k} className={styles.csatLegendItem}><i className={`${styles.dot} ${styles[`csat${k}`]}`} /> {k}★</span>)}
      </div>
    </div>
  );
};

/* ========================= Página ========================= */
export default function Dashboard() {
  // últimos 7 dias
  const d7 = new Date(Date.now() - 6 * 24 * 60 * 60 * 1000);
  const [from, setFrom] = useState(new Date(d7.getFullYear(), d7.getMonth(), d7.getDate(), 0, 0, 0).toISOString().slice(0, 16));
  const [to, setTo] = useState(new Date().toISOString().slice(0, 16));

  const debFrom = useDebounce(from, 300);
  const debTo   = useDebounce(to, 300);

  const [summary, setSummary] = useState(null);
  const [queues, setQueues] = useState([]);
  const [frtDay, setFrtDay] = useState([]);
  const [artAgents, setArtAgents] = useState([]);
  const [durationByQueue, setDurationByQueue] = useState([]);
  const [abandonment, setAbandonment] = useState({ taxa_pct: 0, abandonados: 0, total: 0, threshold_min: 15 });
  const [aging, setAging] = useState([]);

  // NPS/CSAT/Clientes novos
  const [nps, setNps]   = useState({ score: 0, promoters: 0, passives: 0, detractors: 0, responses: 0, available: false });
  const [csat, setCsat] = useState({ pct: 0, avg: 0, responses: 0, counts: {}, available: false });
  const [clientsSeries, setClientsSeries] = useState([]);

  const [loading, setLoading] = useState(false);
  const [erro, setErro] = useState(null);
  const [firstLoad, setFirstLoad] = useState(true);
  const [refreshKey, setRefreshKey] = useState(0);

  useEffect(() => {
    const fetchAll = async () => {
      setLoading(true); setErro(null);
      try {
        const params = { from: toISO(debFrom), to: toISO(debTo) };
        const s   = await apiGet(`/analytics/metrics/summary?${qs(params)}`);
        const q   = await apiGet(`/analytics/metrics/queues?${qs(params)}`);
        const frt = await apiGet(`/analytics/metrics/frt?group=day&${qs(params)}`);
        const art = await apiGet(`/analytics/metrics/agents/art?${qs(params)}`);
        const dur = await apiGet(`/analytics/metrics/duration-by-queue?${qs(params)}`);
        const abd = await apiGet(`/analytics/metrics/abandonment?threshold_min=15&${qs(params)}`);
        const ag  = await apiGet(`/analytics/metrics/aging-by-queue`);

        const [npsRaw, csatRaw] = await Promise.all([
          safeGet(`/analytics/metrics/series/nps?${qs(params)}`),
          safeGet(`/analytics/metrics/series/csat?${qs(params)}`),
        ]);

        const clientsRaw =
          (await safeGet(`/analytics/metrics/new-clients?group=day&${qs(params)}`)) ||
          (await safeGet(`/analytics/metrics/clients?type=new&group=day&${qs(params)}`));

        setSummary(s || null);
        setQueues(Array.isArray(q) ? q : []);
        setFrtDay(Array.isArray(frt?.metrics) ? frt.metrics : []);
        setArtAgents(Array.isArray(art) ? art : []);
        setDurationByQueue(Array.isArray(dur) ? dur : []);
        setAbandonment(abd || { taxa_pct: 0, abandonados: 0, total: 0, threshold_min: 15 });
        setAging(Array.isArray(ag) ? ag : []);

        if (npsRaw && typeof npsRaw === 'object') {
          setNps({
            score: Number(npsRaw?.nps ?? npsRaw?.score ?? 0),
            promoters: fmtInt(npsRaw?.promoters ?? npsRaw?.promotores ?? 0),
            passives: fmtInt(npsRaw?.passives ?? npsRaw?.neutros ?? 0),
            detractors: fmtInt(npsRaw?.detractors ?? npsRaw?.detratores ?? 0),
            responses: fmtInt(npsRaw?.responses ?? npsRaw?.respostas ?? 0),
            available: true,
          });
        } else setNps((p) => ({ ...p, available: false }));

        if (csatRaw && typeof csatRaw === 'object') {
          const counts = csatRaw?.counts || csatRaw?.notas || {};
          const resp   = fmtInt(csatRaw?.responses ?? csatRaw?.respostas ?? 0);
          const good   = fmtInt((counts?.[4] || 0) + (counts?.[5] || 0));
          const pct    = resp ? (good / resp) * 100 : Number(csatRaw?.csat_pct ?? csatRaw?.pct ?? 0);
          setCsat({ pct: pct || 0, avg: Number(csatRaw?.avg ?? csatRaw?.media ?? 0), responses: resp, counts, available: true });
        } else setCsat((p) => ({ ...p, available: false }));

        if (clientsRaw && (clientsRaw.metrics || Array.isArray(clientsRaw))) {
          const src = clientsRaw.metrics ?? clientsRaw;
          const items = src
            .filter((d) => d.group_key)
            .map((d) => {
              const date = new Date(d.group_key);
              const v = d.total ?? d.count ?? d.novos ?? d.new ?? d.clientes ?? 0;
              return {
                sort: +date,
                xLabel: date.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' }),
                y: v,
              };
            })
            .sort((a, b) => a.sort - b.sort);
          setClientsSeries(items);
        } else setClientsSeries([]);
      } catch (e) {
        console.error(e);
        setErro('Falha ao carregar métricas. Tente ajustar o período.');
      } finally {
        setLoading(false);
        setFirstLoad(false);
      }
    };
    if (debFrom && debTo) fetchAll();
  }, [debFrom, debTo, refreshKey]);

  /* ===== Derivados ===== */
  const totalCriados = (
    (summary?.total_criados_no_periodo ?? summary?.total_criados ??
      queues?.reduce((acc, r) => acc + fmtInt(r.total_criados_no_periodo ?? r.total_criados ?? 0), 0)) ?? 0
  );
  const backlogAberto  = fmtInt(summary?.backlog_aberto);
  const aguardando     = fmtInt(summary?.aguardando);
  const emAtendimento  = fmtInt(summary?.em_atendimento);

  const frtSerie = useMemo(() => {
    const items = frtDay.filter((d) => d.group_key).map((d) => {
      const dt = new Date(d.group_key);
      return { sort: +dt, xLabel: dt.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' }), y: d.frt_media_min ?? null };
    }).sort((a,b) => a.sort - b.sort);
    return items;
  }, [frtDay]);

  const slaDia = useMemo(() => {
    const items = frtDay.filter((d) => d.group_key).map((d) => {
      const dt = new Date(d.group_key);
      return { sort: +dt, xLabel: dt.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' }), y: d.sla_15min_pct ?? null };
    }).sort((a,b) => a.sort - b.sort);
    return items;
  }, [frtDay]);

  const artRows = useMemo(() =>
    [...artAgents].sort((a, b) => (a.art_media_min ?? 0) - (b.art_media_min ?? 0))
  , [artAgents]);

  const queuesBacklog = useMemo(() =>
    [...queues].sort((a,b) => (b.backlog_aberto ?? 0) - (a.backlog_aberto ?? 0))
               .slice(0, 8)
               .map((r,i) => ({ label: r.fila || `— ${i+1}`, value: r.backlog_aberto ?? 0 })),
  [queues]);

  const durationRows = useMemo(() =>
    [...durationByQueue].sort((a,b) => (b.duracao_media_min ?? 0) - (a.duracao_media_min ?? 0)),
  [durationByQueue]);

  const clientsTotal = useMemo(() => clientsSeries.reduce((a, b) => a + fmtInt(b.y), 0), [clientsSeries]);

  const frtAvg = avg(frtSerie);
  const slaAvg = avg(slaDia);

  /* ===== Render ===== */
  return (
    <div className={styles.container}>
      {/* Indicador da página */}
      <div className={styles.crumbBar}>
        <span className={styles.crumb}><LayoutDashboard size={14} /> <span>Dashboard</span></span>
        {erro ? <span className={styles.crumbError}>• {erro}</span> : null}
      </div>

      {/* Filtros + atualizar */}
      <div className={styles.headerRow}>
        <div className={styles.filters}>
          <div className={styles.filterItem}>
            <label>De</label>
            <input type="datetime-local" value={from} onChange={(e) => setFrom(e.target.value)} />
          </div>
          <div className={styles.filterItem}>
            <label>Até</label>
            <input type="datetime-local" value={to} onChange={(e) => setTo(e.target.value)} />
          </div>
          <button
            className={styles.refreshBtn}
            disabled={loading}
            onClick={() => setRefreshKey((k) => k + 1)}
            title="Atualizar dados"
          >
            <RefreshCcw size={16} className={loading ? styles.spinning : ''} />
            Atualizar
          </button>
        </div>
      </div>

      {/* KPIs */}
      {firstLoad && loading ? (
        <div className={styles.statRow}><SkeletonCard /><SkeletonCard /><SkeletonCard /></div>
      ) : (
        <div className={styles.statRow}>
          <Card
            title="Tickets criados (período)"
            icon={<TrendingUp size={18} />}
            help={`Mostra a soma de tickets CRIADOS no intervalo [De, Até].\n• Fonte: /analytics/metrics/summary\n• O número muda quando você altera o período.`}
          >
            <Stat label="Criados" value={fmtInt(totalCriados)} tone="blue" />
          </Card>

          <Card
            title="Backlog atual"
            icon={<Activity size={18} />}
            help={`Snapshot do momento (independe do período):\n• Abertos = status=open\n• Aguardando = open sem assigned_to\n• Em atendimento = open com assigned_to`}
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
            help={`Rosca mostra % dentro do SLA de 15m.\n• Cálculo: 100% − taxa de abandono\n• Fonte: /analytics/metrics/abandonment`}
          >
            <Donut percent={abandonment && Number.isFinite(+abandonment.taxa_pct) ? (100 - +abandonment.taxa_pct) : 0} label="Dentro do SLA" />
            <div className={styles.subtleCenter}>Abandono: {fmtPct(abandonment?.taxa_pct ?? 0)} • Limite {abandonment?.threshold_min ?? 15}m</div>
          </Card>
        </div>
      )}

      {/* Linhas com área */}
      <div className={styles.gridTwo}>
        <Card
          title="FRT diário (média em minutos)"
          icon={<LineIcon size={18} />}
          right={<span className={styles.kpill}>média: {fmtMin(frtAvg)}</span>}
          help={`FRT médio por dia.\n• FRT = 1ª msg cliente → 1ª resposta do agente\n• Fonte: /analytics/metrics/frt?group=day`}
        >
          {firstLoad && loading
            ? <Skeleton w="100%" h={180} />
            : frtSerie.length === 0
              ? <div className={styles.empty}>Sem dados.</div>
              : <AreaLineChart series={frtSerie} height={180} valueFormatter={fmtMin} />}
        </Card>

        <Card
          title="SLA 15m por dia"
          icon={<Clock size={18} />}
          right={<span className={styles.kpill}>{fmtPct(slaAvg, 0)} média</span>}
          help={`Percentual diário de tickets com FRT ≤ 15m.\n• Fonte: /analytics/metrics/frt?group=day (sla_15min_pct)`}
        >
          {firstLoad && loading
            ? <Skeleton w="100%" h={180} />
            : slaDia.length === 0
              ? <div className={styles.empty}>Sem dados.</div>
              : <AreaLineChart series={slaDia} height={180} valueFormatter={(v) => fmtPct(v, 0)} yMax={100} />}
        </Card>
      </div>

      {/* NPS & CSAT */}
      <div className={styles.gridTwo}>
        <Card title="NPS (Net Promoter Score)" icon={<Smile size={18} />}
              right={<span className={styles.kpill}>{fmtInt(nps.responses)} respostas</span>}
              help={`NPS do período.\n• Cálculo: %Promotores (9–10) − %Detratores (0–6)\n• Escala: −100 a 100`}>
          {firstLoad && loading ? <Skeleton w="100%" h={64} /> :
            nps.available ? (<>
              <NpsGauge score={nps.score} />
              <div className={styles.npsBreakdown}>
                <span className={styles.kpillGreen}>Promotores: {fmtInt(nps.promoters)}</span>
                <span className={styles.kpillAmber}>Neutros: {fmtInt(nps.passives)}</span>
                <span className={styles.kpillRed}>Detratores: {fmtInt(nps.detractors)}</span>
              </div>
            </>) : <div className={styles.empty}>Endpoint de NPS não disponível.</div>}
        </Card>

        <Card title="CSAT (Satisfação do Cliente)" icon={<Smile size={18} />}
              right={<span className={styles.kpill}>{csat.responses ? `${fmtInt(csat.responses)} respostas` : 'sem respostas'}</span>}
              help={`CSAT do período.\n• Rosca = % de avaliações 4★ e 5★\n• Média (1–5) e distribuição por notas`}>
          {firstLoad && loading ? <Skeleton w="100%" h={96} /> :
            csat.available ? (
              <div className={styles.csatRow}>
                <Donut percent={csat.pct || 0} label="Satisfeitos" />
                <div className={styles.csatSide}>
                  <div className={styles.csatBig}>{fmtPct(csat.pct || 0)}</div>
                  <div className={styles.csatAvg}>Média: {Number(csat.avg || 0).toFixed(2)} ★</div>
                  <CsatDistribution counts={csat.counts} />
                </div>
              </div>
            ) : <div className={styles.empty}>Endpoint de CSAT não disponível.</div>}
        </Card>
      </div>

      {/* Novos clientes + Backlog */}
      <div className={styles.gridTwo}>
        <Card title="Novos clientes" icon={<Users size={18} />}
              right={<span className={styles.kpill}>{fmtInt(clientsTotal)} no período</span>}
              help={`Clientes únicos criados (tabela clientes) por dia no período.\n• Endpoint sugerido: /analytics/metrics/new-clients?group=day`}>
          {firstLoad && loading ? <Skeleton w="100%" h={220} /> :
            clientsSeries.length === 0 ? <div className={styles.empty}>Sem dados.</div> :
            <BarChart
              data={clientsSeries.map(d => ({ xLabel: d.xLabel, value: d.y }))}
              height={220}
              formatter={(v)=>fmtInt(v)}
            />}
        </Card>

        <Card title="Backlog por fila (snapshot)" icon={<BarChart2 size={18} />}
              help={`Tickets abertos por fila no momento.\n• Ajuda a identificar filas sobrecarregadas\n• Não depende do período`}>
          {firstLoad && loading ? <Skeleton w="100%" h={200} /> :
            queuesBacklog.length === 0 ? <div className={styles.empty}>Sem dados.</div> :
            <RankList items={queuesBacklog} />}
        </Card>
      </div>

      {/* Tabelas */}
      <div className={styles.gridTwo}>
        <Card title="Tempo de resposta por agente (ART médio)" icon={<Users size={18} />}
              help={`ART por agente — tempo entre msg do cliente e 1ª resposta do agente.\n• Fonte: /analytics/metrics/agents/art`}>
          {firstLoad && loading ? <Skeleton w="100%" h={160} /> :
            artRows.length === 0 ? <div className={styles.empty}>Sem dados para o período.</div> :
            <div className={styles.tableWrap}>
              <table className={styles.table}>
                <thead><tr><th>Agente</th><th>ART médio</th><th>Interações</th></tr></thead>
                <tbody>
                  {artRows.map((r, i) => (
                    <tr key={r.agente || i}>
                      <td>{r.agente || '—'}</td>
                      <td>{fmtMin(r.art_media_min)}</td>
                      <td>{fmtInt(r.interacoes)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>}
        </Card>

        <Card title="Duração média das conversas por fila" icon={<AlertTriangle size={18} />}
              help={`Tempo médio do ciclo de conversa por fila no período.\n• P90 = 90% dos tickets abaixo deste valor\n• Fonte: /analytics/metrics/duration-by-queue`}>
          {firstLoad && loading ? <Skeleton w="100%" h={160} /> :
            durationRows.length === 0 ? <div className={styles.empty}>Sem dados para o período.</div> :
            <div className={styles.tableWrap}>
              <table className={styles.table}>
                <thead><tr><th>Fila</th><th>Duração média</th><th>P90</th></tr></thead>
                <tbody>
                  {durationRows.map((d, i) => (
                    <tr key={(d.fila || '-') + i}>
                      <td>{d.fila || '—'}</td>
                      <td>{fmtMin(d.duracao_media_min)}</td>
                      <td>{fmtMin(d.duracao_p90_min)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>}
        </Card>
      </div>

      {/* Aging */}
      <div className={styles.gridTwo}>
        <Card title="Aging do backlog por fila (snapshot)" icon={<Activity size={18} />}
              help={`Distribuição do backlog atual por faixas de idade.\n• Faixas: ≤15m, 15–30m, 30–60m, 1–4h, >4h\n• Fonte: /analytics/metrics/aging-by-queue`}>
          {firstLoad && loading ? <Skeleton w="100%" h={160} /> :
            aging.length === 0 ? <div className={styles.empty}>Sem dados.</div> :
            <div className={styles.tableWrap}>
              <table className={styles.table}>
                <thead>
                  <tr>
                    <th>Fila</th><th>≤15m</th><th>15–30m</th><th>30–60m</th><th>1–4h</th><th>&gt;4h</th><th>Total</th>
                  </tr>
                </thead>
                <tbody>
                  {aging.map((r, i) => {
                    const total = fmtInt(r.ate_15m)+fmtInt(r.m15_a_30m)+fmtInt(r.m30_a_60m)+fmtInt(r.h1_a_h4)+fmtInt(r.acima_4h);
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
            </div>}
        </Card>
      </div>
    </div>
  );
}

