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
  TrendingUp,
  Users,
  DollarSign,
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

// ===== CSV helpers =====
const CSV_DELIM = ";";

const escapeCSV = (val) => {
  if (val === null || val === undefined) return "";
  const s = String(val);
  const needsQuotes =
    s.includes('"') || s.includes("\n") || s.includes("\r") || s.includes(CSV_DELIM);
  const esc = s.replace(/"/g, '""');
  return needsQuotes ? `"${esc}"` : esc;
};

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

// =========== Normalizadores ===========
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

/* ==================== ChannelIcon (logo em SVG) ==================== */

const ChannelIcon = ({ channel }) => {
  const ch = String(channel || "default").toLowerCase();

  if (ch.includes("whats")) {
    return (
      <span className={`${styles.channelLogo} ${styles.chWhatsapp}`}>
        <svg
          viewBox="0 0 24 24"
          className={styles.channelLogoSvg}
          aria-hidden="true"
        >
          <circle cx="12" cy="12" r="10" fill="#22c55e" />
          <path
            d="M9.2 7.7c.2-.3.3-.4.6-.4h.3c.2 0 .4 0 .6.5.2.4.7 1.3.8 1.4.1.2.1.3 0 .5-.1.2-.2.3-.4.4-.2.1-.3.2-.1.5.1.3.6 1 1.4 1.6.9.6 1.6.8 1.9.9.3.1.4 0 .5-.2.1-.3.6-.7.7-.9.1-.2.3-.2.5-.1.3.1 1.5.7 1.7.8.2.1.3.2.3.4 0 .2 0 .9-.4 1.7-.4.8-1.1 1.2-1.9 1.3-.5 0-1.1.1-1.9-.1-1.1-.3-2.3-.9-3.2-1.7-.8-.7-1.8-1.8-2.1-2.9-.2-.5-.3-1-.3-1.4 0-.4 0-.9.2-1.2z"
            fill="#022c22"
          />
        </svg>
      </span>
    );
  }

  if (ch.includes("telegram")) {
    return (
      <span className={`${styles.channelLogo} ${styles.chTelegram}`}>
        <svg
          viewBox="0 0 24 24"
          className={styles.channelLogoSvg}
          aria-hidden="true"
        >
          <circle cx="12" cy="12" r="10" fill="#3b82f6" />
          <path
            d="M17.4 7.1 6.9 11.1c-.4.1-.4.6 0 .7l2.6.9 1 3.2c.1.4.6.4.7 0l.9-2.3 2.6 1.9c.3.2.8 0 .9-.4l1.4-7.1c.1-.4-.3-.8-.6-.7z"
            fill="#e5f0ff"
          />
        </svg>
      </span>
    );
  }

  if (ch.includes("facebook")) {
    return (
      <span className={`${styles.channelLogo} ${styles.chFacebook}`}>
        <svg
          viewBox="0 0 24 24"
          className={styles.channelLogoSvg}
          aria-hidden="true"
        >
          <circle cx="12" cy="12" r="10" fill="#2563eb" />
          <path
            d="M13 7h-1.2C10.3 7 9 8.3 9 9.8v1.2H8.1a.5.5 0 0 0-.5.5v1.6c0 .3.2.5.5.5H9v3.6c0 .3.2.5.5.5h1.8c.3 0 .5-.2.5-.5v-3.6h1.4c.3 0 .5-.2.5-.5v-1.6a.5.5 0 0 0-.5-.5h-1.4V9.9c0-.4.3-.7.7-.7H14c.3 0 .5-.2.5-.5V7.5A.5.5 0 0 0 14 7h-1z"
            fill="#ffffff"
          />
        </svg>
      </span>
    );
  }

  if (ch.includes("insta")) {
    return (
      <span className={`${styles.channelLogo} ${styles.chInstagram}`}>
        <svg
          viewBox="0 0 24 24"
          className={styles.channelLogoSvg}
          aria-hidden="true"
        >
          <defs>
            <linearGradient id="igGrad" x1="0" y1="0" x2="1" y2="1">
              <stop offset="0%" stopColor="#f97316" />
              <stop offset="40%" stopColor="#ec4899" />
              <stop offset="100%" stopColor="#6366f1" />
            </linearGradient>
          </defs>
          <rect
            x="4"
            y="4"
            width="16"
            height="16"
            rx="4"
            ry="4"
            fill="url(#igGrad)"
          />
          <circle
            cx="12"
            cy="12"
            r="4"
            fill="none"
            stroke="#f9fafb"
            strokeWidth="1.4"
          />
          <circle cx="16" cy="8" r="1" fill="#f9fafb" />
        </svg>
      </span>
    );
  }

  // default genérico
  return (
    <span className={`${styles.channelLogo} ${styles.chDefault}`}>
      <svg
        viewBox="0 0 24 24"
        className={styles.channelLogoSvg}
        aria-hidden="true"
      >
        <circle cx="12" cy="12" r="10" fill="#4b5563" />
        <path
          d="M8.5 9.2c0-1.1.9-2 2-2h3c1.1 0 2 .9 2 2v5.6c0 .5-.4.9-.9.9H9.4a.9.9 0 0 1-.9-.9V9.2z"
          fill="#e5e7eb"
        />
      </svg>
    </span>
  );
};

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
  useEffect(() => () => { mounted.current = false; }, []);

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

  const fmtDt = (ts) => (ts ? new Date(ts).toLocaleString("pt-BR") : "—");

  const totalUsers = data.rows?.length || 0;
  const totalSessions =
    data.rows?.reduce((acc, r) => acc + pickSessions(r), 0) || 0;
  const avgPerUser = totalUsers > 0 ? data.total_cents / totalUsers : 0;

  const channelsSorted = useMemo(
    () =>
      (data.totals_by_channel || [])
        .slice()
        .sort((a, b) => (b.total_cents || 0) - (a.total_cents || 0)),
    [data.totals_by_channel]
  );

  const totalCentsChannels = useMemo(
    () =>
      channelsSorted.reduce((acc, c) => acc + (c.total_cents || 0), 0),
    [channelsSorted]
  );

  const totalSessionsChannels = useMemo(
    () => channelsSorted.reduce((acc, c) => acc + (c.sessions || 0), 0),
    [channelsSorted]
  );

  const pct = (value, total) =>
    total > 0 ? ((value / total) * 100).toFixed(1) : "0.0";

  return (
    <div className={styles.page}>
      <div className={styles.container}>
        {/* Toolbar superior */}
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

        {/* HEADER padronizado (card) */}
        <div className={styles.header}>
          <div className={styles.headerText}>
            <h1 className={styles.title}>Extrato de faturamento</h1>
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
        </div>

        {/* KPIs – 3 cards na mesma linha */}
        <div className={styles.kpisGrid}>
          {/* Usuários ativos */}
          <div className={styles.card}>
            <div className={styles.cardHead}>
              <div className={styles.cardTitle}>
                <Users size={18} />
                <span>Usuários ativos</span>
              </div>
            </div>
            <div className={styles.cardBody}>
              <div className={styles.bigNumber}>{totalUsers}</div>
              <div className={styles.subtle}>
                Total de usuários com sessões faturáveis.
              </div>
              <div className={styles.inlineStat}>
                <TrendingUp size={14} />
                Média: {BRL(avgPerUser)} por usuário.
              </div>
            </div>
          </div>

          {/* Faturamento por canal – rosca por valor */}
          <div className={styles.card}>
            <div className={styles.cardHead}>
              <div className={styles.cardTitle}>
                <DollarSign size={18} />
                <span>Faturamento por canal</span>
              </div>
            </div>
            <div className={`${styles.cardBody} ${styles.donutBody}`}>
              <div className={styles.donutWrapper}>
                <div className={styles.donutOuter}>
                  <svg
                    viewBox="0 0 36 36"
                    className={styles.donutSvg}
                    aria-hidden="true"
                  >
                    <circle
                      className={styles.donutBg}
                      cx="18"
                      cy="18"
                      r="15.915"
                    />
                    {channelsSorted.reduce(
                      (acc, c, index) => {
                        const value = c.total_cents || 0;
                        const pctVal =
                          totalCentsChannels > 0
                            ? (value / totalCentsChannels) * 100
                            : 0;
                        const dash = Math.max(0, pctVal);
                        const gap = 1.5;
                        const circle = (
                          <circle
                            key={c.channel || index}
                            className={`${styles.donutSegment} ${styles[`seg${index % 5}`]}`}
                            cx="18"
                            cy="18"
                            r="15.915"
                            strokeDasharray={`${dash} ${100 - dash}`}
                            strokeDashoffset={acc.offset}
                          />
                        );
                        const nextOffset = acc.offset - dash - gap;
                        return {
                          offset: nextOffset,
                          nodes: [...acc.nodes, circle],
                        };
                      },
                      { offset: 25, nodes: [] }
                    ).nodes}
                  </svg>
                  <div className={styles.donutCenter}>
                    <span className={styles.donutValue}>{grandTotal}</span>
                    <span className={styles.donutLabel}>Total faturado</span>
                  </div>
                </div>
              </div>

              <div className={styles.donutLegend}>
                {channelsSorted.length === 0 && !loading && (
                  <div className={styles.emptySmall}>Sem dados por canal.</div>
                )}
                {channelsSorted.map((c, index) => (
                  <div
                    key={c.channel || index}
                    className={styles.legendRow}
                  >
                    <span
                      className={`${styles.legendDot} ${styles[`seg${index % 5}`]}`}
                    />
                    <span className={styles.legendLabel}>
                      {c.channel || "default"}
                    </span>
                    <span className={styles.legendValue}>
                      {BRL(c.total_cents || 0)}
                    </span>
                    <span className={styles.legendPct}>
                      {pct(c.total_cents || 0, totalCentsChannels)}%
                    </span>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Sessões por canal – apenas quantidade */}
          <div className={styles.card}>
            <div className={styles.cardHead}>
              <div className={styles.cardTitle}>
                <BarChart2 size={18} />
                <span>Sessões por canal</span>
              </div>
            </div>
            <div className={styles.cardBody}>
              <div className={styles.sessionsHeader}>
                <span className={styles.sessionsTotal}>
                  {fmtInt(totalSessions)}
                </span>
                <span className={styles.sessionsLabel}>
                  sessões no período
                </span>
              </div>

              <div className={styles.sessionsList}>
                {channelsSorted.length === 0 && !loading && (
                  <div className={styles.emptySmall}>
                    Sem sessões agrupadas por canal.
                  </div>
                )}
                {channelsSorted.map((c) => {
                  const sess = c.sessions || 0;
                  const perc = totalSessionsChannels
                    ? (sess / totalSessionsChannels) * 100
                    : 0;
                  return (
                    <div
                      key={c.channel}
                      className={styles.sessionRow}
                    >
                      <div className={styles.sessionLabel}>
                        <ChannelIcon channel={c.channel} />
                        <span>{c.channel || "default"}</span>
                      </div>
                      <div className={styles.sessionBarWrap}>
                        <div className={styles.sessionBarBg}>
                          <div
                            className={styles.sessionBar}
                            style={{ width: `${perc}%` }}
                          />
                        </div>
                        <span className={styles.sessionMeta}>
                          {fmtInt(sess)} ({pct(sess, totalSessionsChannels)}%)
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        </div>

        {/* Tabela detalhada */}
        <div className={styles.card}>
          <div className={styles.cardHead}>
            <div className={styles.cardTitle}>
              <BarChart2 size={18} />
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
                {!loading && (!data.rows || data.rows.length === 0) && (
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
                        <td className={`${styles.cellUser} ${styles.cellStrong}`}>
                          {r.user_id || r.user || "—"}
                        </td>
                        <td className={styles.cellChannel}>
                          <ChannelIcon channel={r.channel} />
                        </td>
                        <td className={styles.cellStrong}>{fmtInt(sessions)}</td>
                        <td>{fmtDt(first)}</td>
                        <td>{fmtDt(last)}</td>
                        <td className={styles.cellMoney}>{BRL(cents)}</td>
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
        </div>
      </div>
    </div>
  );
}
