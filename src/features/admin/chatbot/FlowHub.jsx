import React, { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { toast } from "react-toastify";
import { apiGet, apiPost } from "../../../shared/apiClient";

const THEME = {
  bg: "#f9fafb",
  panelBg: "#ffffff",
  text: "#0f172a",
  textMuted: "#475569",
  border: "#e2e8f0",
  shadow: "0 6px 20px rgba(15, 23, 42, 0.08)",
};

const CHANNELS = ["whatsapp", "instagram", "web"]; // ajuste se precisar

export default function FlowHub() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [rows, setRows] = useState([]);
  const [showNewModal, setShowNewModal] = useState(false);

  const load = async () => {
    try {
      setLoading(true);
      const data = await apiGet("/flows/meta"); // usa a view meta do seu back
      setRows(Array.isArray(data) ? data : []);
    } catch (e) {
      console.error(e);
      toast.error("Falha ao carregar flows");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  const handleOpenBuilder = (flow, channel) => {
    // rota com :flowId na URL + meta no state (nome e canal)
    navigate(`/admin/chatbot/builder/${flow.id}`, {
      state: { meta: { flowId: flow.id, name: flow.name, channel } },
    });
  };

  return (
    <div style={{ padding: 16, background: THEME.bg, minHeight: "100vh" }}>
      {/* header padrão simples */}
      <div style={{
        background: THEME.panelBg, border: `1px solid ${THEME.border}`,
        borderRadius: 12, padding: 14, marginBottom: 16, display: "flex",
        alignItems: "center", justifyContent: "space-between", boxShadow: THEME.shadow
      }}>
        <div style={{ fontWeight: 800 }}>FlowHub</div>
        <button
          onClick={() => setShowNewModal(true)}
          style={{
            background: "#2563eb", color: "#fff", border: "none",
            padding: "10px 14px", borderRadius: 10, fontWeight: 700, cursor: "pointer"
          }}
        >
          + Novo Flow
        </button>
      </div>

      {/* grid de cards */}
      {loading ? (
        <div style={{ color: THEME.textMuted }}>Carregando…</div>
      ) : rows.length === 0 ? (
        <div style={{ color: THEME.textMuted }}>Nenhum flow ainda. Crie o primeiro!</div>
      ) : (
        <div style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))",
          gap: 14
        }}>
          {rows.map((f) => (
            <FlowCard
              key={f.id}
              flow={f}
              onOpen={(channel) => handleOpenBuilder(f, channel)}
            />
          ))}
        </div>
      )}

      {showNewModal && (
        <NewFlowModal
          onClose={() => setShowNewModal(false)}
          onCreate={async (form) => {
            try {
              const created = await apiPost("/flows", {
                name: form.name,
                description: form.description || null,
              });
              toast.success(`Flow "${created?.name}" criado!`);
              setShowNewModal(false);
              // já abre o Builder desse flow novo no canal padrão
              navigate(`/admin/chatbot/builder/${created.id}`, {
                state: { meta: { flowId: created.id, name: created.name, channel: CHANNELS[0] } },
              });
            } catch (e) {
              console.error(e);
              toast.error("Erro ao criar flow");
            }
          }}
        />
      )}
    </div>
  );
}

function FlowCard({ flow, onOpen }) {
  const lastPublished = flow?.last_published ?? null;
  const lastVersion = flow?.last_version ?? null;
  const deploys = Array.isArray(flow?.active_deploys) ? flow.active_deploys : [];

  // canal sugerido: se tem algum deploy ativo usa o primeiro canal, senão ‘whatsapp’
  const suggestedChannel = useMemo(() => {
    if (deploys.length > 0) return deploys[0].channel;
    return CHANNELS[0];
  }, [deploys]);

  return (
    <div style={{
      background: "#fff", border: `1px solid ${THEME.border}`, borderRadius: 12,
      padding: 14, display: "flex", flexDirection: "column", gap: 10,
      boxShadow: THEME.shadow
    }}>
      <div style={{ fontWeight: 800 }}>{flow.name}</div>
      {flow.description && (
        <div style={{ fontSize: 13, color: THEME.textMuted }}>{flow.description}</div>
      )}

      <div style={{ fontSize: 12, color: THEME.textMuted, display: "flex", gap: 10 }}>
        <span>última publicada: <b>{lastPublished ?? "—"}</b></span>
        <span>última versão: <b>{lastVersion ?? "—"}</b></span>
      </div>

      {deploys.length > 0 ? (
        <div style={{ borderTop: `1px solid ${THEME.border}`, paddingTop: 8 }}>
          <div style={{ fontSize: 12, marginBottom: 6 }}>Deploys ativos</div>
          <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
            {deploys.slice(0, 4).map((d) => (
              <span key={d.id} style={pill}>
                {d.channel} · v{d.version}
              </span>
            ))}
          </div>
        </div>
      ) : (
        <div style={{ fontSize: 12, color: THEME.textMuted }}>
          Nenhum deploy ativo
        </div>
      )}

      <div style={{ marginTop: 8, display: "flex", gap: 8 }}>
        <ChannelPicker
          defaultValue={suggestedChannel}
          onOpen={(ch) => onOpen(ch)}
        />
      </div>
    </div>
  );
}

function ChannelPicker({ defaultValue, onOpen }) {
  const [channel, setChannel] = useState(defaultValue || CHANNELS[0]);
  return (
    <>
      <select
        value={channel}
        onChange={(e) => setChannel(e.target.value)}
        style={{
          border: `1px solid ${THEME.border}`, borderRadius: 8, padding: "8px 10px",
          background: "#fff"
        }}
      >
        {CHANNELS.map((c) => (
          <option key={c} value={c}>{c}</option>
        ))}
      </select>
      <button
        onClick={() => onOpen(channel)}
        style={{
          background: "#0ea5e9", color: "#fff", border: "none",
          padding: "8px 12px", borderRadius: 8, fontWeight: 700, cursor: "pointer"
        }}
      >
        Editar
      </button>
    </>
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
          <input
            autoFocus
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="ex.: Atendimentos WhatsApp"
            style={input}
          />
          <label style={label}>Descrição (opcional)</label>
          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="breve descrição"
            style={{ ...input, height: 88, resize: "vertical" }}
          />
        </div>

        <div style={{ display: "flex", justifyContent: "flex-end", gap: 8, marginTop: 14 }}>
          <button onClick={onClose} style={ghostBtn}>Cancelar</button>
          <button
            disabled={!canSave}
            onClick={() => onCreate({ name: name.trim(), description: description.trim() || "" })}
            style={{
              ...primaryBtn,
              ...(canSave ? {} : { opacity: 0.6, cursor: "not-allowed" })
            }}
          >
            Criar
          </button>
        </div>
      </div>
    </div>
  );
}

/* estilos */
const overlay = {
  position: "fixed", inset: 0, background: "rgba(15,23,42,.35)",
  display: "flex", alignItems: "center", justifyContent: "center", padding: 16, zIndex: 1000
};
const modal = {
  background: "#fff", border: `1px solid ${THEME.border}`, borderRadius: 12,
  width: "min(520px, 96vw)", padding: 16, boxShadow: THEME.shadow
};
const label = { fontSize: 12, color: THEME.textMuted };
const input = {
  border: `1px solid ${THEME.border}`, borderRadius: 8, padding: "10px 12px",
  outline: "none", width: "100%"
};
const pill = {
  fontSize: 12, border: `1px solid ${THEME.border}`, borderRadius: 999,
  padding: "4px 10px", background: "#f8fafc"
};
const linkBtn = {
  background: "transparent", color: "#2563eb", border: "none",
  fontWeight: 700, cursor: "pointer"
};
const ghostBtn = {
  background: "#fff", border: `1px solid ${THEME.border}`,
  padding: "8px 12px", borderRadius: 8, cursor: "pointer", fontWeight: 700
};
const primaryBtn = {
  background: "#2563eb", color: "#fff", border: "none",
  padding: "8px 12px", borderRadius: 8, cursor: "pointer", fontWeight: 700
};
