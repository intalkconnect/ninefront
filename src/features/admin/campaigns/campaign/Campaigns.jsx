// File: Campaigns.jsx
import React, { useCallback, useEffect, useMemo, useState } from "react";
import { RefreshCw, Plus, X as XIcon } from "lucide-react";
import { useLocation, useNavigate } from "react-router-dom";
import { apiGet } from "../../../../shared/apiClient";
import { toast } from "react-toastify";
import styles from "../../styles/AdminUI.module.css";

/** Radios (options) do topo */
const FILTERS = [
  { key: "all", label: "Todos" },
  { key: "active", label: "Ativos" }, // queued/scheduled ou remaining > 0
  { key: "finished", label: "Finalizados" },
  { key: "failed", label: "Falhas" },
];

/** Processados/total (conta falhas como processadas para não virar “restante”) */
function calcProcessed(c) {
  const total = Number(c?.total_items || 0);
  const pc = Number(c?.processed_count);
  if (Number.isFinite(pc) && pc >= 0) return { processed: pc, total };

  const rem = Number(c?.remaining);
  if (Number.isFinite(rem) && total > 0) {
    return { processed: Math.max(0, total - rem), total };
  }

  const sent = Number(c?.sent_count || 0);
  const del = Number(c?.delivered_count || 0);
  const read = Number(c?.read_count || 0);
  const fail = Number(c?.failed_count || 0);
  const sum = sent + del + read + fail;
  const safeTotal = total || sum;
  return { processed: Math.min(safeTotal, sum), total: safeTotal };
}

/** Label + classe do chip de status */
function getStatusUi(c) {
  const st = String(c?.status || "").toLowerCase();
  const { processed, total } = calcProcessed(c);
  const remaining = Math.max(0, (total || 0) - processed);

  if (st === "failed") return { label: "Falhou", cls: styles.stFailed };
  if (st === "finished") return { label: "Concluída", cls: styles.stFinished };
  if (st === "scheduled") return { label: "Agendada", cls: styles.stScheduled };
  if (st === "queued" || remaining > 0)
    return { label: "Em andamento", cls: styles.stActive };

  return { label: st || "—", cls: styles.stDefault };
}

export default function Campaigns() {
  const [items, setItems] = useState([]);
  const [filter, setFilter] = useState("all");
  const [query, setQuery] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const navigate = useNavigate();
  const location = useLocation();

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await apiGet("/campaigns");
      setItems(Array.isArray(data) ? data : []);
    } catch (e) {
      console.error(e);
      setError("Falha ao carregar campanhas.");
      toast.error("Falha ao carregar campanhas.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  // se voltou da página de criação com sucesso, recarrega e avisa
  useEffect(() => {
    if (location.state?.created) {
      load();
      toast.success("Campanha criada com sucesso!");
      navigate(location.pathname, { replace: true, state: {} });
    }
  }, [location, navigate, load]);

  // filtro client-side (busca só por NOME)
  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return (items || [])
      .filter((c) => {
        if (filter === "finished")
          return String(c.status).toLowerCase() === "finished";

        if (filter === "failed")
          return (
            String(c.status).toLowerCase() === "failed" ||
            Number(c.failed_count || 0) > 0
          );

        if (filter === "active") {
          const st = String(c.status).toLowerCase();
          const { processed, total } = calcProcessed(c);
          return (
            st === "queued" ||
            st === "scheduled" ||
            total > processed
          );
        }

        return true;
      })
      .filter(
        (c) =>
          !q || String(c.name || "").toLowerCase().includes(q)
      )
      .sort((a, b) =>
        String(a.updated_at || "").localeCompare(
          String(b.updated_at || "")
        )
      )
      .reverse();
  }, [items, filter, query]);

  return (
    <div className={styles.page}>
      <div className={styles.container}>
        {/* HEADER padrão FlowHub/adminUi */}
        <header className={styles.header}>
          <div className={styles.titleBlock}>
            <h1 className={styles.title}>Campanhas</h1>
            <p className={styles.subtitle}>
              Envie imediatamente ou agende disparos em massa. Acompanhe o
              progresso e os resultados em tempo real.
            </p>
          </div>

          <div className={styles.headerActions}>
            <button
              className={styles.iconCircle}
              onClick={load}
              type="button"
              title="Atualizar"
            >
              <RefreshCw size={18} />
            </button>
            <button
              className={styles.iconCirclePrimary}
              onClick={() => navigate("/campaigns/new")}
              type="button"
              title="Nova campanha"
            >
              <Plus size={18} />
            </button>
          </div>
        </header>

        {/* Card da lista */}
        <section className={styles.tableCard}>
          {/* Header do card: filtros (pílulas) + busca */}
          <div className={styles.cardHead}>
            <div
              className={styles.segmentRow}
              role="tablist"
              aria-label="Filtro de status"
            >
              {FILTERS.map((opt) => {
                const active = filter === opt.key;
                return (
                  <button
                    key={opt.key}
                    type="button"
                    className={`${styles.segBtn} ${
                      active ? styles.segBtnActive : ""
                    }`}
                    onClick={() => setFilter(opt.key)}
                    aria-pressed={active}
                  >
                    {opt.label}
                  </button>
                );
              })}
            </div>

            <div className={styles.searchGroup}>
              <input
                className={styles.searchInput}
                placeholder="Buscar por nome…"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                aria-label="Buscar campanhas por nome"
              />
              {query && (
                <button
                  className={styles.searchClear}
                  onClick={() => setQuery("")}
                  aria-label="Limpar busca"
                  type="button"
                >
                  <XIcon size={14} />
                </button>
              )}
            </div>
          </div>

          {/* Tabela */}
          <div className={styles.tableWrap}>
            <table className={styles.table}>
              <thead>
                <tr>
                  <th className={styles.colCampaign}>Campanha</th>
                  <th className={styles.colStatus}>Status</th>
                  <th className={styles.colCount}>Carregados</th>
                  <th className={styles.colCount}>Lidos</th>
                  <th className={styles.colCount}>Entregues</th>
                  <th className={styles.colCount}>Falhas</th>
                  <th className={styles.colProgress}>Progresso</th>
                </tr>
              </thead>
              <tbody>
                {loading && (
                  <tr>
                    <td colSpan={7} className={styles.loading}>
                      Carregando…
                    </td>
                  </tr>
                )}

                {!loading && filtered.length === 0 && (
                  <tr>
                    <td colSpan={7} className={styles.empty}>
                      Nenhuma campanha encontrada.
                    </td>
                  </tr>
                )}

                {!loading &&
                  filtered.map((c) => {
                    const { processed, total } = calcProcessed(c);
                    const pct = total
                      ? Math.round((processed / total) * 100)
                      : 0;
                    const stUi = getStatusUi(c);

                    return (
                      <tr key={c.id} className={styles.row}>
                        <td
                          className={styles.campaignCell}
                          data-label="Campanha"
                        >
                          <span className={styles.campaignName}>
                            {c.name || "—"}
                          </span>
                        </td>

                        <td data-label="Status">
                          <span
                            className={`${styles.statusBadge} ${stUi.cls}`}
                          >
                            {stUi.label}
                          </span>
                        </td>

                        <td data-label="Carregados">
                          {c.total_items ?? 0}
                        </td>

                        <td data-label="Lidos">
                          <span
                            className={`${styles.pill} ${styles.pillOk}`}
                          >
                            {c.read_count ?? 0}
                          </span>
                        </td>

                        <td data-label="Entregues">
                          <span
                            className={`${styles.pill} ${styles.pillWarn}`}
                          >
                            {c.delivered_count ?? 0}
                          </span>
                        </td>

                        <td data-label="Falhas">
                          <span
                            className={`${styles.pill} ${styles.pillErr}`}
                          >
                            {c.failed_count ?? 0}
                          </span>
                        </td>

                        <td data-label="Progresso">
                          <div className={styles.progressWrap}>
                            <div
                              className={styles.progressBar}
                              aria-label="Progresso"
                            >
                              <span
                                className={styles.progressFill}
                                style={{ width: `${pct}%` }}
                              />
                            </div>
                            <div className={styles.progressInfo}>
                              {processed}/{total || 0}
                            </div>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
              </tbody>
            </table>
          </div>

          {error && (
            <div className={styles.alertErr}>
              <span>⚠ {error}</span>
            </div>
          )}
        </section>
      </div>
    </div>
  );
}
