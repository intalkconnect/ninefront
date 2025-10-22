import React, { useCallback, useEffect, useMemo, useState } from "react";
import { CheckCircle2, XCircle, RefreshCcw, Filter, X as XIcon, Search } from "lucide-react";
import { apiGet } from "../../../../shared/apiClient";
import styles from "../../management/users/styles/Users.module.css"; // reaproveitando o mesmo CSS

// --- helpers ---------------------------------------------------------------

// 2xx/3xx -> sucesso, 4xx/5xx -> falha
const statusToBadge = (code) => {
  const n = Number(code) || 0;
  const ok = n >= 200 && n < 400;
  return {
    text: ok ? "Sucesso" : "Falha",
    ok
  };
};

// rótulos humanos para as ações mais comuns
const ACTION_LABELS = {
  "flow.activate": "Ativar fluxo",
  "flow.reset": "Reset de fluxo do cliente",
  "session.upsert": "Salvar sessão do cliente",
  "facebook.connect.upsert": "Conectar/atualizar Facebook",
  "instagram.connect.upsert": "Conectar/atualizar Instagram",
  "instagram.connect.exchange_failed": "Falha ao finalizar Instagram (code usado)",
  "queue.update": "Atualizar fila",
  "queue.rules.delete.notfound": "Excluir regra da fila (não encontrada)",
  "ticket.tags.catalog.upsert.start": "Atualizar catálogo de tags (início)",
  "ticket.tags.catalog.upsert.done": "Atualizar catálogo de tags (concluído)",
};

function humanizeAction(action = "", resourceType = "") {
  if (ACTION_LABELS[action]) return ACTION_LABELS[action];
  // fallback: "queue.create" -> "Queue: create"
  if (!action) return resourceType ? `Ação em ${resourceType}` : "Ação";
  const [a, b] = String(action).split(".");
  if (a && b) {
    return `${a.replaceAll("_"," ") }: ${b.replaceAll("_"," ")}`.trim();
  }
  return action.replaceAll("_"," ");
}

function formatDate(ts) {
  if (!ts) return "—";
  try {
    const d = new Date(ts);
    return d.toLocaleString();
  } catch { return ts; }
}

// ----------------------------------------------------------------------------

export default function AuditLogs() {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(false);

  // filtros
  const [query, setQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState(""); // '', 'ok', 'fail'
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");

  // paginação simples (opcional): backend pode aceitar ?limit=&cursor=
  const [cursor, setCursor] = useState(null);
  const [nextCursor, setNextCursor] = useState(null);

  const load = useCallback(async (reset = false) => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (query.trim()) params.set("q", query.trim());
      if (statusFilter === "ok") params.set("status", "ok");
      if (statusFilter === "fail") params.set("status", "fail");
      if (from) params.set("from", from);
      if (to) params.set("to", to);
      if (!reset && cursor) params.set("cursor", cursor);
      params.set("limit", "25");

      const resp = await apiGet(`/audit/logs?${params.toString()}`);
      const rows = Array.isArray(resp?.items) ? resp.items : Array.isArray(resp) ? resp : [];
      const nc = resp?.next_cursor ?? null;

      if (reset) setItems(rows);
      else setItems((prev) => [...prev, ...rows]);

      setNextCursor(nc);
    } catch (e) {
      setItems([]);
    } finally {
      setLoading(false);
    }
  }, [query, statusFilter, from, to, cursor]);

  useEffect(() => { 
    setCursor(null);
    load(true);
  }, [load]);

  const filtered = useMemo(() => items, [items]);

  return (
    <div className={styles.container}>
      {/* toolbar (à direita) */}
      <div className={styles.toolbar}>
        <div className={styles.headerActions}>
          <button
            className={styles.refreshBtn}
            onClick={() => { setCursor(null); load(true); }}
            disabled={loading}
            title="Recarregar"
          >
            <RefreshCcw size={16} className={loading ? styles.spinning : undefined}/>
            Recarregar
          </button>
        </div>
      </div>

      {/* header + subtítulo */}
      <div className={styles.header}>
        <div>
          <h2 style={{margin:0}}>Logs de auditoria</h2>
          <p className={styles.subtitle}>Eventos de sistema com rastro de usuário e resultado da operação.</p>
        </div>
      </div>

      {/* card de filtros e tabela */}
      <div className={styles.card}>
        {/* filtros compactos no topo do card (lado direito, como Users) */}
        <div className={styles.cardHead} style={{justifyContent:"space-between"}}>
          <div className={styles.searchGroup} style={{display:"flex", gap:8, alignItems:"center"}}>
            <div className={styles.searchGroup} style={{position:"relative"}}>
              <input
                className={styles.searchInput}
                placeholder="Buscar (ação, usuário, recurso…)"
                value={query}
                onChange={(e)=>setQuery(e.target.value)}
              />
              {query ? (
                <button className={styles.searchClear} onClick={()=>setQuery("")} aria-label="Limpar">
                  <XIcon size={14}/>
                </button>
              ) : (
                <div style={{position:'absolute',right:8,top:'50%',transform:'translateY(-50%)',opacity:.55}}>
                  <Search size={16}/>
                </div>
              )}
            </div>

            {/* Status */}
            <select
              className={styles.searchInput}
              style={{width:170,height:40}}
              value={statusFilter}
              onChange={(e)=>setStatusFilter(e.target.value)}
              title="Filtrar por resultado"
            >
              <option value="">Status (todos)</option>
              <option value="ok">Sucesso</option>
              <option value="fail">Falha</option>
            </select>

            {/* Date range */}
            <input
              className={styles.searchInput}
              style={{width:170,height:40}}
              type="date"
              value={from}
              onChange={(e)=>setFrom(e.target.value)}
              title="De"
            />
            <span style={{opacity:.6}}>→</span>
            <input
              className={styles.searchInput}
              style={{width:170,height:40}}
              type="date"
              value={to}
              onChange={(e)=>setTo(e.target.value)}
              title="Até"
            />

            <button
              className={styles.refreshBtn}
              onClick={() => { setCursor(null); load(true); }}
              disabled={loading}
              title="Aplicar filtros"
              style={{display:"inline-flex",alignItems:"center",gap:6}}
            >
              <Filter size={16}/> Filtrar
            </button>
          </div>
        </div>

        {/* tabela */}
        <div className={styles.tableWrap}>
          <table className={styles.table}>
            <thead>
              <tr>
                <th>Data</th>
                <th>Ação</th>
                <th>Status</th>
                <th>Ator</th>
              </tr>
            </thead>
            <tbody>
              {loading && Array.from({length:6}).map((_,i)=>(
                <tr key={`sk-${i}`} className={styles.skelRow}>
                  <td colSpan={4}><div className={styles.skeletonRow}/></td>
                </tr>
              ))}

              {!loading && filtered.length===0 && (
                <tr><td colSpan={4} className={styles.empty}>Nenhum registro encontrado.</td></tr>
              )}

              {!loading && filtered.map((row) => {
                const badge = statusToBadge(row.status_code);
                const label = humanizeAction(row.action, row.resource_type);
                const actor = row.actor_user || row.actor_id || "—";

                return (
                  <tr key={row.id} className={styles.rowHover}>
                    <td data-label="Data">{formatDate(row.ts)}</td>
                    <td data-label="Ação">{label}</td>

                    <td data-label="Status">
                      {badge.ok ? (
                        <span className="nc-status-ok">
                          <CheckCircle2 size={14} style={{marginRight:6}}/>
                          {badge.text}
                        </span>
                      ) : (
                        <span className="nc-status-fail">
                          <XCircle size={14} style={{marginRight:6}}/>
                          {badge.text}
                        </span>
                      )}
                    </td>

                    <td data-label="Ator">{actor}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        {/* paginação simples por cursor (se backend retornar) */}
        <div style={{display:"flex",justifyContent:"flex-end",gap:8,padding:"12px 16px"}}>
          <button
            className={styles.refreshBtn}
            disabled={!nextCursor || loading}
            onClick={() => { setCursor(nextCursor); load(false); }}
            title="Carregar mais"
          >
            Carregar mais
          </button>
        </div>
      </div>
    </div>
  );
}
