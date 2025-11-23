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
  DollarSign,
  Users,
  PieChart,
  BarChart2,
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

// ===== CSV helpers (Excel-friendly pt-BR) =====
const CSV_DELIM = ";"; // ; funciona melhor com Excel em pt-BR

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
  const cands = [
    row?.sessions,
    row?.windows,
    row?.billing_windows,
    row?.janelas,
  ];
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

  // BOM p/ Excel abrir acentuação corretamente
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

/* ========================= Gráficos ========================= */

const COLORS = [
  "#22c55e",
  "#3b82f6",
  "#f97316",
  "#a855f7",
  "#eab308",
  "#06b6d4",
  "#f97373",
];

function ChannelRevenueDonut({ totalsByChannel = [], totalCents = 0 }) {
  const items = (totalsByChannel || []).map((c, idx) => ({
    label: c.channel || "default",
    cents: pickCents(c),
    color: COLORS[idx % COLORS.length],
  }));

  const total =
    totalCents && Number.isFinite(+totalCents)
      ? +totalCents
      : items.reduce((acc, i) => acc + (i.cents || 0), 0);

  if (!items.length) {
    return (
      <div className={styles.donutEmpty}>
        <span className={styles.subtle}>Sem dados de faturamento por canal.</span>
      </div>
    );
  }

  let acc = 0;
  const segments = items.map((item) => {
    const pct = total > 0 ? (item.cents / total) * 100 : 0;
    const from = acc;
    const to = acc + pct;
    acc = to;
    return { ...item, pct, from, to };
  });

  const gradient =
    total > 0
      ? segments
          .map(
            (s) => `${s.color} ${s.from.toFixed(2)}% ${s.to.toFixed(2)}%`
          )
          .join(", ")
      : "#1f2937 0 100%";

  return (
    <div className={styles.donutWrapper}>
      <div
        className={styles.donutChart}
        style={{
          backgroundImage:
            total > 0 ? `conic-gradient(${gradient})` : undefined,
        }}
      >
        <div className={styles.donutInner}>
          <div className={styles.donutValue}>{BRL(total)}</div>
          <div className={styles.donutLabel}>Total faturado</div>
        </div>
      </div>

      <div className={styles.donutLegend}>
        {segments.map((s) => (
          <div key={s.label} className={styles.legendItem}>
            <span
              className={styles.legendDot}
              style={{ backgroundColor: s.color }}
            />
            <span className={styles.legendText}>
              <span className={styles.legendLabel}>{s.label}</span>
              <span className={styles.legendValue}>
                {BRL(s.cents)}{" "}
                <span className={styles.legendPct}>
                  ({(s.pct || 0).toFixed(1)}%)
                </span>
              </span>
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

function SessionsPerChannel({ totalsByChannel = [], totalSessions = 0 }) {
  const items = (totalsByChannel || []).map((c) => ({
    label: c.channel || "default",
    sessions: Number.isFinite(+c.sessions) ? +c.sessions : pickSessions(c),
  }));

  const maxSessions = items.reduce(
    (m, i) => (i.sessions > m ? i.sessions : m),
    0
  );

  if (!items.length) {
    return (
      <div className={styles.sessionsEmpty}>
        <span className={styles.subtle}>Sem sessões no período.</span>
      </div>
    );
  }

  return (
    <div className={styles.sessionsWrapper}>
      <div className={styles.sessionsTotalLine}>
        <span className={styles.sessionsTotalNumber}>{totalSessions}</span>
        <span className={styles.sessionsTotalLabel}>sessões no período</span>
      </div>

      <ul className={styles.sessionsList}>
        {items.map((item) => {
          const pct =
            totalSessions > 0 ? (item.sessions / totalSessions) * 100 : 0;
          const bar =
            maxSessions > 0 ? (item.sessions / maxSessions) * 100 : 0;
          return (
            <li key={item.label} className={styles.sessionsItem}>
              <div className={styles.sessionsHeaderRow}>
                <span className={styles.sessionsChannel}>{item.label}</span>
                <span className={styles.sessionsValue}>
                  {item.sessions}{" "}
                  <span className={styles.sessionsPct}>
                    ({pct.toFixed(1)}%)
                  </span>
                </span>
              </div>
              <div className={styles.sessionsBarOuter}>
                <div
                  className={styles.sessionsBarInner}
                  style={{ width: `${bar}%` }}
                />
              </div>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

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

      // 1) linhas
      let rows = Array.isArray(res)
        ? res
        : Array.isArray(res?.rows)
        ? res.rows
        : Array.isArray(res?.data)
        ? res.data
        : [];
      if (!Array.isArray(rows)) rows = [];

      // 2) total do período
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

      // 3) somatório por canal (se API não mandar pronto)
      const totals_by_channel =
        res?.totals_by_channel && Array.isArray(res.totals_by_channel)
          ? res.totals_by_channel
          : Object.values(
              rows.reduce((acc, r) => {
                const ch = r.channel || "default";
                const cents = pickCents(r);
                const sess = pickSessions(r);
                if (!acc[ch])
                  acc[ch] = { channel: ch, sessions: 0, total_cents: 0 };
                acc[ch].sessions += sess;
                acc[ch].total_cents += cents;
                return acc;
              }, {})
            );

      if (mounted.current)
        setData({ rows, total_cents, totals_by_channel });
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

  // métricas extras
  const totalUsers = data.rows?.length || 0;
  const totalSessions =
    data.rows?.reduce((acc, r) => acc + pickSessions(r), 0) || 0;

  /* ---------- render ---------- */

  return (
    <div className={styles.page}>
      <div className={styles.container}>
        {/* HEADER padrão FlowHub */}
        <header className={styles.header}>
          <div className={styles.titleRow}>
            <h1 className={styles.title}>Extrato de faturamento</h1>
            <p className={styles.subtitle}>
              Acompanhe o faturamento por usuário, canal e sessões no período
              selecionado.
            </p>
          </div>

          <div className={styles.headerActions}>
            <button
              className={styles.btn}
              type="button"
              onClick={() => setRefreshKey((k) => k + 1)}
              disabled={loading}
              title="Atualizar"
            >
              <RefreshCcw
                size={16}
                className={loading ? styles.spin : ""}
              />
              Atualizar
            </button>

            <button
              className={styles.btnPrimary}
              type="button"
              onClick={handleExport}
              disabled={loading}
              title="Exportar CSV"
            >
              <Download size={16} />
              Exportar CSV
            </button>
          </div>
        </header>

        {/* FILTROS */}
        <section className={styles.filtersCard}>
          <div className={styles.filtersRow}>
            <div className={styles.filterItem}>
              <span className={styles.filterLabel}>
                <CalendarRange size={14} /> Período inicial
              </span>
              <input
                className={styles.input}
                type="datetime-local"
                value={from}
                onChange={(e) => setFrom(e.target.value)}
              />
            </div>
            <div className={styles.filterItem}>
              <span className={styles.filterLabel}>
                <CalendarRange size={14} /> Período final
              </span>
              <input
                className={styles.input}
                type="datetime-local"
                value={to}
                onChange={(e) => setTo(e.target.value)}
              />
            </div>
          </div>
        </section>

        {/* KPIs – 4 cards na mesma linha */}
        <section className={styles.kpisGrid}>
          {/* Faturamento total */}
          <div className={styles.card}>
            <div className={styles.cardHead}>
              <div className={styles.cardTitle}>
                <span className={styles.cardIcon}>
                  <DollarSign size={18} />
                </span>
                <span>Faturamento total</span>
              </div>
            </div>
            <div className={styles.cardBody}>
              <div className={styles.bigTotal}>{grandTotal}</div>
              <div className={styles.subtle}>
                Receita total gerada no período selecionado.
              </div>
            </div>
          </div>

          {/* Usuários ativos */}
          <div className={styles.card}>
            <div className={styles.cardHead}>
              <div className={styles.cardTitle}>
                <span className={styles.cardIcon}>
                  <Users size={18} />
                </span>
                <span>Usuários ativos</span>
              </div>
            </div>
            <div className={styles.cardBody}>
              <div className={styles.bigNumber}>{totalUsers}</div>
              <div className={styles.subtle}>
                Usuários com sessões faturáveis no período.
              </div>
              <div className={styles.inlineStat}>
                Média:{" "}
                <span className={styles.inlineHighlight}>
                  {BRL(
                    totalUsers > 0
                      ? data.total_cents / totalUsers
                      : 0
                  )}
                </span>{" "}
                por usuário.
              </div>
            </div>
          </div>

          {/* Faturamento por canal (pizza) */}
          <div className={styles.card}>
            <div className={styles.cardHead}>
              <div className={styles.cardTitle}>
                <span className={styles.cardIcon}>
                  <PieChart size={18} />
                </span>
                <span>Faturamento por canal</span>
              </div>
            </div>
            <div className={styles.cardBody}>
              <ChannelRevenueDonut
                totalsByChannel={data.totals_by_channel || []}
                totalCents={data.total_cents || 0}
              />
            </div>
          </div>

          {/* Sessões por canal (quantidade) */}
          <div className={styles.card}>
            <div className={styles.cardHead}>
              <div className={styles.cardTitle}>
                <span className={styles.cardIcon}>
                  <BarChart2 size={18} />
                </span>
                <span>Sessões por canal</span>
              </div>
            </div>
            <div className={styles.cardBody}>
              <SessionsPerChannel
                totalsByChannel={data.totals_by_channel || []}
                totalSessions={totalSessions}
              />
            </div>
          </div>
        </section>

        {/* TABELA DETALHADA */}
        <section className={styles.card}>
          <div className={styles.cardHead}>
            <div className={styles.cardTitle}>
              <span className={styles.cardIcon}>
                <BarChart2 size={18} />
              </span>
              <span>Detalhamento por usuário</span>
            </div>
            <div className={styles.tableMeta}>
              {fmtInt(totalSessions)} sessão(ões) totais
            </div>
          </div>

          <div className={styles.tableWrap}>
            <table className={styles.table}>
              <thead>
                <tr>
                  <th className={styles.colUser}>User ID</th>
                  <th className={styles.colChannel}>Canal</th>
                  <th className={styles.colSessions}>Sessões</th>
                  <th className={styles.colDate}>Primeira mensagem</th>
                  <th className={styles.colDate}>Última mensagem</th>
                  <th className={styles.colMoney}>Valor total</th>
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
                        key={(r.user_id || r.user || "-") +
                          (r.channel || "default") +
                          i}
                      >
                        <td>{r.user_id || r.user || "—"}</td>
                        <td>
                          <span className={styles.pillTable}>
                            {r.channel || "default"}
                          </span>
                        </td>
                        <td>{fmtInt(sessions)}</td>
                        <td>{fmtDt(first)}</td>
                        <td>{fmtDt(last)}</td>
                        <td className={styles.cellMoney}>
                          {BRL(cents)}
                        </td>
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
