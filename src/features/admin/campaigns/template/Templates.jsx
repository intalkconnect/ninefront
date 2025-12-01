import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { Plus, RefreshCw, Trash2, X as XIcon } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { apiGet, apiPost, apiDelete } from "../../../../shared/apiClient";
import { useConfirm } from "../../../../app/provider/ConfirmProvider.jsx";

import styles from "./styles/Templates.module.css";

const STATUS_OPTIONS = [
  { key: "", label: "Todos" },
  { key: "approved", label: "Aprovados" },
  { key: "rejected", label: "Rejeitados" },
  { key: "submitted", label: "Em análise" },
  { key: "draft", label: "Rascunhos" },
];

function StatusChip({ status }) {
  const map = {
    approved: { txt: "Aprovado", cls: styles.stApproved },
    rejected: { txt: "Rejeitado", cls: styles.stRejected },
    submitted: { txt: "Em análise", cls: styles.stSubmitted },
    draft: { txt: "Rascunho", cls: styles.stDraft },
  };
  const it = map[status] || { txt: status || "—", cls: styles.stDefault };
  return <span className={`${styles.statusChip} ${it.cls}`}>{it.txt}</span>;
}

function ScoreSemaforo({ value }) {
  function parseQuality(raw) {
    if (!raw) return { score: null, date: null };
    if (typeof raw === "object") {
      return {
        score: raw.score ?? raw.quality ?? raw.value ?? null,
        date: raw.date ?? raw.timestamp ?? null,
      };
    }
    const s = String(raw).trim();
    try {
      return parseQuality(JSON.parse(s));
    } catch {
      return { score: s, date: null };
    }
  }
  const q = parseQuality(value);
  if (!q.score) return null;
  const code = String(q.score).trim().toUpperCase();
  const color =
    code === "GREEN"
      ? "#10B981"
      : code === "YELLOW"
      ? "#F59E0B"
      : code === "RED"
      ? "#EF4444"
      : "#9CA3AF";
  return (
    <span
      className={styles.qualityDot}
      style={{ backgroundColor: color }}
      title={`Qualidade ${code}`}
    />
  );
}

export default function Templates() {
  const navigate = useNavigate();
  const confirm = useConfirm();

  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [okMsg, setOkMsg] = useState(null);

  const [query, setQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState("");

  const [selected, setSelected] = useState(null);

  const pollRef = useRef(null);
  const stopPolling = () => {
    if (pollRef.current) {
      clearInterval(pollRef.current);
      pollRef.current = null;
    }
  };

  const toastOK = useCallback((msg) => {
    setOkMsg(msg);
    setTimeout(() => setOkMsg(null), 2200);
  }, []);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const qs = new URLSearchParams();
      if (statusFilter) qs.set("status", statusFilter);
      if (query.trim()) qs.set("q", query.trim());
      const data = await apiGet(`/templates${qs.toString() ? `?${qs}` : ""}`);
      setItems(Array.isArray(data) ? data : []);
    } catch (e) {
      console.error(e);
      setError("Falha ao carregar templates.");
    } finally {
      setLoading(false);
    }
  }, [statusFilter, query]);

  useEffect(() => {
    load();
  }, [load]);

  // polling para os que estão em "submitted"
  useEffect(() => {
    const ids = items
      .filter((t) => t.status === "submitted")
      .map((t) => t.id);
    if (ids.length === 0) {
      stopPolling();
      return;
    }
    if (pollRef.current) return;
    pollRef.current = setInterval(async () => {
      try {
        await Promise.all(
          ids.map((id) => apiPost(`/templates/${id}/sync`, {}))
        );
        load();
      } catch (e) {
        console.warn("Polling falhou:", e?.message || e);
      }
    }, 15000);
    return stopPolling;
  }, [items, load]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return [...items]
      .filter(
        (t) =>
          !statusFilter ||
          String(t.status).toLowerCase() === statusFilter
      )
      .filter(
        (t) =>
          !q ||
          String(t.name || "").toLowerCase().includes(q) ||
          String(t.body_text || "").toLowerCase().includes(q)
      )
      .sort((a, b) =>
        String(a.updated_at || "").localeCompare(
          String(b.updated_at || "")
        )
      )
      .reverse();
  }, [items, statusFilter, query]);

  useEffect(() => {
    if (!selected || !filtered.find((f) => f.id === selected.id)) {
      setSelected(filtered[0] || null);
    }
  }, [filtered]); // eslint-disable-line react-hooks/exhaustive-deps

  async function handleDelete(id, status) {
    if (!["draft", "rejected"].includes(status)) {
      setError(
        "Apenas rascunhos ou rejeitados podem ser removidos localmente."
      );
      return;
    }
    const ok = await confirm({
      title: "Remover template?",
      description:
        "Esta ação remove o registro local (não afeta o status já enviado à Meta).",
      tone: "danger",
      confirmText: "Remover",
      cancelText: "Cancelar",
    });
    if (!ok) return;

    try {
      setError(null);
      await apiDelete(`/templates/${id}`);
      toastOK("Template removido.");
      load();
      if (selected?.id === id) setSelected(null);
    } catch (e) {
      console.error(e);
      setError("Falha ao excluir template.");
    }
  }

  const clearSearch = () => setQuery("");

  return (
    <div className={styles.container}>
      {/* HEADER NO PADRÃO CAMPANHAS/USERS */}
      <div className={styles.headerCard}>
        <div className={styles.headerRow}>
          <div className={styles.headerCenter}>
            <div className={styles.headerTitle}>Templates WhatsApp</div>
            <div className={styles.headerSubtitle}>
              Crie, acompanhe o status e visualize a prévia dos modelos
              aprovados pela Meta.
            </div>
          </div>

          <div className={styles.headerRight}>
            <button
              className={styles.iconCircle}
              type="button"
              onClick={load}
              title="Atualizar lista"
            >
              <RefreshCw size={18} />
            </button>
            <button
              className={styles.iconCirclePrimary}
              type="button"
              onClick={() => navigate("/campaigns/templates/new")}
              title="Novo template"
            >
              <Plus size={18} />
            </button>
          </div>
        </div>
      </div>

      {/* LISTA (apenas 1 coluna, sem preview) */}
      <div className={styles.mainGrid}>
        <div className={styles.colList}>
          <div className={styles.card}>
            <div className={styles.cardHead}>
              <div
                className={styles.segmentRow}
                role="tablist"
                aria-label="Filtrar por status"
              >
                {STATUS_OPTIONS.map((opt) => {
                  const active = statusFilter === opt.key;
                  return (
                    <button
                      key={opt.key || "all"}
                      type="button"
                      className={`${styles.segBtn} ${
                        active ? styles.segBtnActive : ""
                      }`}
                      onClick={() => setStatusFilter(opt.key)}
                      aria-pressed={active}
                    >
                      {opt.label}
                    </button>
                  );
                })}
              </div>

              <div className={styles.searchGroup}>
                <input
                  className={styles.searchInput}
                  placeholder="Buscar por nome ou conteúdo…"
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  aria-label="Buscar templates"
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
            </div>

            <div className={styles.tableWrap}>
              <table className={styles.table}>
                <thead>
                  <tr>
                    <th style={{ minWidth: 240 }}>Nome do modelo</th>
                    <th>Categoria</th>
                    <th>Recategorizado</th>
                    <th>Idioma</th>
                    <th>Status</th>
                    <th>Qualidade</th>
                    <th style={{ width: 120 }}>Ações</th>
                  </tr>
                </thead>
                <tbody>
                  {loading && (
                    <tr>
                      <td className={styles.loading} colSpan={7}>
                        Carregando…
                      </td>
                    </tr>
                  )}
                  {!loading && filtered.length === 0 && (
                    <tr>
                      <td className={styles.empty} colSpan={7}>
                        Nenhum template encontrado.
                      </td>
                    </tr>
                  )}

                  {!loading &&
                    filtered.map((t) => {
                      const isSel = selected?.id === t.id;
                      return (
                        <tr
                          key={t.id}
                          className={`${styles.rowHover} ${
                            isSel ? styles.rowSelected : ""
                          }`}
                          onClick={() => setSelected(t)}
                        >
                          <td data-label="Nome" className={styles.colName}>
                            <div className={styles.keyTitle}>{t.name}</div>
                          </td>
                          <td data-label="Categoria">{t.category || "—"}</td>
                          <td data-label="Recategorizado">
                            {t.recategorized ? "Sim" : "Não"}
                          </td>
                          <td data-label="Idioma">
                            {t.language_code || "—"}
                          </td>
                          <td data-label="Status">
                            <StatusChip status={t.status} />
                          </td>
                          <td data-label="Qualidade">
                            <ScoreSemaforo value={t.quality_score} />
                          </td>
                          <td
                            data-label="Ações"
                            className={styles.actionsCell}
                            onClick={(e) => e.stopPropagation()}
                            onKeyDown={(e) => e.stopPropagation()}
                          >
                            <div className={styles.actions}>
                              <button
                                className={`${styles.qrIconBtn} ${styles.danger}`}
                                title="Excluir"
                                onClick={() =>
                                  handleDelete(t.id, t.status)
                                }
                                disabled={
                                  !["draft", "rejected"].includes(
                                    t.status
                                  )
                                }
                                type="button"
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

            {error && (
              <div className={styles.alertErr} role="alert">
                ⚠️ {error}
              </div>
            )}
            {okMsg && (
              <div className={styles.alertOk} role="status">
                ✅ {okMsg}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
