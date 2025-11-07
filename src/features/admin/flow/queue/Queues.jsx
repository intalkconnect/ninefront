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

  // flowId pode vir da URL (ex.: /development/flowhub/:flowId/queues)
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

      // tenta pegar a mensagem amigável da API
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

  return (
    <div className={styles.container}>
      {/* HEADER no mesmo espírito de Channels */}
      <div className={styles.header}>
        <div>
          <h1 className={styles.title}>Filas de atendimento</h1>
          <p className={styles.subtitle}>
            Crie, edite, configure horários e exclua filas de atendimento.
          </p>
        </div>

        <div className={styles.headerRight}>
          {flowId ? (
            <div className={styles.contextPill}>
              <span className={styles.contextLabel}>Contexto do fluxo</span>
              <span className={styles.contextValue}>{flowId}</span>
            </div>
          ) : (
            <span className={styles.contextHint}>
              Sem contexto de flow (todas as filas)
            </span>
          )}
        </div>
      </div>

      {/* LISTA EM CARDS EMPILHADOS */}
      <div className={styles.listCard}>
        <div className={styles.listToolbar}>
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
            aria-label="Total de filas filtradas"
          >
            <span className={styles.counterNumber}>{filtered.length}</span>
            <span>{filtered.length === 1 ? "fila" : "filas"}</span>
          </div>

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

        <div className={styles.listArea}>
          {loading && <div className={styles.empty}>Carregando…</div>}

          {!loading && filtered.length === 0 && (
            <div className={styles.empty}>Nenhuma fila encontrada.</div>
          )}

          {!loading && filtered.length > 0 && (
            <div className={styles.stackList}>
              {filtered.map((f) => {
                const id = f.id ?? f.nome ?? f.name;
                const nomeFila = f.nome ?? f.name ?? "";
                const hex = f.color || "";
                const showHex = normalizeHexColor(hex);
                const ativa = f.ativa !== false;

                return (
                  <div key={String(id)} className={styles.queueRow}>
                    {/* Esquerda: nome + descrição */}
                    <div className={styles.queueRowMain}>
                      <div className={styles.queueNameLine}>
                        <span
                          className={styles.colorDot}
                          style={{ background: showHex || "#fff" }}
                        />
                        <span className={styles.queueTitle}>{nomeFila}</span>
                        <span
                          className={
                            ativa ? styles.statusOk : styles.statusOff
                          }
                        >
                          {ativa ? "Ativa" : "Inativa"}
                        </span>
                      </div>
                      <p className={styles.queueDesc}>
                        {f.descricao || "—"}
                      </p>
                    </div>

                    {/* Direita: ações */}
                    <div className={styles.queueRowActions}>
                      <button
                        type="button"
                        className={styles.btnSecondary}
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
                        <span>Horários</span>
                      </button>

                      <button
                        type="button"
                        className={styles.btnSecondary}
                        title="Editar fila"
                        onClick={() =>
                          navigate(
                            `/management/queues/${encodeURIComponent(id)}`,
                            { state: { flowId } }
                          )
                        }
                      >
                        <SquarePen size={16} />
                        <span>Editar</span>
                      </button>

                      <button
                        type="button"
                        className={styles.btnDanger}
                        title="Excluir fila"
                        onClick={() => handleDelete(f)}
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
    </div>
  );
}
