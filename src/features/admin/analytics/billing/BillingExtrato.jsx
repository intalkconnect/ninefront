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
  PieChart,
  Activity,
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

/* ====== SVG dos canais (WhatsApp / Facebook / genérico) ====== */
const ChannelIcon = ({ channel }) => {
  const ch = String(channel || "").toLowerCase();

  if (ch === "whatsapp") {
    return (
      <svg
        className={styles.channelSvg}
        viewBox="0 0 24 24"
        aria-hidden="true"
      >
        <defs>
          <linearGradient id="waGrad" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#22c55e" />
            <stop offset="100%" stopColor="#16a34a" />
          </linearGradient>
        </defs>
        <circle cx="12" cy="12" r="11" fill="url(#waGrad)" />
        <path
          d="M11.9 6.5c-2.6 0-4.7 2.1-4.7 4.7 0 .9.3 1.8.7 2.5l-.8 2.9 3-1c.7.4 1.6.6 2.4.6 2.6 0 4.7-2.1 4.7-4.7 0-2.7-2.1-5-5.3-5z"
          fill="#020617"
          opacity="0.08"
        />
        <path
          d="M10.3 8.2c-.2-.4-.3-.4-.5-.4h-.4c-.1 0-.4.1-.7.3s-.9.9-.9 2.1c0 1.2.9 2.4 1 2.6.1.2 1.7 2.7 4.1 3.7 2 .8 2.4.7 2.8.7.4 0 1.4-.6 1.6-1.2.2-.6.2-1.1.2-1.2s-.2-.3-.4-.4l-1.3-.6c-.2-.1-.4-.1-.5.1l-.4.6c-.1.1-.2.2-.4.2-.2 0-.4-.1-.6-.2-.3-.1-1-.4-1.9-1.3-.7-.7-1.2-1.6-1.3-1.8-.1-.2 0-.4.1-.5.1-.1.2-.3.3-.4.1-.1.1-.2.2-.3.1-.1.1-.3 0-.4l-.6-1.3z"
          fill="#ecfdf5"
        />
      </svg>
    );
  }

  if (ch === "facebook") {
    return (
      <svg
        className={styles.channelSvg}
        viewBox="0 0 24 24"
        aria-hidden="true"
      >
        <defs>
          <linearGradient id="fbGrad" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#3b82f6" />
            <stop offset="100%" stopColor="#1d4ed8" />
          </linearGradient>
        </defs>
        <circle cx="12" cy="12" r="11" fill="url(#fbGrad)" />
        <path
          d="M13.1 8.3h1.7V6.3h-1.9c-2.3 0-3.6 1.4-3.6 3.6v1.5H8v2.1h1.3v4.2h2.2v-4.2h1.8l.3-2.1h-2.1v-1.4c0-.7.2-1.5 1.6-1.5z"
          fill="#eff6ff"
        />
      </svg>
    );
  }

  // genérico
  return (
    <svg className={styles.channelSvg} viewBox="0 0 24 24" aria-hidden="true">
      <circle cx="12" cy="12" r="11" fill="#0f172a" />
      <circle cx="12" cy="12" r="9" fill="#1f2937" />
      <text
        x="12"
        y="14"
        textAnchor="middle"
        fontSize="10"
        fill="#e5e7eb"
        fontFamily="system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif"
      >
        {ch?.[0]?.toUpperCase() || "C"}
      </text>
    </svg>
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
  useEffect(() => () => { mounted.current = false; }, []);

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
                if (!acc[ch])
                  acc[ch] = { channel: ch, sessions: 0, total_cents: 0 };
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

  // métricas extras
  const totalUsers = data.rows?.length || 0;
  const totalSessions =
    data.rows?.reduce((acc, r) => acc + pickSessions(r), 0) || 0;
  const avgPerUser = totalUsers > 0 ? data.total_cents / totalUsers : 0;

  // agrupamento / cálculos por canal
  const canaisOrdenados = useMemo(() => {
    return (data.totals_by_channel || [])
      .slice()
      .sort((a, b) => (b.total_cents || 0) - (a.total_cents || 0));
  }, [data.totals_by_channel]);

  const totalCentsChannels = useMemo(
    () =>
      canaisOrdenados.reduce(
        (acc, c) => acc + (Number.isFinite(+c.total_cents) ? +c.total_cents : 0),
        0
      ),
    [canaisOrdenados]
  );

  const totalSessionsChannels = useMemo(
    () =>
      canaisOrdenados.reduce(
        (acc, c) => acc + (Number.isFinite(+c.sessions) ? +c.sessions : 0),
        0
      ),
    [canaisOrdenados]
  );

  // cores fixas para canais (para caber bem em legendas)
  const channelColors = (channel) => {
    const ch = String(channel || "").toLowerCase();
    if (ch === "whatsapp") return "#22c55e";
    if (ch === "facebook") return "#3b82f6";
    if (ch === "telegram") return "#0ea5e9";
    if (ch === "instagram") return "#ec4899";
    if (ch === "webchat") return "#a855f7";
    return "#94a3b8";
  };

  // donut por faturamento (valor)
  const donutBackground = useMemo(() => {
    if (!canaisOrdenados.length || totalCentsChannels <= 0) {
      return "radial-gradient(circle at center, #020617 55%, #0f172a 56%)";
    }

    let start = 0;
    const segments = canaisOrdenados.map((c) => {
      const value = Number.isFinite(+c.total_cents) ? +c.total_cents : 0;
      const pct = value / totalCentsChannels || 0;
      const size = pct * 360;
      const color = channelColors(c.channel);
      const seg = { from: start, to: start + size, color };
      start += size;
      return seg;
    });

    const conic = segments
      .map((s) => `${s.color} ${s.from}deg ${s.to}deg`)
      .join(", ");

    return `
      radial-gradient(circle at center, #020617 55%, transparent 55%),
      conic-gradient(${conic})
    `;
  }, [canaisOrdenados, totalCentsChannels]);

  // export CSV usando estado atual
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

  return (
    <div className={styles.page}>
      <div className={styles.container}>
        {/* HEADER padrão FlowHub */}
        <header className={styles.header}>
          <div className={styles.titleBlock}>
            <h1 className={styles.title}>Extrato de faturamento</h1>
            <p className={styles.subtitle}>
              Análise detalhada do faturamento por sessões, usuários e canais.
            </p>
          </div>

          <div className={styles.headerActions}>
            <button
              type="button"
              className={styles.iconBtn}
              onClick={() => setRefreshKey((k) => k + 1)}
              disabled={loading}
              title="Atualizar"
            >
              <RefreshCcw
                size={16}
                className={loading ? styles.spin : undefined}
              />
            </button>
            <button
              type="button"
              className={`${styles.iconBtn} ${styles.iconBtnPrimary}`}
              onClick={handleExport}
              disabled={loading}
              title="Exportar CSV"
            >
              <Download size={16} />
            </button>
          </div>
        </header>

        {/* CARD DE PERÍODO (filtro) */}
        <section className={styles.filtersCard}>
          <div className={styles.filtersCardTitle}>
            <CalendarRange size={16} />
            <span>Período do extrato</span>
          </div>
          <div className={styles.filtersRow}>
            <div className={styles.filterItem}>
              <label>Período inicial</label>
              <input
                className={styles.input}
                type="datetime-local"
                value={from}
                onChange={(e) => setFrom(e.target.value)}
              />
            </div>
            <div className={styles.filterItem}>
              <label>Período final</label>
              <input
                className={styles.input}
                type="datetime-local"
                value={to}
                onChange={(e) => setTo(e.target.value)}
              />
            </div>
          </div>
        </section>

        {/* CARDS PRINCIPAIS (3 em linha) */}
        <section className={styles.kpisGrid}>
          {/* Usuários ativos */}
          <div className={styles.card}>
            <div className={styles.cardHead}>
              <div className={styles.cardTitle}>
                <Users size={16} />
                <span>Usuários ativos</span>
              </div>
            </div>
            <div className={styles.cardBody}>
              <div className={styles.bigNumber}>{totalUsers}</div>
              <div className={styles.subtle}>
                Usuários com sessões faturáveis no período.
              </div>
              <div className={styles.inlineStat}>
                <TrendingUp size={14} />
                <span>
                  Média: <strong>{BRL(avgPerUser)}</strong> por usuário
                </span>
              </div>
            </div>
          </div>

          {/* Faturamento por canal – rosca por valor */}
          <div className={styles.card}>
            <div className={styles.cardHead}>
              <div className={styles.cardTitle}>
                <PieChart size={16} />
                <span>Faturamento por canal</span>
              </div>
            </div>
            <div className={`${styles.cardBody} ${styles.cardBodyRow}`}>
              <div className={styles.donutWrapper}>
                <div
                  className={styles.donut}
                  style={{ backgroundImage: donutBackground }}
                />
                <div className={styles.donutCenter}>
                  <span className={styles.donutLabel}>Total</span>
                  <span className={styles.donutValue}>{grandTotal}</span>
                </div>
              </div>
              <div className={styles.donutLegend}>
                {(!canaisOrdenados.length || totalCentsChannels <= 0) && (
                  <p className={styles.emptySmall}>Sem faturamento no período.</p>
                )}
                {canaisOrdenados.map((c) => {
                  const value = Number.isFinite(+c.total_cents)
                    ? +c.total_cents
                    : 0;
                  const pct =
                    totalCentsChannels > 0
                      ? (value / totalCentsChannels) * 100
                      : 0;
                  return (
                    <div key={c.channel || "default"} className={styles.legendRow}>
                      <span
                        className={styles.legendDot}
                        style={{ backgroundColor: channelColors(c.channel) }}
                      />
                      <span className={styles.legendLabel}>
                        {c.channel || "default"}
                      </span>
                      <span className={styles.legendValue}>
                        {BRL(value)}{" "}
                        <span className={styles.legendPct}>
                          {pct.toFixed(1)}%
                        </span>
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>

          {/* Sessões por canal – barras por quantidade */}
          <div className={styles.card}>
            <div className={styles.cardHead}>
              <div className={styles.cardTitle}>
                <Activity size={16} />
                <span>Sessões por canal</span>
              </div>
            </div>
            <div className={styles.cardBody}>
              <div className={styles.sessionsHeader}>
                <span className={styles.bigNumber}>{totalSessions}</span>
                <span className={styles.subtle}>sessões no período</span>
              </div>

              <div className={styles.sessionsList}>
                {(!canaisOrdenados.length || totalSessionsChannels <= 0) && (
                  <p className={styles.emptySmall}>
                    Nenhuma sessão faturável no período.
                  </p>
                )}
                {canaisOrdenados.map((c) => {
                  const sess = Number.isFinite(+c.sessions) ? +c.sessions : 0;
                  const pct =
                    totalSessionsChannels > 0
                      ? (sess / totalSessionsChannels) * 100
                      : 0;
                  return (
                    <div
                      key={`sess-${c.channel || "default"}`}
                      className={styles.sessionRow}
                    >
                      <div className={styles.sessionLabel}>
                        <ChannelIcon channel={c.channel} />
                        <span>{c.channel || "default"}</span>
                      </div>
                      <div className={styles.sessionBarWrapper}>
                        <div className={styles.sessionBarBg}>
                          <div
                            className={styles.sessionBarFill}
                            style={{
                              width: `${Math.max(4, pct)}%`,
                              backgroundColor: channelColors(c.channel),
                            }}
                          />
                        </div>
                      </div>
                      <div className={styles.sessionValue}>
                        {sess}
                        <span className={styles.legendPct}>
                          {pct.toFixed(1)}%
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        </section>

        {/* TABELA DETALHADA */}
        <section className={styles.tableCard}>
          <div className={styles.tableHeader}>
            <div className={styles.tableTitleBlock}>
              <span className={styles.tableTitleIcon}>▮</span>
              <h2 className={styles.tableTitle}>Detalhamento por usuário</h2>
            </div>
            <div className={styles.tableMetaRight}>
              {totalSessions} sessão(ões) totais
            </div>
          </div>

          <div className={styles.tableWrap}>
            <table className={styles.table}>
              <thead>
                <tr>
                  <th>User ID</th>
                  <th>Canal</th>
                  <th>Sessões</th>
                  <th>Primeira mensagem</th>
                  <th>Última mensagem</th>
                  <th>Valor total</th>
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
                        <td className={styles.cellUser}>{r.user_id || r.user || "—"}</td>
                        <td className={styles.channelCell}>
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
        </section>
      </div>
    </div>
  );
}
