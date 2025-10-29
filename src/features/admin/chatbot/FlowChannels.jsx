// src/features/admin/chatbot/FlowChannels.jsx
import React, { useEffect, useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { toast } from "react-toastify";
import { apiGet, apiPost, apiDelete, apiPatch } from "../../../shared/apiClient";
import { ArrowLeft, Link2, Unlink, CheckCircle2,
  MessageCircle as WaIcon, Instagram as IgIcon, Send as TgIcon, Globe as WebIcon } from "lucide-react";

const THEME = {
  bg: "#f9fafb",
  panelBg: "#ffffff",
  text: "#0f172a",
  textMuted: "#475569",
  border: "#e2e8f0",
  shadow: "0 6px 20px rgba(15, 23, 42, 0.08)",
};

const iconFor = (type) => {
  const t = String(type||"").toLowerCase();
  if (t === "whatsapp") return <WaIcon size={16}/>;
  if (t === "instagram") return <IgIcon size={16}/>;
  if (t === "telegram") return <TgIcon size={16}/>;
  return <WebIcon size={16}/>;
};

export default function FlowChannels() {
  const { flowId } = useParams();
  const navigate = useNavigate();

  const [meta, setMeta] = useState(null);
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);

  const [newKey, setNewKey] = useState("");
  const [newType, setNewType] = useState("whatsapp");
  const [newName, setNewName] = useState("");

  const load = async () => {
    try {
      setLoading(true);
      const info = await apiGet(`/flows/${flowId}`);
      setMeta(info || null);
      const data = await apiGet(`/flows/${flowId}/channels`);
      setRows(Array.isArray(data) ? data : []);
    } catch (e) {
      console.error(e);
      toast.error("Falha ao carregar canais do flow");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); /* eslint-disable-next-line */ }, [flowId]);

  const bind = async () => {
    if (!newKey.trim()) { toast.info("Informe o channel_key"); return; }
    try {
      await apiPost(`/flows/${flowId}/channels`, {
        channel_key: newKey.trim(),
        channel_type: newType,
        display_name: newName.trim() || null,
      });
      toast.success("Canal vinculado");
      setNewKey(""); setNewName("");
      await load();
    } catch (e) {
      console.error(e);
      toast.error("Erro ao vincular canal");
    }
  };

  const unbind = async (channel_key) => {
    try {
      await apiDelete(`/flows/${flowId}/channels/${encodeURIComponent(channel_key)}`);
      toast.success("Canal desvinculado");
      await load();
    } catch (e) {
      console.error(e);
      toast.error("Erro ao desvincular canal");
    }
  };

  const toggleActive = async (channel_key, is_active) => {
    try {
      await apiPatch(`/flows/${flowId}/channels/${encodeURIComponent(channel_key)}`, {
        is_active: !is_active
      });
      await load();
    } catch (e) {
      console.error(e);
      toast.error("Erro ao alterar status do canal");
    }
  };

  return (
    <div style={{ padding: 16, background: THEME.bg, minHeight: "100vh" }}>
      {/* header */}
      <div style={{
        background: THEME.panelBg, border: `1px solid ${THEME.border}`,
        borderRadius: 12, padding: 14, marginBottom: 16, display: "flex",
        alignItems: "center", justifyContent: "space-between", boxShadow: THEME.shadow
      }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <button
            onClick={() => navigate("/admin/development/flowhub")}
            style={{ border:`1px solid ${THEME.border}`, background:"#fff", borderRadius:8, padding:"6px 8px", cursor:"pointer", display:"inline-flex", alignItems:"center", gap:6 }}
            title="Voltar ao FlowHub"
          >
            <ArrowLeft size={16}/> Voltar
          </button>
          <div>
            <div style={{ fontWeight: 800 }}>{meta?.name || "Flow"}</div>
            <div style={{ fontSize: 12, color: THEME.textMuted }}>Canais vinculados a este fluxo</div>
          </div>
        </div>

        <button
          onClick={() => navigate(`/admin/development/studio/${flowId}`, { state: { meta: { flowId, name: meta?.name || null } } })}
          style={{ background: "#2563eb", color:"#fff", border:"none", padding:"8px 12px", borderRadius:8, fontWeight:700, cursor:"pointer" }}
        >
          Abrir Builder
        </button>
      </div>

      {/* form de vínculo */}
      <div style={{
        background: THEME.panelBg, border:`1px solid ${THEME.border}`, borderRadius:12,
        padding:14, marginBottom:16, boxShadow:THEME.shadow
      }}>
        <div style={{ fontWeight:700, marginBottom:8, display:"flex", alignItems:"center", gap:8 }}>
          <Link2 size={16}/> Vincular novo canal
        </div>
        <div style={{ display:"grid", gridTemplateColumns:"160px 1fr 1fr auto", gap:8 }}>
          <select value={newType} onChange={(e)=>setNewType(e.target.value)}
                  style={{ border:`1px solid ${THEME.border}`, borderRadius:8, padding:"8px 10px", background:"#fff" }}>
            <option value="whatsapp">whatsapp</option>
            <option value="instagram">instagram</option>
            <option value="telegram">telegram</option>
            <option value="web">web</option>
          </select>
          <input value={newKey} onChange={(e)=>setNewKey(e.target.value)}
                 placeholder='channel_key ex: whatsapp:5511999999999'
                 style={{ border:`1px solid ${THEME.border}`, borderRadius:8, padding:"8px 10px" }}/>
          <input value={newName} onChange={(e)=>setNewName(e.target.value)} placeholder="rótulo (opcional)"
                 style={{ border:`1px solid ${THEME.border}`, borderRadius:8, padding:"8px 10px" }}/>
          <button onClick={bind}
                  style={{ background:"#16a34a", color:"#fff", border:"none", borderRadius:8, padding:"8px 12px", fontWeight:700, cursor:"pointer" }}>
            Vincular
          </button>
        </div>
      </div>

      {/* lista */}
      <div style={{ display:"grid", gap:10 }}>
        {loading ? (
          <div style={{ color: THEME.textMuted }}>Carregando…</div>
        ) : rows.length === 0 ? (
          <div style={{ color: THEME.textMuted }}>Nenhum canal vinculado.</div>
        ) : (
          rows.map((c) => (
            <div key={c.channel_key} style={{
              background:"#fff", border:`1px solid ${THEME.border}`, borderRadius:12,
              padding:12, display:"flex", alignItems:"center", justifyContent:"space-between"
            }}>
              <div style={{ display:"flex", alignItems:"center", gap:10 }}>
                <span style={{
                  display:"inline-flex", alignItems:"center", justifyContent:"center",
                  width:28, height:28, borderRadius:999, background:"#f1f5f9", border:`1px solid ${THEME.border}`
                }}>
                  {iconFor(c.channel_type)}
                </span>
                <div>
                  <div style={{ fontWeight:700 }}>{c.display_name || c.channel_key}</div>
                  <div style={{ fontSize:12, color:THEME.textMuted }}>{c.channel_type} • {c.channel_key}</div>
                </div>
              </div>

              <div style={{ display:"flex", gap:8 }}>
                <button
                  onClick={() => toggleActive(c.channel_key, c.is_active)}
                  style={{ background:"#fff", border:`1px solid ${THEME.border}`, borderRadius:8, padding:"6px 10px", cursor:"pointer", fontWeight:700 }}
                  title={c.is_active ? "Desativar" : "Ativar"}
                >
                  <CheckCircle2 size={16} style={{ marginRight:6, opacity:0.8 }}/>
                  {c.is_active ? "Ativo" : "Inativo"}
                </button>
                <button
                  onClick={() => unbind(c.channel_key)}
                  style={{ background:"#fff", border:`1px solid ${THEME.border}`, borderRadius:8, padding:"6px 10px", cursor:"pointer", fontWeight:700, color:"#b91c1c" }}
                  title="Desvincular canal"
                >
                  <Unlink size={16} style={{ marginRight:6 }}/> Remover
                </button>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
