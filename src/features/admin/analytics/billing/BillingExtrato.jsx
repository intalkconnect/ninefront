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
  TrendingUp,
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
  const avgPerUser =
    totalUsers > 0 ? data.total_cents / totalUsers : 0;

  return (
    <div className={styles.page}>
      <div className={styles.container}>
        {/* HEADER no padrão dos monitores */}
        <div className={styles.header}>
          <div className={styles.titleRow}>
            <h1 className={styles.title}>Extrato de Faturamento</h1>
            <p className={styles.subtitle}>
              Análise detalhada do faturamento por sessões e usuários.
            </p>
          </div>

          <div className={styles.headerActions}>
            <button
              type="button"
              className={styles.refreshBtn}
              onClick={() => setRefreshKey((k) => k + 1)}
              disabled={loading}
              title="Atualizar agora"
            >
              <RefreshCcw
                size={16}
                className={loading ? styles.spinning : ""}
              />
            </button>

            <button
              type="button"
              className={styles.exportBtn}
              onClick={handleExport}
              disabled={loading}
              title="Exportar CSV"
            >
              <Download size={16} />
              <span>Exportar CSV</span>
            </button>
          </div>
        </div>

        {/* FILTROS em card */}
        <section className={styles.filters}>
          <div className={styles.filterGroup}>
            <div className={styles.filterTitle}>
              <CalendarRange size={14} /> Período inicial
            </div>
            <input
              className={styles.input}
              type="datetime-local"
              value={from}
              onChange={(e) => setFrom(e.target.value)}
            />
          </div>

          <div className={styles.filterGroup}>
            <div className={styles.filterTitle}>
              <CalendarRange size={14} /> Período final
            </div>
            <input
              className={styles.input}
              type="datetime-local"
              value={to}
              onChange={(e) => setTo(e.target.value)}
            />
          </div>
        </section>

        {/* KPIs */}
        <section className={styles.kpisGrid}>
          {/* Faturamento total */}
          <div className={styles.card}>
            <div className={styles.cardHead}>
              <div className={styles.cardTitle}>
                <DollarSign size={18} />
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
                <span>Média: {BRL(avgPerUser)} por usuário</span>
              </div>
            </div>
          </div>

          {/* Total por canal */}
          <div className={styles.card}>
            <div className={styles.cardHead}>
              <div className={styles.cardTitle}>
                <span>Total por canal</span>
              </div>
            </div>
            <div className={styles.cardBody}>
              {loading ? (
                <div className={styles.loading}>Carregando…</div>
              ) : data.totals_by_channel?.length ? (
                <ul className={styles.channelList}>
                  {data.totals_by_channel
                    .slice()
                    .sort(
                      (a, b) =>
                        (b.total_cents || 0) -
                        (a.total_cents || 0)
                    )
                    .map((c) => (
                      <li
                        key={c.channel}
                        className={styles.channelItem}
                      >
                        <span
                          className={[
                            styles.pill,
                            c.channel === "whatsapp"
                              ? styles["pill_whatsapp"]
                              : c.channel === "telegram"
                              ? styles["pill_telegram"]
                              : styles["pill_default"],
                          ].join(" ")}
                        >
                          {c.channel || "default"}
                        </span>
                        <span className={styles.channelStat}>
                          {fmtInt(c.sessions || 0)} sessões •{" "}
                          <strong>
                            {BRL(c.total_cents || 0)}
                          </strong>
                        </span>
                      </li>
                    ))}
                </ul>
              ) : (
                <div className={styles.empty}>
                  Sem dados por canal.
                </div>
              )}
            </div>
          </div>
        </section>

        {/* TABELA */}
        <section className={styles.tableCard}>
          <div className={styles.tableHeader}>
            <h2 className={styles.tableTitle}>
              Detalhamento por usuário
            </h2>
            <span className={styles.tableMeta}>
              {totalSessions} sessão(ões) totais
            </span>
          </div>

          <div className={styles.tableScroll}>
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
                    <td
                      colSpan={6}
                      className={styles.loading}
                    >
                      Carregando dados…
                    </td>
                  </tr>
                )}

                {!loading &&
                  (!data.rows || data.rows.length === 0) && (
                    <tr>
                      <td
                        colSpan={6}
                        className={styles.empty}
                      >
                        Nenhum dado encontrado para o período
                        selecionado.
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
                        key={
                          (r.user_id || r.user || "—") +
                          (r.channel || "default") +
                          i
                        }
                      >
                        <td className={styles.cellStrong}>
                          {r.user_id || r.user || "—"}
                        </td>
                        <td>
                          <span
                            className={[
                              styles.pill,
                              r.channel === "whatsapp"
                                ? styles["pill_whatsapp"]
                                : r.channel === "telegram"
                                ? styles["pill_telegram"]
                                : styles["pill_default"],
                            ].join(" ")}
                          >
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
                    <td className={styles.tfootValue}>
                      {grandTotal}
                    </td>
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
