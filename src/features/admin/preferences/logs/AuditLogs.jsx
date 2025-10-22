import React, { useCallback, useEffect, useMemo, useState } from "react";
import { X as XIcon, ChevronLeft, ChevronRight } from "lucide-react";
import styles from "./styles/AuditLogs.module.css";
import { apiGet } from "../../../../shared/apiClient";

/** Sucesso = 2xx ou 3xx */
const isSuccess = (code) => {
  const n = Number(code);
  return Number.isFinite(n) && n >= 200 && n < 400;
};

/** Data PT-BR curtinha */
function fmtDate(ts) {
  if (!ts) return "—";
  try {
    return new Date(ts).toLocaleString("pt-BR", {
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
    });
  } catch {
    return String(ts);
  }
}

/** Rótulo amigável para "action" técnica */
function formatAction(action) {
  const raw = (action ?? "").trim();
  if (!raw) return "—";

  const a = raw.toLowerCase();
  const parts = a.split(".").filter(Boolean);

  // Casos diretos
  const DIRECT = [
    [/^facebook\.connect\.upsert$/, "Conectou Facebook"],
    [/^instagram\.connect\.upsert$/, "Conectou Instagram"],
    [/^instagram\.connect\.exchange_failed$/, "Instagram: falha na troca do código"],
    [/^ticket\.tags\.catalog\.upsert\.start$/, "Tags do ticket (catálogo): início do upsert"],
    [/^ticket\.tags\.catalog\.upsert\.done$/, "Tags do ticket (catálogo): upsert concluído"],
    [/^queue\.rules\.delete\.notfound$/, "Regras da fila: exclusão (não havia regras)"],
    [/^wa\.profile\.photo\.set$/, "Definiu foto do perfil do WhatsApp"],
    [/^wa\.profile\.photo\.unset$/, "Removeu foto do perfil do WhatsApp"],
  ];
  for (const [re, label] of DIRECT) if (re.test(a)) return label;

  // Entidades por prefixo
  const ENTITY = new Map([
    ["pause_reasons", "motivo de pausa"],
    ["campaigns", "campanha"],
    ["tags.customer.catalog", "tag de cliente (catálogo)"],
    ["ticket.tags.catalog", "tag de ticket (catálogo da fila)"],
    ["ticket.tags.attach", "vínculo de tags ao ticket"],
    ["ticket.tags.detach", "remoção de tag do ticket"],
    ["queue.hours", "horário de atendimento da fila"],
    ["queue.rules", "regras da fila"],
    ["queue.permission", "permissão da fila"],
    ["queue.create", "fila"],
    ["queue.update", "fila"],
    ["queue", "fila"],
    ["quick_reply", "resposta rápida"],
    ["token", "token de API"],
    ["settings", "configuração"],
    ["telegram.connect", "Telegram"],
    ["facebook.connect", "Facebook"],
    ["instagram.connect", "Instagram"],
    ["wa.profile.photo", "WhatsApp: foto do perfil"],
    ["wa.profile", "WhatsApp: perfil"],
    ["template", "template"],
    ["templates.sync_all", "templates (sincronização geral)"],
    ["session.upsert", "sessão"],
    ["flow.publish", "fluxo"],
    ["flow.activate", "fluxo"],
    ["flow.reset", "fluxo"],
    ["flow", "fluxo"],
  ]);

  let entityLabel = null;
  let used = 0;
  for (let key of Array.from(ENTITY.keys()).sort((a, b) => b.length - a.length)) {
    const k = key.split(".");
    const ok = k.every((p, i) => parts[i] === p);
    if (ok) {
      entityLabel = ENTITY.get(key);
      used = k.length;
      break;
    }
  }
  if (!entityLabel) {
    entityLabel = parts[0]?.replace(/_/g, " ") || "ação";
    used = 1;
  }

  const verb = parts[used] || "";
  let suffix = parts.slice(used + 1).join(".");

  let upsertUpdate = false, upsertCreate = false;
  if (verb === "upsert" && suffix.startsWith("update")) {
    upsertUpdate = true; suffix = suffix.replace(/^update\.?/, "");
  }
  if (verb === "upsert" && suffix.startsWith("create")) {
    upsertCreate = true; suffix = suffix.replace(/^create\.?/, "");
  }

  const VERBS = {
    create: "Criou",
    update: "Atualizou",
    patch: "Alterou",
    delete: "Removeu",
    toggle: "Alternou",
    upsert: "Inseriu/Atualizou",
    test: "Testou",
    publish: "Publicou",
    activate: "Ativou",
    revoke: "Revogou",
    connect: "Conectou",
    submit: "Enviou",
    sync: "Sincronizou",
  };
  let vLabel = upsertUpdate ? "Atualizou" : upsertCreate ? "Criou" : (VERBS[verb] || "Restaurou");

  if (a.startsWith("wa.profile.update")) vLabel = "Atualizou";

  const SUFFIX = {
    error: " (erro)",
    invalid: " (dados inválidos)",
    not_found: " (não encontrado)",
    conflict: " (conflito)",
    bad_request: " (requisição inválida)",
    provider_fail: " (falha do provedor)",
    already: " (já estava aplicado)",
    done: " concluído",
    start: " iniciado",
    list_only: " (listagem)",
    dry_run: " (simulação)",
    nop: " (sem alterações)",
  };
  let sLabel = "";
  if (suffix) {
    const first = suffix.split(".")[0];
    if (SUFFIX[first] != null) sLabel = SUFFIX[first];
  }

  let finalLabel = `${vLabel} ${entityLabel}${sLabel}`.trim();
  if (!finalLabel || /executou ação/i.test(finalLabel)) {
    finalLabel = raw.split(".").join(" › ");
  }
  return finalLabel.charAt(0).toUpperCase() + finalLabel.slice(1);
}

export default function AuditLogs() {
  // dados
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(false);

  // filtros (status é client-side; os demais podem ir para o back)
  const [statusChip, setStatusChip] = useState(""); // '' | 'success' | 'fail'
  const [author, setAuthor] = useState("");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");

  // paginação local
  const [page, setPage] = useState(1);
  const pageSize = 25;

  const clearFilters = useCallback(() => {
    setStatusChip("");
    setAuthor("");
    setDateFrom("");
    setDateTo("");
    setPage(1);
  }, []);

  // carrega do back SEM status (status é exato no back e aqui é grupo)
  const load = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (author) params.set("actor_user", author);
      if (dateFrom) params.set("from", dateFrom);
      if (dateTo) params.set("to", dateTo);

      const resp = await apiGet(`/audit/logs?${params.toString()}`);
      const arr = Array.isArray(resp?.items) ? resp.items : (Array.isArray(resp) ? resp : []);
      setItems(arr);
      setPage(1);
    } catch {
      setItems([]);
    } finally {
      setLoading(false);
    }
  }, [author, dateFrom, dateTo]);

  useEffect(() => { load(); }, [load]);

  // aplica filtro de status client-side
  const filtered = useMemo(() => {
    if (!statusChip) return items;
    return items.filter((row) => {
      const ok = isSuccess(row?.status_code);
      return statusChip === "success" ? ok : !ok;
    });
  }, [items, statusChip]);

  // paginação
  const paginated = useMemo(() => {
    const start = (page - 1) * pageSize;
    return filtered.slice(start, start + pageSize);
  }, [filtered, page]);
  const totalPages = Math.max(1, Math.ceil(filtered.length / pageSize));
  const canPrev = page > 1;
  const canNext = page < totalPages;

  return (
    <div className={styles.container}>
      {/* Header */}
      <div className={styles.header}>
        <div>
          <h1 className={styles.title}>Logs de Auditoria</h1>
          <p className={styles.subtitle}>
            Registros de ações críticas do sistema para rastreabilidade e segurança.
          </p>
        </div>
      </div>

      {/* Filtros */}
      <div className={styles.filtersBar}>
        <div className={styles.field}>
          <label>Status</label>
          <div className={styles.chipGroup}>
            <button
              type="button"
              className={`${styles.chip} ${statusChip === "" ? styles.chipActive : ""}`}
              aria-pressed={statusChip === ""}
              onClick={() => { setStatusChip(""); setPage(1); }}
            >
              Todos
            </button>
            <button
              type="button"
              className={`${styles.chip} ${statusChip === "success" ? styles.chipActive : ""}`}
              aria-pressed={statusChip === "success"}
              onClick={() => { setStatusChip("success"); setPage(1); }}
            >
              Sucesso
            </button>
            <button
              type="button"
              className={`${styles.chip} ${statusChip === "fail" ? styles.chipActive : ""}`}
              aria-pressed={statusChip === "fail"}
              onClick={() => { setStatusChip("fail"); setPage(1); }}
            >
              Falha
            </button>
          </div>
        </div>

        <div className={styles.field}>
          <label>Autor/Usuário</label>
          <div className={styles.inputWrap}>
            <input
              className={styles.input}
              placeholder="email ou nome"
              value={author}
              onChange={(e) => setAuthor(e.target.value)}
            />
            {author && (
              <button
                className={styles.inputClear}
                title="Limpar"
                onClick={() => setAuthor("")}
              >
                <XIcon size={14} />
              </button>
            )}
          </div>
        </div>

        <div className={styles.field}>
          <label>De</label>
          <input
            type="date"
            className={styles.input}
            value={dateFrom}
            onChange={(e) => setDateFrom(e.target.value)}
          />
        </div>

        <div className={styles.field}>
          <label>Até</label>
          <input
            type="date"
            className={styles.input}
            value={dateTo}
            onChange={(e) => setDateTo(e.target.value)}
          />
        </div>

        <div className={styles.actionsRight}>
          <button className={styles.resetBtn} onClick={clearFilters}>
            Limpar filtros
          </button>
          <button className={styles.applyBtn} onClick={() => load()}>
            Aplicar
          </button>
        </div>
      </div>

      {/* Card + Tabela */}
      <div className={styles.card}>
        <div className={styles.tableWrap}>
          <table className={styles.table}>
            <thead>
              <tr>
                <th>Data</th>
                <th>Ação</th>
                <th>Status</th>
                <th>Autor/Usuário</th>
              </tr>
            </thead>
            <tbody>
              {loading &&
                Array.from({ length: 8 }).map((_, i) => (
                  <tr key={`sk-${i}`} className={styles.skelRow}>
                    <td colSpan={4}><div className={styles.skeletonRow} /></td>
                  </tr>
                ))}

              {!loading && paginated.length === 0 && (
                <tr>
                  <td colSpan={4} className={styles.empty}>
                    Nenhum log encontrado para os filtros aplicados.
                  </td>
                </tr>
              )}

              {!loading && paginated.map((row) => (
                <tr key={row.id} className={styles.rowHover}>
                  <td data-label="Data">{fmtDate(row.ts)}</td>
                  <td data-label="Ação">{formatAction(row.action)}</td>
                  <td data-label="Status">
                    <span
                      className={isSuccess(row.status_code) ? styles.statusOk : styles.statusFail}
                      title={`HTTP ${row.status_code}`}
                    >
                      {isSuccess(row.status_code) ? "Sucesso" : "Falha"}
                    </span>
                  </td>
                  <td data-label="Autor/Usuário">{row.actor_user || row.actor_id || "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Paginação */}
        <div className={styles.pager}>
          <button
            className={styles.pageBtn}
            onClick={() => canPrev && setPage((p) => Math.max(1, p - 1))}
            disabled={!canPrev}
          >
            <ChevronLeft size={16} />
            Anterior
          </button>
          <div className={styles.pageInfo}>{page} / {totalPages}</div>
          <button
            className={styles.pageBtn}
            onClick={() => canNext && setPage((p) => Math.min(totalPages, p + 1))}
            disabled={!canNext}
          >
            Próxima
            <ChevronRight size={16} />
          </button>
        </div>
      </div>
    </div>
  );
}
