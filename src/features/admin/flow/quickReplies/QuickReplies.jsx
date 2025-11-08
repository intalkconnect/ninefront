// src/pages/QuickReplies/QuickReplies.jsx
import React, { useEffect, useMemo, useState, useCallback } from "react";
import { apiGet, apiDelete, apiPut } from "../../../../shared/apiClient.js";
import { useConfirm } from "../../../../app/provider/ConfirmProvider.jsx";
import { toast } from "react-toastify";
import styles from "./styles/QuickReplies.module.css";
import {
  Save as SaveIcon,
  Edit3 as EditIcon,
  Trash2 as TrashIcon,
  X as XIcon,
  RefreshCw,
  ArrowLeft,
} from "lucide-react";
import { useParams, useNavigate } from "react-router-dom";

import QuickReplyModal from "./QuickReplyModal";

const QuickReplies = () => {
  const { flowId } = useParams();
  const navigate = useNavigate();
  const inFlowContext = Boolean(flowId);

  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState(null);
  const [successMsg, setSuccessMsg] = useState(null);

  const [flowName, setFlowName] = useState("");

  // busca
  const [query, setQuery] = useState("");

  // modal
  const [createOpen, setCreateOpen] = useState(false);

  // edição inline
  const [deletingId, setDeletingId] = useState(null);
  const [editingId, setEditingId] = useState(null);
  const [editTitle, setEditTitle] = useState("");
  const [editContent, setEditContent] = useState("");
  const [savingId, setSavingId] = useState(null);
  const confirm = useConfirm();

  const showSuccess = useCallback((msg) => {
    setSuccessMsg(msg);
    setTimeout(() => setSuccessMsg(null), 2600);
  }, []);

  const load = useCallback(async () => {
    setLoading(true);
    setRefreshing(true);
    setError(null);
    try {
      const qs = flowId ? `?flow_id=${encodeURIComponent(flowId)}` : "";

      const [data, flowMeta] = await Promise.all([
        apiGet(`/quick-replies${qs}`),
        flowId ? apiGet(`/flows/${encodeURIComponent(flowId)}`) : null,
      ]);

      setItems(Array.isArray(data) ? data : []);
      if (flowMeta) {
        setFlowName(flowMeta?.name ?? flowMeta?.nome ?? "");
      }
    } catch (e) {
      console.error(e);
      setError("Falha ao carregar respostas rápidas. Verifique sua conexão.");
      toast.error(
        "Falha ao carregar respostas rápidas. Verifique sua conexão."
      );
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
      const qs = flowId ? `?flow_id=${encodeURIComponent(flowId)}` : "";
      const updated = await apiPut(`/quick-replies/${id}${qs}`, {
        title: editTitle.trim(),
        content: editContent.trim(),
        ...(flowId ? { flow_id: flowId } : {}),
      });

      setItems((prev) =>
        prev.map((item) => (item.id === id ? { ...item, ...updated } : item))
      );
      setEditingId(null);
      setEditTitle("");
      setEditContent("");
      toast.success("Resposta atualizada.");
    } catch (e) {
      console.error(e);
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

      const qs = flowId ? `?flow_id=${encodeURIComponent(flowId)}` : "";
      await apiDelete(`/quick-replies/${id}${qs}`);

      setItems((prev) => prev.filter((r) => r.id !== id));
      toast.success("Resposta removida.");
    } catch (e) {
      console.error(e);
      setError("Erro ao excluir resposta. Tente novamente.");
      toast.error("Erro ao excluir resposta. Tente novamente.");
    } finally {
      setDeletingId(null);
    }
  };

  const clearSearch = () => setQuery("");

  const handleBack = () => {
    if (inFlowContext) {
      navigate("/development/flowhub");
    } else {
      navigate(-1);
    }
  };

  return (
    <div className={styles.page} data-page="quickreplies">
      {/* HEADER NO PADRÃO (Voltar + título + meta + busca/ações) */}
      <div className={styles.headerCard}>
        <button className={styles.btn} onClick={handleBack}>
          <ArrowLeft size={14} />
          <span>Voltar</span>
        </button>

        <div className={styles.headerCenter}>
          <div className={styles.headerTitle}>Respostas rápidas</div>
          {flowName && (
            <div className={styles.headerMeta}>
              Flow:
              <span className={styles.headerMetaName}>{flowName}</span>
            </div>
          )}
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

          <button
            type="button"
            className={styles.iconBtnPrimary}
            onClick={() => setCreateOpen(true)}
          >
            + Nova resposta
          </button>

          <button
            className={styles.iconBtn}
            title="Recarregar"
            onClick={load}
            disabled={refreshing}
            type="button"
          >
            <RefreshCw
              size={16}
              className={refreshing ? styles.spinning : ""}
            />
          </button>
        </div>
      </div>

      {error && (
        <div className={styles.alertErr}>
          <span>{error}</span>
        </div>
      )}
      {successMsg && (
        <div className={styles.alertOk}>
          <span>{successMsg}</span>
        </div>
      )}

      {/* CARD TABELA */}
      <div className={styles.card}>
        <div className={styles.cardHead}>
          <div className={styles.cardActions}>
            <div
              className={styles.counter}
              aria-label="Total de itens filtrados"
            >
              <span className={styles.counterNumber}>{filtered.length}</span>
              <span>{filtered.length === 1 ? "item" : "itens"}</span>
            </div>
          </div>
        </div>

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

                    <td className={styles.actionsCell} data-label="Ações">
                      {editingId === item.id ? (
                        <div className={styles.actions}>
                          <button
                            className={`${styles.qrIconBtn} ${styles.iconSuccess}`}
                            onClick={() => saveEdit(item.id)}
                            disabled={savingId === item.id}
                            type="button"
                            title="Salvar"
                            aria-label="Salvar"
                          >
                            <SaveIcon size={18} />
                          </button>
                          <button
                            className={styles.qrIconBtn}
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
                            className={styles.qrIconBtn}
                            onClick={() => startEdit(item)}
                            type="button"
                            title="Editar"
                            aria-label="Editar"
                          >
                            <EditIcon size={18} />
                          </button>
                          <button
                            className={`${styles.qrIconBtn} ${styles.iconDanger}`}
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
          showSuccess("Resposta criada com sucesso.");
        }}
        flowId={flowId}
      />
    </div>
  );
};

export default QuickReplies;
