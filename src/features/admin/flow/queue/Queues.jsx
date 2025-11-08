import React, {
  useEffect,
  useMemo,
  useState,
  useCallback,
} from "react";
import {
  ArrowLeft,
  RefreshCw,
  Clock3,
  SquarePen,
  Trash2,
  Plus,
} from "lucide-react";
import {
  useNavigate,
  useLocation,
  useParams,
} from "react-router-dom";
import { apiGet, apiDelete } from "../../../../shared/apiClient";
import { useConfirm } from "../../../../app/provider/ConfirmProvider.jsx";
import { toast } from "react-toastify";

import LogoLoader from "../../../../components/common/LogoLoader";

import styles from "./styles/Queues.module.css";

function normalizeHexColor(input) {
  if (!input) return null;
  let c = String(input).trim();
  if (!c) return null;
  if (!c.startsWith("#")) c = `#${c}`;
  if (/^#([0-9a-fA-F]{3})$/.test(c)) {
    c =
      "#" +
      c
        .slice(1)
        .split("")
        .map((ch) => ch + ch)
        .join("");
  }
  return /^#([0-9a-fA-F]{6})$/.test(c) ? c.toUpperCase() : null;
}

export default function Queues() {
  const navigate = useNavigate();
  const location = useLocation();
  const params = useParams();
  const confirm = useConfirm();

  const flowId =
    params.flowId ||
    location.state?.flowId ||
    location.state?.meta?.flowId ||
    null;

  const [loading, setLoading] = useState(true);
  const [flowName, setFlowName] = useState("");

  const [filas, setFilas] = useState([]);
  const [query, setQuery] = useState("");

  const loadAll = useCallback(async () => {
    setLoading(true);
    try {
      if (flowId) {
        try {
          const meta = await apiGet(`/flows/${flowId}`);
          setFlowName(meta?.name || "");
        } catch {
          setFlowName("");
        }
      } else {
        setFlowName("");
      }

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
    loadAll();
  }, [loadAll]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return filas;
    return filas.filter((f) => {
      const nome = String(f.nome ?? f.name ?? "").toLowerCase();
      const desc = String(f.descricao ?? "").toLowerCase();
      return nome.includes(q) || desc.includes(q);
    });
  }, [filas, query]);

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
      loadAll();
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

  const handleBack = () => {
    if (flowId) {
      navigate("/development/flowhub");
    } else {
      navigate(-1);
    }
  };

  const handleNewQueue = () =>
    navigate("/management/queues/new", {
      state: { flowId },
    });

  return (
    <div className={styles.page}>
      {/* HEADER – igual FlowChannels, mas sem a linha de id/nome */}
      <div className={styles.header}>
        <div className={styles.titleRow}>
          <button
            onClick={handleBack}
            className={styles.btn}
            title="Voltar"
            type="button"
          >
            <ArrowLeft size={14} />
            <span>Voltar</span>
          </button>
        </div>

        <div className={styles.metaRow}>
          <div className={styles.flowMeta}>
            {flowId ? "Filas do Flow" : "Filas de atendimento"}
          </div>
          {/* opcional: se quiser, pode colocar o nome do flow embaixo,
              mas no print você marcou para remover a linha */}
          {false && flowId && (
            <div className={styles.flowInfo}>
              <span className={styles.dim}>id:</span>&nbsp;<b>{flowId}</b>
              {flowName && (
                <>
                  <span className={styles.sep}>·</span>
                  <span className={styles.dim}>nome:</span>&nbsp;<b>{flowName}</b>
                </>
              )}
            </div>
          )}
        </div>

        <button
          onClick={loadAll}
          className={styles.btn}
          type="button"
          title="Recarregar"
        >
          <RefreshCw size={14} />
          <span>Recarregar</span>
        </button>
      </div>

      {loading ? (
        <LogoLoader full size={56} src="/logo.png" />
      ) : (
        <>
          {/* TOOLBAR – sem o chip de contador, só busca + Nova fila */}
          <div className={styles.toolbar}>
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
                  className={styles.searchClear}
                  onClick={() => setQuery("")}
                  title="Limpar busca"
                  aria-label="Limpar busca"
                  type="button"
                >
                  ×
                </button>
              )}
            </div>

            <div className={styles.toolbarRight}>
              <button
                className={styles.btnPrimary}
                type="button"
                onClick={handleNewQueue}
              >
                <Plus size={14} />
                <span>Nova fila</span>
              </button>
            </div>
          </div>

          {/* LISTA DE FILAS – cards empilhados */}
          <div className={styles.list}>
            {filtered.length === 0 ? (
              <div className={styles.emptyCard}>
                Nenhuma fila encontrada para os filtros atuais.
              </div>
            ) : (
              filtered.map((f) => {
                const id = f.id ?? f.nome ?? f.name;
                const nomeFila = f.nome ?? f.name ?? "";
                const hex = f.color || "";
                const showHex = normalizeHexColor(hex) || "#22c55e";
                const ativa =
                  typeof f.ativa === "boolean" ? f.ativa : true;

                return (
                  <div key={String(id)} className={styles.queueCard}>
                    <div className={styles.queueMain}>
                      <div className={styles.queueHead}>
                        <span
                          className={styles.queueDot}
                          style={{ backgroundColor: showHex }}
                        />
                        <span className={styles.queueTitle}>
                          {nomeFila}
                        </span>
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
                      <div className={styles.queueDesc}>
                        {f.descricao || "Sem descrição."}
                      </div>
                    </div>

                    <div className={styles.queueActions}>
                      <button
                        type="button"
                        className={styles.btnGhost}
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
                        <Clock3 size={14} />
                        <span>Horários</span>
                      </button>

                      <button
                        type="button"
                        className={styles.btnGhost}
                        title="Editar"
                        onClick={() =>
                          navigate(
                            `/management/queues/${encodeURIComponent(id)}`,
                            { state: { flowId } }
                          )
                        }
                      >
                        <SquarePen size={14} />
                        <span>Editar</span>
                      </button>

                      <button
                        type="button"
                        className={styles.btnDanger}
                        title="Excluir"
                        onClick={() => handleDelete(f)}
                      >
                        <Trash2 size={14} />
                        <span>Excluir</span>
                      </button>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </>
      )}
    </div>
  );
}
