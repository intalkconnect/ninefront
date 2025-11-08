import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
  Users as UsersIcon,
  Plus,
  SquarePen,
  Trash2,
  RefreshCw,
  ArrowLeft,
  X as XIcon,
} from "lucide-react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { apiGet, apiDelete } from "../../../../shared/apiClient";
import { toast } from "react-toastify";
import { useConfirm } from "../../../../app/provider/ConfirmProvider";
import styles from "./styles/Agents.module.css";

const PERFIL_ICONS = {
  admin: <UsersIcon size={14} />,
  atendente: <UsersIcon size={14} />,
  supervisor: <UsersIcon size={14} />,
};
const iconForPerfil = (perfil) => {
  const k = String(perfil || "").toLowerCase();
  return PERFIL_ICONS[k] ?? <UsersIcon size={14} />;
};

export default function Agents() {
  const { flowId } = useParams();
  const navigate = useNavigate();
  const confirm = useConfirm();

  const [items, setItems] = useState([]);
  const [queues, setQueues] = useState([]);
  const [flowName, setFlowName] = useState("");
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const [query, setQuery] = useState("");
  const [error, setError] = useState(null);

  const inFlowContext = Boolean(flowId);

  const load = useCallback(async () => {
    setLoading(true);
    setRefreshing(true);
    setError(null);
    try {
      const qs = flowId ? `?flow_id=${encodeURIComponent(flowId)}` : "";

      const [usersResp, filasResp, flowMeta] = await Promise.all([
        apiGet(`/users${qs}`),
        apiGet(`/queues${qs}`),
        flowId ? apiGet(`/flows/${encodeURIComponent(flowId)}`) : null,
      ]);

      const allUsers = Array.isArray(usersResp) ? usersResp : [];
      const allQueues = Array.isArray(filasResp) ? filasResp : [];

      setQueues(allQueues);
      if (flowMeta) {
        setFlowName(flowMeta?.name ?? flowMeta?.nome ?? "");
      }

      const queueIds = new Set(
        allQueues.map((q) => String(q.id ?? q.nome ?? q.name))
      );

      // só atendentes
      const justAgents = allUsers.filter(
        (u) => String(u.perfil || "").toLowerCase() === "atendente"
      );

      // se tiver flowId, agente só aparece se tiver fila deste flow
      const agentsFiltered = flowId
        ? justAgents.filter(
            (u) =>
              Array.isArray(u.filas) &&
              u.filas.some((fid) => queueIds.has(String(fid)))
          )
        : justAgents;

      setItems(agentsFiltered);
    } catch (e) {
      console.error(e);
      const msg = "Falha ao carregar agentes.";
      setError(msg);
      toast.error(msg);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [flowId]);

  useEffect(() => {
    load();
  }, [load]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return items;
    return items.filter((u) => {
      const nome = `${u.name ?? ""} ${u.lastname ?? ""}`.toLowerCase();
      const email = String(u.email ?? "").toLowerCase();
      return nome.includes(q) || email.includes(q);
    });
  }, [items, query]);

  const queuesById = useMemo(() => {
    const map = new Map();
    for (const f of queues) {
      const k = String(f.id ?? f.nome ?? f.name);
      map.set(k, f);
    }
    return map;
  }, [queues]);

  async function handleDelete(u) {
    setError(null);
    const hasFilas = Array.isArray(u.filas) && u.filas.length > 0;
    if (hasFilas) {
      const msg =
        "Não é possível excluir: o usuário possui filas vinculadas. Remova as filas antes de excluir.";
      setError(msg);
      toast.warn(msg);
      return;
    }
    try {
      const ok = await confirm({
        title: "Excluir atendente?",
        description:
          "Tem certeza que deseja excluir esse atendente? Esta ação não pode ser desfeita.",
        confirmText: "Excluir",
        cancelText: "Cancelar",
        tone: "danger",
      });
      if (!ok) return;
      await apiDelete(`/users/${u.id}`);
      toast.success("Atendente excluído.");
      load();
    } catch (e) {
      console.error(e);
      const msg = "Falha ao excluir atendente.";
      setError(msg);
      toast.error(msg);
    }
  }

  const baseAgentsPath = inFlowContext
    ? `/development/flowhub/${encodeURIComponent(flowId)}/agents`
    : "/management/users";

  return (
    <div className={styles.page}>
      {/* HEADER NO PADRÃO DO FLOW (Voltar + título + meta + busca/ações) */}
      <div className={styles.headerCard}>
        <button
          className={styles.btn}
          onClick={() => navigate("/development/flowhub")}
        >
          <ArrowLeft size={14} />
          <span>Voltar</span>
        </button>

        <div className={styles.headerCenter}>
          <div className={styles.headerTitle}>Atendentes</div>
        </div>

        <div className={styles.headerRight}>
          <div className={styles.searchGroup}>
            <input
              className={styles.searchInput}
              placeholder="Buscar por nome ou e-mail..."
              value={query}
              onChange={(e) => setQuery(e.target.value)}
            />
            {query && (
              <button
                className={styles.searchClear}
                onClick={() => setQuery("")}
                aria-label="Limpar busca"
              >
                <XIcon size={14} />
              </button>
            )}
          </div>

          <button
            className={styles.iconBtnPrimary}
            title="Novo atendente"
            onClick={() =>
              inFlowContext
                ? navigate(
                    `/development/flowhub/${encodeURIComponent(
                      flowId
                    )}/agents/new`,
                    { state: { flowId } }
                  )
                : navigate("/management/users/new")
            }
          >
            <Plus size={18} />
          </button>

          <button
            className={styles.iconBtn}
            title="Recarregar"
            onClick={load}
            disabled={refreshing}
          >
            <RefreshCw size={16} className={refreshing ? styles.spinning : ""} />
          </button>
        </div>
      </div>

      {error && <div className={styles.alertErr}>{error}</div>}

      {/* CARD TABELA */}
      <div className={styles.card}>
        <div className={styles.tableWrap}>
          <table className={styles.table}>
            <thead>
              <tr>
                <th>Nome</th>
                <th>Email</th>
                <th>Perfil</th>
                <th>Filas</th>
                <th style={{ width: 140, textAlign: "right" }}>Ações</th>
              </tr>
            </thead>
            <tbody>
              {loading &&
                Array.from({ length: 6 }).map((_, i) => (
                  <tr key={`sk-${i}`} className={styles.skelRow}>
                    <td colSpan={5}>
                      <div className={styles.skeletonRow} />
                    </td>
                  </tr>
                ))}

              {!loading && filtered.length === 0 && (
                <tr>
                  <td colSpan={5} className={styles.empty}>
                    Nenhum atendente encontrado para as filas deste flow.
                  </td>
                </tr>
              )}

              {!loading &&
                filtered.map((u) => {
                  const nome = `${u.name ?? ""} ${u.lastname ?? ""}`.trim();
                  const filasArr = Array.isArray(u.filas) ? u.filas : [];
                  const chipNames = filasArr
                    .map(
                      (id) =>
                        queuesById.get(String(id))?.nome ??
                        queuesById.get(String(id))?.name ??
                        id
                    )
                    .filter(Boolean);

                  return (
                    <tr key={u.id} className={styles.rowHover}>
                      <td data-label="Nome">{nome || "—"}</td>
                      <td data-label="Email">{u.email || "—"}</td>
                      <td data-label="Perfil">
                        <span
                          className={`${styles.tag} ${styles.tagRole}`}
                          data-role={String(u.perfil || "").toLowerCase()}
                          title={u.perfil}
                          aria-label={u.perfil}
                        >
                          {iconForPerfil(u.perfil)}
                        </span>
                      </td>
                      <td data-label="Filas">
                        <div className={styles.tagsWrap}>
                          {chipNames.length === 0 ? (
                            <span className={styles.muted}>—</span>
                          ) : (
                            chipNames.map((n, i) => (
                              <span
                                key={`${u.id}-f-${i}`}
                                className={`${styles.tag} ${styles.tagQueue}`}
                              >
                                {n}
                              </span>
                            ))
                          )}
                        </div>
                      </td>
                      <td className={styles.actionsCell}>
                        <div className={styles.actions}>
                          <Link
                            to={
                              inFlowContext
                                ? `/development/flowhub/${encodeURIComponent(
                                    flowId
                                  )}/agents/${encodeURIComponent(u.id)}/edit`
                                : `/management/users/${encodeURIComponent(
                                    u.id
                                  )}/edit`
                            }
                            state={{ flowId }}
                            className={styles.qrIconBtn}
                            title="Editar atendente"
                          >
                            <SquarePen size={16} />
                          </Link>
                          <button
                            className={`${styles.qrIconBtn} ${styles.danger}`}
                            title="Excluir atendente"
                            onClick={() => handleDelete(u)}
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
