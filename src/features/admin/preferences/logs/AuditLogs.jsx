import React, { useEffect, useMemo, useState } from "react";
import { apiGet } from "../../../../shared/apiClient";
import { Search, Filter, ChevronRight, ChevronLeft, ExternalLink } from "lucide-react";

const cell = {
  padding: "10px 12px",
  borderBottom: "1px solid #e2e8f0",
  fontSize: 13,
  color: "#0f172a",
};

const th = { ...cell, fontWeight: 700, background: "#f8fafc" };

function JsonBlock({ data }) {
  if (!data || (typeof data === "object" && Object.keys(data).length === 0)) {
    return <div style={{ fontSize: 12, color: "#64748b" }}>—</div>;
  }
  return (
    <pre
      style={{
        background: "#0b1220",
        color: "#e5e7eb",
        padding: 12,
        borderRadius: 8,
        maxHeight: 300,
        overflow: "auto",
        fontSize: 12,
      }}
    >
      {JSON.stringify(data, null, 2)}
    </pre>
  );
}

export default function AuditLogs() {
  const [items, setItems] = useState([]);
  const [total, setTotal] = useState(0);
  const [q, setQ] = useState("");
  const [status, setStatus] = useState("");
  const [method, setMethod] = useState("");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [loading, setLoading] = useState(false);
  const [limit, setLimit] = useState(25);
  const [offset, setOffset] = useState(0);
  const [selected, setSelected] = useState(null);
  const [fullRow, setFullRow] = useState(null);

  const canPrev = offset > 0;
  const canNext = offset + limit < total;

  const load = async (ofs = offset) => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (q) params.set("q", q);
      if (status) params.set("status", status);
      if (method) params.set("method", method);
      if (from) params.set("from", from);
      if (to) params.set("to", to);
      params.set("limit", limit);
      params.set("offset", ofs);

      const res = await apiGet(`/audit/logs?${params.toString()}`);
      setItems(res.items || []);
      setTotal(res.total || 0);
      setOffset(ofs);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  const openDetails = async (row) => {
    setSelected(row);
    setFullRow(null);
    try {
      const res = await apiGet(`/audit/logs/${row.id}`);
      setFullRow(res);
    } catch (e) {
      console.error(e);
    }
  };

  useEffect(() => { load(0); /* first load */ }, []); // eslint-disable-line

  const statusColor = useMemo(
    () => (s) => {
      if (s >= 500) return "#ef4444";
      if (s >= 400) return "#f59e0b";
      if (s >= 200) return "#22c55e";
      return "#334155";
    },
    []
  );

  return (
    <div style={{ padding: 16, display: "grid", gap: 12 }}>
      <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
        <div style={{ position: "relative" }}>
          <Search size={16} style={{ position: "absolute", left: 10, top: 10, color: "#64748b" }} />
          <input
            placeholder="Buscar (ação, path, usuário, recurso...)"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && load(0)}
            style={{
              padding: "8px 12px 8px 32px",
              border: "1px solid #e2e8f0",
              borderRadius: 10,
              minWidth: 320,
            }}
          />
        </div>

        <select value={method} onChange={(e) => setMethod(e.target.value)} style={{ padding: 8, border: "1px solid #e2e8f0", borderRadius: 10 }}>
          <option value="">Método</option>
          {["GET", "POST", "PUT", "DELETE", "PATCH"].map(m => <option key={m}>{m}</option>)}
        </select>

        <select value={status} onChange={(e) => setStatus(e.target.value)} style={{ padding: 8, border: "1px solid #e2e8f0", borderRadius: 10 }}>
          <option value="">Status</option>
          {[200,201,204,400,401,403,404,409,422,500].map(s => <option key={s} value={s}>{s}</option>)}
        </select>

        <input type="datetime-local" value={from} onChange={(e)=>setFrom(e.target.value)} style={{ padding: 8, border: "1px solid #e2e8f0", borderRadius: 10 }} />
        <span style={{ color: "#64748b" }}>→</span>
        <input type="datetime-local" value={to} onChange={(e)=>setTo(e.target.value)} style={{ padding: 8, border: "1px solid #e2e8f0", borderRadius: 10 }} />

        <button onClick={() => load(0)} style={{ padding: "8px 12px", border: "1px solid #e2e8f0", borderRadius: 10, background: "#fff", display: "inline-flex", gap: 6, alignItems: "center", cursor: "pointer" }}>
          <Filter size={16} /> Filtrar
        </button>

        <div style={{ marginLeft: "auto", display: "flex", gap: 6, alignItems: "center" }}>
          <button disabled={!canPrev || loading} onClick={() => load(Math.max(offset - limit, 0))} style={{ padding: 8, borderRadius: 10, border: "1px solid #e2e8f0", background: "#fff", cursor: canPrev ? "pointer" : "default" }}>
            <ChevronLeft size={16} />
          </button>
          <div style={{ fontSize: 12, color: "#64748b" }}>
            {offset + 1}–{Math.min(offset + limit, total)} de {total}
          </div>
          <button disabled={!canNext || loading} onClick={() => load(offset + limit)} style={{ padding: 8, borderRadius: 10, border: "1px solid #e2e8f0", background: "#fff", cursor: canNext ? "pointer" : "default" }}>
            <ChevronRight size={16} />
          </button>
        </div>
      </div>

      <div style={{ border: "1px solid #e2e8f0", borderRadius: 12, overflow: "hidden" }}>
        <table style={{ width: "100%", borderCollapse: "collapse" }}>
          <thead>
            <tr>
              <th style={th}>Data</th>
              <th style={th}>Ação</th>
              <th style={th}>Status</th>
              <th style={th}>Método</th>
              <th style={th}>Path</th>
              <th style={th}>Ator</th>
              <th style={th}>Recurso</th>
              <th style={{ ...th, width: 60 }}></th>
            </tr>
          </thead>
          <tbody>
            {items.map((r) => (
              <tr key={r.id} style={{ background: selected?.id === r.id ? "#f1f5f9" : "#fff" }}>
                <td style={cell}>{new Date(r.ts).toLocaleString()}</td>
                <td style={cell}>{r.action || "—"}</td>
                <td style={{ ...cell, fontWeight: 700, color: statusColor(r.status_code) }}>{r.status_code}</td>
                <td style={cell}>{r.method}</td>
                <td style={{ ...cell, color: "#475569" }}>{r.path}</td>
                <td style={cell}>{r.actor_user || r.actor_id || "—"}</td>
                <td style={cell}>
                  {r.resource_type ? `${r.resource_type}:${r.resource_id ?? "—"}` : "—"}
                </td>
                <td style={{ ...cell, textAlign: "right" }}>
                  <button
                    onClick={() => openDetails(r)}
                    style={{ border: "1px solid #e2e8f0", borderRadius: 8, padding: "6px 8px", background: "#fff", cursor: "pointer" }}
                    title="Abrir detalhes"
                  >
                    <ExternalLink size={16} />
                  </button>
                </td>
              </tr>
            ))}
            {!items.length && !loading && (
              <tr><td colSpan={8} style={{ ...cell, textAlign: "center", color: "#64748b" }}>Sem registros</td></tr>
            )}
            {loading && (
              <tr><td colSpan={8} style={{ ...cell, textAlign: "center", color: "#64748b" }}>Carregando…</td></tr>
            )}
          </tbody>
        </table>
      </div>

      {/* Drawer simples de detalhes */}
      {selected && (
        <div
          role="dialog"
          aria-modal="true"
          style={{
            position: "fixed", top: 0, right: 0, bottom: 0, width: "min(640px, 90vw)",
            background: "#fff", borderLeft: "1px solid #e2e8f0", boxShadow: "0 0 40px rgba(2,6,23,.18)",
            padding: 16, overflow: "auto", zIndex: 9999
          }}
          onClick={(e)=>{ if(e.target === e.currentTarget) setSelected(null); }}
        >
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
            <div style={{ fontWeight: 800 }}>Log #{selected.id}</div>
            <button onClick={()=>setSelected(null)} style={{ border: "1px solid #e2e8f0", borderRadius: 8, padding: "6px 12px", background: "#fff", cursor: "pointer" }}>Fechar</button>
          </div>

          <div style={{ display: "grid", gap: 8, fontSize: 13, color: "#0f172a" }}>
            <div><b>Data:</b> {new Date(selected.ts).toLocaleString()}</div>
            <div><b>Ação:</b> {selected.action || "—"}</div>
            <div><b>Status:</b> {selected.status_code}</div>
            <div><b>HTTP:</b> {selected.method} <span style={{ color: "#475569" }}>{selected.path}</span></div>
            <div><b>Ator:</b> {selected.actor_user || selected.actor_id || "—"}</div>
            <div><b>IP:</b> {selected.ip || "—"}</div>
            <div><b>UA:</b> <span style={{ color: "#475569" }}>{selected.user_agent || "—"}</span></div>
            <div><b>Recurso:</b> {selected.resource_type ? `${selected.resource_type}:${selected.resource_id ?? "—"}` : "—"}</div>

            <hr style={{ border: 0, borderTop: "1px solid #e2e8f0", margin: "8px 0" }} />

            <div><b>request_body</b></div>
            <JsonBlock data={fullRow?.request_body} />

            <div><b>response_body</b></div>
            <JsonBlock data={fullRow?.response_body} />

            <div><b>before_data</b></div>
            <JsonBlock data={fullRow?.before_data} />

            <div><b>after_data</b></div>
            <JsonBlock data={fullRow?.after_data} />

            <div><b>extra</b></div>
            <JsonBlock data={fullRow?.extra} />
          </div>
        </div>
      )}
    </div>
  );
}
