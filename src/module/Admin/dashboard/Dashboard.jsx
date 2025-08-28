// File: dashboard/Dashboard.jsx
import React, { useEffect, useMemo, useRef, useState } from 'react';
import { apiGet } from '../../../shared/apiClient';
import {
  Info, TrendingUp, Clock, Users, BarChart2,
  LineChart as LineIcon, Activity, AlertTriangle, Gauge, Smile, LayoutDashboard,
  RefreshCcw
} from 'lucide-react';
import styles from './styles/Dashboard.module.css';

/* ========================= Chart.js (canvas) ========================= */
import {
  Chart as ChartJS,
  ArcElement, BarElement, PointElement, LineElement,
  CategoryScale, LinearScale, Tooltip as ChartTooltip, Legend, Filler,
} from 'chart.js';
import { Line as LineChart, Bar as BarChartJS, Doughnut } from 'react-chartjs-2';

ChartJS.register(
  ArcElement, BarElement, PointElement, LineElement,
  CategoryScale, LinearScale, ChartTooltip, Legend, Filler
);

/* -------- Plugin do ponteiro para gauge (semi-donut) -------- */
const gaugeNeedle = {
  id: 'gaugeNeedle',
  afterDraw(chart, _args, opts) {
    const { ctx, chartArea, options } = chart;
    const meta = chart.getDatasetMeta(0);
    if (!meta?.data?.length) return;

    const arc0 = meta.data[0];
    const cx = arc0.x;
    const cy = arc0.y;
    const outer = arc0.outerRadius;

    const min = Number(opts?.min ?? 0);
    const max = Number(opts?.max ?? 100);
    const val = Math.min(max, Math.max(min, Number(opts?.value ?? min)));

    const rot = options.rotation ?? -Math.PI;     // -PI (meio-dia)
    const circ = options.circumference ?? Math.PI; // PI (semicírculo)
    const t = (val - min) / (max - min || 1);
    const angle = rot + t * circ;

    const needleLen = outer - 8;
    const needleWidth = 3.2;

    ctx.save();
    ctx.translate(cx, cy);
    ctx.rotate(angle);
    // haste
    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.lineTo(needleLen, 0);
    ctx.lineWidth = needleWidth;
    ctx.strokeStyle = '#0F172A';
    ctx.lineCap = 'round';
    ctx.stroke();
    // pivô
    ctx.beginPath();
    ctx.arc(0, 0, 7, 0, 2 * Math.PI);
    ctx.fillStyle = '#0F172A';
    ctx.fill();
    ctx.restore();
  }
};

/* ========================= Helpers ========================= */
const toISO = (v) => (v ? new Date(v).toISOString() : null);
const fmtInt = (n) => (Number.isFinite(+n) ? Math.round(+n) : 0);
const fmtPct = (n, d = 1) => (Number.isFinite(+n) ? `${(+n).toFixed(d)}%` : '—');
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
const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v));
const sum = (arr) => arr.reduce((a, b) => a + b, 0);
const toNum = (v) => (Number.isFinite(+v) ? +v : 0);
const mean = (arr) => (arr.length ? sum(arr) / arr.length : 0);

/* ========================= UI base ========================= */
const HelpIcon = ({ text, className }) => {
  if (!text) return null;
  const ref = useRef(null);
  const [pos, setPos] = useState('top');
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

/* ========================= Componentes Chart.js ========================= */

/* Linhas com área (FRT / SLA) */
const LineMini = ({ labels = [], values = [], height = 180, formatter = (v)=>v, yMax }) => {
  const data = {
    labels,
    datasets: [{
      data: values,
      borderWidth: 2,
      tension: 0.3,
      fill: 'start',
      backgroundColor: (ctx) => {
        const { chart } = ctx;
        const { ctx: c, chartArea } = chart;
        if (!chartArea) return 'rgba(99, 102, 241, 0.12)';
        const g = c.createLinearGradient(0, chartArea.top, 0, chartArea.bottom);
        g.addColorStop(0, 'rgba(99, 102, 241, 0.18)');
        g.addColorStop(1, 'rgba(99, 102, 241, 0.02)');
        return g;
      },
      borderColor: '#6366F1',
      pointRadius: 2.5
    }]
  };
  const options = {
    responsive: true, maintainAspectRatio: false,
    scales: {
      x: { grid: { display:false } },
      y: {
        beginAtZero: true,
        suggestedMax: yMax ?? undefined,
        ticks: { callback: (v)=>formatter(v) },
        grid: { color: 'rgba(0,0,0,0.05)' }
      }
    },
    plugins: { legend: { display:false }, tooltip: { enabled:true, callbacks: { label: (ctx)=>formatter(ctx.parsed.y) } } }
  };
  return <div style={{height}}><LineChart data={data} options={options} /></div>;
};

/* Barras verticais (Novos clientes) */
const BarsMini = ({ labels = [], values = [], height = 220 }) => {
  const data = { labels, datasets: [{ data: values, backgroundColor: '#22c55e', borderRadius: 6, maxBarThickness: 28 }] };
  const options = {
    responsive: true, maintainAspectRatio: false,
    scales: {
      x: { grid: { display:false } },
      y: { beginAtZero:true, grid:{ color:'rgba(0,0,0,0.05)' } }
    },
    plugins: { legend: { display:false }, tooltip: { enabled:true } }
  };
  return <div style={{height}}><BarChartJS data={data} options={options} /></div>;
};

/* Rosca (SLA) */
const DonutChart = ({ percent = 0, size = 136, label='Percentual' }) => {
  const p = clamp(+percent || 0, 0, 100);
  const data = {
    labels: ['Dentro', 'Fora'],
    datasets: [{
      data: [p, 100 - p],
      backgroundColor: ['#16a34a', '#e5e7eb'],
      borderWidth: 0,
      cutout: '72%'
    }]
  };
  const options = {
    responsive: true, maintainAspectRatio: false,
    plugins: { legend: { display:false }, tooltip: { enabled:false } }
  };
  return (
    <div style={{ width: size, height: size, position:'relative' }}>
      <Doughnut data={data} options={options} />
      <div className={styles.donutCenter}>
        <div className={styles.donutText}>{fmtPct(p)}</div>
        <div className={styles.donutLabel}>{label}</div>
      </div>
    </div>
  );
};

/* Gauge semicircular com ponteiro (NPS / CSAT) — sem SVG */
const GaugeChart = ({
  value = 0, min = 0, max = 10,
  segments = 10, size = 300, thicknessPct = 70
}) => {
  const colors = Array.from({length: segments}, (_, i) => {
    const h = Math.round(8 + (140 - 8) * (i / Math.max(1, segments - 1))); // vermelho→verde
    return `hsl(${h} 85% 50%)`;
  });
  const data = {
    labels: Array.from({length: segments}, (_, i) => i + 1),
    datasets: [{
      data: new Array(segments).fill(1),
      backgroundColor: colors,
      borderWidth: 0
    }]
  };
  const options = {
    responsive: true, maintainAspectRatio: false,
    rotation: -Math.PI,         // inicia na esquerda (topo)
    circumference: Math.PI,     // semicírculo
    cutout: `${clamp(thicknessPct, 40, 90)}%`,
    plugins: {
      legend: { display:false },
      tooltip: { enabled:false },
      gaugeNeedle: { value, min, max }
    }
  };
  return <div style={{ width: size, height: size*0.6 }}>
    <Doughnut data={data} options={options} plugins={[gaugeNeedle]} />
  </div>;
};

/* Distribuição CSAT como barra horizontal empilhada (5 segmentos) */
const CsatDistributionChart = ({ counts = {} }) => {
  const total = [1,2,3,4,5].reduce((a,k)=>a+(counts[k]||0),0) || 1;
  const datasets = [1,2,3,4,5].map((k, idx) => ({
    label: `${k}★`,
    data: [((counts[k]||0)/total)*100],
    stack: 'dist',
    backgroundColor: ['#ef4444','#f59e0b','#eab308','#22c55e','#16a34a'][idx],
    borderWidth: 0
  }));
  const data = { labels: [''], datasets };
  const options = {
    indexAxis: 'y', responsive: true, maintainAspectRatio: false,
    scales: {
      x: { stacked:true, min:0, max:100, ticks: { callback:(v)=>`${v}%` }, grid:{ display:false } },
      y: { stacked:true, grid:{ display:false } }
    },
    plugins: { legend:{ display:true, position:'bottom' }, tooltip:{ enabled:true, callbacks:{ label:(ctx)=>`${ctx.dataset.label}: ${fmtPct(ctx.raw,1)}` } } }
  };
  return <div style={{height:32}}><BarChartJS data={data} options={options} /></div>;
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

  // NPS / CSAT / Clientes
  const [nps, setNps] = useState({
    avgScore: 0, responses: 0,
    promoters: 0, passives: 0, detractors: 0,
    promPct: 0, passPct: 0, detrPct: 0,
    index: 0, available: false
  });
  const [csat, setCsat] = useState({ avg: 0, responses: 0, counts: {}, available: false });
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

        /* ======== NPS — média simples (0..10) + breakdown ======== */
        if (Array.isArray(npsRaw) && npsRaw.length > 0) {
          const avgs = npsRaw.map(b => toNum(b.avg_score)).filter(Number.isFinite);
          const avgScore = mean(avgs);

          const promoters  = sum(npsRaw.map(b => toNum(b.promoters_count)));
          const passives   = sum(npsRaw.map(b => toNum(b.passives_count)));
          const detractors = sum(npsRaw.map(b => toNum(b.detractors_count)));
          const responses  = sum(npsRaw.map(b => toNum(b.total))) || (promoters + passives + detractors);

          let promPct = 0, passPct = 0, detrPct = 0;
          if (responses > 0) {
            promPct = (promoters  / responses) * 100;
            passPct = (passives   / responses) * 100;
            detrPct = (detractors / responses) * 100;
          } else {
            promPct = mean(npsRaw.map(b => toNum(b.pct_promoters)));
            passPct = mean(npsRaw.map(b => toNum(b.pct_passives)));
            detrPct = mean(npsRaw.map(b => toNum(b.pct_detractors)));
          }
          const index = promPct - detrPct;

          setNps({
            avgScore,
            responses: fmtInt(responses || npsRaw.length),
            promoters: fmtInt(promoters),
            passives: fmtInt(passives),
            detractors: fmtInt(detractors),
            promPct, passPct, detrPct,
            index,
            available: true
          });
        } else {
          setNps((p)=>({ ...p, available:false }));
        }

        /* ======== CSAT — média simples (1..5) + distribuição ======== */
        if (Array.isArray(csatRaw) && csatRaw.length > 0) {
          const avgs = csatRaw.map(b => toNum(b.avg_score)).filter(Number.isFinite);
          const avgScore = mean(avgs);

          const counts = {
            1: sum(csatRaw.map(b => toNum(b.count_1))),
            2: sum(csatRaw.map(b => toNum(b.count_2))),
            3: sum(csatRaw.map(b => toNum(b.count_3))),
            4: sum(csatRaw.map(b => toNum(b.count_4))),
            5: sum(csatRaw.map(b => toNum(b.count_5))),
          };
          const responses = sum(csatRaw.map(b => toNum(b.total)));

          setCsat({ avg: avgScore, responses: fmtInt(responses || csatRaw.length), counts, available: true });
        } else {
          setCsat((p)=>({ ...p, available:false }));
        }

        /* ======== Clientes ======== */
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
            <DonutChart percent={abandonment && Number.isFinite(+abandonment.taxa_pct) ? (100 - +abandonment.taxa_pct) : 0} label="Dentro do SLA" />
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
              : <LineMini
                  labels={frtSerie.map(s=>s.xLabel)}
                  values={frtSerie.map(s=>s.y)}
                  height={180}
                  formatter={fmtMin}
                />}
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
              : <LineMini
                  labels={slaDia.map(s=>s.xLabel)}
                  values={slaDia.map(s=>s.y)}
                  height={180}
                  formatter={(v)=>fmtPct(v,0)}
                  yMax={100}
                />}
        </Card>
      </div>

      {/* NPS & CSAT — médias simples + breakdown */}
      <div className={styles.gridTwo}>
        <Card title="NPS (Média das notas 0–10)" icon={<Smile size={18} />}
              right={<span className={styles.kpill}>{fmtInt(nps.responses)} respostas</span>}
              help={`Velocímetro (canvas) com a **média simples** 0–10. Abaixo: Promotores/Neutros/Detratores e o **índice NPS** (promotores% − detratores%).`}>
          {firstLoad && loading ? <Skeleton w="100%" h={140} /> :
            nps.available ? (
              <>
                <GaugeChart value={nps.avgScore} min={0} max={10} segments={10} size={300} />
                <div className={styles.subtleCenter} style={{ marginTop: 6 }}>
                  Índice NPS: <strong>{Number(nps.index || 0).toFixed(1)}</strong>
                </div>
                <div className={styles.npsBreakdown} style={{ marginTop: 8 }}>
                  <span className={styles.kpillGreen}>Promotores: {fmtInt(nps.promoters)} ({fmtPct(nps.promPct)})</span>
                  <span className={styles.kpillAmber}>Neutros: {fmtInt(nps.passives)} ({fmtPct(nps.passPct)})</span>
                  <span className={styles.kpillRed}>Detratores: {fmtInt(nps.detractors)} ({fmtPct(nps.detrPct)})</span>
                </div>
              </>
            ) : <div className={styles.empty}>Sem dados de NPS para o período.</div>}
        </Card>

        <Card title="CSAT (Média 1–5)" icon={<Smile size={18} />}
              right={<span className={styles.kpill}>{fmtInt(csat.responses)} respostas</span>}
              help={`Velocímetro (canvas) com a **média simples** das notas 1–5 e barra de distribuição por estrelas.`}>
          {firstLoad && loading ? <Skeleton w="100%" h={140} /> :
            csat.available ? (
              <div>
                <GaugeChart value={csat.avg} min={1} max={5} segments={4} size={300} />
                {Object.values(csat.counts || {}).some(v => v > 0)
                  ? <div style={{ marginTop: 10 }}><CsatDistributionChart counts={csat.counts} /></div>
                  : null}
              </div>
            ) : <div className={styles.empty}>Sem dados de CSAT para o período.</div>}
        </Card>
      </div>

      {/* Novos clientes + Backlog */}
      <div className={styles.gridTwo}>
        <Card title="Novos clientes" icon={<Users size={18} />}
              right={<span className={styles.kpill}>{fmtInt(clientsTotal)} no período</span>}
              help={`Clientes únicos criados por dia no período.\n• Endpoint: /analytics/metrics/new-clients?group=day`}>
          {firstLoad && loading ? <Skeleton w="100%" h={220} /> :
            clientsSeries.length === 0 ? <div className={styles.empty}>Sem dados.</div> :
            <BarsMini
              labels={clientsSeries.map(d=>d.xLabel)}
              values={clientsSeries.map(d=>d.y)}
              height={220}
            />}
        </Card>

        <Card title="Backlog por fila (snapshot)" icon={<BarChart2 size={18} />}
              help={`Tickets abertos por fila no momento. Não depende do período.`}>
          {firstLoad && loading ? <Skeleton w="100%" h={200} /> :
            queuesBacklog.length === 0 ? <div className={styles.empty}>Sem dados.</div> :
            <ul className={styles.rankList}>
              {queuesBacklog.map((it, idx) => {
                const max = Math.max(...queuesBacklog.map(q=>q.value||0), 1);
                const w = (Number(it.value || 0) / max) * 100;
                return (
                  <li key={it.label + idx} className={styles.rankItem}>
                    <span className={styles.rankLabel} title={it.label}>{it.label}</span>
                    <div className={styles.rankBarWrap}><div className={styles.rankBar} style={{ width: `${w}%` }} /></div>
                    <span className={styles.rankValue}>{fmtInt(it.value)}</span>
                  </li>
                );
              })}
            </ul>}
        </Card>
      </div>

      {/* Tabelas */}
      <div className={styles.gridTwo}>
        <Card title="Tempo de resposta por agente (ART médio)" icon={<Users size={18} />}
              help={`ART por agente — tempo entre a msg do cliente e a 1ª resposta do agente.\n• Fonte: /analytics/metrics/agents/art`}>
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
