import React, { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { toast } from "react-toastify";
import { apiGet, apiPost } from "../../../shared/apiClient";
import { Bot, Workflow, Wifi } from "lucide-react";
import LogoLoader from "../../../components/LogoLoader";
import BrandIcon from "./BrandIcon";

const THEME = {
  bg: "#f9fafb",
  panelBg: "#ffffff",
  textMuted: "#475569",
  border: "#e2e8f0",
  shadow: "0 6px 20px rgba(15, 23, 42, 0.08)",
  brand: "#2563eb",
};

function getTenantFromHost() {
  if (typeof window === "undefined") return "";
  const host = window.location.hostname;
  const parts = host.split(".");
  if (parts.length >= 3) return parts[0] === "www" ? parts[1] : parts[0];
  return parts[0] || "";
}

export default function FlowHub() {
  const tenant = useMemo(() => getTenantFromHost(), []);
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [rows, setRows] = useState([]);
  const [showNewModal, setShowNewModal] = useState(false);

  const load = async () => {
    try {
      setLoading(true);
      const data = await apiGet(`/flows/meta${tenant ? `?subdomain=${tenant}` : ""}`);
      setRows(Array.isArray(data) ? data : []);
    } catch (e) {
      console.error(e);
      toast.error("Falha ao carregar flows");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, [tenant]);

  const openStudio = (f) =>
    navigate(`/development/studio/${f.id}`, { state: { meta: { flowId: f.id, name: f.name } } });
  const openChannels = (f) =>
    navigate(`/development/flowhub/${f.id}/channels`, { state: { from: "/development/flowhub" } });

  return (
    <div style={{ padding: 16, background: THEME.bg, minHeight: "100vh" }}>
      <div
        style={{
          background: THEME.panelBg,
          border: `1px solid ${THEME.border}`,
          borderRadius: 12,
          padding: 14,
          marginBottom: 16,
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          boxShadow: THEME.shadow,
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <span style={{ fontWeight: 800 }}>FlowHub</span>
        </div>

        <button
          onClick={() => setShowNewModal(true)}
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: 8,
            background: THEME.brand,
            color: "#fff",
            border: "none",
            padding: "10px 14px",
            borderRadius: 10,
            fontWeight: 700,
            cursor: "pointer",
          }}
        >
          + Novo Flow
        </button>
      </div>

      {loading ? (
        <LogoLoader
        full
        size={56}
        label="Carregando flow…"
        src="/logo.svg"
      />
      ) : rows.length === 0 ? (
        <div style={{ color: THEME.textMuted }}>Nenhum flow ainda. Crie o primeiro!</div>
      ) : (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(200px, 1fr))", gap: 14 }}>
          {rows.map((f) => (
            <div key={f.id}
              style={{
                background: "#fff", border: `1px solid ${THEME.border}`, borderRadius: 12, padding: 14,
                display: "flex", flexDirection: "column", gap: 12, boxShadow: THEME.shadow,
              }}
            >
              <div style={{ display: "flex", alignItems: "center" }}>
                <span style={{
                  display: "inline-flex", alignItems: "center", gap: 6, fontSize: 12,
                  padding: "3px 8px", borderRadius: 999, background: "#eef2ff", color: "#3730a3", fontWeight: 700,
                }}>
                  <Workflow size={14}/> flow
                </span>
                <div style={{ marginLeft: "auto", display: "flex", gap: 8 }}>
                  <IconButton title="Canais" onClick={() => openChannels(f)}><Wifi size={16}/></IconButton>
                  <IconButton title="Studio"  onClick={() => openStudio(f)}><Bot size={16}/></IconButton>
                </div>
              </div>

              <div style={{ fontWeight: 800 }}>{f.name}</div>
              {f.description ? <div style={{ fontSize: 13, color: THEME.textMuted }}>{f.description}</div> : null}

              <div style={{ borderTop: `1px solid ${THEME.border}`, paddingTop: 8, display: "flex", gap: 6, flexWrap: "wrap" }}>
                {Array.isArray(f.channels) && f.channels.length
                  ? f.channels.filter(c => c?.is_active).slice(0, 8).map((c, i) => (
                      <span key={`${c.channel_type}-${i}`}
                        title={c.display_name || c.channel_type}
                        style={{
                          display: "inline-flex", alignItems: "center", justifyContent: "center",
                          width: 32, height: 32, borderRadius: 10, border: `1px solid ${THEME.border}`, background: "#fff"
                        }}
                      >
                        <BrandIcon type={c.channel_type}/>
                      </span>
                    ))
                  : <span style={{ fontSize: 12, color: THEME.textMuted }}>Nenhum canal vinculado</span>}
              </div>
            </div>
          ))}
        </div>
      )}

      {showNewModal && (
        <NewFlowModal
          onClose={() => setShowNewModal(false)}
          onCreate={async (form) => {
            try {
              const created = await apiPost("/flows", { name: form.name, description: form.description || null });
              toast.success(`Flow "${created?.name}" criado!`);
              setShowNewModal(false);
              await load();
            } catch {
              toast.error("Erro ao criar flow");
            }
          }}
        />
      )}
    </div>
  );
}

function IconButton({ title, onClick, children }) {
  return (
    <button
      onClick={onClick}
      title={title}
      style={{
        width: 34, height: 34, display: "inline-flex", alignItems: "center", justifyContent: "center",
        borderRadius: 10, border: `1px solid #e2e8f0`, background: "#fff", cursor: "pointer",
      }}
    >
      {children}
    </button>
  );
}

function NewFlowModal({ onClose, onCreate }) {
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const canSave = name.trim().length > 0;

  return (
    <div style={overlay} onClick={onClose}>
      <div style={modal} onClick={(e) => e.stopPropagation()}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <strong>Novo Flow</strong>
          <button onClick={onClose} style={linkBtn}>Fechar</button>
        </div>

        <div style={{ display: "grid", gap: 8, marginTop: 12 }}>
          <label style={label}>Nome</label>
          <input autoFocus value={name} onChange={(e) => setName(e.target.value)} placeholder="ex.: Atendimento" style={input} />
          <label style={label}>Descrição (opcional)</label>
          <textarea value={description} onChange={(e) => setDescription(e.target.value)} placeholder="breve descrição" style={{ ...input, height: 88, resize: "vertical" }} />
        </div>

        <div style={{ display: "flex", justifyContent: "flex-end", gap: 8, marginTop: 14 }}>
          <button onClick={onClose} style={ghostBtn}>Cancelar</button>
          <button disabled={!canSave} onClick={() => onCreate({ name: name.trim(), description: description.trim() || "" })}
            style={{ ...primaryBtn, ...(canSave ? {} : { opacity: .6, cursor: "not-allowed" }) }}>
            Criar
          </button>
        </div>
      </div>
    </div>
  );
}

const overlay = { position: "fixed", inset: 0, background: "rgba(15,23,42,.35)", display: "flex", alignItems: "center", justifyContent: "center", padding: 16, zIndex: 1000 };
const modal   = { background: "#fff", border: `1px solid #e2e8f0`, borderRadius: 12, width: "min(520px, 96vw)", padding: 16, boxShadow: "0 6px 20px rgba(15, 23, 42, 0.08)" };
const label   = { fontSize: 12, color: "#475569" };
const input   = { border: `1px solid #e2e8f0`, borderRadius: 8, padding: "10px 12px", outline: "none", width: "100%" };
const linkBtn = { background: "transparent", color: "#2563eb", border: "none", fontWeight: 700, cursor: "pointer" };
const ghostBtn= { background: "#fff", border: `1px solid #e2e8f0`, padding: "8px 12px", borderRadius: 8, cursor: "pointer", fontWeight: 700 };
const primaryBtn = { background: "#2563eb", color: "#fff", border: "none", padding: "8px 12px", borderRadius: 8, cursor: "pointer", fontWeight: 700 };
