import { useEffect, useMemo, useState } from "react";
import { Plus, GitBranch, Zap, Radio } from "lucide-react";
import { apiGet, apiPost } from "../../../shared/apiClient";
import { useNavigate } from "react-router-dom";

const Card = ({ children }) => (
  <div style={{
    border: "1px solid #e5e7eb",
    borderRadius: 14,
    background: "#fff",
    padding: 16,
    boxShadow: "0 6px 20px rgba(15,23,42,.06)",
    display: "flex",
    flexDirection: "column",
    gap: 10,
  }}>{children}</div>
);

export default function FlowHub() {
  const [flows, setFlows] = useState([]);
  const [deploys, setDeploys] = useState([]);
  const [creating, setCreating] = useState(false);
  const [name, setName] = useState("");
  const [desc, setDesc] = useState("");
  const navigate = useNavigate();

  const load = async () => {
    const [fs, ds] = await Promise.all([
      apiGet("/flows"),
      apiGet("/flows/deployments"),
    ]);
    setFlows(fs || []);
    setDeploys(ds || []);
  };

  useEffect(() => { load(); }, []);

  const byFlow = useMemo(() => {
    const map = new Map();
    deploys.forEach(d => {
      const arr = map.get(d.flow_id) || [];
      arr.push(d);
      map.set(d.flow_id, arr);
    });
    return map;
  }, [deploys]);

  const handleCreate = async () => {
    if (!name.trim()) return;
    setCreating(true);
    try {
      const created = await apiPost("/flows", { name: name.trim(), description: desc || null });
      setName(""); setDesc("");
      await load();
      // abre direto o builder desse flow
      navigate(`/development/studio/${created.id}`);
    } finally {
      setCreating(false);
    }
  };

  return (
    <div style={{ padding: 24 }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 16 }}>
        <h2 style={{ margin: 0, fontWeight: 800, color: "#0f172a" }}>Flow Hub</h2>
      </div>

      {/* linha de criação rápida */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 2fr auto", gap: 10, marginBottom: 16 }}>
        <input
          placeholder="Nome do novo flow"
          value={name}
          onChange={e=>setName(e.target.value)}
          style={{ border: "1px solid #e5e7eb", borderRadius: 10, padding: "10px 12px" }}
        />
        <input
          placeholder="Descrição (opcional)"
          value={desc}
          onChange={e=>setDesc(e.target.value)}
          style={{ border: "1px solid #e5e7eb", borderRadius: 10, padding: "10px 12px" }}
        />
        <button
          onClick={handleCreate}
          disabled={creating || !name.trim()}
          style={{
            display: "inline-flex", alignItems: "center", gap: 8,
            background: "#111827", color: "#fff", border: "none",
            padding: "10px 14px", borderRadius: 10, fontWeight: 800, cursor: "pointer"
          }}
        >
          <Plus size={16}/> {creating ? "Criando…" : "Novo flow"}
        </button>
      </div>

      {/* grid de cards */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill,minmax(260px,1fr))", gap: 14 }}>
        {flows.map(f => {
          const list = byFlow.get(f.id) || [];
          return (
            <Card key={f.id}>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                <div style={{ fontWeight: 800, color: "#0f172a" }}>{f.name}</div>
                <button
                  onClick={()=>navigate(`/development/studio/${f.id}`)}
                  style={{ background: "#2563eb", color: "#fff", border: 0, padding: "8px 10px", borderRadius: 8, fontWeight: 700, cursor: "pointer" }}
                  title="Abrir no Builder"
                >
                  Abrir
                </button>
              </div>
              {f.description && <div style={{ color:"#64748b", fontSize: 12 }}>{f.description}</div>}

              <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginTop: 6 }}>
                {list.length === 0 ? (
                  <span style={{ fontSize: 12, color: "#9ca3af" }}>Sem deploy ativo</span>
                ) : list.map(d => (
                  <span key={d.id} title={`v${d.version} • ${new Date(d.activated_at).toLocaleString()}`}
                    style={{
                      display: "inline-flex", alignItems: "center", gap: 6,
                      border: "1px solid #e5e7eb", borderRadius: 999, padding: "4px 10px",
                      background: "#f9fafb", fontSize: 12
                    }}>
                    <Radio size={14}/> {d.channel} <span style={{display:'inline-flex', alignItems:'center', gap:4, fontWeight:700}}><GitBranch size={12}/>v{d.version}</span>
                  </span>
                ))}
              </div>
            </Card>
          );
        })}
      </div>
    </div>
  );
}
