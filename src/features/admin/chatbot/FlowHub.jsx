// src/features/admin/chatbot/FlowHub.jsx
import { useEffect, useMemo, useState } from "react";
import { Plus, Radio } from "lucide-react";
import { apiGet, apiPost } from "../../../shared/apiClient";
import { useNavigate } from "react-router-dom";

export default function FlowHub() {
  const [list, setList] = useState([]);
  const [name, setName] = useState("");
  const [desc, setDesc] = useState("");
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const navigate = useNavigate();

  const load = async () => {
    setLoading(true);
    try {
      const rows = await apiGet("/flows/meta");   // <- agrega tudo p/ os cards
      setList(rows || []);
    } finally { setLoading(false); }
  };
  useEffect(() => { load(); }, []);

  const flows = useMemo(
    () => (list || []).filter(f => f && f.id && f.name),
    [list]
  );

  const handleCreate = async () => {
    if (!name.trim()) return;
    setCreating(true);
    try {
      const created = await apiPost("/flows", { name: name.trim(), description: desc || null });
      setName(""); setDesc("");
      await load();
      navigate(`/development/studio/${created.id}`);
    } finally { setCreating(false); }
  };

  return (
    <div style={{ padding: 24 }}>
      <h2 style={{ margin: 0, fontWeight: 800 }}>Flow Hub</h2>

      {/* Nova criação */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 2fr auto", gap: 10, marginTop: 12, marginBottom: 16 }}>
        <input value={name} onChange={e=>setName(e.target.value)} placeholder="Nome do novo flow"
          style={{ border:'1px solid #e5e7eb', borderRadius:10, padding:'10px 12px' }}/>
        <input value={desc} onChange={e=>setDesc(e.target.value)} placeholder="Descrição (opcional)"
          style={{ border:'1px solid #e5e7eb', borderRadius:10, padding:'10px 12px' }}/>
        <button onClick={handleCreate} disabled={!name.trim() || creating}
          style={{ display:'inline-flex', alignItems:'center', gap:8, background:'#111827', color:'#fff',
                   border:0, padding:'10px 14px', borderRadius:10, fontWeight:800, cursor:'pointer' }}>
          <Plus size={16}/> {creating? 'Criando…':'Novo flow'}
        </button>
      </div>

      {loading && <div style={{ color:'#64748b' }}>Carregando…</div>}
      {!loading && flows.length === 0 && (
        <div style={{ border:'1px dashed #cbd5e1', borderRadius:14, padding:24, background:'#f8fafc', color:'#475569' }}>
          Nenhum flow. Crie o primeiro acima.
        </div>
      )}

      {!!flows.length && (
        <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fill,minmax(260px,1fr))', gap:14 }}>
          {flows.map(f => (
            <div key={f.id} style={{ border:'1px solid #e5e7eb', borderRadius:14, background:'#fff', padding:16 }}>
              <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center' }}>
                <div style={{ fontWeight:800, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>
                  {f.name}
                </div>
                <button onClick={()=>navigate(`/development/studio/${f.id}`)}
                  style={{ background:'#2563eb', color:'#fff', border:0, padding:'8px 10px',
                           borderRadius:8, fontWeight:700, cursor:'pointer' }}>
                  Abrir
                </button>
              </div>
              {f.description && <div style={{ color:'#64748b', fontSize:12, marginTop:6 }}>{f.description}</div>}

              <div style={{ marginTop:10, display:'flex', gap:8, flexWrap:'wrap' }}>
                {(!f.active_deploys || f.active_deploys.length===0) ? (
                  <span style={{ fontSize:12, color:'#9ca3af' }}>Sem deploy ativo</span>
                ) : f.active_deploys.map(d => (
                  <span key={d.id} title={`v${d.version} • ${new Date(d.activated_at).toLocaleString()}`}
                        style={{ display:'inline-flex', alignItems:'center', gap:6, border:'1px solid #e5e7eb',
                                 borderRadius:999, padding:'4px 10px', background:'#f9fafb', fontSize:12 }}>
                    <Radio size={14}/> {d.channel} • v{d.version}
                  </span>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
