import React, { useCallback, useEffect, useMemo, useState } from "react";
import { X as XIcon, ChevronLeft, ChevronRight } from "lucide-react";
import styles from "./styles/AuditLogs.module.css";
import { apiGet } from "../../../../shared/apiClient";

/**
 * Mapeia "action" bruta -> label amigável
 */
function formatAction(action = "") {
  const a = String(action || "").toLowerCase();

  const MAP = [
    [/^flow\.reset$/, "Reiniciou fluxo"],
    [/^flow\.activate$/, "Ativou fluxo"],
    [/^facebook\.connect\.upsert$/, "Conectou Facebook"],
    [/^instagram\.connect\.upsert$/, "Conectou Instagram"],
    [/^instagram\.connect\.exchange_failed$/, "Instagram: falha na troca do código"],
    [/^ticket\.tags\.catalog\.upsert\.start$/, "Tags de ticket: início do upsert"],
    [/^ticket\.tags\.catalog\.upsert\.done$/, "Tags de ticket: upsert concluído"],
    [/^queue\.rules\.delete\.notfound$/, "Regras da fila: exclusão (não havia regras)"],
    [/^queue\.update$/, "Atualizou fila"],
  ];

  for (const [re, label] of MAP) if (re.test(a)) return label;

  // fallback: troca "." por " › "
  return action.replaceAll(".", " › ");
}

/**
 * Sucesso = 2xx ou 3xx
 */
const isSuccess = (code) => {
  const n = Number(code);
  return !Number.isNaN(n) && n >= 200 && n < 400;
};

/**
 * Data PT-BR (curtinha)
 */
function fmtDate(ts) {
  try {
    return new Date(ts).toLocaleString("pt-BR", {
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
    });
  } catch {
    return ts ?? "—";
  }
}

export default function AuditLogs() {
  // dados
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(false);

  // filtros server-side
  const [statusChip, setStatusChip] = useState(""); // '' | 'success' | 'fail'
  const [author, setAuthor] = useState("");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");

  // paginação (client-side simples)
  const [page, setPage] = useState(1);
  const pageSize = 25;

  const clearFilters = useCallback(() => {
    setStatusChip("");
    setAuthor("");
    setDateFrom("");
    setDateTo("");
    setPage(1);
  }, []);

  // carrega do back com os filtros
  const load = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (statusChip) params.set("status", statusChip); // 'success' | 'fail'
      if (author) params.set("actor", author);
      if (dateFrom) params.set("from", dateFrom);
      if (dateTo) params.set("to", dateTo);

      // o endpoint do back proposto: GET /audit/logs
      const resp = await apiGet(`/audit/logs?${params.toString()}`);
      const arr = Array.isArray(resp?.items) ? resp.items : (Array.isArray(resp) ? resp : []);
      setItems(arr);
      setPage(1);
    } catch (e) {
      setItems([]);
    } finally {
      setLoading(false);
    }
  }, [statusChip, author, dateFrom, dateTo]);

  useEffect(() => { load(); }, [load]);

  // paginação local
  const paginated = useMemo(() => {
    const start = (page - 1) * pageSize;
    return items.slice(start, start + pageSize);
  }, [items, page]);

  const totalPages = Math.max(1, Math.ceil(items.length / pageSize));
  const canPrev = page > 1;
  const canNext = page < totalPages;

  return (
    <div className={styles.container}>
      {/* Header */}
      <div className={styles.header}>
        <div>
          <h1 className={styles.title}>Logs de Auditoria</h1>
          <p className={styles.subtitle}>
            Registros de ações críticas do sistema para rastreabilidade e segurança.
          </p>
        </div>
      </div>

      {/* Filtros */}
      <div className={styles.filtersBar}>
        <div className={styles.field}>
          <label>Status</label>
          <div className={styles.chipGroup}>
            <button
              type="button"
              className={`${styles.chip} ${statusChip === "" ? styles.chipActive : ""}`}
              aria-pressed={statusChip === ""}
              onClick={() => setStatusChip("")}
            >
              Todos
            </button>
            <button
              type="button"
              className={`${styles.chip} ${statusChip === "success" ? styles.chipActive : ""}`}
              aria-pressed={statusChip === "success"}
              onClick={() => setStatusChip("success")}
            >
              Sucesso
            </button>
            <button
              type="button"
              className={`${styles.chip} ${statusChip === "fail" ? styles.chipActive : ""}`}
              aria-pressed={statusChip === "fail"}
              onClick={() => setStatusChip("fail")}
            >
              Falha
            </button>
          </div>
        </div>

        <div className={styles.field}>
          <label>Autor/Usuário</label>
          <input
            className={styles.input}
            placeholder="email ou nome"
            value={author}
            onChange={(e) => setAuthor(e.target.value)}
          />
          {author && (
            <button
              className={styles.inputClear}
              title="Limpar"
              onClick={() => setAuthor("")}
            >
              <XIcon size={14} />
            </button>
          )}
        </div>

        <div className={styles.field}>
          <label>De</label>
          <input
            type="date"
            className={styles.input}
            value={dateFrom}
            onChange={(e) => setDateFrom(e.target.value)}
          />
        </div>

        <div className={styles.field}>
          <label>Até</label>
          <input
            type="date"
            className={styles.input}
            value={dateTo}
            onChange={(e) => setDateTo(e.target.value)}
          />
        </div>

        <div className={styles.actionsRight}>
          <button className={styles.resetBtn} onClick={clearFilters}>
            Limpar filtros
          </button>
        </div>
      </div>

      {/* Card + Tabela */}
      <div className={styles.card}>
        <div className={styles.tableWrap}>
          <table className={styles.table}>
            <thead>
              <tr>
                <th>Data</th>
                <th>Ação</th>
                <th>Status</th>
                <th>Autor/Usuário</th>
              </tr>
            </thead>
            <tbody>
              {loading &&
                Array.from({ length: 8 }).map((_, i) => (
                  <tr key={`sk-${i}`} className={styles.skelRow}>
                    <td colSpan={4}>
                      <div className={styles.skeletonRow} />
                    </td>
                  </tr>
                ))}

              {!loading && paginated.length === 0 && (
                <tr>
                  <td colSpan={4} className={styles.empty}>
                    Nenhum log encontrado para os filtros aplicados.
                  </td>
                </tr>
              )}

              {!loading &&
                paginated.map((row) => (
                  <tr key={row.id} className={styles.rowHover}>
                    <td data-label="Data">{fmtDate(row.ts)}</td>
                    <td data-label="Ação">{formatAction(row.action)}</td>
                    <td data-label="Status">
                      <span
                        className={
                          isSuccess(row.status_code)
                            ? styles.statusOk
                            : styles.statusFail
                        }
                        title={`HTTP ${row.status_code}`}
                      >
                        {isSuccess(row.status_code) ? "Sucesso" : "Falha"}
                      </span>
                    </td>
                    <td data-label="Autor/Usuário">
                      {row.actor_user || row.actor_id || "—"}
                    </td>
                  </tr>
                ))}
            </tbody>
          </table>
        </div>

        {/* Paginação */}
        <div className={styles.pager}>
          <button
            className={styles.pageBtn}
            onClick={() => canPrev && setPage((p) => Math.max(1, p - 1))}
            disabled={!canPrev}
          >
            <ChevronLeft size={16} />
            Anterior
          </button>
          <div className={styles.pageInfo}>
            {page} / {totalPages}
          </div>
          <button
            className={styles.pageBtn}
            onClick={() => canNext && setPage((p) => Math.min(totalPages, p + 1))}
            disabled={!canNext}
          >
            Próxima
            <ChevronRight size={16} />
          </button>
        </div>
      </div>
    </div>
  );
}
