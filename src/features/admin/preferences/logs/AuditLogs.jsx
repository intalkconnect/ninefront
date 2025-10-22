import React, { useCallback, useEffect, useMemo, useState } from "react";
import { X as XIcon, CalendarRange, RefreshCw } from "lucide-react";
import styles from "./AuditLogs.module.css";
import { apiGet } from "../../../../shared/apiClient";
import { toast } from "react-toastify";

/** Mapeia códigos técnicos -> rótulos claros */
const prettifyAction = (code = "") => {
  const map = {
    "flow.activate": "Ativar fluxo",
    "flow.publish": "Publicar fluxo",
    "flow.publish.bad_request": "Publicação inválida",
    "flow.publish.error": "Erro ao publicar fluxo",
    "flow.reset": "Reiniciar fluxo do cliente",

    "session.upsert": "Salvar sessão",
    "session.upsert.error": "Erro ao salvar sessão",

    "instagram.connect.upsert": "Conectar Instagram",
    "instagram.connect.exchange_failed": "Falha na conexão do Instagram",
    "facebook.connect.upsert": "Conectar Facebook",

    "queue.update": "Atualizar fila",
    "queue.rules.delete.notfound": "Excluir regras da fila (não encontrado)",

    "ticket.tags.catalog.upsert.start": "Criar/atualizar tag (início)",
    "ticket.tags.catalog.upsert.done": "Criar/atualizar tag (concluído)",
  };
  if (map[code]) return map[code];

  // fallback: "queue_ticket_tag" etc continuam ocultos (sem coluna "Recurso")
  // Apenas melhora a leitura do action: "abc.def" -> "Abc def"
  const pretty = String(code).replaceAll(".", " ").trim();
  return pretty ? pretty[0].toUpperCase() + pretty.slice(1) : "—";
};

const isSuccess = (statusCode) => {
  const n = Number(statusCode);
  return n >= 200 && n < 400;
};

export default function AuditLogs() {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(false);

  // Filtros
  const [statusChip, setStatusChip] = useState(""); // '', 'success', 'fail'
  const [author, setAuthor] = useState("");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [query, setQuery] = useState(""); // busca livre (ação, path, etc)

  const clearFilters = useCallback(() => {
    setStatusChip("");
    setAuthor("");
    setDateFrom("");
    setDateTo("");
    setQuery("");
  }, []);

  const load = useCallback(
    async (override = {}) => {
      setLoading(true);
      try {
        const s = override.status ?? statusChip;
        const a = override.author ?? author;
        const f = override.from ?? dateFrom;
        const t = override.to ?? dateTo;
        const q = override.q ?? query;

        const params = new URLSearchParams();
        if (s) params.set("status", s); // success|fail
        if (a) params.set("actor", a);
        if (f) params.set("from", f);
        if (t) params.set("to", t);
        if (q) params.set("q", q);

        const resp = await apiGet(`/audit/logs?${params.toString()}`);
        setItems(Array.isArray(resp?.items) ? resp.items : []);
      } catch (e) {
        toast.error("Falha ao carregar logs de auditoria.");
      } finally {
        setLoading(false);
      }
    },
    [statusChip, author, dateFrom, dateTo, query]
  );

  useEffect(() => {
    load();
  }, [load]);

  // Filtro rápido client-side adicional para "query" (se o back não filtrar q)
  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    let base = items;
    if (statusChip) {
      base = base.filter((r) =>
        statusChip === "success" ? isSuccess(r.status_code) : !isSuccess(r.status_code)
      );
    }
    if (author) {
      const a = author.toLowerCase();
      base = base.filter(
        (r) =>
          String(r.actor_user || "").toLowerCase().includes(a) ||
          String(r.actor_id || "").toLowerCase().includes(a)
      );
    }
    if (dateFrom) {
      base = base.filter((r) => new Date(r.ts) >= new Date(dateFrom));
    }
    if (dateTo) {
      // inclui o dia inteiro
      const end = new Date(dateTo);
      end.setHours(23, 59, 59, 999);
      base = base.filter((r) => new Date(r.ts) <= end);
    }
    if (q) {
      base = base.filter((r) => {
        const blob = `${r.action ?? ""} ${r.path ?? ""} ${r.method ?? ""} ${r.actor_user ?? ""}`.toLowerCase();
        return blob.includes(q);
      });
    }
    return base;
  }, [items, statusChip, author, dateFrom, dateTo, query]);

  return (
    <div className={styles.container}>
      {/* Header & descrição */}
      <div className={styles.header}>
        <div>
          <h1 className={styles.title}>Logs de auditoria</h1>
          <p className={styles.subtitle}>
            Eventos importantes do sistema com **quem**, **quando** e **resultado**.
          </p>
        </div>
      </div>

      {/* Barra de filtros */}
      <div className={styles.filtersBar}>
        {/* Status chips */}
        <div className={styles.field}>
          <label>Status</label>
          <div className={styles.chipGroup}>
            <button
              type="button"
              className={`${styles.chip} ${statusChip === "" ? styles.chipActive : ""}`}
              aria-pressed={statusChip === ""}
              onClick={() => setStatusChip("")}
            >
              Todos
            </button>
            <button
              type="button"
              className={`${styles.chip} ${statusChip === "success" ? styles.chipActive : ""}`}
              aria-pressed={statusChip === "success"}
              onClick={() => setStatusChip("success")}
            >
              Sucesso
            </button>
            <button
             
