// src/features/admin/chatbot/FlowHub.jsx
import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Plus } from "lucide-react";
import { apiGet, apiPost } from "../../../shared/apiClient";

export default function FlowHub() {
  const nav = useNavigate();
  const [rows, setRows] = useState([]);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [creating, setCreating] = useState(false);
  const [loading, setLoading] = useState(true);

  const load = async () => {
    try {
      setLoading(true);
      const data = await apiGet("/flows");
      setRows(Array.isArray(data) ? data : []);
    } finally {
      setLoading(false);
    }
  };
  useEffect(() => { load(); }, []);

  const createFlow = async () => {
    if (!name.trim()) return;
    try {
      setCreating(true);
      const res = await apiPost("/flows", { name: name.trim(), description: description || null });
      setName(""); setDescription("");
      await load();
      // abre direto no builder do novo flow
      nav(`/development/studio/${res.id}`);
    } finally {
      setCreating(false);
    }
  };

  return (
    <div style={{ padding: 16 }}>
      <div style={{ display: "flex", gap: 8, alignItems: "center", marginBottom: 12 }}>
        <input
          placeholder="Nome do novo flow"
          value={name}
          onChange={(e)=>setName(e.target.value)}
          style={{ flex: 1, padding: 10, border: "1px solid #e2e8f0", borderRadius: 10 }}
        />
        <input
          placeholder="Descrição (opcional)"
          value={description}
          onChange={(e)=>setDescription(e.target.value)}
          style={{ flex: 2, padding: 10, border: "1px solid #e2e8f0", borderRadius: 10 }}
        />
        <button
          onClick={createFlow}
          disabled={!name.trim() || creating}
          style={{
            display: "inline-flex", alignItems: "center", gap: 8,
            background: "#0ea5e9", color: "#fff", padding: "10px 14px",
            border: 0, borderRadius: 10, fontWeight: 700, cursor: "pointer"
          }}
        >
          <Plus size={16}/> Novo flow
        </button>
      </div>

      {loading ? (
        <div>Carregando…</div>
      ) : rows.length === 0 ? (
        <div>Nenhum flow ainda. Crie o primeiro acima.</div>
      ) : (
        <div style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fill, minmax(260px, 1fr))",
          gap: 12
        }}>
          {rows.map((f)=>(
            <div key={f.id} style={{
              border: "1px solid #e5e7eb", borderRadius: 14, padding: 16, background: "#fff"
            }}>
              <div style={{ fontWeight: 800, marginBottom: 6 }}>{f.name || f.id}</div>
              {f.description && <div style={{ fontSize: 12, color: "#64748b" }}>{f.description}</div>}
              <div style={{ display: "flex", justifyContent: "flex-end", marginTop: 10 }}>
                <button
                  onClick={()=>nav(`/development/studio/${f.id}`)}
                  style={{ background: "#2563eb", color: "#fff", border: 0, borderRadius: 8, padding: "8px 12px", fontWeight: 700, cursor: "pointer" }}
                >
                  Abrir
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
