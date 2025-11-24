// File: BillingExtrato.jsx
import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { apiGet } from "../../../../shared/apiClient";
import {
  CalendarRange,
  Download,
  RefreshCcw,
  Users,
  DollarSign,
  PieChart,
} from "lucide-react";
import { toast } from "react-toastify";
import styles from "./styles/BillingExtrato.module.css";

/* ========================= Helpers ========================= */
const toISO = (v) => (v ? new Date(v).toISOString() : null);
const fmtInt = (n) => (Number.isFinite(+n) ? Math.round(+n) : 0);
const BRL = (v) => {
  const cents = Number.isFinite(+v) ? +v : 0;
  return (cents / 100).toLocaleString("pt-BR", {
    style: "currency",
    currency: "BRL",
  });
};
const qs = (obj) =>
  Object.entries(obj)
    .filter(([, v]) => v !== null && v !== undefined && v !== "")
    .map(([k, v]) => `${encodeURIComponent(k)}=${encodeURIComponent(v)}`)
    .join("&");

const useDebounce = (value, delay = 300) => {
  const [deb, setDeb] = useState(value);
  useEffect(() => {
    const t = setTimeout(() => setDeb(value), delay);
    return () => clearTimeout(t);
  }, [value, delay]);
  return deb;
};

// ===== CSV helpers =====
const CSV_DELIM = ";";

const escapeCSV = (val) => {
  if (val === null || val === undefined) return "";
  const s = String(val);
  const needsQuotes =
    s.includes('"') ||
    s.includes("\n") ||
    s.includes("\r") ||
    s.includes(CSV_DELIM);
  const esc = s.replace(/"/g, '""');
  return needsQuotes ? `"${esc}"` : esc;
};

const pickCents = (row) => {
  if (Number.isFinite(+row?.amount_cents)) return +row.amount_cents;
  if (Number.isFinite(+row?.total_cents)) return +row.total_cents;
  if (Number.isFinite(+row?.total_value_cents)) return +row.total_value_cents;
  if (Number.isFinite(+row?.cents)) return +row.cents;
  if (Number.isFinite(+row?.total_brl)) return Math.round(+row.total_brl * 100);
  return 0;
};
const pickSessions = (row) => {
  const cands = [row?.sessions, row?.windows, row?.billing_windows, row?.janelas];
  const v = cands.find((x) => Number.isFinite(+x));
  return Number.isFinite(+v) ? +v : 0;
};
const pickFirstTs = (row) =>
  row?.first_ref_ts ||
  row?.first_incoming_at ||
  row?.first_at ||
  row?.start_at ||
  row?.min_ts ||
  row?.first_msg_at;
const pickLastTs = (row) =>
  row?.last_ref_ts ||
  row?.last_incoming_at ||
  row?.last_at ||
  row?.end_at ||
  row?.max_ts ||
  row?.last_msg_at;

const buildCsvFromState = (data) => {
  const headers = [
    "User ID",
    "Canal",
    "Janelas",
    "Primeira Mensagem",
    "Última Mensagem",
    "Total (R$)",
  ];
  const lines = (data?.rows || []).map((row) => {
    const cents = pickCents(row);
    const sess = pickSessions(row);
    const first = pickFirstTs(row);
    const last = pickLastTs(row);
    return [
      escapeCSV(row.user_id || row.user || ""),
      escapeCSV(row.channel || "default"),
      escapeCSV(fmtInt(sess)),
      escapeCSV(first ? new Date(first).toLocaleString("pt-BR") : ""),
      escapeCSV(last ? new Date(last).toLocaleString("pt-BR") : ""),
      escapeCSV(BRL(cents).replace("R$", "").trim()),
    ].join(CSV_DELIM);
  });

  return "\uFEFF" + [headers.join(CSV_DELIM), ...lines].join("\n");
};

const downloadBlob = (data, filename, mime = "text/csv;charset=utf-8") => {
  const blob = data instanceof Blob ? data : new Blob([data], { type: mime });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
};

/* ========================= SVG dos canais ========================= */

const ChannelIcon = ({ channel }) => {
  const ch = String(channel || "default").toLowerCase();

  if (ch === "whatsapp") {
    return (
      <span className={styles.channelIconWrap} title="WhatsApp">
        <svg viewBox="0 0 32 32" className={styles.channelIcon}>
          <circle cx="16" cy="16" r="16" fill="#22c55e" />
          <path
            d="M16 7a7 7 0 0 0-6.02 10.58L9 25l2.49-.65A7 7 0 1 0 16 7z"
            fill="#022c22"
          />
          <path
            d="M18.9 18.3c-.4.22-1.1.47-1.58.53-.4.05-.92.09-1.49-.09-.34-.1-.78-.25-1.3-.5-2.29-1.12-3.77-3.73-3.88-3.9-.11-.16-.93-1.24-.93-2.37 0-1.13.59-1.68.8-1.9.21-.22.46-.28.62-.28.16 0 .31.01.44.01.14.01.33-.05.51.39.19.45.64 1.55.69 1.66.05.11.08.24.02.4-.06.16-.09.24-.18.37-.09.13-.19.28-.27.38-.09.1-.18.21-.08.4.1.19.46.76.99 1.23.68.6 1.26.79 1.45.88.19.08.3.07.41-.04.11-.11.48-.56.6-.75.13-.19.26-.16.44-.1.19.07 1.19.56 1.39.66.2.1.34.15.39.23.05.07.05.83-.35 1.05z"
            fill="#a7f3d0"
          />
        </svg>
      </span>
    );
  }

  if (ch === "facebook") {
    return (
      <span className={styles.channelIconWrap} title="Facebook">
        <svg viewBox="0 0 32 32" className={styles.channelIcon}>
          <circle cx="16" cy="16" r="16" fill="#2563eb" />
          <path
            d="M18 9h2V5h-2c-3.31 0-6 2.69-6 6v2H9v4h3v8h4v-8h3l1-4h-4v-2c0-1.1.9-2 2-2z"
            fill="#eff6ff"
          />
        </svg>
      </span>
    );
  }

  if (ch === "telegram") {
    return (
      <span className={styles.channelIconWrap} title="Telegram">
        <svg viewBox="0 0 32 32" className={styles.channelIcon}>
          <circle cx="16" cy="16" r="16" fill="#0ea5e9" />
          <path
            d="M23.4 9.2L8.7 15.1c-.7.3-.7 1.3 0 1.6l3.5 1.4 1.4 4.5c.2.6 1 .7 1.4.2l2-2.4 3.6 2.8c.5.4 1.3.1 1.4-.6l1.8-12.1c.1-.7-.6-1.2-1.4-.9z"
            fill="#e0f2fe"
          />
        </svg>
      </span>
    );
  }

  const initial = ch.charAt(0).toUpperCase() || "?";
  return (
    <span className={styles.channelIconWrap} title={channel || "default"}>
      <svg viewBox="0 0 32 32" className={styles.channelIcon}>
        <circle cx="16" cy="16" r="16" fill="#4b5563" />
        <text
          x="16"
          y="20"
          textAnchor="middle"
          fontSize="14"
          fill="#e5e7eb"
          fontFamily="system-ui, -apple-system, Segoe UI, sans-serif"
        >
          {initial}
        </text>
      </svg>
    </span>
  );
};

/* ========================= Página ========================= */
export default function BillingExtrato() {
  const now = new Date();
  const firstMonthDay = new Date(
    now.getFullYear(),
    now.getMonth(),
    1,
    0,
    0,
    0
  );

  const [from, setFrom] = useState(firstMonthDay.toISOString().slice(0, 16));
  const [to, setTo] = useState(new Date().toISOString().slice(0, 16));

  const debFrom = useDebounce(from, 300);
  const debTo = useDebounce(to, 300);

  const [loading, setLoading] = useState(false);
  const [data, setData] = useState({
    rows: [],
    total_cents: 0,
    totals_by_channel: [],
  });
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
      const res = await apiGet(`/billing/statement?${qs(params)}`);

      let rows = Array.isArray(res)
        ? res
        : Array.isArray(res?.rows)
        ? res.rows
        : Array.isArray(res?.data)
        ? res.data
        : [];
      if (!Array.isArray(rows)) rows = [];

      let total_cents = 0;
      if (Number.isFinite(+res?.total_cents)) {
        total_cents = +res.total_cents;
      } else if (
        Number.isFinite(+res?.totals?.amount_cents_all_currencies)
      ) {
        total_cents = +res.totals.amount_cents_all_currencies;
      } else {
        total_cents = rows.reduce((acc, r) => acc + pickCents(r), 0);
      }

      const totals_by_channel =
        res?.totals_by_channel && Array.isArray(res.totals_by_channel)
          ? res.totals_by_channel
          : Object.values(
              rows.reduce((acc, r) => {
                const ch = r.channel || "default";
                const cents = pickCents(r);
                const sess = pickSessions(r);
                if (!acc[ch]) acc[ch] = { channel: ch, sessions: 0, total_cents: 0 };
                acc[ch].sessions += sess;
                acc[ch].total_cents += cents;
                return acc;
              }, {})
            );

      if (mounted.current) setData({ rows, total_cents, totals_by_channel });
    } catch (e) {
      console.error(e);
      if (mounted.current)
        toast.error("Falha ao carregar extrato. Verifique o período.");
    } finally {
      if (mounted.current) setLoading(false);
    }
  }, [debFrom, debTo]);

  useEffect(() => {
    if (debFrom && debTo) load();
  }, [debFrom, debTo, refreshKey, load]);

  const grandTotal = useMemo(
    () => BRL(data.total_cents || 0),
    [data.total_cents]
  );

  const handleExport = () => {
    const fromDate = new Date(debFrom).toLocaleDateString("pt-BR");
    const toDate = new Date(debTo).toLocaleDateString("pt-BR");
    const filename = `extrato-faturamento-${fromDate.replace(
      /\//g,
      "-"
    )}-a-${toDate.replace(/\//g, "-")}.csv`;

    const csv = buildCsvFromState(data);
    downloadBlob(csv, filename);
  };

  const fmtDt = (ts) =>
    ts ? new Date(ts).toLocaleString("pt-BR") : "—";

  const totalUsers = data.rows?.length || 0;
  const totalSessions =
    data.rows?.reduce((acc, r) => acc + pickSessions(r), 0) || 0;
  const avgPerUser = totalUsers > 0 ? data.total_cents / totalUsers : 0;

  const channels = useMemo(() => {
    const arr = data.totals_by_channel || [];
    return arr
      .slice()
      .sort((a, b) => (b.total_cents || 0) - (a.total_cents || 0));
  }, [data.totals_by_channel]);

  const totalByValue = channels.reduce(
    (acc, c) => acc + (c.total_cents || 0),
    0
  );
  const totalBySessions = channels.reduce(
    (acc, c) => acc + (c.sessions || 0),
    0
  );

  const channelColor = (ch, index) => {
    const key = String(ch || "default").toLowerCase();
    if (key === "whatsapp") return "#22c55e";
    if (key === "telegram") return "#3b82f6";
    if (key === "facebook") return "#60a5fa";
    const palette = ["#a855f7", "#f97316", "#eab308", "#f97373"];
    return palette[index % palette.length];
  };

  const DonutChart = () => {
    if (!channels.length || totalByValue <= 0) {
      return (
        <div className={styles.donutEmpty}>
          <span className={styles.donutEmptyLabel}>
            Sem faturamento no período
          </span>
        </div>
      );
    }

    const size = 130;
    const stroke = 18;
    const radius = (size - stroke) / 2;
    const cx = size / 2;
    const cy = size / 2;
    const circumference = 2 * Math.PI * radius;

    let offsetAcumulado = 0;

    return (
      <svg
        width={size}
        height={size}
        viewBox={`0 0 ${size} ${size}`}
        className={styles.donutSvg}
      >
        <circle
          cx={cx}
          cy={cy}
          r={radius}
          fill="#020617"
          stroke="#111827"
          strokeWidth={stroke}
        />
        {channels.map((c, index) => {
          const value = c.total_cents || 0;
          const pct = value / totalByValue;
          const dash = circumference * pct;
          const gap = circumference - dash;
          const offset = offsetAcumulado;
          offsetAcumulado -= dash;

          return (
            <circle
              key={c.channel || index}
              cx={cx}
              cy={cy}
              r={radius}
              fill="transparent"
              stroke={channelColor(c.channel, index)}
              strokeWidth={stroke}
              strokeDasharray={`${dash} ${gap}`}
              strokeDashoffset={offset}
              strokeLinecap="round"
              className={styles.donutSegment}
            />
          );
        })}
        <text
          x={cx}
          y={cy - 4}
          textAnchor="middle"
          className={styles.donutValue}
        >
          {grandTotal}
        </text>
        <text
          x={cx}
          y={cy + 14}
          textAnchor="middle"
          className={styles.donutLabel}
        >
          Total faturado
        </text>
      </svg>
    );
  };

  return (
    <div className={styles.page}>
      <div className={styles.container}>
        {/* HEADER enxuto */}
        <header className={styles.header}>
          <div className={styles.headerLeft}>
            <h1 className={styles.title}>Extrato de faturamento</h1>
            <p className={styles.subtitle}>
              Análise detalhada do faturamento por sessões, usuários e canais.
            </p>
          </div>

          <div className={styles.headerActions}>
            <button
              className={styles.iconBtn}
              type="button"
              onClick={() => setRefreshKey((k) => k + 1)}
              disabled={loading}
              title="Atualizar"
            >
              <RefreshCcw
                size={16}
                className={loading ? styles.spin : ""}
              />
            </button>

            <button
              className={`${styles.iconBtn} ${styles.iconBtnPrimary}`}
              type="button"
              onClick={handleExport}
              disabled={loading}
              title="Exportar CSV"
            >
              <Download size={16} />
            </button>
          </div>
        </header>

        {/* GRID – card de período + KPIs */}
        <section className={styles.kpisGrid}>
          {/* Card de período (filtros de data) */}
          <article className={styles.card}>
            <div className={styles.cardHead}>
              <div className={styles.cardTitle}>
                <CalendarRange size={18} />
                Período
              </div>
            </div>
            <div className={styles.cardBody}>
              <div className={styles.periodGrid}>
                <div className={styles.periodField}>
                  <span className={styles.periodLabel}>Inicial</span>
                  <input
                    className={styles.input}
                    type="datetime-local"
                    value={from}
                    onChange={(e) => setFrom(e.target.value)}
                  />
                </div>
                <div className={styles.periodField}>
                  <span className={styles.periodLabel}>Final</span>
                  <input
                    className={styles.input}
                    type="datetime-local"
                    value={to}
                    onChange={(e) => setTo(e.target.value)}
                  />
                </div>
              </div>
              <div className={styles.periodHint}>
                Os dados abaixo consideram o período selecionado.
              </div>
            </div>
          </article>

          {/* Usuários ativos */}
          <article className={styles.card}>
            <div className={styles.cardHead}>
              <div className={styles.cardTitle}>
                <Users size={18} />
                Usuários ativos
              </div>
            </div>
            <div className={styles.cardBody}>
              <div className={styles.bigNumber}>{totalUsers}</div>
              <div className={styles.subtle}>
                Usuários com sessões faturáveis no período.
              </div>
              <div className={styles.inlineStat}>
                <DollarSign size={14} />
                Média: {BRL(avgPerUser)} por usuário.
              </div>
            </div>
          </article>

          {/* Faturamento por canal (rosca) */}
          <article className={styles.card}>
            <div className={styles.cardHead}>
              <div className={styles.cardTitle}>
                <PieChart size={18} />
                Faturamento por canal
              </div>
            </div>
            <div className={styles.cardBody}>
              <div className={styles.donutLayout}>
                <DonutChart />
                <div className={styles.donutLegend}>
                  {channels.length === 0 ? (
                    <span className={styles.emptyLegend}>
                      Sem dados de canais.
                    </span>
                  ) : (
                    channels.map((c, index) => {
                      const value = c.total_cents || 0;
                      const pct =
                        totalByValue > 0
                          ? (value / totalByValue) * 100
                          : 0;
                      return (
                        <div
                          key={c.channel || index}
                          className={styles.legendRow}
                        >
                          <span
                            className={styles.legendDot}
                            style={{
                              backgroundColor: channelColor(
                                c.channel,
                                index
                              ),
                            }}
                          />
                          <span className={styles.legendLabel}>
                            {c.channel || "default"}
                          </span>
                          <span className={styles.legendValue}>
                            {BRL(value)}
                          </span>
                          <span className={styles.legendPct}>
                            {pct.toFixed(1)}%
                          </span>
                        </div>
                      );
                    })
                  )}
                </div>
              </div>
            </div>
          </article>

          {/* Sessões por canal (quantidade) */}
          <article className={styles.card}>
            <div className={styles.cardHead}>
              <div className={styles.cardTitle}>
                <PieChart size={18} />
                Sessões por canal
              </div>
            </div>
            <div className={styles.cardBody}>
              <div className={styles.sessionsSummary}>
                <span className={styles.bigNumber}>{totalSessions}</span>
                <span className={styles.subtle}>sessões no período.</span>
              </div>

              <div className={styles.sessionsList}>
                {channels.length === 0 ? (
                  <div className={styles.empty}>Sem sessões por canal.</div>
                ) : (
                  channels.map((c, index) => {
                    const sess = c.sessions || 0;
                    const pct =
                      totalBySessions > 0
                        ? (sess / totalBySessions) * 100
                        : 0;
                    return (
                      <div
                        key={c.channel || index}
                        className={styles.sessionRow}
                      >
                        <div className={styles.sessionHeader}>
                          <ChannelIcon channel={c.channel} />
                          <span className={styles.sessionLabel}>
                            {c.channel || "default"}
                          </span>
                          <span className={styles.sessionCount}>
                            {sess}
                          </span>
                          <span className={styles.sessionPct}>
                            {pct.toFixed(1)}%
                          </span>
                        </div>
                        <div className={styles.sessionBarBg}>
                          <div
                            className={styles.sessionBarFill}
                            style={{
                              width: `${Math.max(pct, 4)}%`,
                              backgroundColor: channelColor(
                                c.channel,
                                index
                              ),
                            }}
                          />
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            </div>
          </article>
        </section>

        {/* Tabela detalhada */}
        <section className={styles.tableCard}>
          <div className={styles.tableHeader}>
            <div className={styles.tableTitleWrap}>
              <span className={styles.tableTitleIcon}>
                <PieChart size={16} />
              </span>
              <h2 className={styles.tableTitle}>Detalhamento por usuário</h2>
            </div>
            <div className={styles.tableMeta}>
              {totalSessions} sessão(ões) totais
            </div>
          </div>

          <div className={styles.tableWrap}>
            <table className={styles.table}>
              <thead>
                <tr>
                  {[
                    "User ID",
                    "Canal",
                    "Sessões",
                    "Primeira mensagem",
                    "Última mensagem",
                    "Valor total",
                  ].map((h) => (
                    <th key={h}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {loading && (
                  <tr>
                    <td colSpan={6} className={styles.loading}>
                      Carregando dados...
                    </td>
                  </tr>
                )}
                {!loading &&
                  (!data.rows || data.rows.length === 0) && (
                    <tr>
                      <td colSpan={6} className={styles.empty}>
                        Nenhum dado encontrado para o período selecionado.
                      </td>
                    </tr>
                  )}
                {!loading &&
                  data.rows?.map((r, i) => {
                    const cents = pickCents(r);
                    const sessions = pickSessions(r);
                    const first = pickFirstTs(r);
                    const last = pickLastTs(r);
                    return (
                      <tr
                        key={(r.user_id || r.user || "-") + (r.channel || "default") + i}
                      >
                        <td>{r.user_id || r.user || "—"}</td>
                        <td>
                          <ChannelIcon channel={r.channel} />
                        </td>
                        <td>{fmtInt(sessions)}</td>
                        <td>{fmtDt(first)}</td>
                        <td>{fmtDt(last)}</td>
                        <td>{BRL(cents)}</td>
                      </tr>
                    );
                  })}
              </tbody>
              {data.rows?.length ? (
                <tfoot>
                  <tr>
                    <td colSpan={5} className={styles.tfootLabel}>
                      Total geral
                    </td>
                    <td className={styles.tfootValue}>{grandTotal}</td>
                  </tr>
                </tfoot>
              ) : null}
            </table>
          </div>
        </section>
      </div>
    </div>
  );
}
