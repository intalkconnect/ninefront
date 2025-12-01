import React, { useCallback, useEffect, useMemo, useState } from "react";
import { X as XIcon, ChevronLeft, ChevronRight } from "lucide-react";
import { apiGet } from "../../../../shared/apiClient";
import styles from "../../styles/AdminUI.module.css";

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

/** Label amigável e consistente para a coluna Ação */
function formatAction(action, resourceType) {
  const raw = (action ?? "").trim();
  if (!raw) return "—";
  const a = raw.toLowerCase();

  // ===== 1) Casos específicos (prioridade maior) =====
  const SPECIAL = [
    [/^flow\.reset$/i, "Resetou fluxo"],
    [/^flow\.activate$/i, "Ativou fluxo"],
    [/^flow\.publish$/i, "Publicou fluxo"],

    [/^facebook\.connect\.upsert$/i, "Atualizou conexão com Facebook"],
    [/^instagram\.connect\.upsert$/i, "Atualizou conexão com Instagram"],
    [
      /^instagram\.connect\.exchange_failed$/i,
      "Instagram: falha na troca do código",
    ],

    [/^queue\.update$/i, "Atualizou fila"],
    [
      /^queue\.rules\.delete\.notfound$/i,
      "Exclusão de regras da fila (não havia regras)",
    ],

    [
      /^ticket\.tags\.catalog\.upsert\.start$/i,
      "Atualizou catálogo de tags do ticket (início)",
    ],
    [
      /^ticket\.tags\.catalog\.upsert\.done$/i,
      "Atualizou catálogo de tags do ticket (concluído)",
    ],
  ];
  for (const [re, label] of SPECIAL) if (re.test(a)) return label;

  // ===== 2) Regras genéricas =====
  const VERB_MAP = {
    create: "Criou",
    update: "Atualizou",
    upsert: "Atualizou",
    patch: "Atualizou",
    delete: "Excluiu",
    reset: "Resetou",
    activate: "Ativou",
    publish: "Publicou",
    connect: "Conectou",
    toggle: "Alternou",
    test: "Testou",
    sync: "Sincronizou",
    submit: "Enviou",
    revoke: "Revogou",
  };

  const RES_MAP = {
    flow: "fluxo",
    session: "sessão",
    queue: "fila",
    "queue-permission": "permissão de fila",
    "queue_ticket_tag": "tag de ticket (catálogo da fila)",
    campaign: "campanha",
    template: "modelo",
    channel: "canal",
    security_token: "token de segurança",
    setting: "configuração",
    user: "usuário",
    ticket: "ticket",
    ticket_tag: "tag do ticket",
    whatsapp_profile: "perfil do WhatsApp",
  };

  const SUFFIX_MAP = [
    { re: /\.start$/i, label: " (início)" },
    { re: /\.done$/i, label: " (concluído)" },
    { re: /\.invalid$/i, label: " (dados inválidos)" },
    { re: /\.bad_request$/i, label: " (requisição inválida)" },
    { re: /\.not_found/i, label: " (não encontrado)" },
    { re: /\.conflict$/i, label: " (conflito)" },
    { re: /\.provider_fail$/i, label: " (falha do provedor)" },
    { re: /\.already$/i, label: " (já existia)" },
    { re: /\.error$/i, label: " (erro)" },
  ];

  const parts = a.split(".");
  let verbKey = parts.slice().reverse().find((p) => VERB_MAP[p]);
  if (!verbKey) {
    verbKey = parts.find((p) => VERB_MAP[p]) || null;
  }
  const verb = verbKey ? VERB_MAP[verbKey] : null;

  const resKey =
    (resourceType && resourceType.toLowerCase()) || parts[0] || "";
  const resLabel = RES_MAP[resKey] || resKey.replace(/_/g, " ");

  let suffix = "";
  for (const s of SUFFIX_MAP) {
    if (s.re.test(a)) {
      suffix = s.label;
      break;
    }
  }

  if (verb) {
    if (verbKey === "connect" && /facebook|instagram|telegram/i.test(a)) {
      const which = /facebook/i.test(a)
        ? "Facebook"
        : /instagram/i.test(a)
        ? "Instagram"
        : /telegram/i.test(a)
        ? "Telegram"
        : "canal";
      return `${verb} ${which}${suffix}`;
    }
    return `${verb} ${resLabel}${suffix}`.trim();
  }

  return raw.replace(/\./g, " › ");
}

export default function AuditLogs() {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(false);

  const [statusChip, setStatusChip] = useState("");
  const [author, setAuthor] = useState("");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");

  const [page, setPage] = useState(1);
  const pageSize = 25;

  const clearFilters = useCallback(() => {
    setStatusChip("");
    setAuthor("");
    setDateFrom("");
    setDateTo("");
    setPage(1);
  }, []);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (author) params.set("actor_user", author);
      if (dateFrom) params.set("from", dateFrom);
      if (dateTo) params.set("to", dateTo);

      const resp = await apiGet(`/audit/logs?${params.toString()}`);
      const arr = Array.isArray(resp?.items)
        ? resp.items
        : Array.isArray(resp)
        ? resp
        : [];
      setItems(arr);
      setPage(1);
    } catch {
      setItems([]);
    } finally {
      setLoading(false);
    }
  }, [author, dateFrom, dateTo]);

  useEffect(() => {
    load();
  }, [load]);

  const filtered = useMemo(() => {
    if (!statusChip) return items;
    return items.filter((row) => {
      const ok = isSuccess(row?.status_code);
      return statusChip === "success" ? ok : !ok;
    });
  }, [items, statusChip]);

  const paginated = useMemo(() => {
    const start = (page - 1) * pageSize;
    return filtered.slice(start, start + pageSize);
  }, [filtered, page]);
  const totalPages = Math.max(1, Math.ceil(filtered.length / pageSize));
  const canPrev = page > 1;
  const canNext = page < totalPages;

  return (
    <div className={styles.page}>
      <div className={styles.container}>
        {/* Header padrão dark */}
        <header className={styles.header}>
          <div className={styles.titleBlock}>
            <h1 className={styles.title}>Logs de auditoria</h1>
            <p className={styles.subtitle}>
              Registros de ações para rastreabilidade e segurança.
            </p>
          </div>
        </header>

        {/* Filtros reaproveitando o layout padrão */}
        <section className={styles.filters}>
          {/* Status */}
          <div className={styles.filterGroup}>
            <p className={styles.filterTitle}>Status</p>
            <div className={styles.filterChips}>
              <button
                type="button"
                className={`${styles.chip} ${
                  statusChip === "" ? styles.chipActive : ""
                }`}
                aria-pressed={statusChip === ""}
                onClick={() => {
                  setStatusChip("");
                  setPage(1);
                }}
              >
                Todos
              </button>
              <button
                type="button"
                className={`${styles.chip} ${
                  statusChip === "success" ? styles.chipActive : ""
                }`}
                aria-pressed={statusChip === "success"}
                onClick={() => {
                  setStatusChip("success");
                  setPage(1);
                }}
              >
                Sucesso
              </button>
              <button
                type="button"
                className={`${styles.chip} ${
                  statusChip === "fail" ? styles.chipActive : ""
                }`}
                aria-pressed={statusChip === "fail"}
                onClick={() => {
                  setStatusChip("fail");
                  setPage(1);
                }}
              >
                Falha
              </button>
            </div>
          </div>

          {/* Linha de filtros: autor + datas + limpar */}
          <div className={styles.filterRow}>
            <div className={styles.group}>
              <label className={styles.label}>Autor/Usuário</label>
              <div className={styles.searchGroup}>
                <input
                  className={styles.searchInput}
                  placeholder="email ou nome"
                  value={author}
                  onChange={(e) => setAuthor(e.target.value)}
                />
                {author && (
                  <button
                    type="button"
                    className={styles.searchClear}
                    title="Limpar"
                    onClick={() => setAuthor("")}
                  >
                    <XIcon size={14} />
                  </button>
                )}
              </div>
            </div>

            <div className={styles.group}>
              <label className={styles.label}>De</label>
              <input
                type="date"
                className={styles.input}
                value={dateFrom}
                onChange={(e) => setDateFrom(e.target.value)}
              />
            </div>

            <div className={styles.group}>
              <label className={styles.label}>Até</label>
              <input
                type="date"
                className={styles.input}
                value={dateTo}
                onChange={(e) => setDateTo(e.target.value)}
              />
            </div>

            <div className={styles.group}>
              <label className={styles.label}>&nbsp;</label>
              <button
                type="button"
                className={styles.btnGhost}
                onClick={clearFilters}
              >
                Limpar filtros
              </button>
            </div>
          </div>
        </section>

        {/* Card + tabela no padrão FlowHub */}
        <section className={styles.tableCard}>
          <div className={styles.tableScroll}>
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
                  Array.from({ length: 6 }).map((_, i) => (
                    <tr key={`sk-${i}`}>
                      <td colSpan={4}>
                        <div
                          className={`${styles.skeleton} ${styles.sq48}`}
                        />
                      </td>
                    </tr>
                  ))}

                {!loading && paginated.length === 0 && (
                  <tr>
                    <td colSpan={4} className={styles.empty}>
                      Nenhum log encontrado para os filtros aplicados.
                    </td>
                  </tr>
                )}

                {!loading &&
                  paginated.map((row) => (
                    <tr key={row.id}>
                      <td data-label="Data">{fmtDate(row.ts)}</td>
                      <td data-label="Ação">
                        {formatAction(row.action, row.resource_type)}
                      </td>
                      <td data-label="Status">
                        <span
                          className={`${styles.statusBadge} ${
                            isSuccess(row.status_code)
                              ? styles.stFinished
                              : styles.stFailed
                          }`}
                          title={`HTTP ${row.status_code}`}
                        >
                          {isSuccess(row.status_code) ? "Sucesso" : "Falha"}
                        </span>
                      </td>
                      <td data-label="Autor/Usuário">
                        {row.actor_user || row.actor_id || "—"}
                      </td>
                    </tr>
                  ))}
              </tbody>
            </table>
          </div>

          {/* Paginação padrão adminui */}
          <div className={styles.pagination}>
            <button
              type="button"
              className={styles.pageBtn}
              onClick={() => canPrev && setPage((p) => Math.max(1, p - 1))}
              disabled={!canPrev}
            >
              <ChevronLeft size={16} />
              Anterior
            </button>
            <div className={styles.pageInfo}>
              Página {page} de {totalPages}
            </div>
            <button
              type="button"
              className={styles.pageBtn}
              onClick={() =>
                canNext && setPage((p) => Math.min(totalPages, p + 1))
              }
              disabled={!canNext}
            >
              Próxima
              <ChevronRight size={16} />
            </button>
          </div>
        </section>
      </div>
    </div>
  );
}
