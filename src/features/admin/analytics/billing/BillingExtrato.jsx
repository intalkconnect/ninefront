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

/* ========================= Pequenos componentes ========================= */

const CHANNEL_COLORS = {
  whatsapp: "#22c55e",
  telegram: "#3b82f6",
  webchat: "#a855f7",
  instagram: "#ec4899",
  facebook: "#60a5fa",
  default: "#9ca3af",
};

const normalizeChannelKey = (raw) => {
  if (!raw) return "default";
  const s = String(raw).toLowerCase();
  if (s.includes("whats")) return "whatsapp";
  if (s.includes("telegram")) return "telegram";
  if (s.includes("web")) return "webchat";
  if (s.includes("insta")) return "instagram";
  if (s.includes("face")) return "facebook";
  return s;
};

/** Donut chart por canal baseado em VALOR (total_cents) */
function ChannelPie({ channels }) {
  if (!channels?.length) {
    return (
      <div className={styles.emptySmall}>Sem dados por canal neste período.</div>
    );
  }

  const total = channels.reduce(
    (acc, c) => acc + (Number.isFinite(+c.total_cents) ? +c.total_cents : 0),
    0
  );
  if (total <= 0) {
    return (
      <div className={styles.emptySmall}>Sem valores faturados por canal.</div>
    );
  }

  const data = channels.map((c) => {
    const key = normalizeChannelKey(c.channel);
    const color = CHANNEL_COLORS[key] || CHANNEL_COLORS.default;
    const value = Number.isFinite(+c.total_cents) ? +c.total_cents : 0;
    const pct = (value / total) * 100;
    return { label: c.channel || "default", value, pct, color };
  });

  const radius = 42;
  const cx = 60;
  const cy = 60;
  const circumference = 2 * Math.PI * radius;

  let offsetAcc = 0;

  return (
    <div className={styles.pieWrap}>
      <div className={styles.pieSvgWrap}>
        <svg
          viewBox="0 0 120 120"
          className={styles.pieSvg}
          aria-label="Faturamento por canal"
        >
          {/* fundo */}
          <circle
            cx={cx}
            cy={cy}
            r={radius}
            className={styles.pieBg}
          />
          {data.map((slice, idx) => {
            const frac = slice.value / total;
            const length = frac * circumference;
            const strokeDasharray = `${length} ${circumference - length}`;
            const strokeDashoffset = -offsetAcc;
            offsetAcc += length;
            return (
              <circle
                key={idx}
                cx={cx}
                cy={cy}
                r={radius}
                fill="transparent"
                stroke={slice.color}
                strokeWidth="16"
                strokeDasharray={strokeDasharray}
                strokeDashoffset={strokeDashoffset}
                strokeLinecap="butt"
              />
            );
          })}
          {/* buraco central (donut) */}
          <circle
            cx={cx}
            cy={cy}
            r={radius - 15}
            className={styles.pieHole}
          />
          <text
            x={cx}
            y={cy - 2}
            textAnchor="middle"
            className={styles.pieTotalValue}
          >
            {BRL(total)}
          </text>
          <text
            x={cx}
            y={cy + 10}
            textAnchor="middle"
            className={styles.pieTotalLabel}
          >
            Total
          </text>
        </svg>
      </div>

      <div className={styles.pieLegend}>
        {data.map((slice) => (
          <div key={slice.label} className={styles.pieLegendItem}>
            <span
              className={styles.pieDot}
              style={{ backgroundColor: slice.color }}
            />
            <span className={styles.pieLegendText}>
              <span className={styles.pieLegendChannel}>
                {slice.label || "default"}
              </span>
              <span className={styles.pieLegendMoney}>{BRL(slice.value)}</span>
              <span className={styles.pieLegendPct}>
                {slice.pct.toFixed(1)}%
              </span>
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

/* ========================= Página ========================= */
export default function BillingExtrato() {
  const now = new Date();
  const firstMonthDay = new Date(now.getFullYear(), now.getMonth(), 1, 0, 0, 0);

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

      // 3) somatório por canal
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

  const fmtDt = (ts) => (ts ? new Date(ts).toLocaleString("pt-BR") : "—");

  // métricas extras
  const totalUsers = data.rows?.length || 0;
  const totalSessions =
    data.rows?.reduce((acc, r) => acc + pickSessions(r), 0) || 0;
  const avgPerUser = totalUsers > 0 ? data.total_cents / totalUsers : 0;

  const channels = data.totals_by_channel || [];

  return (
    <div className={styles.page}>
      <div className={styles.container}>
        {/* Toolbar superior (igual padrão FlowHub) */}
        <div className={styles.toolbar}>
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
        </div>

        {/* Header + filtros */}
        <header className={styles.header}>
          <div className={styles.titleRow}>
            <h1 className={styles.title}>Extrato de Faturamento</h1>
            <p className={styles.subtitle}>
              Análise detalhada do faturamento por sessões, usuários e canais.
            </p>
          </div>

          <div className={styles.filters}>
            <div className={styles.filterItem}>
              <label>
                <CalendarRange size={14} /> Período inicial
              </label>
              <input
                className={styles.input}
                type="datetime-local"
                value={from}
                onChange={(e) => setFrom(e.target.value)}
              />
            </div>
            <div className={styles.filterItem}>
              <label>
                <CalendarRange size={14} /> Período final
              </label>
              <input
                className={styles.input}
                type="datetime-local"
                value={to}
                onChange={(e) => setTo(e.target.value)}
              />
            </div>
          </div>
        </header>

        {/* KPIs + canais */}
        <section className={styles.kpisGrid}>
          {/* Faturamento total */}
          <div className={styles.card}>
            <div className={styles.cardHead}>
              <div className={styles.cardTitle}>
                <DollarSign size={18} />
                Faturamento total
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
                <Users size={18} />
                Usuários ativos
              </div>
            </div>
            <div className={styles.cardBody}>
              <div className={styles.bigNumber}>{totalUsers}</div>
              <div className={styles.subtle}>
                Usuários com sessões faturáveis.
              </div>
              <div className={styles.inlineStat}>
                Média: {BRL(avgPerUser)} por usuário
              </div>
            </div>
          </div>

          {/* Pizza por canal (valor) */}
          <div className={styles.card}>
            <div className={styles.cardHead}>
              <div className={styles.cardTitle}>Faturamento por canal</div>
            </div>
            <div className={styles.cardBody}>
              {loading ? (
                <div className={styles.loading}>Carregando…</div>
              ) : (
                <ChannelPie channels={channels} />
              )}
            </div>
          </div>

          {/* Totais por canal (lista) */}
          <div className={styles.card}>
            <div className={styles.cardHead}>
              <div className={styles.cardTitle}>Totais por canal</div>
            </div>
            <div className={styles.cardBody}>
              {loading ? (
                <div className={styles.loading}>Carregando…</div>
              ) : channels?.length ? (
                <ul className={styles.channelList}>
                  {channels
                    .slice()
                    .sort(
                      (a, b) =>
                        (b.total_cents || 0) - (a.total_cents || 0)
                    )
                    .map((c) => {
                      const key = normalizeChannelKey(c.channel);
                      const color =
                        CHANNEL_COLORS[key] || CHANNEL_COLORS.default;
                      return (
                        <li
                          key={c.channel}
                          className={styles.channelItem}
                        >
                          <div className={styles.channelLeft}>
                            <span
                              className={styles.channelDot}
                              style={{ backgroundColor: color }}
                            />
                            <span className={styles.channelName}>
                              {c.channel || "default"}
                            </span>
                          </div>
                          <div className={styles.channelRight}>
                            <span className={styles.channelSessions}>
                              {fmtInt(c.sessions || 0)} sessões
                            </span>
                            <span className={styles.channelMoney}>
                              {BRL(c.total_cents || 0)}
                            </span>
                          </div>
                        </li>
                      );
                    })}
                </ul>
              ) : (
                <div className={styles.emptySmall}>
                  Sem dados por canal.
                </div>
              )}
            </div>
          </div>
        </section>

        {/* Tabela detalhada */}
        <section className={styles.card}>
          <div className={styles.cardHead}>
            <div className={styles.cardTitle}>Detalhamento por usuário</div>
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
                    <td
                      colSpan={6}
                      className={styles.loading}
                    >
                      Carregando dados...
                    </td>
                  </tr>
                )}
                {!loading && (!data.rows || data.rows.length === 0) && (
                  <tr>
                    <td
                      colSpan={6}
                      className={styles.empty}
                    >
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
                    const key =
                      (r.user_id || r.user || "-") +
                      (r.channel || "default") +
                      i;
                    const channelKey = normalizeChannelKey(r.channel);
                    const color =
                      CHANNEL_COLORS[channelKey] || CHANNEL_COLORS.default;

                    return (
                      <tr key={key}>
                        <td className={styles.cellStrong}>
                          {r.user_id || r.user || "—"}
                        </td>
                        <td>
                          <span className={styles.pillChannel}>
                            <span
                              className={styles.channelDot}
                              style={{ backgroundColor: color }}
                            />
                            {r.channel || "default"}
                          </span>
                        </td>
                        <td className={styles.cellStrong}>
                          {fmtInt(sessions)}
                        </td>
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
                    <td
                      colSpan={5}
                      className={styles.tfootLabel}
                    >
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
