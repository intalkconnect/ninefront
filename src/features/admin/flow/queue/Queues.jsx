import React, {
  useEffect,
  useMemo,
  useState,
  useCallback,
} from "react";
import {
  ArrowLeft,
  RefreshCw,
  Plus,
  Clock3,
  SquarePen,
  Trash2,
  X as XIcon,
} from "lucide-react";
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

  const inFlowContext = !!flowId;

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

      // se vier algo não-array, garante array vazio
      setFilas(Array.isArray(data) ? data : []);
    } catch (e) {
      console.error(e);
      toast.error("Falha ao carregar filas.");
      setFilas([]);
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
        description: `Tem certeza que deseja excluir a fila "${
          queue.nome ?? queue.name
        }"? Esta ação não pode ser desfeita.`,
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

  const goBack = () => {
    if (inFlowContext) {
      navigate("/development/flowhub");
    } else {
      navigate(-1);
    }
  };

  const handleNewQueue = () => {
    navigate("/management/queues/new", { state: { flowId } });
  };

  const handleEdit = (queue) => {
    const id = queue.id ?? queue.nome ?? queue.name;
    if (!id) return;
    navigate(`/management/queues/${encodeURIComponent(id)}`, {
      state: { flowId },
    });
  };

  const handleHours = (queue) => {
    const nomeFila = queue.nome ?? queue.name ?? "";
    if (!nomeFila) return;
    navigate(`/management/queues/${encodeURIComponent(nomeFila)}/hours`, {
      state: { flowId },
    });
  };

  return (
    <div className={styles.page}>
      {/* HEADER / CONTROLES */}
      <div className={styles.headerCard}>
        <div className={styles.headerRow}>
          <button
            type="button"
            className={styles.btn}
            onClick={goBack}
            title="Voltar"
          >
            <ArrowLeft size={16} />
            <span>Voltar</span>
          </button>

          <div className={styles.headerCenter}>
            <div className={styles.title}>
              {inFlowContext ? "Filas do Flow" : "Filas de atendimento"}
            </div>
          </div>

          <button
            type="button"
            className={`${styles.btn} ${styles.iconBtn}`}
            onClick={load}
            title="Recarregar"
            aria-label="Recarregar"
          >
            <RefreshCw size={18} />
          </button>
        </div>

        {/* linha com busca + novo (na mesma linha) */}
        <div className={styles.filterRow}>
          <div className={styles.searchGroup}>
            <input
              className={styles.searchInput}
              placeholder="Buscar por nome ou descrição..."
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              aria-label="Buscar filas"
            />
            {query && (
              <button
                type="button"
                className={styles.searchClear}
                onClick={clearSearch}
                title="Limpar busca"
                aria-label="Limpar busca"
              >
                <XIcon size={14} />
              </button>
            )}
          </div>

          <button
            type="button"
            className={`${styles.btnPrimary} ${styles.iconBtn}`}
            onClick={handleNewQueue}
            title="Nova fila"
            aria-label="Nova fila"
          >
            <Plus size={20} />
          </button>
        </div>
      </div>

      {/* LISTA DE FILAS */}
      <div className={styles.bodyCard}>
        {loading ? (
          <div className={styles.stateMsg}>Carregando filas…</div>
        ) : !filtered.length ? (
          <div className={styles.stateMsg}>Nenhuma fila encontrada.</div>
        ) : (
          <div className={styles.list}>
            {filtered.map((f) => {
              const id = f.id ?? f.nome ?? f.name;
              const nomeFila = f.nome ?? f.name ?? "";
              const ativa = f.ativa !== false;
              const hex = f.color || "";
              const showHex = normalizeHexColor(hex);

              return (
                <div key={String(id)} className={styles.row}>
                  <div className={styles.rowMain}>
                    <div className={styles.rowTitle}>
                      <span
                        className={styles.statusDot}
                        style={
                          showHex
                            ? { backgroundColor: showHex }
                            : undefined
                        }
                      />
                      <span className={styles.queueName}>{nomeFila}</span>
                      <span
                        className={
                          ativa
                            ? styles.statusChipOk
                            : styles.statusChipOff
                        }
                      >
                        {ativa ? "Ativa" : "Inativa"}
                      </span>
                    </div>
                    <div className={styles.rowDesc}>
                      {f.descricao || "—"}
                    </div>
                  </div>

                  <div className={styles.rowActions}>
                    <button
                      type="button"
                      className={styles.actionBtn}
                      onClick={() => handleHours(f)}
                      title="Configurar horários e feriados"
                    >
                      <Clock3 size={16} />
                      <span>Horários</span>
                    </button>
                    <button
                      type="button"
                      className={styles.actionBtn}
                      onClick={() => handleEdit(f)}
                      title="Editar fila"
                    >
                      <SquarePen size={16} />
                      <span>Editar</span>
                    </button>
                    <button
                      type="button"
                      className={`${styles.actionBtn} ${styles.actionBtnDanger}`}
                      onClick={() => handleDelete(f)}
                      title="Excluir fila"
                    >
                      <Trash2 size={16} />
                      <span>Excluir</span>
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
