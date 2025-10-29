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
/** Label amigável e consistente para a coluna Ação */
function formatAction(action, resourceType) {
  const raw = (action ?? "").trim();
  if (!raw) return "—";
  const a = raw.toLowerCase();

  // ===== 1) Casos específicos (prioridade maior) =====
  const SPECIAL = [
    // Fluxo
    [/^flow\.reset$/i,                        "Resetou fluxo"],
    [/^flow\.activate$/i,                     "Ativou fluxo"],
    [/^flow\.publish$/i,                      "Publicou fluxo"],

    // Conexões Facebook/Instagram
    [/^facebook\.connect\.upsert$/i,          "Atualizou conexão com Facebook"],
    [/^instagram\.connect\.upsert$/i,         "Atualizou conexão com Instagram"],
    [/^instagram\.connect\.exchange_failed$/i,"Instagram: falha na troca do código"],

    // Fila
    [/^queue\.update$/i,                      "Atualizou fila"],
    [/^queue\.rules\.delete\.notfound$/i,     "Exclusão de regras da fila (não havia regras)"],

    // Catálogo de tags do ticket (por fila)
    [/^ticket\.tags\.catalog\.upsert\.start$/i,"Atualizou catálogo de tags do ticket (início)"],
    [/^ticket\.tags\.catalog\.upsert\.done$/i, "Atualizou catálogo de tags do ticket (concluído)"],
  ];
  for (const [re, label] of SPECIAL) if (re.test(a)) return label;

  // ===== 2) Regras genéricas =====
  // 2.1 Mapa de verbos (action segment → verbo PT-BR)
  const VERB_MAP = {
    create:   "Criou",
    update:   "Atualizou",
    upsert:   "Atualizou",       // <= pedido: upsert deve virar "Atualizou"
    patch:    "Atualizou",
    delete:   "Excluiu",
    reset:    "Resetou",
    activate: "Ativou",
    publish:  "Publicou",
    connect:  "Conectou",
    toggle:   "Alternou",
    test:     "Testou",
    sync:     "Sincronizou",
    submit:   "Enviou",
    revoke:   "Revogou",
  };

  // 2.2 Mapa de recursos (resource_type → nome PT-BR)
  const RES_MAP = {
    flow:               "fluxo",
    session:            "sessão",
    queue:              "fila",
    "queue-permission": "permissão de fila",
    "queue_ticket_tag": "tag de ticket (catálogo da fila)",
    campaign:           "campanha",
    template:           "modelo",
    channel:            "canal",
    security_token:     "token de segurança",
    setting:            "configuração",
    user:               "usuário",
    ticket:             "ticket",
    ticket_tag:         "tag do ticket",
    whatsapp_profile:   "perfil do WhatsApp",
  };

  // 2.3 Sufixos de estado (aparecem no final da action)
  const SUFFIX_MAP = [
    { re: /\.start$/i,        label: " (início)" },
    { re: /\.done$/i,         label: " (concluído)" },
    { re: /\.invalid$/i,      label: " (dados inválidos)" },
    { re: /\.bad_request$/i,  label: " (requisição inválida)" },
    { re: /\.not_found/i,     label: " (não encontrado)" },
    { re: /\.conflict$/i,     label: " (conflito)" },
    { re: /\.provider_fail$/i,label: " (falha do provedor)" },
    { re: /\.already$/i,      label: " (já existia)" },
    { re: /\.error$/i,        label: " (erro)" },
  ];

  // Quebra a action em segmentos: ex. "ticket.tags.catalog.upsert.done"
  const parts = a.split(".");
  // tenta achar um verbo conhecido no fim (ex.: upsert, update, create, delete…)
  let verbKey = parts.slice().reverse().find(p => VERB_MAP[p]);
  // se não achou, tenta em posições anteriores (ex.: "queue.rules.delete.notfound")
  if (!verbKey) {
    verbKey = parts.find(p => VERB_MAP[p]) || null;
  }
  const verb = verbKey ? VERB_MAP[verbKey] : null;

  // recurso: preferir resourceType do payload; se vier vazio, inferir do início
  const resKey =
    (resourceType && resourceType.toLowerCase()) ||
    parts[0] || ""; // ex.: flow, queue, template…
  const resLabel = RES_MAP[resKey] || resKey.replace(/_/g, " ");

  // monta sufixo legível (se existir)
  let suffix = "";
  for (const s of SUFFIX_MAP) {
    if (s.re.test(a)) {
      suffix = s.label;
      break;
    }
  }

  // composição final
  if (verb) {
    // ajuste semântico: "Conectou" normalmente é "Conectou X" ou "Conectou canal"
    if (verbKey === "connect" && /facebook|instagram|telegram/i.test(a)) {
      const which =
        /facebook/i.test(a) ? "Facebook" :
        /instagram/i.test(a) ? "Instagram" :
        /telegram/i.test(a) ? "Telegram" : "canal";
      return `${verb} ${which}${suffix}`;
    }

    // regra default: "Verbo + recurso"
    return `${verb} ${resLabel}${suffix}`.trim();
  }

  // ===== 3) Fallback totalmente genérico =====
  // transforma "ticket.tags.catalog.foo.bar" → "ticket › tags › catalog › foo › bar"
  return raw.replace(/\./g, " › ");
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
          <p className={styles.subtitle}>
            Registros de ações para rastreabilidade e segurança.
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
