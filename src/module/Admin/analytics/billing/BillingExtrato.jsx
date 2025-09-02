// File: BillingExtrato.jsx
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { apiGet } from '../../../../shared/apiClient';
import { CalendarRange, Coins, Download, RefreshCcw } from 'lucide-react';
import styles from './styles/BillingExtrato.module.css';

/* ========================= Helpers ========================= */
const toISO = (v) => (v ? new Date(v).toISOString() : null);
const fmtInt = (n) => (Number.isFinite(+n) ? Math.round(+n) : 0);
const BRL = (v) => {
  const cents = Number.isFinite(+v) ? +v : 0;
  return (cents / 100).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
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

// =========== Normalizadores ===========
const pickCents = (row) => {
  if (Number.isFinite(+row?.amount_cents)) return +row.amount_cents; // <-- novo payload
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
  row?.first_ref_ts || row?.first_incoming_at || row?.first_at || row?.start_at || row?.min_ts || row?.first_msg_at;
const pickLastTs = (row) =>
  row?.last_ref_ts || row?.last_incoming_at || row?.last_at || row?.end_at || row?.max_ts || row?.last_msg_at;

/* ========================= Página ========================= */
export default function BillingExtrato() {
  // período padrão: 1º dia do mês atual até agora
  const now = new Date();
  const firstMonthDay = new Date(now.getFullYear(), now.getMonth(), 1, 0, 0, 0);

  const [from, setFrom] = useState(firstMonthDay.toISOString().slice(0, 16));
  const [to, setTo] = useState(new Date().toISOString().slice(0, 16));

  const debFrom = useDebounce(from, 300);
  const debTo   = useDebounce(to, 300);

  const [loading, setLoading] = useState(false);
  const [errMsg, setErrMsg] = useState(null);
  const [data, setData] = useState({ rows: [], total_cents: 0, totals_by_channel: [] });
  const [refreshKey, setRefreshKey] = useState(0);

  const mounted = useRef(true);
  useEffect(() => () => { mounted.current = false; }, []);

  const load = useCallback(async () => {
    setLoading(true); setErrMsg(null);
    try {
      const params = { from: toISO(debFrom), to: toISO(debTo) };
      const res = await apiGet(`/billing/statement?${qs(params)}`);

      // 1) linhas
      let rows =
        Array.isArray(res) ? res :
        (Array.isArray(res?.rows) ? res.rows :
        (Array.isArray(res?.data) ? res.data : [])); // <-- aceita {data: [...]}
      if (!Array.isArray(rows)) rows = [];

      // 2) total do período
      let total_cents = 0;
      if (Number.isFinite(+res?.total_cents)) {
        total_cents = +res.total_cents;
      } else if (Number.isFinite(+res?.totals?.amount_cents_all_currencies)) {
        total_cents = +res.totals.amount_cents_all_currencies; // <-- novo payload
      } else {
        total_cents = rows.reduce((acc, r) => acc + pickCents(r), 0);
      }

      // 3) somatório por canal (se API não mandar pronto)
      const totals_by_channel =
        res?.totals_by_channel && Array.isArray(res.totals_by_channel)
          ? res.totals_by_channel
          : Object.values(
              rows.reduce((acc, r) => {
                const ch = r.channel || 'default';
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
      if (mounted.current) setErrMsg('Falha ao carregar extrato. Verifique o período.');
    } finally {
      if (mounted.current) setLoading(false);
    }
  }, [debFrom, debTo]);

  useEffect(() => { if (debFrom && debTo) load(); }, [debFrom, debTo, refreshKey, load]);

  const grandTotal = useMemo(() => BRL(data.total_cents || 0), [data.total_cents]);

  // export CSV
  const handleExport = () => {
    const params = { from: toISO(debFrom), to: toISO(debTo) };
    const url = `/billing/statement/export?${qs(params)}`;
    window.open(url, '_blank', 'noopener,noreferrer');
  };

  const fmtDt = (ts) => ts ? new Date(ts).toLocaleString('pt-BR') : '—';

  return (
    <div className={styles.container}>
      {/* Barra superior (ações à direita) */}
      <div className={styles.toolbar}>
        <div className={styles.headerActions}>
          <button className={styles.btn} type="button" onClick={() => setRefreshKey(k => k + 1)} disabled={loading} title="Atualizar">
            <RefreshCcw size={16} className={loading ? styles.spin : ''} /> Atualizar
          </button>
          <button className={styles.btnPrimary} type="button" onClick={handleExport} disabled={loading} title="Exportar CSV">
            <Download size={16} /> Exportar CSV
          </button>
        </div>
      </div>

      {/* Cabeçalho + filtros */}
      <div className={styles.header}>
        <h1 className={styles.title}><Coins size={28}/> Extrato de Cobrança</h1>
        <div className={styles.filters}>
          <div className={styles.filterItem}>
            <label><CalendarRange size={14}/> De</label>
            <input type="datetime-local" value={from} onChange={(e) => setFrom(e.target.value)} />
          </div>
          <div className={styles.filterItem}>
            <label><CalendarRange size={14}/> Até</label>
            <input type="datetime-local" value={to} onChange={(e) => setTo(e.target.value)} />
          </div>
        </div>
      </div>

      {/* Resumo topo */}
      <div className={styles.kpisRow}>
        <div className={styles.card}>
          <div className={styles.cardHead}>
            <div className={styles.cardTitle}><Coins size={18}/> Total no período</div>
          </div>
          <div className={styles.cardBody}>
            <div className={styles.bigTotal}>{grandTotal}</div>
            <div className={styles.subtle}>Soma de todas as janelas faturáveis do período.</div>
          </div>
        </div>

        <div className={styles.card}>
          <div className={styles.cardHead}>
            <div className={styles.cardTitle}>Totais por canal</div>
          </div>
          <div className={styles.cardBody}>
            {loading ? <div className={styles.loading}>Carregando…</div> :
            (data.totals_by_channel?.length ? (
              <ul className={styles.channelList}>
                {data.totals_by_channel
                  .slice()
                  .sort((a, b) => (b.total_cents || 0) - (a.total_cents || 0))
                  .map((c) => (
                    <li key={c.channel} className={styles.channelItem}>
                      <span className={styles.channelLabel}>{c.channel || 'default'}</span>
                      <span className={styles.channelStat}>
                        {fmtInt(c.sessions || 0)} janelas • <strong>{BRL(c.total_cents || 0)}</strong>
                      </span>
                    </li>
                  ))}
              </ul>
            ) : <div className={styles.empty}>Sem dados por canal para o período.</div>)}
          </div>
        </div>
      </div>

      {/* Lista detalhada */}
      <div className={styles.card}>
        <div className={styles.cardHead}>
          <div className={styles.cardTitle}>Detalhamento por usuário</div>
        </div>
        <div className={styles.tableWrap}>
          <table className={styles.table}>
            <thead>
              <tr>
                <th>User ID</th>
                <th>Canal</th>
                <th>Janelas</th>
                <th>1ª msg</th>
                <th>Última msg</th>
                <th>Total</th>
              </tr>
            </thead>
            <tbody>
              {loading && (
                <tr><td colSpan={6} className={styles.loading}>Carregando…</td></tr>
              )}
              {!loading && (!data.rows || data.rows.length === 0) && (
                <tr><td colSpan={6} className={styles.empty}>Sem dados no período.</td></tr>
              )}
              {!loading && data.rows?.map((r, i) => {
                const cents = pickCents(r);
                const sessions = pickSessions(r);
                const first = pickFirstTs(r);
                const last  = pickLastTs(r);
                return (
                  <tr key={(r.user_id || r.user || '-') + (r.channel || 'default') + i}>
                    <td>{r.user_id || r.user || '—'}</td>
                    <td>{r.channel || 'default'}</td>
                    <td>{fmtInt(sessions)}</td>
                    <td>{fmtDt(first)}</td>
                    <td>{fmtDt(last)}</td>
                    <td><strong>{BRL(cents)}</strong></td>
                  </tr>
                );
              })}
            </tbody>
            {data.rows?.length ? (
              <tfoot>
                <tr>
                  <td colSpan={5} className={styles.tfootLabel}>Total</td>
                  <td className={styles.tfootValue}>{grandTotal}</td>
                </tr>
              </tfoot>
            ) : null}
          </table>
        </div>

        {errMsg && <div className={styles.alertErr} role="alert">⚠️ {errMsg}</div>}
      </div>
    </div>
  );
}
