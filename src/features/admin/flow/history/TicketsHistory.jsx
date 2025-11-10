// src/pages/.../TicketsHistory.jsx
import React, {
  useCallback,
  useEffect,
  useMemo,
  useState,
} from "react";
import {
  ArrowLeft,
  RefreshCw,
  X as XIcon,
} from "lucide-react";
import styles from "./styles/TicketsHistory.module.css";
import { toast } from "react-toastify";
import { apiGet } from "../../../../shared/apiClient";
import { useNavigate, useLocation, useParams } from "react-router-dom";

const PAGE_SIZES = [10, 20, 30, 40];

function fmtDateTime(iso) {
  if (!iso) return "—";
  try {
    const d = new Date(iso);
    return d.toLocaleString("pt-BR", {
      day: "2-digit",
      month: "2-digit",
      year: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
    });
  } catch {
    return "—";
  }
}

export default function TicketsHistory() {
  const navigate = useNavigate();
  const location = useLocation();
  const params = useParams();

  // flowId SEMPRE esperado nesse contexto (FlowHub)
  const flowIdParam = params.flowId || null;
  const flowIdFromState =
    location.state?.flowId || location.state?.meta?.flowId || null;
  const flowId = flowIdParam || flowIdFromState || null;
  const inFlowContext = !!flowId;

  const [items, setItems] = useState([]);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [total, setTotal] = useState(0);
  const totalPages = Math.max(1, Math.ceil(total / pageSize));

  const [q, setQ] = useState("");
  const [qDeb, setQDeb] = useState("");
  const [fromDate, setFromDate] = useState("");
  const [toDate, setToDate] = useState("");

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  // debounce do texto de busca
  useEffect(() => {
    const t = setTimeout(() => setQDeb(q.trim()), 350);
    return () => clearTimeout(t);
  }, [q]);

  const queryString = useMemo(() => {
    const p = new URLSearchParams();
    p.set("page", String(page));
    p.set("page_size", String(pageSize));
    if (qDeb) p.set("q", qDeb);
    if (fromDate) p.set("from", fromDate);
    if (toDate) p.set("to", toDate);
    if (flowId) p.set("flow_id", flowId);
    return p.toString();
  }, [page, pageSize, qDeb, fromDate, toDate, flowId]);

  const load = useCallback(async () => {
    if (!flowId) {
      setError("flow_id é obrigatório para carregar o histórico.");
      toast.error("flow_id é obrigatório para carregar o histórico.");
      return;
    }

    setLoading(true);
    setError(null);
    try {
      const resp = await apiGet(`/tickets/history?${queryString}`);
      const { data = [], total = 0, page = 1 } = resp || {};
      setItems(Array.isArray(data) ? data : []);
      setTotal(Number(total) || 0);
      setPage(Number(page) || 1);
    } catch (e) {
      console.error(e);
      setError("Falha ao carregar histórico de tickets.");
      toast.error("Falha ao carregar histórico de tickets.");
    } finally {
      setLoading(false);
    }
  }, [queryString, flowId]);

  useEffect(() => {
    load();
  }, [load]);

  const startIdx = total === 0 ? 0 : (page - 1) * pageSize + 1;
  const endIdx = Math.min(total, page * pageSize);

  const clearSearch = () => setQ("");

  const goBack = () => {
    if (inFlowContext) {
      navigate("/development/flowhub");
    } else {
      navigate(-1);
    }
  };

  return (
    <div className={styles.page}>
      {/* HEADER EM CARTÃO (padrão FlowHub) */}
      <div className={styles.headerCard}>
        <div className={styles.headerRow}>
          {/* Voltar */}
          <button
            type="button"
            className={styles.btn}
            onClick={goBack}
            title="Voltar"
          >
            <ArrowLeft size={16} />
            <span>Voltar</span>
          </button>

          {/* Título centralizado */}
          <div className={styles.headerCenter}>
            <div className={styles.title}>Histórico de tickets</div>
          </div>

          {/* Direita: busca + recarregar */}
          <div className={styles.headerRight}>
            <div className={styles.searchGroup}>
              <input
                className={styles.searchInput}
                placeholder="Buscar por número, cliente, fila ou atendente…"
                value={q}
                onChange={(e) => {
                  setQ(e.target.value);
                  setPage(1);
                }}
                aria-label="Buscar tickets"
              />
              {q && (
                <button
                  className={styles.searchClear}
                  onClick={clearSearch}
                  aria-label="Limpar busca"
                  type="button"
                >
                  <XIcon size={14} />
                </button>
              )}
            </div>

            <button
              type="button"
              className={`${styles.btn} ${styles.iconBtn}`}
              onClick={load}
              title="Recarregar"
              aria-label="Recarregar"
              disabled={loading || !flowId}
            >
              <RefreshCw size={16} />
            </button>
          </div>
        </div>
      </div>

      {/* CARD PRINCIPAL COM FILTROS + TABELA */}
      <div className={styles.bodyCard}>
        {/* Filtros de período e info de contagem */}
        <div className={styles.filtersRow}>
          <div className={styles.filtersLeft}>
            <div className={styles.inputGroupSm}>
              <label className={styles.labelSm}>De</label>
              <input
                type="date"
                className={styles.inputSm}
                value={fromDate}
                onChange={(e) => {
                  setFromDate(e.target.value);
                  setPage(1);
                }}
              />
            </div>
            <div className={styles.inputGroupSm}>
              <label className={styles.labelSm}>Até</label>
              <input
                type="date"
                className={styles.inputSm}
                value={toDate}
                onChange={(e) => {
                  setToDate(e.target.value);
                  setPage(1);
                }}
              />
            </div>
          </div>

          <div className={styles.filtersRight}>
            <span className={styles.filtersHint}>
              {total > 0
                ? `Mostrando ${startIdx}–${endIdx} de ${total}`
                : "Nenhum ticket encontrado"}
            </span>
          </div>
        </div>

        {/* Tabela */}
        <div className={styles.tableWrap}>
          <table className={styles.table}>
            <thead>
              <tr>
                <th className={styles.colNum}>Ticket</th>
                <th className={styles.colClient}>Cliente</th>
                <th className={styles.colFila}>Fila</th>
                <th className={styles.colAgent}>Atendente</th>
                <th className={styles.colWhen}>Fechado em</th>
              </tr>
            </thead>

            <tbody>
              {loading && (
                <tr>
                  <td colSpan={5} className={styles.stateMsg}>
                    Carregando…
                  </td>
                </tr>
              )}

              {!loading && !error && items.length === 0 && (
                <tr>
                  <td colSpan={5} className={styles.stateMsg}>
                    Nenhum ticket encontrado.
                  </td>
                </tr>
              )}

              {!loading &&
                !error &&
                items.map((t) => {
                  const num = t.ticket_number
                    ? String(t.ticket_number).padStart(5, "0")
                    : "—";
                  const client =
                    t.client_name || t.user_name || t.user_id || "—";
                  const agent = t.agent_name || t.assigned_to || "—";

                  return (
                    <tr
                      key={t.id}
                      className={`${styles.rowHover} ${styles.rowClickable}`}
                      role="button"
                      tabIndex={0}
                      onClick={() =>
                        navigate(
                          `/development/flowhub/${encodeURIComponent(
                            flowId
                          )}/ticket-history/${t.id}`,
                          {
                            state: {
                              returnTo:
                                window.location.pathname +
                                window.location.search,
                              flowId,
                            },
                          }
                        )
                      }
                    >
                      <td className={styles.nowrap}>{num}</td>
                      <td className={styles.truncate}>{client}</td>
                      <td className={styles.truncate}>{t.fila || "—"}</td>
                      <td className={styles.truncate}>{agent}</td>
                      <td
                        className={`${styles.nowrap} ${styles.textRight}`}
                      >
                        {fmtDateTime(t.closed_at || t.updated_at)}
                      </td>
                    </tr>
                  );
                })}
            </tbody>
          </table>
        </div>

        {/* Paginação (padrão inferior) */}
        <div className={styles.tableFooter}>
          <div className={styles.leftInfo}>
            {`Mostrando ${startIdx}–${endIdx} de ${total}`}
          </div>

          <div className={styles.pager}>
            <select
              className={styles.pageSize}
              value={pageSize}
              onChange={(e) => {
                setPageSize(Number(e.target.value));
                setPage(1);
              }}
            >
              {PAGE_SIZES.map((n) => (
                <option key={n} value={n}>
                  {n} por página
                </option>
              ))}
            </select>

            <button
              className={styles.pBtn}
              onClick={() => setPage(1)}
              disabled={page <= 1}
            >
              « Primeiro
            </button>
            <button
              className={styles.pBtn}
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              disabled={page <= 1}
            >
              Anterior
            </button>
            <span className={styles.pInfo}>
              Página {page} de {totalPages}
            </span>
            <button
              className={styles.pBtn}
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
              disabled={page >= totalPages}
            >
              Próxima
            </button>
            <button
              className={styles.pBtn}
              onClick={() => setPage(totalPages)}
              disabled={page >= totalPages}
            >
              Última »
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
