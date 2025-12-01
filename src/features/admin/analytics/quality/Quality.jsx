import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { apiGet } from "../../../../shared/apiClient";
import {
  RefreshCcw,
  CalendarRange,
  Smile,
  MessageSquare,
} from "lucide-react";
import { toast } from "react-toastify";

import styles from "../../styles/AdminUI.module.css";

/* ========= Helpers ========= */
const toISO = (v) => (v ? new Date(v).toISOString() : null);
const fmtInt = (n) => (Number.isFinite(+n) ? Math.round(+n) : 0);
const fmtPct = (n, d = 1) =>
  Number.isFinite(+n) ? `${(+n).toFixed(d)}%` : "—";
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

const safeGet = async (url) => {
  try {
    return await apiGet(url);
  } catch {
    return null;
  }
};

/* ========= UI básicos (cards no padrão adminUi) ========= */
const Card = ({ title, icon, right, children }) => (
  <div className={styles.card}>
    <div className={styles.cardHead}>
      <div className={styles.cardTitle}>
        {icon ? <span className={styles.cardIcon}>{icon}</span> : null}
        <span>{title}</span>
      </div>
      {right && <div>{right}</div>}
    </div>
    <div className={styles.cardBody}>{children}</div>
  </div>
);

const Skeleton = ({ w = "100%", h = 14, r = 10, className }) => (
  <div
    className={`${styles.skeleton} ${className || ""}`}
    style={{ width: w, height: h, borderRadius: r }}
  />
);

/* ========= SegmentedGauge ========= */
const SegmentedGauge = ({
  value = 0,
  min = 0,
  max = 10,
  tickStep = 1,
  size = 300,
  stroke = 12,
  gapDeg = 3,
  format = (v) => v,
}) => {
  const cx = 100;
  const cy = 100;
  const r = 80;
  const vbW = 200;
  const vbH = 120;

  const range = Math.max(0.0001, max - min);
  const normalized = Math.min(max, Math.max(min, value));
  const p = (normalized - min) / range;
  const pointerAngle = 180 * (1 - p);

  const pol = (deg, R = r) => {
    const a = (Math.PI / 180) * deg;
    return { x: cx + R * Math.cos(a), y: cy - R * Math.sin(a) };
  };

  const arcPath = (startDeg, endDeg, radius = r) => {
    const s = pol(startDeg, radius);
    const e = pol(endDeg, radius);
    const large = Math.abs(endDeg - startDeg) > 180 ? 1 : 0;
    return `M ${s.x} ${s.y} A ${radius} ${radius} 0 ${large} 1 ${e.x} ${e.y}`;
  };

  const segments = Math.round(range / tickStep);
  const segmentAngle = 180 / segments;
  const pointerTip = pol(pointerAngle, r - 6);
  const ticks = Array.from({ length: segments + 1 }, (_, i) => ({
    angle: 180 - i * segmentAngle,
    value: min + i * tickStep,
  }));
  const segColor = (i, total) =>
    `hsl(${Math.round(
      8 + (132 * i) / Math.max(1, total - 1)
    )}, 85%, 50%)`;

  return (
    <div
      style={{
        width: "100%",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        gap: 8,
      }}
    >
      <svg
        viewBox={`0 0 ${vbW} ${vbH}`}
        width={size}
        height={size * (vbH / vbW)}
        preserveAspectRatio="xMidYMid meet"
      >
        <path
          d={arcPath(180, 0)}
          fill="none"
          stroke="#1f2937"
          strokeWidth={stroke}
        />
        {Array.from({ length: segments }, (_, i) => {
          const start = 180 - i * segmentAngle + gapDeg / 2;
          const end = 180 - (i + 1) * segmentAngle - gapDeg / 2;
          return (
            <path
              key={i}
              d={arcPath(start, end)}
              fill="none"
              stroke={segColor(i, segments)}
              strokeWidth={stroke}
            />
          );
        })}
        {ticks.map((t, i) => {
          const tickLen = 6;
          const inner = pol(t.angle, r - 2);
          const outer = pol(t.angle, r - 2 - tickLen);
          const label = pol(t.angle, r + 10);
          return (
            <g key={i}>
              <line
                x1={inner.x}
                y1={inner.y}
                x2={outer.x}
                y2={outer.y}
                stroke="#64748B"
                strokeWidth="1.5"
              />
              <text
                x={label.x}
                y={label.y - 3}
                fontSize="10"
                textAnchor="middle"
                fill="#9ca3af"
                fontWeight="500"
              >
                {Math.round(t.value)}
              </text>
            </g>
          );
        })}
        <line
          x1={cx}
          y1={cy}
          x2={pointerTip.x}
          y2={pointerTip.y}
          stroke="#f9fafb"
          strokeWidth="3"
          strokeLinecap="round"
        />
        <circle cx={cx} cy={cy} r="3.5" fill="#020617" />
        <circle cx={cx} cy={cy} r="2" fill="#ffffff" />
      </svg>
      <div className={styles.kpiValue}>{format(normalized)}</div>
    </div>
  );
};

/* ========= CSAT Distribution ========= */
const CsatDistribution = ({ counts = {} }) => {
  const total = [1, 2, 3, 4, 5].reduce(
    (a, k) => a + (counts[k] || 0),
    0
  );

  const colorFor = (k) => {
    switch (k) {
      case 1:
        return "#ef4444";
      case 2:
        return "#fb923c";
      case 3:
        return "#facc15";
      case 4:
        return "#22c55e";
      case 5:
      default:
        return "#22c55e";
    }
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
      <div
        style={{
          display: "flex",
          width: "100%",
          height: 10,
          borderRadius: 999,
          overflow: "hidden",
          background: "#020617",
          border: "1px solid #1f2937",
        }}
      >
        {[1, 2, 3, 4, 5].map((k) => {
          const v = counts[k] || 0;
          const w = total ? (v / total) * 100 : 0;
          return (
            <span
              key={k}
              style={{
                width: `${w}%`,
                backgroundColor: colorFor(k),
                opacity: 0.8,
              }}
              title={`${k}★: ${v}`}
            />
          );
        })}
      </div>
      <div
        style={{
          display: "flex",
          flexWrap: "wrap",
          gap: 10,
          fontSize: 12,
        }}
      >
        {[1, 2, 3, 4, 5].map((k) => (
          <span key={k} className={styles.subtle}>
            <span
              style={{
                display: "inline-block",
                width: 8,
                height: 8,
                borderRadius: "999px",
                marginRight: 6,
                backgroundColor: colorFor(k),
              }}
            />
            {k}★
          </span>
        ))}
      </div>
    </div>
  );
};

/* ========= Normalização de feedback individual ========= */
function normalizeFeedback(raw) {
  if (!Array.isArray(raw)) return [];
  return raw.map((r, i) => {
    const ts =
      r.ts ||
      r.timestamp ||
      r.created_at ||
      r.updated_at ||
      r.date ||
      r.datetime;

    const channel = r.channel || r.origin || r.source || "";
    const client =
      r.client ||
      r.cliente ||
      r.customer ||
      r.user_id ||
      r.contact ||
      r.usuario ||
      "—";
    const comment =
      r.comment ||
      r.feedback ||
      r.text ||
      r.observacao ||
      r.note ||
      "";

    const score = toNum(
      r.score ?? r.rating ?? r.value ?? r.nota ?? r.csat ?? r.nps
    );

    const type =
      (r.type && String(r.type).toUpperCase()) ||
      (Number.isFinite(score) &&
      score >= 0 &&
      score <= 10 &&
      (r.nps !== undefined || r.metric === "NPS")
        ? "NPS"
        : Number.isFinite(score) &&
          score >= 1 &&
          score <= 5
        ? "CSAT"
        : (r.metric && String(r.metric).toUpperCase()) || "NPS");

    return {
      id: r.id || `${client}-${i}`,
      ts,
      channel,
      client,
      comment,
      score,
      type,
    };
  });
}

/* ========= Página ========= */
export default function Quality() {
  // período padrão: 1º dia do mês até agora
  const now = new Date();
  const firstMonthDay = new Date(
    now.getFullYear(),
    now.getMonth(),
    1,
    0,
    0,
    0
  );

  const [from, setFrom] = useState(
    firstMonthDay.toISOString().slice(0, 16)
  );
  const [to, setTo] = useState(new Date().toISOString().slice(0, 16));

  const debFrom = useDebounce(from, 300);
  const debTo = useDebounce(to, 300);

  const [npsAgg, setNpsAgg] = useState(null);
  const [csatAgg, setCsatAgg] = useState(null);
  const [feedback, setFeedback] = useState([]);
  const [loading, setLoading] = useState(false);
  const [refreshKey, setRefreshKey] = useState(0);

  const mounted = useRef(true);
  useEffect(
    () => () => {
      mounted.current = false;
    },
    []
  );

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const params = { from: toISO(debFrom), to: toISO(debTo) };

      // séries agregadas
      const [npsRaw, csatRaw] = await Promise.all([
        safeGet(`/analytics/metrics/series/nps?${qs(params)}`),
        safeGet(`/analytics/metrics/series/csat?${qs(params)}`),
      ]);

      // feedback individual
      const res = await safeGet(
        `/analytics/metrics/feedback/responses?${qs(params)}`
      );
      const fb = normalizeFeedback(res?.data || []);

      /* ---- NPS ---- */
      if (Array.isArray(npsRaw) && npsRaw.length) {
        const avgs = npsRaw
          .map((b) => toNum(b.avg_score))
          .filter(Number.isFinite);
        const avgScore = mean(avgs);

        const promoters = sum(
          npsRaw.map((b) => toNum(b.promoters_count))
        );
        const passives = sum(
          npsRaw.map((b) => toNum(b.passives_count))
        );
        const detractors = sum(
          npsRaw.map((b) => toNum(b.detractors_count))
        );
        const responses =
          sum(npsRaw.map((b) => toNum(b.total))) ||
          promoters + passives + detractors;

        let promPct = 0;
        let passPct = 0;
        let detrPct = 0;
        if (responses > 0) {
          promPct = (promoters / responses) * 100;
          passPct = (passives / responses) * 100;
          detrPct = (detractors / responses) * 100;
        } else {
          promPct = mean(
            npsRaw.map((b) => toNum(b.pct_promoters))
          );
          passPct = mean(
            npsRaw.map((b) => toNum(b.pct_passives))
          );
          detrPct = mean(
            npsRaw.map((b) => toNum(b.pct_detractors))
          );
        }

        setNpsAgg({
          avg: avgScore,
          resp: fmtInt(responses || npsRaw.length),
          promPct,
          passPct,
          detrPct,
          promoters: fmtInt(promoters),
          passives: fmtInt(passives),
          detractors: fmtInt(detractors),
        });
      } else {
        // fallback via feedback
        const npsOnly = fb.filter(
          (x) => x.type === "NPS" && Number.isFinite(x.score)
        );
        const scores = npsOnly.map((x) => x.score);
        const promoters = npsOnly.filter((x) => x.score >= 9).length;
        const passives = npsOnly.filter(
          (x) => x.score >= 7 && x.score <= 8
        ).length;
        const detractors = npsOnly.filter((x) => x.score <= 6).length;
        const responses = npsOnly.length;

        const promPct = responses
          ? (promoters / responses) * 100
          : 0;
        const passPct = responses
          ? (passives / responses) * 100
          : 0;
        const detrPct = responses
          ? (detractors / responses) * 100
          : 0;

        setNpsAgg({
          avg: mean(scores) || 0,
          resp: fmtInt(responses),
          promPct,
          passPct,
          detrPct,
          promoters,
          passives,
          detractors,
        });
      }

      /* ---- CSAT ---- */
      if (Array.isArray(csatRaw) && csatRaw.length) {
        const avgs = csatRaw
          .map((b) => toNum(b.avg_score))
          .filter(Number.isFinite);

        const counts = {
          1: sum(csatRaw.map((b) => toNum(b.count_1))),
          2: sum(csatRaw.map((b) => toNum(b.count_2))),
          3: sum(csatRaw.map((b) => toNum(b.count_3))),
          4: sum(csatRaw.map((b) => toNum(b.count_4))),
          5: sum(csatRaw.map((b) => toNum(b.count_5))),
        };

        const responses = sum(
          csatRaw.map((b) => toNum(b.total))
        );

        setCsatAgg({
          avg: mean(avgs) || 0,
          resp: fmtInt(responses || csatRaw.length),
          counts,
        });
      } else {
        const csatOnly = fb.filter(
          (x) => x.type === "CSAT" && Number.isFinite(x.score)
        );
        const counts = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 };
        csatOnly.forEach((x) => {
          const k = Math.round(x.score);
          if (counts[k] !== undefined) counts[k]++;
        });

        setCsatAgg({
          avg: mean(csatOnly.map((x) => x.score)) || 0,
          resp: fmtInt(csatOnly.length),
          counts,
        });
      }

      if (mounted.current) {
        setFeedback(
          fb.sort(
            (a, b) => +new Date(b.ts || 0) - +new Date(a.ts || 0)
          )
        );
      }
    } catch (e) {
      if (mounted.current) {
        toast.error(
          "Falha ao carregar qualidade. Verifique o período."
        );
      }
    } finally {
      if (mounted.current) setLoading(false);
    }
  }, [debFrom, debTo]);

  useEffect(() => {
    if (debFrom && debTo) load();
  }, [debFrom, debTo, refreshKey, load]);

  const fmtDate = (ts) =>
    ts ? new Date(ts).toLocaleString("pt-BR") : "—";

  return (
    <div className={styles.page}>
      <div className={styles.container}>
        {/* HEADER padrão adminUi */}
        <div className={styles.header}>
          <div className={styles.titleRow}>
            <h1 className={styles.title}>Monitor de Qualidade</h1>
            <p className={styles.subtitle}>
              Qualidade de atendimento — NPS e CSAT.
            </p>
          </div>

          <button
            className={styles.refreshBtn}
            disabled={loading}
            onClick={() => setRefreshKey((k) => k + 1)}
            title="Atualizar agora"
          >
            <RefreshCcw
              size={16}
              className={loading ? styles.spinning : ""}
            />
          </button>
        </div>

        {/* FILTROS (card) */}
        <section className={styles.filters}>
          <div className={styles.filterRow}>
            <div className={styles.filterGroup}>
              <div className={styles.filterTitle}>
                <CalendarRange size={14} />{" "}
                <span style={{ marginLeft: 6 }}>De</span>
              </div>
              <input
                type="datetime-local"
                className={styles.input}
                value={from}
                onChange={(e) => setFrom(e.target.value)}
              />
            </div>

            <div className={styles.filterGroup}>
              <div className={styles.filterTitle}>
                <CalendarRange size={14} />{" "}
                <span style={{ marginLeft: 6 }}>Até</span>
              </div>
              <input
                type="datetime-local"
                className={styles.input}
                value={to}
                onChange={(e) => setTo(e.target.value)}
              />
            </div>
          </div>
        </section>

        {/* NPS / CSAT cards */}
        <section className={styles.gridTwo}>
          <Card
            title="NPS (média 0–10)"
            icon={<Smile size={18} />}
            right={
              <span className={styles.kpill}>
                {fmtInt(npsAgg?.resp || 0)} respostas
              </span>
            }
          >
            {loading && !npsAgg ? (
              <Skeleton w="100%" h={140} />
            ) : (
              <>
                <SegmentedGauge
                  value={npsAgg?.avg || 0}
                  min={0}
                  max={10}
                  tickStep={1}
                  size={300}
                  format={(v) => Number(v).toFixed(2)}
                />
                <div
                  style={{
                    display: "flex",
                    flexWrap: "wrap",
                    gap: 8,
                    marginTop: 12,
                  }}
                >
                  <span
                    className={`${styles.pill} ${styles.pillOk}`}
                  >
                    Promotores: {fmtInt(npsAgg?.promoters || 0)} (
                    {fmtPct(npsAgg?.promPct || 0)})
                  </span>
                  <span
                    className={`${styles.pill} ${styles.pillWarn}`}
                  >
                    Neutros: {fmtInt(npsAgg?.passives || 0)} (
                    {fmtPct(npsAgg?.passPct || 0)})
                  </span>
                  <span
                    className={`${styles.pill} ${styles.pillErr}`}
                  >
                    Detratores: {fmtInt(npsAgg?.detractors || 0)} (
                    {fmtPct(npsAgg?.detrPct || 0)})
                  </span>
                </div>
              </>
            )}
          </Card>

          <Card
            title="CSAT (média 1–5)"
            icon={<MessageSquare size={18} />}
            right={
              <span className={styles.kpill}>
                {fmtInt(csatAgg?.resp || 0)} respostas
              </span>
            }
          >
            {loading && !csatAgg ? (
              <Skeleton w="100%" h={140} />
            ) : (
              <>
                <SegmentedGauge
                  value={csatAgg?.avg || 0}
                  min={1}
                  max={5}
                  tickStep={1}
                  size={300}
                  format={(v) => `${Number(v).toFixed(2)} ★`}
                />
                {csatAgg?.counts && (
                  <div style={{ marginTop: 10 }}>
                    <CsatDistribution counts={csatAgg.counts} />
                  </div>
                )}
              </>
            )}
          </Card>
        </section>

        {/* Tabela de avaliações */}
        <section className={styles.tableCard}>
          <div className={styles.tableHeader}>
            <h2 className={styles.tableTitle}>
              Avaliações dos clientes
            </h2>
            <span className={styles.kpill}>
              {fmtInt(feedback.length)} registros
            </span>
          </div>

          <div className={styles.tableScroll}>
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
                  <tr>
                    <td colSpan={6} className={styles.loading}>
                      Carregando…
                    </td>
                  </tr>
                )}

                {!loading && feedback.length === 0 && (
                  <tr>
                    <td colSpan={6} className={styles.empty}>
                      Nenhuma avaliação no período.
                    </td>
                  </tr>
                )}

                {!loading &&
                  feedback.map((f) => (
                    <tr key={f.id}>
                      <td>{fmtDate(f.ts)}</td>
                      <td>{f.client}</td>
                      <td>{f.channel || "—"}</td>
                      <td>{f.type}</td>
                      <td>
                        {Number.isFinite(+f.score) ? f.score : "—"}
                      </td>
                      <td className={styles.commentCell}>
                        {f.comment ? (
                          f.comment
                        ) : (
                          <span className={styles.subtleCenter}>
                            —
                          </span>
                        )}
                      </td>
                    </tr>
                  ))}
              </tbody>
            </table>
          </div>
        </section>
      </div>
    </div>
  );
}
