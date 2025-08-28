// File: dashboard/Dashboard.jsx
import React, { useEffect, useMemo, useRef, useState } from 'react';
import { apiGet } from '../../../shared/apiClient';
import {
  Info, TrendingUp, Clock, Users, BarChart2,
  LineChart as LineIcon, Activity, AlertTriangle, Gauge, Smile, LayoutDashboard,
} from 'lucide-react';
import styles from './styles/Dashboard.module.css';

/* ===== Helpers ===== */
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

/* ===== Tooltip ===== */
/* ===== Tooltip ===== */
const HelpIcon = ({ text, className }) => {
  if (!text) return null; // evita render quando não há texto

  const ref = useRef(null);
  const [pos, setPos] = useState('top');

  const onEnter = () => {
    const el = ref.current;
    if (!el) return;
    const TIP_W = 260, PAD = 12;
    const rect = el.getBoundingClientRect();
    const midX = rect.left + rect.width / 2;
    const vw = window.innerWidth;
    if (midX + TIP_W / 2 + PAD > vw) setPos('top-right');
    else if (midX - TIP_W / 2 - PAD < 0) setPos('top-left');
    else setPos('top');
  };

  return (
    <span
      ref={ref}
      onMouseEnter={onEnter}
      className={`${styles.help} ${className || ''}`}
      data-tooltip={text}
      data-pos={pos}
      aria-label="Ajuda"
      role="img"
    >
      <Info size={16} />
    </span>
  );
};


/* ===== UI ===== */
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

/* ===== Skeleton ===== */
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
    <div className={styles.cardBody}><Skeleton w="100%" h={90} /></div>
  </div>
);

/* ===== Gráficos leves ===== */
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
  const stepX = 48, padding = 10;
  const width = Math.max(2 * padding + stepX * Math.max(0, data.length - 1), 100);
  const points = data.map((d, i) => {
    const x = padding + i * stepX;
    const y = padding + (1 - (+d.y || 0) / max) * (height - 2 * padding);
    return `${x},${y}`;
  });
  return (
    <div className={styles.lineWrap}>
      <svg width={width} height={height} className={styles.lineSvg}>
        <polyline points={points.join(' ')} fill="none" stroke="currentColor" strokeWidth="2" className={styles.lineStroke}/>
        {data.map((d, i) => {
          const x = padding + i * stepX;
          const y = padding + (1 - (+d.y || 0) / max) * (height - 2 * padding);
          return <circle key={i} cx={x} cy={y} r="3" className={styles.lineDot} />;
        })}
      </svg>
      <div className={styles.lineXAxis}>
        {data.map((d, i) => <div key={i} className={styles.lineTick} style={{ width: stepX }}>{d.xLabel}</div>)}
      </div>
    </div>
  );
};
const Donut = ({ percent = 0, size = 132, stroke = 14, label }) => {
  const p = Math.min(100, Math.max(0, +percent || 0));
  const r = (size - stroke) / 2, c = 2 * Math.PI * r, dash = (p / 100) * c;
  return (
    <div className={styles.donutWrap} title={`${label || 'Percentual'}: ${fmtPct(p)}`}>
      <svg width={size} height={size}>
        <circle className={styles.donutBg} cx={size/2} cy={size/2} r={r} strokeWidth={stroke} fill="none"/>
        <circle className={styles.donutFg} cx={size/2} cy={size/2} r={r} strokeWidth={stroke}
                fill="none" strokeDasharray={`${dash} ${c - dash}`} strokeLinecap="round"
                transform={`rotate(-90 ${size/2} ${size/2})`}/>
        <text x="50%" y="50%" textAnchor="middle" dominantBaseline="central" className={styles.donutText}>
          {fmtPct(p)}
        </text>
      </svg>
      {label ? <div className={styles.donutLabel}>{label}</div> : null}
    </div>
  );
};

/* ===== NPS & CSAT helpers ===== */
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

/* ===== Página ===== */
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

  // novos
  const [nps, setNps]   = useState({ score: 0, promoters: 0, passives: 0, detractors: 0, responses: 0, available: false });
  const [csat, setCsat] = useState({ pct: 0, avg: 0, responses: 0, counts: {}, available: false });
  const [clientsSeries, setClientsSeries] = useState([]);   // novos clientes / dia

  const [loading, setLoading] = useState(false);
  const [erro, setErro] = useState(null);
  const [firstLoad, setFirstLoad] = useState(true);

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
          safeGet(`/analytics/metrics/nps?${qs(params)}`),
          safeGet(`/analytics/metrics/csat?${qs(params)}`),
        ]);

        // Novos clientes por dia (endpoint opcional – ver sugestão de backend abaixo)
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
  }, [debFrom, debTo]);

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

  /* ===== Render ===== */
  return (
    <div className={styles.container}>
      {/* Indicador da página */}
      <div className={styles.crumbBar}>
        <span className={styles.crumb}><LayoutDashboard size={14} /> <span>Dashboard</span></span>
        {erro ? <span className={styles.crumbError}>• {erro}</span> : null}
      </div>

      {/* Filtros */}
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
        </div>
      </div>

      {/* KPIs */}
      {firstLoad && loading ? (
        <div className={styles.statRow}><SkeletonCard /><SkeletonCard /><SkeletonCard /></div>
      ) : (
        <div className={styles.statRow}>
          <Card title="Tickets criados (período)" icon={<TrendingUp size={18} />} help="Quantidade total de tickets criados no intervalo selecionado.">
            <Stat label="Criados" value={fmtInt(totalCriados)} tone="blue" />
          </Card>
          <Card title="Backlog atual" icon={<Activity size={18} />} help="Quantidade de tickets abertos no momento (snapshot).">
            <div className={styles.statsGrid3}>
              <Stat label="Abertos" value={backlogAberto} tone="purple" />
              <Stat label="Aguardando" value={aguardando} tone="amber" />
              <Stat label="Em atendimento" value={emAtendimento} tone="green" />
            </div>
          </Card>
          <Card title="SLA de 1ª resposta (15m)" icon={<Gauge size={18} />} help="Percentual de tickets respondidos em até 15 minutos (por dia) no período. Abaixo, donut mostra o inverso do abandono.">
            <Donut percent={abandonment && Number.isFinite(+abandonment.taxa_pct) ? (100 - +abandonment.taxa_pct) : 0} label="Dentro do SLA" />
            <div className={styles.subtleCenter}>Abandono: {fmtPct(abandonment?.taxa_pct ?? 0)} • Limite {abandonment?.threshold_min ?? 15}m</div>
          </Card>
        </div>
      )}

      {/* NPS & CSAT */}
      <div className={styles.gridTwo}>
        <Card title="NPS (Net Promoter Score)" icon={<Smile size={18} />} help="NPS no período selecionado. Marcador indica a posição em –100 a 100."
              right={<span className={styles.kpill}>{fmtInt(nps.responses)} respostas</span>}>
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

        <Card title="CSAT (Satisfação do Cliente)" icon={<Smile size={18} />} help="Percentual de avaliações satisfeitas (4★ e 5★) no período."
              right={<span className={styles.kpill}>{csat.responses ? `${fmtInt(csat.responses)} respostas` : 'sem respostas'}</span>}>
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

      {/* Novos clientes + Backlog por fila */}
      <div className={styles.gridTwo}>
        <Card title="Novos clientes" icon={<Users size={18} />} help="Clientes únicos criados (tabela clientes) por dia no período."
              right={<span className={styles.kpill}>{fmtInt(clientsTotal)} no período</span>}>
          {firstLoad && loading ? <Skeleton w="100%" h={220} /> :
            clientsSeries.length === 0 ? <div className={styles.empty}>Sem dados para o período.</div> :
            <LineChart data={clientsSeries} formatter={(v) => fmtInt(v)} />}
        </Card>

        <Card title="Backlog por fila (snapshot)" icon={<BarChart2 size={18} />} help="Quantidade de tickets abertos por fila no momento (snapshot atual).">
          {firstLoad && loading ? <Skeleton w="100%" h={180} /> :
            queuesBacklog.length === 0 ? <div className={styles.empty}>Sem dados.</div> :
            <BarChart data={queuesBacklog} formatter={(v) => fmtInt(v)} />}
        </Card>
      </div>

      {/* TABELAS puras (sem gráfico) */}
      <div className={styles.gridTwo}>
        <Card title="Tempo de resposta por agente (ART médio)" icon={<Users size={18} />}
              help="ART médio por agente — tempo entre uma mensagem do cliente e a primeira resposta do agente.">
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
              help="Tempo médio do ciclo de conversa por fila no período.">
          {firstLoad && loading ? <Skeleton w="100%" h={160} /> :
            durationRows.length === 0 ? <div className={styles.empty}>Sem dados para o período.</div> :
            <div className={styles.tableWrap}>
              <table className={styles.table}>
                <thead><tr><th>Fila</th><th>Duração média</th><th>P90</th></tr></thead>
                <tbody>
                  {durationRows.map((d) => (
                    <tr key={d.fila || '-'}>
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

      {/* Aging (tabela) */}
      <div className={styles.gridTwo}>
        <Card title="Aging do backlog por fila (snapshot)" icon={<Activity size={18} />}
              help="Distribuição dos tickets abertos por faixas de idade (0–15m, 15–30m, 30–60m, 1–4h, >4h).">
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

