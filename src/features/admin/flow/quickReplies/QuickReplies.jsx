// src/pages/QuickReplies/QuickReplies.jsx
import React, {
  useEffect,
  useMemo,
  useState,
  useCallback,
} from "react";
import {
  MessageSquare,
  Save as SaveIcon,
  Edit3 as EditIcon,
  Trash2 as TrashIcon,
  X as XIcon,
  ArrowLeft,
  RefreshCw,
} from "lucide-react";
import {
  apiGet,
  apiDelete,
  apiPut,
} from "../../../../shared/apiClient.js";
import { useConfirm } from "../../../../app/provider/ConfirmProvider.jsx";
import { toast } from "react-toastify";
import { useLocation, useNavigate, useParams } from "react-router-dom";
import styles from "./styles/QuickReplies.module.css";

import QuickReplyModal from "./QuickReplyModal";

const QuickReplies = () => {
  const { flowId } = useParams();
  const location = useLocation();
  const navigate = useNavigate();
  const confirm = useConfirm();

  // flow_id efetivo (params > state > null)
  const flowIdFromState = location.state?.flowId || location.state?.meta?.flowId;
  const effectiveFlowId = flowId || flowIdFromState || null;
  const inFlowContext = Boolean(effectiveFlowId);

  const [items, setItems] = useState([]);
  const [flowName, setFlowName] = useState("");

  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  const [error, setError] = useState(null);

  // busca
  const [query, setQuery] = useState("");

  // modal criação
  const [createOpen, setCreateOpen] = useState(false);

  // edição inline
  const [deletingId, setDeletingId] = useState(null);
  const [editingId, setEditingId] = useState(null);
  const [editTitle, setEditTitle] = useState("");
  const [editContent, setEditContent] = useState("");
  const [savingId, setSavingId] = useState(null);

  const qs = effectiveFlowId
    ? `?flow_id=${encodeURIComponent(effectiveFlowId)}`
    : "";

  const load = useCallback(async () => {
    setLoading(true);
    setRefreshing(true);
    setError(null);
    try {
      const [data, flowMeta] = await Promise.all([
        apiGet(`/quick-replies${qs}`),
        effectiveFlowId
          ? apiGet(`/flows/${encodeURIComponent(effectiveFlowId)}`)
          : Promise.resolve(null),
      ]);

      setItems(Array.isArray(data) ? data : []);

      if (flowMeta) {
        const fm = flowMeta?.data ?? flowMeta;
        setFlowName(fm?.name ?? fm?.nome ?? "");
      }
    } catch (e) {
      setError("Falha ao carregar respostas rápidas. Verifique sua conexão.");
      toast.error("Falha ao carregar respostas rápidas. Verifique sua conexão.");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [qs, effectiveFlowId]);

  useEffect(() => {
    load();
  }, [load]);

  const clearSearch = () => setQuery("");

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    const base = [...items].sort((a, b) =>
      String(a.title || "").localeCompare(String(b.title || ""), undefined, {
        sensitivity: "base",
      })
    );
    if (!q) return base;
    return base.filter((r) => {
      const t = String(r.title || "").toLowerCase();
      const c = String(r.content || "").toLowerCase();
      return t.includes(q) || c.includes(q);
    });
  }, [items, query]);

  // edição
  const startEdit = (item) => {
    setEditingId(item.id);
    setEditTitle(item.title || "");
    setEditContent(item.content || "");
  };
  const cancelEdit = () => {
    setEditingId(null);
    setEditTitle("");
    setEditContent("");
  };
  const saveEdit = async (id) => {
    if (!editTitle.trim() || !editContent.trim()) {
      setError("Título e conteúdo são obrigatórios.");
      toast.warn("Título e conteúdo são obrigatórios.");
      return;
    }
    setSavingId(id);
    setError(null);
    try {
      const updated = await apiPut(`/quick-replies/${id}${qs}`, {
        title: editTitle.trim(),
        content: editContent.trim(),
      });
      setItems((prev) =>
        prev.map((item) => (item.id === id ? { ...item, ...updated } : item))
      );
      setEditingId(null);
      setEditTitle("");
      setEditContent("");
      toast.success("Resposta atualizada.");
    } catch (e) {
      setError("Erro ao salvar alterações. Tente novamente.");
      toast.error("Erro ao salvar alterações. Tente novamente.");
    } finally {
      setSavingId(null);
    }
  };

  // remover
  const handleDelete = async (id) => {
    setDeletingId(id);
    setError(null);
    try {
      const ok = await confirm({
        title: "Excluir resposta?",
        description:
          "Tem certeza que deseja excluir essa resposta rápida? Esta ação não pode ser desfeita.",
        confirmText: "Excluir",
        cancelText: "Cancelar",
        tone: "danger",
      });
      if (!ok) return;
      await apiDelete(`/quick-replies/${id}${qs}`);
      setItems((prev) => prev.filter((r) => r.id !== id));
      toast.success("Resposta removida.");
    } catch (e) {
      setError("Erro ao excluir resposta. Tente novamente.");
      toast.error("Erro ao excluir resposta. Tente novamente.");
    } finally {
      setDeletingId(null);
    }
  };

  const handleBack = () => {
    if (inFlowContext) {
      navigate("/development/flowhub");
    } else {
      navigate(-1);
    }
  };

  return (
    <div className={styles.page} data-page="quickreplies">
      {/* HEADER PADRONIZADO (igual queues/agents) */}
      <div className={styles.headerCard}>
        <button type="button" className={styles.btn} onClick={handleBack}>
          <ArrowLeft size={14} />
          <span>Voltar</span>
        </button>

        <div className={styles.headerCenter}>
          <div className={styles.headerTitle}>
            <span className={styles.headerIcon}>
              <MessageSquare size={18} />
            </span>
            <span>Respostas rápidas</span>
          </div>
          <p className={styles.headerSubtitle}>
            Atalhos de mensagens para agilizar o atendimento.
            {inFlowContext && flowName && (
              <>
                {" "}
                <span className={styles.flowBadge}>
                  Flow: <strong>{flowName}</strong>
                </span>
              </>
            )}
          </p>
        </div>

        <div className={styles.headerRight}>
          <div className={styles.searchGroup}>
            <input
              className={styles.searchInput}
              placeholder="Buscar por título ou conteúdo..."
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              aria-label="Buscar respostas"
            />
            {query && (
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

          <div
            className={styles.counter}
            aria-label="Total de itens filtrados"
          >
            <span className={styles.counterNumber}>{filtered.length}</span>
            <span>{filtered.length === 1 ? "item" : "itens"}</span>
          </div>

          <button
            type="button"
            className={styles.iconBtn}
            title="Recarregar"
            onClick={load}
            disabled={refreshing}
          >
            <RefreshCw
              size={16}
              className={refreshing ? styles.spinning : ""}
            />
          </button>

          <button
            type="button"
            className={styles.btnPrimary}
            onClick={() => setCreateOpen(true)}
          >
            + Nova resposta
          </button>
        </div>
      </div>

      {error && <div className={styles.alertErr}>{error}</div>}

      {/* CARD TABELA */}
      <div className={styles.card}>
        <div className={styles.tableWrap}>
          <table className={styles.table} role="table">
            <thead>
              <tr>
                <th style={{ minWidth: 280 }}>Título</th>
                <th>Conteúdo</th>
                <th style={{ width: 220, textAlign: "right" }}>Ações</th>
              </tr>
            </thead>
            <tbody>
              {loading && (
                <tr>
                  <td colSpan={3} className={styles.empty}>
                    Carregando respostas…
                  </td>
                </tr>
              )}

              {!loading && filtered.length === 0 && (
                <tr>
                  <td colSpan={3} className={styles.empty}>
                    <div>Nenhuma resposta encontrada.</div>
                    {query && (
                      <button
                        className={styles.btnLink}
                        onClick={clearSearch}
                        type="button"
                      >
                        Limpar filtro
                      </button>
                    )}
                  </td>
                </tr>
              )}

              {!loading &&
                filtered.map((item) => (
                  <tr key={item.id} className={styles.tableRow}>
                    <td data-label="Título">
                      {editingId === item.id ? (
                        <input
                          className={styles.editInput}
                          value={editTitle}
                          onChange={(e) => setEditTitle(e.target.value)}
                          placeholder="Título"
                          autoFocus
                        />
                      ) : (
                        <div className={styles.keyTitle}>{item.title}</div>
                      )}
                    </td>

                    <td data-label="Conteúdo">
                      {editingId === item.id ? (
                        <textarea
                          className={styles.editTextarea}
                          value={editContent}
                          onChange={(e) => setEditContent(e.target.value)}
                          rows={3}
                          placeholder="Conteúdo"
                        />
                      ) : (
                        <div className={styles.contentText}>
                          {item.content}
                        </div>
                      )}
                    </td>

                    <td
                      className={styles.actionsCell}
                      data-label="Ações"
                    >
                      {editingId === item.id ? (
                        <div className={styles.actions}>
                          <button
                            className={`${styles.iconBtn} ${styles.iconSuccess}`}
                            onClick={() => saveEdit(item.id)}
                            disabled={savingId === item.id}
                            type="button"
                            title="Salvar"
                            aria-label="Salvar"
                          >
                            <SaveIcon size={18} />
                          </button>
                          <button
                            className={styles.iconBtn}
                            onClick={cancelEdit}
                            disabled={savingId === item.id}
                            type="button"
                            title="Cancelar"
                            aria-label="Cancelar"
                          >
                            <XIcon size={18} />
                          </button>
                        </div>
                      ) : (
                        <div className={styles.actions}>
                          <button
                            className={styles.iconBtn}
                            onClick={() => startEdit(item)}
                            type="button"
                            title="Editar"
                            aria-label="Editar"
                          >
                            <EditIcon size={18} />
                          </button>
                          <button
                            className={`${styles.iconBtn} ${styles.iconDanger}`}
                            onClick={() => handleDelete(item.id)}
                            disabled={deletingId === item.id}
                            type="button"
                            title="Excluir"
                            aria-label="Excluir"
                          >
                            <TrashIcon size={18} />
                          </button>
                        </div>
                      )}
                    </td>
                  </tr>
                ))}
            </tbody>
          </table>
        </div>
      </div>

      <div className={styles.footer}>
        <div className={styles.footerContent}>
          <div className={styles.tip}>
            <strong>Dica:</strong> Prefira títulos descritivos para encontrar
            rapidamente suas respostas.
          </div>
        </div>
      </div>

      <QuickReplyModal
        isOpen={createOpen}
        onClose={() => setCreateOpen(false)}
        onCreated={() => {
          setCreateOpen(false);
          load();
        }}
        flowId={effectiveFlowId}
      />
    </div>
  );
};

export default QuickReplies;
