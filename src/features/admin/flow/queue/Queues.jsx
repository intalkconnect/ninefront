// webapp/src/features/admin/flow/queue/Queues.jsx
import React, { useEffect, useMemo, useState, useCallback } from "react";
import { Clock3, X as XIcon, SquarePen, Trash2, Plus, RotateCw } from "lucide-react";
import { useNavigate, useLocation, useParams } from "react-router-dom";
import { apiGet, apiDelete } from "../../../../shared/apiClient";
import { useConfirm } from "../../../../app/provider/ConfirmProvider.jsx";
import { toast } from "react-toastify";
import styles from "./styles/Queues.module.css";

export default function Queues() {
  const navigate = useNavigate();
  const location = useLocation();
  const params = useParams();

  // flowId pode vir da URL (ex.: /development/flowhub/:flowId/queues)
  // ou do state enviado pelo FlowHub
  const flowId =
    params.flowId ||
    location.state?.flowId ||
    location.state?.meta?.flowId ||
    null;

  // meta extra do flow (quando vier do FlowHub)
  const flowMeta = location.state?.meta || null;
  const flowName =
    flowMeta?.name ||
    flowMeta?.flowName ||
    flowMeta?.title ||
    null;

  const [filas, setFilas] = useState([]);
  const [loading, setLoading] = useState(false);
  const [query, setQuery] = useState("");
  const confirm = useConfirm();

  const normalizeHexColor = (input) => {
    if (!input) return null;
    let c = String(input).trim();
    if (!c) return null;
    if (!c.startsWith("#")) c = `#${c}`;
    if (/^#([0-9a-fA-F]{3})$/.test(c)) {
      c = "#" + c.slice(1).split("").map((ch) => ch + ch).join("");
    }
    return /^#([0-9a-fA-F]{6})$/.test(c) ? c.toUpperCase() : null;
  };

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const qs = flowId ? `?flow_id=${encodeURIComponent(flowId)}` : "";
      const data = await apiGet(`/queues${qs}`);
      setFilas(Array.isArray(data) ? data : []);
    } catch (e) {
      console.error(e);
      toast.error("Falha ao carregar filas.");
    } finally {
      setLoading(false);
    }
  }, [flowId]);

  useEffect(() => {
    load();
  }, [load]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return filas;
    return filas.filter((f) => {
      const nome = String(f.nome ?? f.name ?? "").toLowerCase();
      const desc = String(f.descricao ?? "").toLowerCase();
      return nome.includes(q) || desc.includes(q);
    });
  }, [filas, query]);

  const clearSearch = () => setQuery("");

  async function handleDelete(queue) {
    const id = queue.id ?? queue.nome ?? queue.name;
    if (!id) {
      toast.warn("ID da fila indisponível.");
      return;
    }
    try {
      const ok = await confirm({
        title: "Excluir fila?",
        description: `Tem certeza que deseja excluir a fila "${queue.nome ?? queue.name}"? Esta ação não pode ser desfeita.`,
        confirmText: "Excluir",
        cancelText: "Cancelar",
        tone: "danger",
      });
      if (!ok) return;

      const qs = flowId ? `?flow_id=${encodeURIComponent(flowId)}` : "";
      await apiDelete(`/queues/${encodeURIComponent(id)}${qs}`);

      toast.success("Fila excluída.");
      load();
    } catch (e) {
      console.error(e);

      let msg = "Falha ao excluir fila.";
      const data = e?.response?.data || e?.data;
      if (data && typeof data.error === "string") {
        msg = data.error;
      } else if (typeof e?.message === "string") {
        const idx = e.message.indexOf("): ");
        if (idx !== -1) {
          msg = e.message.slice(idx + 3).trim();
        } else {
          msg = e.message;
        }
      }

      toast.error(msg);
    }
  }

  const baseQueuesPath = flowId
    ? `/development/flowhub/${encodeURIComponent(flowId)}/queues`
    : "/management/queues";

  return (
    <div className={styles.container}>
      {/* HEADER no mesmo padrão visual das outras telas */}
      <div className={styles.header}>
        <div>
          <h1 className={styles.title}>Filas de atendimento</h1>
          <p className={styles.subtitle}>
            Crie, edite, configure horários e exclua filas de atendimento.
          </p>

          {flowId && (
            <div className={styles.flowContextPill}>
              <span className={styles.flowLabel}>Contexto do fluxo</span>
              <span className={styles.flowInfo}>
                id: <code>{flowId}</code>
              </span>
              {flowName && (
                <span className={styles.flowInfo}>
                  • nome: <strong>{flowName}</strong>
                </span>
              )}
            </div>
          )}
        </div>

        <div className={styles.headerActionsRight}>
          <button
            type="button"
            className={styles.btn}
            onClick={load}
            title="Recarregar filas"
          >
            <RotateCw size={16} />
            Recarregar
          </button>

          <button
            type="button"
            className={styles.btnPrimary}
            onClick={() =>
              navigate("/management/queues/new", { state: { flowId } })
            }
          >
            <Plus size={16} /> Nova fila
          </button>
        </div>
      </div>

      {/* CARD + LISTA */}
      <div className={styles.card}>
        <div className={styles.cardHead}>
          <div className={styles.cardActions}>
            <div className={styles.searchGroup}>
              <input
                className={styles.searchInput}
                placeholder="Buscar por nome ou descrição…"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                aria-label="Buscar filas"
              />
              {query && (
                <button
                  className={styles.searchClear}
                  onClick={clearSearch}
                  title="Limpar busca"
                  aria-label="Limpar busca"
                  type="button"
                >
                  <XIcon size={14} />
                </button>
              )}
            </div>

            <div
              className={styles.counter}
              aria-label="Total de itens filtrados"
            >
              <span className={styles.counterNumber}>{filtered.length}</span>
              <span>
                {filtered.length === 1 ? "fila" : "filas"}
              </span>
            </div>
          </div>
        </div>

        <div className={styles.tableWrap}>
          <table className={styles.table}>
            <thead>
              <tr>
                <th style={{ minWidth: 360 }}>Fila</th>
                <th>Descrição</th>
                <th style={{ width: 220, textAlign: "right" }}>Ações</th>
              </tr>
            </thead>
            <tbody>
              {loading && (
                <tr>
                  <td colSpan={3} className={styles.loading}>
                    Carregando…
                  </td>
                </tr>
              )}
              {!loading && filtered.length === 0 && (
                <tr>
                  <td colSpan={3} className={styles.empty}>
                    Nenhuma fila encontrada.
                  </td>
                </tr>
              )}
              {!loading &&
                filtered.map((f) => {
                  const id = f.id ?? f.nome ?? f.name;
                  const nomeFila = f.nome ?? f.name ?? "";
                  const hex = f.color || "";
                  const showHex = normalizeHexColor(hex);

                  return (
                    <tr key={String(id)} className={styles.rowHover}>
                      <td data-label="Fila">
                        <div className={styles.queueNameWrap}>
                          <span
                            className={styles.colorDot}
                            style={{ background: showHex || "#fff" }}
                            aria-hidden="true"
                          />
                          <span>{nomeFila}</span>
                        </div>
                      </td>
                      <td data-label="Descrição">
                        {f.descricao || "—"}
                      </td>
                      <td
                        className={styles.actionsCell}
                        data-label="Ações"
                      >
                        <div
                          style={{ display: "inline-flex", gap: 8 }}
                        >
                          <button
                            type="button"
                            className={`${styles.btnSecondary} ${styles.iconOnly}`}
                            title="Configurar horários e feriados"
                            onClick={() =>
                              navigate(
                                `/management/queues/${encodeURIComponent(
                                  nomeFila
                                )}/hours`,
                                { state: { flowId } }
                              )
                            }
                          >
                            <Clock3 size={16} />
                          </button>
                          <button
                            type="button"
                            className={`${styles.btnSecondary} ${styles.iconOnly}`}
                            title="Editar"
                            onClick={() =>
                              navigate(
                                `/management/queues/${encodeURIComponent(
                                  id
                                )}`,
                                { state: { flowId } }
                              )
                            }
                          >
                            <SquarePen size={16} />
                          </button>
                          <button
                            type="button"
                            className={`${styles.btn} ${styles.iconOnly}`}
                            title="Excluir"
                            onClick={() => handleDelete(f)}
                          >
                            <Trash2 size={16} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
