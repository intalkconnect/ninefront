import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { apiGet } from "../../../../shared/apiClient";
import { RefreshCcw, CalendarRange, Smile, MessageSquare } from "lucide-react";
// Reaproveita o visual do Dashboard (cards, tabelas, charts)
import styles from "./styles/Quality.module.css";

/* ========= Helpers ========= */
const toISO = (v) => (v ? new Date(v).toISOString() : null);
const fmtInt = (n) => (Number.isFinite(+n) ? Math.round(+n) : 0);
const fmtPct = (n, d = 1) => (Number.isFinite(+n) ? `${(+n).toFixed(d)}%` : "—");
const qs = (obj) =>
  Object.entries(obj)
    .filter(([, v]) => v !== null && v !== undefined && v !== "")
    .map(([k, v]) => `${encodeURIComponent(k)}=${encodeURIComponent(v)}`)
    .join("&");

const sum = (arr) => arr.reduce((a, b) => a + b, 0);
const mean = (arr) => (arr.length ? sum(arr) / arr.length : 0);
const toNum = (v) => (Number.isFinite(+v) ? +v : 0);

const useDebounce = (value, delay = 300) => {
  const [deb, setDeb] = useState(value);
  useEffect(() => {
    const t = setTimeout(() => setDeb(value), delay);
    return () => clearTimeout(t);
  }, [value, delay]);
  return deb;
};

const safeGet = async (url) => { try { return await apiGet(url); } catch { return null; } };

/* ========= UI básicos (mesmos do Dashboard) ========= */
const Card = ({ title, icon, help, right, children }) => (
  <div className={styles.card}>
    <div className={styles.cardHead}>
      <div className={styles.cardTitle}>
        {icon ? <span className={styles.cardIcon}>{icon}</span> : null}
        <span>{title}</span>
      </div>
      <div className={styles.cardRight}>{right}</div>
    </div>
    <div className={styles.cardBody}>{children}</div>
  </div>
);

const Skeleton = ({ w = "100%", h = 14, r = 10, className }) =>
  <div className={`${styles.skeleton} ${className || ""}`} style={{ width: w, height: h, borderRadius: r }} />;

/* ========= SegmentedGauge (reaproveitado) ========= */
const SegmentedGauge = ({
  value = 0, min = 0, max = 10, tickStep = 1, size = 300, stroke = 12, gapDeg = 3, format = (v) => v
}) => {
  const cx = 100, cy = 100, r = 80, vbW = 200, vbH = 120;
  const range = Math.max(0.0001, max - min);
  const normalized = Math.min(max, Math.max(min, value));
  const p = (normalized - min) / range;
  const pointerAngle = 180 * (1 - p);
  const pol = (deg, R = r) => { const a = (Math.PI / 180) * deg; return { x: cx + R * Math.cos(a), y: cy - R * Math.sin(a) }; };
  const arcPath = (startDeg, endDeg, radius = r) => {
    const s = pol(startDeg, radius), e = pol(endDeg, radius);
    const large = Math.abs(endDeg - startDeg) > 180 ? 1 : 0;
    return `M ${s.x} ${s.y} A ${radius} ${radius} 0 ${large} 1 ${e.x} ${e.y}`;
  };
  const segments = Math.round(range / tickStep);
  const segmentAngle = 180 / segments;
  const pointerTip = pol(pointerAngle, r - 6);
  const ticks = Array.from({ length: segments + 1 }, (_, i) => ({ angle: 180 - i * segmentAngle, value: min + i * tickStep }));
  const segColor = (i, total) => `hsl(${Math.round(8 + (132 * i) / Math.max(1, total - 1))}, 85%, 50%)`;

  return (
    <div style={{ width: "100%", display: "flex", flexDirection: "column", alignItems: "center" }}>
      <svg viewBox={`0 0 ${vbW} ${vbH}`} width={size} height={size * (vbH / vbW)} preserveAspectRatio="xMidYMid meet">
        <path d={arcPath(180, 0)} fill="none" stroke="#E5E7EB" strokeWidth={stroke} />
        {Array.from({ length: segments }, (_, i) => {
          const start = 180 - i * segmentAngle + gapDeg / 2;
          const end   = 180 - (i + 1) * segmentAngle - gapDeg / 2;
          return <path key={i} d={arcPath(start, end)} fill="none" stroke={segColor(i, segments)} strokeWidth={stroke} />;
        })}
        {ticks.map((t, i) => {
          const tickLen = 6;
          const inner = pol(t.angle, r - 2);
          const outer = pol(t.angle, r - 2 - tickLen);
          const label = pol(t.angle, r + 10);
          return (
            <g key={i}>
              <line x1={inner.x} y1={inner.y} x2={outer.x} y2={outer.y} stroke="#64748B" strokeWidth="1.5" />
              <text x={label.x} y={label.y - 3} fontSize="10" textAnchor="middle" fill="#475569" fontWeight="500">
                {Math.round(t.value)}
              </text>
            </g>
          );
        })}
        <line x1={cx} y1={cy} x2={pointerTip.x} y2={pointerTip.y} stroke="#0F172A" strokeWidth="3" strokeLinecap="round" />
        <circle cx={cx} cy={cy} r="3.5" fill="#0F172A" />
        <circle cx={cx} cy={cy} r="2" fill="#FFFFFF" />
      </svg>
      <div style={{ fontWeight: 700, fontSize: 20, marginTop: 4, color: "#0F172A" }}>{format(normalized)}</div>
    </div>
  );
};

/* ========= CSAT Distribution (reaproveitado) ========= */
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

/* ========= Normalização de feedback individual ========= */
function normalizeFeedback(raw) {
  if (!Array.isArray(raw)) return [];
  return raw.map((r, i) => {
    const ts = r.ts || r.timestamp || r.created_at || r.updated_at || r.date || r.datetime;
    const channel = r.channel || r.origin || r.source || "";
    const client = r.client || r.cliente || r.customer || r.user_id || r.contact || r.usuario || "—";
    const comment = r.comment || r.feedback || r.text || r.observacao || r.note || "";
    // nota
    const score = toNum(r.score ?? r.rating ?? r.value ?? r.nota ?? r.csat ?? r.nps);
    // tipo (tenta inferir)
    const type =
      (r.type && String(r.type).toUpperCase()) ||
      (Number.isFinite(score) && score >= 0 && score <= 10 && (r.nps !== undefined || r.metric === "NPS") ? "NPS" :
       Number.isFinite(score) && score >= 1 && score <= 5 ? "CSAT" :
       (r.metric && String(r.metric).toUpperCase()) || "NPS");
    return { id: r.id || `${client}-${i}`, ts, channel, client, comment, score, type };
  });
}

/* ========= Página ========= */
export default function Quality() {
  // período padrão: 1º dia do mês até agora
  const now = new Date();
  const firstMonthDay = new Date(now.getFullYear(), now.getMonth(), 1, 0, 0, 0);
  const [from, setFrom] = useState(firstMonthDay.toISOString().slice(0, 16));
  const [to, setTo] = useState(new Date().toISOString().slice(0, 16));

  const debFrom = useDebounce(from, 300);
  const debTo   = useDebounce(to, 300);

  // séries agregadas
  const [npsAgg, setNpsAgg]   = useState(null);
  const [csatAgg, setCsatAgg] = useState(null);

  // respostas individuais
  const [feedback, setFeedback] = useState([]);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState(null);
  const [refreshKey, setRefreshKey] = useState(0);

  const mounted = useRef(true);
  useEffect(() => () => { mounted.current = false; }, []);

  const load = useCallback(async () => {
    setLoading(true); setErr(null);
    try {
      const params = { from: toISO(debFrom), to: toISO(debTo) };

      // Séries (mesmos endpoints do Dashboard)
      const [npsRaw, csatRaw] = await Promise.all([
        safeGet(`/analytics/metrics/series/nps?${qs(params)}`),
        safeGet(`/analytics/metrics/series/csat?${qs(params)}`),
      ]);

      // Feedback individual — tenta múltiplos caminhos comuns
      const f1 = await safeGet(`/analytics/quality/responses?${qs(params)}`);
      const f2 = !Array.isArray(f1) ? await safeGet(`/analytics/metrics/quality/responses?${qs(params)}`) : null;
      const f3 = !Array.isArray(f1 || f2) ? await safeGet(`/analytics/metrics/feedback?${qs(params)}`) : null;
      const f4 = !Array.isArray(f1 || f2 || f3)
        ? await safeGet(`/analytics/metrics/surveys?${qs(params)}`) : null;

      const fb = normalizeFeedback((f1 && f1.data) || f1 || f2 || f3 || f4 || []);

      // === NPS agregado ===
      if (Array.isArray(npsRaw) && npsRaw.length) {
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
        setNpsAgg({ avg: avgScore, resp: fmtInt(responses || npsRaw.length), promPct, passPct, detrPct,
                    promoters: fmtInt(promoters), passives: fmtInt(passives), detractors: fmtInt(detractors) });
      } else {
        // fallback via feedback
        const npsOnly = fb.filter(x => x.type === "NPS" && Number.isFinite(x.score));
        const scores = npsOnly.map(x => x.score);
        const promoters  = npsOnly.filter(x => x.score >= 9).length;
        const passives   = npsOnly.filter(x => x.score >= 7 && x.score <= 8).length;
        const detractors = npsOnly.filter(x => x.score <= 6).length;
        const responses  = npsOnly.length;
        const promPct = responses ? (promoters / responses) * 100 : 0;
        const passPct = responses ? (passives / responses) * 100 : 0;
        const detrPct = responses ? (detractors / responses) * 100 : 0;
        setNpsAgg({ avg: mean(scores) || 0, resp: fmtInt(responses), promPct, passPct, detrPct,
                    promoters, passives, detractors });
      }

      // === CSAT agregado ===
      if (Array.isArray(csatRaw) && csatRaw.length) {
        const avgs = csatRaw.map(b => toNum(b.avg_score)).filter(Number.isFinite);
        const counts = {
          1: sum(csatRaw.map(b => toNum(b.count_1))),
          2: sum(csatRaw.map(b => toNum(b.count_2))),
          3: sum(csatRaw.map(b => toNum(b.count_3))),
          4: sum(csatRaw.map(b => toNum(b.count_4))),
          5: sum(csatRaw.map(b => toNum(b.count_5))),
        };
        const responses = sum(csatRaw.map(b => toNum(b.total)));
        setCsatAgg({ avg: mean(avgs) || 0, resp: fmtInt(responses || csatRaw.length), counts });
      } else {
        const csatOnly = fb.filter(x => x.type === "CSAT" && Number.isFinite(x.score));
        const counts = { 1:0,2:0,3:0,4:0,5:0 };
        csatOnly.forEach(x => { const k = Math.round(x.score); if (counts[k] !== undefined) counts[k]++; });
        setCsatAgg({ avg: mean(csatOnly.map(x => x.score)) || 0, resp: fmtInt(csatOnly.length), counts });
      }

      if (mounted.current) setFeedback(fb.sort((a,b) => (+new Date(b.ts||0)) - (+new Date(a.ts||0))));
    } catch (e) {
      console.error(e);
      if (mounted.current) setErr("Falha ao carregar qualidade. Verifique o período.");
    } finally {
      if (mounted.current) setLoading(false);
    }
  }, [debFrom, debTo]);

  useEffect(() => { if (debFrom && debTo) load(); }, [debFrom, debTo, refreshKey, load]);

  const fmtDate = (ts) => ts ? new Date(ts).toLocaleString("pt-BR") : "—";

  return (
    <div className={styles.container}>
      {/* Filtros */}
      <div className={styles.headerRow}>
        <div className={styles.filters}>
          <div className={styles.filterItem}>
            <label><CalendarRange size={14}/> De</label>
            <input type="datetime-local" value={from} onChange={(e) => setFrom(e.target.value)} />
          </div>
          <div className={styles.filterItem}>
            <label><CalendarRange size={14}/> Até</label>
            <input type="datetime-local" value={to} onChange={(e) => setTo(e.target.value)} />
          </div>
          <button
            className={styles.refreshBtn}
            disabled={loading}
            onClick={() => setRefreshKey(k => k + 1)}
            title="Atualizar"
          >
            <RefreshCcw size={16} className={loading ? styles.spinning : ""} />
            Atualizar
          </button>
        </div>
      </div>

      {/* Cabeçalho */}
      <div className={styles.header}>
        <div>
          <p className={styles.subtitle}>Qualidade de atendimento — NPS e CSAT.</p>
        </div>
      </div>

      {/* NPS / CSAT */}
      <div className={styles.gridTwo}>
        <Card
          title="NPS (média 0–10)"
          icon={<Smile size={18} />}
          right={<span className={styles.kpill}>{fmtInt(npsAgg?.resp || 0)} respostas</span>}
        >
          {loading && !npsAgg ? <Skeleton w="100%" h={140} /> : (
            <>
              <SegmentedGauge value={npsAgg?.avg || 0} min={0} max={10} tickStep={1} size={300} format={(v)=>Number(v).toFixed(2)} />
              <div className={styles.npsBreakdown} style={{ marginTop: 8 }}>
                <span className={styles.kpillGreen}>Promotores: {fmtInt(npsAgg?.promoters || 0)} ({fmtPct(npsAgg?.promPct || 0)})</span>
                <span className={styles.kpillAmber}>Neutros: {fmtInt(npsAgg?.passives || 0)} ({fmtPct(npsAgg?.passPct || 0)})</span>
                <span className={styles.kpillRed}>Detratores: {fmtInt(npsAgg?.detractors || 0)} ({fmtPct(npsAgg?.detrPct || 0)})</span>
              </div>
            </>
          )}
        </Card>

        <Card
          title="CSAT (média 1–5)"
          icon={<Smile size={18} />}
          right={<span className={styles.kpill}>{fmtInt(csatAgg?.resp || 0)} respostas</span>}
        >
          {loading && !csatAgg ? <Skeleton w="100%" h={140} /> : (
            <div>
              <SegmentedGauge value={csatAgg?.avg || 0} min={1} max={5} tickStep={1} size={300} format={(v)=>`${Number(v).toFixed(2)} ★`} />
              {csatAgg?.counts && <div style={{ marginTop: 10 }}><CsatDistribution counts={csatAgg.counts} /></div>}
            </div>
          )}
        </Card>
      </div>

      {/* Tabela de avaliações */}
      <Card
        title="Avaliações dos clientes"
        icon={<MessageSquare size={18} />}
        right={<span className={styles.kpill}>{fmtInt(feedback.length)} registros</span>}
      >
        <div className={styles.tableWrap}>
          <table className={styles.table}>
            <thead>
              <tr>
                <th>Data</th>
                <th>Cliente</th>
                <th>Canal</th>
                <th>Tipo</th>
                <th>Nota</th>
                <th>Comentário</th>
              </tr>
            </thead>
            <tbody>
              {loading && (
                <tr><td colSpan={6} className={styles.loading}>Carregando…</td></tr>
              )}
              {!loading && feedback.length === 0 && (
                <tr><td colSpan={6} className={styles.empty}>Nenhuma avaliação no período.</td></tr>
              )}
              {!loading && feedback.map((f) => (
                <tr key={f.id}>
                  <td>{fmtDate(f.ts)}</td>
                  <td>{f.client}</td>
                  <td>{f.channel || "—"}</td>
                  <td>{f.type}</td>
                  <td>{Number.isFinite(+f.score) ? f.score : "—"}</td>
                  <td style={{ maxWidth: 520, whiteSpace: "pre-wrap", wordBreak: "break-word" }}>
                    {f.comment ? f.comment : <span className={styles.subtleCenter}>—</span>}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {err && <div className={styles.alertErr} role="alert">⚠️ {err}</div>}
      </Card>
    </div>
  );
}
