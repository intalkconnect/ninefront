// File: Users.jsx
import React, { useEffect, useMemo, useState, useCallback } from "react";
import {
  Users as UsersIcon,
  Plus,
  SquarePen,
  Trash2,
  X as XIcon,
  RefreshCw,
  ArrowLeft,
} from "lucide-react";
import { useNavigate, useLocation, useParams, Link } from "react-router-dom";
import { apiGet, apiDelete } from "../../../../shared/apiClient.js";
import { toast } from "react-toastify";
import styles from "./styles/Users.module.css";
import { useConfirm } from "../../../../app/provider/ConfirmProvider.jsx";

const PERFIL_ICONS = {
  admin: <UsersIcon size={14} />,
  atendente: <UsersIcon size={14} />,
  supervisor: <UsersIcon size={14} />,
};
const iconForPerfil = (perfil) => {
  const k = String(perfil || "").toLowerCase();
  return PERFIL_ICONS[k] ?? <UsersIcon size={14} />;
};

export default function Users({ canCreateAdmin = false }) {
  const [items, setItems] = useState([]);
  const [queues, setQueues] = useState([]);
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  const [statusFilter, setStatusFilter] = useState("");
  const [query, setQuery] = useState("");

  const [okMsg, setOkMsg] = useState(null);
  const [error, setError] = useState(null);

  const confirm = useConfirm();
  const navigate = useNavigate();
  const location = useLocation();
  const params = useParams();

  // flowId pode vir por state (FlowHub) ou param de rota
  const flowId =
    location.state?.flowId ||
    location.state?.meta?.flowId ||
    params.flowId ||
    null;

  const baseUsersPath = "/management/users";

  const toastOK = useCallback((msg) => {
    setOkMsg(msg);
    toast.success(msg);
    clearTimeout(toastOK._t);
    toastOK._t = setTimeout(() => setOkMsg(null), 2200);
  }, []);

  const load = useCallback(async () => {
    setLoading(true);
    setRefreshing(true);
    setError(null);
    try {
      const qs = flowId ? `?flow_id=${encodeURIComponent(flowId)}` : "";
      const [usersResp, filasResp] = await Promise.all([
        apiGet(`/users${qs}`),
        apiGet(`/queues${qs}`),
      ]);
      setItems(Array.isArray(usersResp) ? usersResp : []);
      setQueues(Array.isArray(filasResp) ? filasResp : []);
    } catch (e) {
      const msg = "Falha ao carregar usuários.";
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
    return items.filter((u) => {
      if (statusFilter && (u.perfil || "").toLowerCase() !== statusFilter)
        return false;
      const nome = `${u.name ?? ""} ${u.lastname ?? ""}`.toLowerCase();
      const email = String(u.email ?? "").toLowerCase();
      if (!q) return true;
      return nome.includes(q) || email.includes(q);
    });
  }, [items, statusFilter, query]);

  const queuesById = useMemo(() => {
    const map = new Map();
    for (const f of queues) map.set(String(f.id ?? f.nome ?? f.name), f);
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
        title: "Excluir usuário?",
        description:
          "Tem certeza que deseja excluir esse usuário? Esta ação não pode ser desfeita.",
        confirmText: "Excluir",
        cancelText: "Cancelar",
        tone: "danger",
      });
      if (!ok) return;
      const qs = flowId ? `?flow_id=${encodeURIComponent(flowId)}` : "";
      await apiDelete(`/users/${u.id}${qs}`);
      toastOK("Usuário excluído.");
      load();
    } catch (e) {
      const msg = "Falha ao excluir usuário.";
      setError(msg);
      toast.error(msg);
    }
  }

  const handleNew = () => {
    navigate("/management/users/new", {
      state: { canCreateAdmin, flowId },
    });
  };

  const handleRefresh = () => {
    if (!refreshing) load();
  };

  const title = flowId ? "Atendentes do Flow" : "Usuários";

  return (
    <div className={styles.container}>
      {/* HEADER NO PADRÃO DAS OUTRAS TELAS */}
      <div className={styles.headerCard}>
        <div className={styles.headerRow}>
          <button
            onClick={() =>
              flowId ? navigate(-1) : navigate(baseUsersPath, { replace: true })
            }
            type="button"
            className={styles.backBtn}
            title="Voltar"
          >
            <ArrowLeft size={14} />
            <span>Voltar</span>
          </button>

          <div className={styles.headerCenter}>
            <div className={styles.headerTitle}>{title}</div>
            <div className={styles.headerSubtitle}>
              {flowId
                ? "Gerencie os atendentes vinculados a este flow."
                : "Gestão de usuários: cadastro, papéis e acessos."}
            </div>
          </div>

          <div className={styles.headerRight}>
            <div className={styles.searchGroup}>
              <input
                className={styles.searchInput}
                placeholder="Buscar por nome ou email…"
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
              type="button"
              className={styles.iconCirclePrimary}
              onClick={handleNew}
              title="Novo atendente"
            >
              <Plus size={18} />
            </button>

            <button
              type="button"
              className={styles.iconCircle}
              onClick={handleRefresh}
              title="Recarregar"
              disabled={refreshing}
            >
              <RefreshCw
                size={18}
                className={refreshing ? styles.spinning : undefined}
              />
            </button>
          </div>
        </div>
      </div>

      {/* Alertas de OK/erro */}
      {(okMsg || error) && (
        <div className={styles.alertsStack}>
          {error && (
            <div className={styles.alertErr}>
              <div className={styles.alertIcon}>⚠</div>
              <span>{error}</span>
            </div>
          )}
          {okMsg && (
            <div className={styles.alertOk}>
              <div className={styles.alertIcon}>✓</div>
              <span>{okMsg}</span>
            </div>
          )}
        </div>
      )}

      {/* Card da tabela */}
      <div className={styles.card}>
        <div className={styles.tableWrap}>
          <table className={styles.table}>
            <thead>
              <tr>
                <th className={styles.colLeft}>Nome</th>
                <th className={styles.colLeft}>Email</th>
                <th className={styles.colCenter}>Perfil</th>
                <th className={styles.colCenter}>Filas</th>
                <th className={styles.colCenter}>Ações</th>
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
                    Nenhum usuário encontrado.
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
                      <td className={styles.cellLeft} data-label="Nome">
                        {nome || "—"}
                      </td>
                      <td className={styles.cellLeft} data-label="Email">
                        {u.email || "—"}
                      </td>
                      <td className={styles.cellCenter} data-label="Perfil">
                        <span
                          className={`${styles.tag} ${styles.tagRole}`}
                          data-role={String(u.perfil || "").toLowerCase()}
                          title={u.perfil}
                          aria-label={u.perfil}
                        >
                          {iconForPerfil(u.perfil)}
                        </span>
                      </td>
                      <td className={styles.cellCenter} data-label="Filas">
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
                      <td
                        className={`${styles.cellCenter} ${styles.actionsCell}`}
                        data-label="Ações"
                      >
                        <div className={styles.actions}>
                          <Link
                            to={`/management/users/${encodeURIComponent(
                              u.id
                            )}/edit`}
                            state={{ canCreateAdmin, flowId }}
                            className={styles.qrIconBtn}
                            title="Editar"
                          >
                            <SquarePen size={16} />
                          </Link>
                          <button
                            className={`${styles.qrIconBtn} ${styles.danger}`}
                            title="Excluir"
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
