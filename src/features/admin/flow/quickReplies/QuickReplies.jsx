// src/pages/QuickReplies/QuickReplies.jsx
import React, { useEffect, useMemo, useState, useCallback } from "react";
import {
  ArrowLeft,
  RefreshCw,
  Plus,
  SquarePen,
  Trash2,
  Save as SaveIcon,
  X as XIcon,
} from "lucide-react";
import { useNavigate, useLocation, useParams } from "react-router-dom";
import { apiGet, apiDelete, apiPut } from "../../../../shared/apiClient";
import { useConfirm } from "../../../../app/provider/ConfirmProvider.jsx";
import { toast } from "react-toastify";
import QuickReplyModal from "./QuickReplyModal";
import styles from "./styles/QuickReplies.module.css";

export default function QuickReplies() {
  const navigate = useNavigate();
  const location = useLocation();
  const params = useParams();
  const confirm = useConfirm();

  // flowId pode vir da URL ou do state
  const flowIdParam = params.flowId || null;
  const flowIdFromState =
    location.state?.flowId || location.state?.meta?.flowId || null;
  const flowId = flowIdParam || flowIdFromState || null;
  const inFlowContext = !!flowId;

  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(false);
  const [query, setQuery] = useState("");

  const [createOpen, setCreateOpen] = useState(false);

  const [editingId, setEditingId] = useState(null);
  const [editTitle, setEditTitle] = useState("");
  const [editContent, setEditContent] = useState("");
  const [savingId, setSavingId] = useState(null);

  const [deletingId, setDeletingId] = useState(null);

  const qs = flowId ? `?flow_id=${encodeURIComponent(flowId)}` : "";

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const data = await apiGet(`/quick-replies${qs}`);
      setItems(Array.isArray(data) ? data : []);
    } catch (e) {
      console.error(e);
      toast.error("Falha ao carregar respostas rápidas.");
      setItems([]);
    } finally {
      setLoading(false);
    }
  }, [qs]);

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

  const clearSearch = () => setQuery("");

  function startEdit(item) {
    setEditingId(item.id);
    setEditTitle(item.title || "");
    setEditContent(item.content || "");
  }

  function cancelEdit() {
    setEditingId(null);
    setEditTitle("");
    setEditContent("");
  }

  async function saveEdit(id) {
    const t = editTitle.trim();
    const c = editContent.trim();

    if (!t || !c) {
      toast.warn("Título e conteúdo são obrigatórios.");
      return;
    }

    setSavingId(id);
    try {
      const updated = await apiPut(
        `/quick-replies/${encodeURIComponent(id)}${qs}`,
        {
          title: t,
          content: c,
          ...(flowId ? { flow_id: flowId } : {}),
        }
      );

      setItems((prev) =>
        prev.map((item) => (item.id === id ? { ...item, ...updated } : item))
      );
      toast.success("Resposta atualizada.");
      cancelEdit();
    } catch (e) {
      console.error(e);
      toast.error("Erro ao salvar alterações. Tente novamente.");
    } finally {
      setSavingId(null);
    }
  }

  async function handleDelete(id) {
    setDeletingId(id);
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

      await apiDelete(`/quick-replies/${encodeURIComponent(id)}${qs}`);
      setItems((prev) => prev.filter((r) => r.id !== id));
      toast.success("Resposta removida.");
    } catch (e) {
      console.error(e);
      toast.error("Erro ao excluir resposta. Tente novamente.");
    } finally {
      setDeletingId(null);
    }
  }

  return (
    <div className={styles.page}>
      {/* HEADER / CONTROLES */}
      <div className={styles.headerCard}>
        <div className={styles.headerRow}>
          {/* Voltar */}
          <button
            type="button"
            className={styles.btn}
            onClick={() => navigate(-1)}
            title="Voltar"
          >
            <ArrowLeft size={16} />
            <span>Voltar</span>
          </button>

          {/* Título centralizado */}
          <div className={styles.headerCenter}>
            <div className={styles.title}>Respostas rápidas</div>
          </div>

          {/* Direita: busca + nova resposta + recarregar */}
          <div className={styles.headerRight}>
            <div className={styles.searchGroup}>
              <input
                className={styles.searchInput}
                placeholder="Buscar por título ou conteúdo..."
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                aria-label="Buscar respostas rápidas"
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
              onClick={() => setCreateOpen(true)}
              title="Nova resposta rápida"
              aria-label="Nova resposta rápida"
            >
              <Plus size={18} />
            </button>

            <button
              type="button"
              className={`${styles.btn} ${styles.iconBtn}`}
              onClick={load}
              title="Recarregar"
              aria-label="Recarregar"
            >
              <RefreshCw size={16} />
            </button>
          </div>
        </div>
      </div>

      {/* LISTA DE RESPOSTAS */}
      <div className={styles.bodyCard}>
        {loading ? (
          <div className={styles.stateMsg}>Carregando respostas rápidas…</div>
        ) : !filtered.length ? (
          <div className={styles.stateMsg}>
            Nenhuma resposta rápida encontrada.
          </div>
        ) : (
          <div className={styles.list}>
            {filtered.map((item) => {
              const isEditing = editingId === item.id;

              return (
                <div key={item.id} className={styles.row}>
                  <div className={styles.rowMain}>
                    {isEditing ? (
                      <div className={styles.editWrapper}>
                        <div className={styles.editGroup}>
                          <label className={styles.editLabel}>Título</label>
                          <input
                            className={styles.editInput}
                            value={editTitle}
                            onChange={(e) => setEditTitle(e.target.value)}
                            placeholder="Título da resposta"
                            autoFocus
                          />
                        </div>
                        <div className={styles.editGroup}>
                          <label className={styles.editLabel}>Conteúdo</label>
                          <textarea
                            className={styles.editTextarea}
                            rows={3}
                            value={editContent}
                            onChange={(e) => setEditContent(e.target.value)}
                            placeholder="Conteúdo da resposta rápida"
                          />
                        </div>
                      </div>
                    ) : (
                      <>
                        <div className={styles.rowTitle}>
                          <span className={styles.replyTitle}>
                            {item.title || "—"}
                          </span>
                        </div>
                        <div className={styles.rowDesc}>
                          {item.content || "—"}
                        </div>
                      </>
                    )}
                  </div>

                  <div className={styles.rowActions}>
                    {isEditing ? (
                      <>
                        <button
                          type="button"
                          className={styles.actionBtn}
                          onClick={() => saveEdit(item.id)}
                          disabled={savingId === item.id}
                          title="Salvar"
                          aria-label="Salvar"
                        >
                          <SaveIcon size={16} />
                        </button>
                        <button
                          type="button"
                          className={`${styles.actionBtn} ${styles.actionBtnDanger}`}
                          onClick={cancelEdit}
                          disabled={savingId === item.id}
                          title="Cancelar edição"
                          aria-label="Cancelar edição"
                        >
                          <XIcon size={16} />
                        </button>
                      </>
                    ) : (
                      <>
                        <button
                          type="button"
                          className={styles.actionBtn}
                          onClick={() => startEdit(item)}
                          title="Editar resposta"
                          aria-label="Editar resposta"
                        >
                          <SquarePen size={16} />
                        </button>
                        <button
                          type="button"
                          className={`${styles.actionBtn} ${styles.actionBtnDanger}`}
                          onClick={() => handleDelete(item.id)}
                          disabled={deletingId === item.id}
                          title="Excluir resposta"
                          aria-label="Excluir resposta"
                        >
                          <Trash2 size={16} />
                        </button>
                      </>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      <QuickReplyModal
        isOpen={createOpen}
        onClose={() => setCreateOpen(false)}
        onCreated={() => {
          setCreateOpen(false);
          load();
        }}
        flowId={flowId}
      />
    </div>
  );
}
