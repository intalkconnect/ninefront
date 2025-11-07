import React, { useEffect, useMemo, useState, useCallback } from "react";
import { Clock3, X as XIcon, SquarePen, Trash2, Plus } from "lucide-react";
import { useNavigate, useLocation, useParams } from "react-router-dom";
import { apiGet, apiDelete } from "../../../../shared/apiClient";
import { useConfirm } from "../../../../app/provider/ConfirmProvider.jsx";
import { toast } from "react-toastify";
import styles from "./styles/Queues.module.css";

export default function Queues() {
  const navigate = useNavigate();
  const location = useLocation();
  const params = useParams();

  // flowId pode vir da URL (/development/flowhub/:flowId/queues)
  // ou do state enviado pelo FlowHub
  const flowId =
    params.flowId ||
    location.state?.flowId ||
    location.state?.meta?.flowId ||
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
      c =
        "#" +
        c
          .slice(1)
          .split("")
          .map((ch) => ch + ch)
          .join("");
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

      // tenta extrair mensagem amigável
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

  const totalFilas = filtered.length;
  const contadorLabel =
    totalFilas === 0
      ? "Nenhuma fila"
      : totalFilas === 1
      ? "1 fila"
      : `${totalFilas} filas`;

  const handleNew = () =>
    navigate("/management/queues/new", {
      state: { flowId },
    });

  return (
    <div className={styles.container}>
      {/* HEADER */}
      <div className={styles.header}>
        <div>
          <h1 className={styles.title}>Filas de atendimento</h1>
          <p className={styles.subtitle}>
            Crie, edite, configure horários e exclua filas de atendimento.
          </p>
        </div>
        {flowId && (
          <div className={styles.flowContext}>
            <span className={styles.flowContextLabel}>Contexto do fluxo</span>
            <span className={styles.flowContextId}>{flowId}</span>
          </div>
        )}
      </div>

      {/* PAINEL PRINCIPAL */}
      <div className={styles.panel}>
        {/* Header do painel: busca + contador + nova fila */}
        <div className={styles.panelHeader}>
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
                onClick={clearSearch}
                title="Limpar busca"
                aria-label="Limpar busca"
                type="button"
              >
                <XIcon size={14} />
              </button>
            )}
          </div>

          <div className={styles.panelHeaderRight}>
            <span className={styles.counterPill}>{contadorLabel}</span>
            <button
              type="button"
              className={styles.btnPrimary}
              onClick={handleNew}
            >
              <Plus size={16} />
              Nova fila
            </button>
          </div>
        </div>

        {/* LISTA DE FILAS */}
        <div className={styles.listArea}>
          {loading && (
            <div className={styles.feedbackRow}>Carregando filas...</div>
          )}

          {!loading && filtered.length === 0 && (
            <div className={styles.feedbackRow}>
              Nenhuma fila encontrada para os filtros atuais.
            </div>
          )}

          {!loading &&
            filtered.map((f) => {
              const id = f.id ?? f.nome ?? f.name;
              const nomeFila = f.nome ?? f.name ?? "";
              const hex = f.color || "";
              const showHex = normalizeHexColor(hex) || "#4ade80"; // verde claro padrão
              const ativa =
                typeof f.ativa === "boolean" ? f.ativa : true; // default

              return (
                <div key={String(id)} className={styles.queueCard}>
                  {/* Coluna principal: nome + descrição */}
                  <div className={styles.queueMain}>
                    <div className={styles.queueTitleRow}>
                      <span
                        className={styles.queueDot}
                        style={{ backgroundColor: showHex }}
                      />
                      <span className={styles.queueName}>{nomeFila}</span>
                      <span
                        className={
                          ativa
                            ? styles.queueStatusActive
                            : styles.queueStatusInactive
                        }
                      >
                        {ativa ? "Ativa" : "Inativa"}
                      </span>
                    </div>
                    <div className={styles.queueDesc}>
                      {f.descricao || "Sem descrição."}
                    </div>
                  </div>

                  {/* Ações */}
                  <div className={styles.queueActions}>
                    <button
                      type="button"
                      className={`${styles.actionBtn} ${styles.actionBtnSoft}`}
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
                      Horários
                    </button>

                    <button
                      type="button"
                      className={`${styles.actionBtn} ${styles.actionBtnSoft}`}
                      title="Editar fila"
                      onClick={() =>
                        navigate(`/management/queues/${encodeURIComponent(id)}`, {
                          state: { flowId },
                        })
                      }
                    >
                      <SquarePen size={16} />
                      Editar
                    </button>

                    <button
                      type="button"
                      className={`${styles.actionBtn} ${styles.actionBtnDanger}`}
                      title="Excluir fila"
                      onClick={() => handleDelete(f)}
                    >
                      <Trash2 size={16} />
                      Excluir
                    </button>
                  </div>
                </div>
              );
            })}
        </div>
      </div>
    </div>
  );
}
