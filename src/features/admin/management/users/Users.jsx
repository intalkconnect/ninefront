// File: Users.jsx
import React, { useEffect, useMemo, useState, useCallback } from "react";
import {
  Users as UsersIcon,
  Plus,
  SquarePen,
  Trash2,
  X as XIcon,
  RefreshCw,
} from "lucide-react";
import { useNavigate, useLocation, useParams, Link } from "react-router-dom";
import { apiGet, apiDelete } from "../../../../shared/apiClient.js";
import { toast } from "react-toastify";
import { useConfirm } from "../../../../app/provider/ConfirmProvider.jsx";
import styles from "../../styles/AdminUI.module.css";

const PERFIL_ICONS = {
  admin: <UsersIcon size={14} />,
  atendente: <UsersIcon size={14} />,
  supervisor: <UsersIcon size={14} />,
};
const iconForPerfil = (perfil) => {
  const k = String(perfil || "").toLowerCase();
  return PERFIL_ICONS[k] ?? <UsersIcon size={14} />;
};

// filtros de perfil usados nos chips
const PERFIL_FILTERS = [
  { key: "", label: "Todos" },
  { key: "admin", label: "Admins" },
  { key: "supervisor", label: "Supervisores" },
  { key: "atendente", label: "Atendentes" },
];

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

  const title = flowId ? "Atendentes do flow" : "Usuários do workspace";

  return (
    <div className={styles.page}>
      <div className={styles.container}>
        {/* HEADER padrão AdminUI */}
        <header className={styles.header}>
          <div className={styles.titleBlock}>
            <h1 className={styles.title}>{title}</h1>
            <p className={styles.subtitle}>
              {flowId
                ? "Gerencie os atendentes vinculados a este flow."
                : "Cadastro e gerenciamento de usuários, perfis e filas."}
            </p>
          </div>
          <div className={styles.headerActions}>
            <button
              type="button"
              className={styles.iconCircle}
              onClick={handleRefresh}
              disabled={refreshing}
              title="Recarregar lista"
            >
              <RefreshCw
                size={18}
                className={refreshing ? styles.spinning : undefined}
              />
            </button>
            <button
              type="button"
              className={styles.iconCirclePrimary}
              onClick={handleNew}
              title="Novo usuário"
            >
              <Plus size={20} />
            </button>
          </div>
        </header>

        {/* TOOLBAR: chips de perfil + busca usando filtros padrão */}
        <section className={styles.filters}>
          <div className={styles.filterGroup}>
            <p className={styles.filterTitle}>Perfil</p>
            <div className={styles.filterChips}>
              {PERFIL_FILTERS.map((f) => (
                <button
                  key={f.key || "all"}
                  type="button"
                  className={`${styles.chip} ${
                    statusFilter === f.key ? styles.chipActive : ""
                  }`}
                  aria-pressed={statusFilter === f.key}
                  onClick={() => setStatusFilter(f.key)}
                >
                  {f.label}
                </button>
              ))}
            </div>
          </div>

          <div className={styles.filterRow}>
            <div className={styles.group}>
              <label className={styles.label}>Busca</label>
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
            </div>
          </div>
        </section>

        {/* Alertas de OK/erro no padrão adminui */}
        {error && (
          <div className={styles.alertErr}>
            <span>{error}</span>
          </div>
        )}
        {okMsg && (
          <div className={styles.alertOk}>
            <span>{okMsg}</span>
          </div>
        )}

        {/* Card da tabela no padrão AdminUI (tableCard/tableScroll/table) */}
        <section className={styles.tableCard}>
          <div className={styles.tableHeader}>
            <h2 className={styles.tableTitle}>{title}</h2>
          </div>

          <div className={styles.tableScroll}>
            <table className={styles.table}>
              <thead>
                <tr>
                  {/* TODAS as colunas centralizadas pelo CSS genérico da tabela */}
                  <th>Nome</th>
                  <th>Email</th>
                  <th>Perfil</th>
                  <th>Filas</th>
                  <th>Ações</th>
                </tr>
              </thead>
              <tbody>
                {loading &&
                  Array.from({ length: 6 }).map((_, i) => (
                    <tr key={`sk-${i}`}>
                      <td colSpan={5}>
                        <div
                          className={`${styles.skeleton} ${styles.sq48}`}
                        />
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
                        <td data-label="Nome">{nome || "—"}</td>
                        <td data-label="Email">{u.email || "—"}</td>
                        <td data-label="Perfil">
                          <span className={styles.pill}>
                            {iconForPerfil(u.perfil)}
                            <span>{u.perfil || "—"}</span>
                          </span>
                        </td>
                        <td data-label="Filas">
                          {chipNames.length === 0 ? (
                            <span className={styles.muted}>—</span>
                          ) : (
                            <div className={styles.tagRow}>
                              {chipNames.map((n, i) => (
                                <span
                                  key={`${u.id}-f-${i}`}
                                  className={styles.tagChip}
                                >
                                  <span className={styles.tagLabel}>{n}</span>
                                </span>
                              ))}
                            </div>
                          )}
                        </td>
                        <td
                          data-label="Ações"
                          className={styles.actionsCell}
                        >
                          <Link
                            to={`/management/users/${encodeURIComponent(
                              u.id
                            )}/edit`}
                            state={{ canCreateAdmin, flowId }}
                            className={styles.iconBtn}
                            title="Editar"
                          >
                            <SquarePen size={16} />
                          </Link>
                          <button
                            className={`${styles.iconBtn} ${styles.iconDanger}`}
                            title="Excluir"
                            onClick={() => handleDelete(u)}
                          >
                            <Trash2 size={16} />
                          </button>
                        </td>
                      </tr>
                    );
                  })}
              </tbody>
            </table>
          </div>
        </section>
      </div>
    </div>
  );
}
