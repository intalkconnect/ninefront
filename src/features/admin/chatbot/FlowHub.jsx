// src/features/admin/chatbot/FlowHub.jsx
import React, { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { toast } from "react-toastify";
import { apiGet, apiPost } from "../../../shared/apiClient";
import {
  Bot,
  MessageCircle,
  Instagram as IgIcon,
  MessageSquareText as FbIcon,
  Send,
  Link as LinkIcon,
  Wrench,
  Plus,
} from "lucide-react";

/* =========================
 * Tema
 * ========================= */
const THEME = {
  bg: "#f9fafb",
  panelBg: "#ffffff",
  text: "#0f172a",
  textMuted: "#475569",
  border: "#e2e8f0",
  shadow: "0 6px 20px rgba(15, 23, 42, 0.08)",
  brand: "#2563eb",
  info: "#0ea5e9",
};

const CHANNEL_ICONS = {
  whatsapp: <MessageCircle size={16} />,
  facebook: <FbIcon size={16} />,
  instagram: <IgIcon size={16} />,
  telegram: <Send size={16} />,
};

export default function FlowHub() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [rows, setRows] = useState([]);
  const [showNewModal, setShowNewModal] = useState(false);

  const load = async () => {
    try {
      setLoading(true);
      // /flows/meta deve trazer: id, name, description, last_published, last_version,
      // active_deploys[], e (preferencial) channels[] de flow_channels.
      const data = await apiGet("/flows/meta");
      setRows(Array.isArray(data) ? data : []);
    } catch (e) {
      console.error(e);
      toast.error("Falha ao carregar flows");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  const openStudio = (flow) => {
    navigate(`/development/studio/${flow.id}`, {
      state: { meta: { flowId: flow.id, name: flow.name } },
    });
  };

  const openFlowChannels = (flow) => {
    navigate(`/development/studio/${flow.id}/channels`, {
      state: { from: "/development/flowhub" },
    });
  };

  return (
    <div style={{ padding: 16, background: THEME.bg, minHeight: "100vh" }}>
      {/* Header */}
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
          <Plus size={16} />
          Novo Flow
        </button>
      </div>

      {/* Grid */}
      {loading ? (
        <div style={{ color: THEME.textMuted }}>Carregando…</div>
      ) : rows.length === 0 ? (
        <div style={{ color: THEME.textMuted }}>Nenhum flow ainda. Crie o primeiro!</div>
      ) : (
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fill, minmax(300px, 1fr))",
            gap: 14,
          }}
        >
          {rows.map((f) => (
            <FlowCard key={f.id} flow={f} onOpenStudio={() => openStudio(f)} onOpenChannels={() => openFlowChannels(f)} />
          ))}
        </div>
      )}

      {/* Modal Novo Flow */}
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
              // ⚠️ NÃO navegar para o Studio; permanece no FlowHub
              await load();
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

function FlowCard({ flow, onOpenStudio, onOpenChannels }) {
  const lastPublished = flow?.last_published ?? null;
  const lastVersion = flow?.last_version ?? null;

  // Preferir channels[] (flow_channels). Se não vier, cair para active_deploys[].channel
  const channelsBound = useMemo(() => {
    if (Array.isArray(flow?.channels) && flow.channels.length) {
      // esperado: [{channel_type, channel_id, ...}]
      return flow.channels
        .filter((c) => c?.channel_type)
        .map((c) => c.channel_type.toLowerCase());
    }
    if (Array.isArray(flow?.active_deploys) && flow.active_deploys.length) {
      const uniq = new Set(flow.active_deploys.map((d) => (d.channel || "").toLowerCase()));
      return Array.from(uniq);
    }
    return [];
  }, [flow]);

  return (
    <div
      style={{
        background: "#fff",
        border: `1px solid ${THEME.border}`,
        borderRadius: 12,
        padding: 14,
        display: "flex",
        flexDirection: "column",
        gap: 12,
        boxShadow: THEME.shadow,
      }}
    >
      {/* Top row: bag + action icons (Canais / Studio) */}
      <div style={{ display: "flex", alignItems: "center" }}>
        {/* Bag "flow" */}
        <span
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: 6,
            fontSize: 12,
            padding: "3px 8px",
            borderRadius: 999,
            background: "#eef2ff",
            color: "#3730a3",
            fontWeight: 700,
          }}
          title="Tipo"
        >
          <Bot size={14} /> flow
        </span>

        <div style={{ marginLeft: "auto", display: "flex", alignItems: "center", gap: 8 }}>
          {/* Botão ícone: Canais */}
          <IconButton
            title="Canais do flow"
            ariaLabel="Editar canais do flow"
            onClick={onOpenChannels}
          >
            <LinkIcon size={16} />
          </IconButton>

          {/* Botão ícone: Studio */}
          <IconButton title="Abrir Studio" ariaLabel="Abrir Studio" onClick={onOpenStudio}>
            <Wrench size={16} />
          </IconButton>
        </div>
      </div>

      {/* Título + descrição */}
      <div style={{ fontWeight: 800 }}>{flow.name}</div>
      {flow.description && (
        <div style={{ fontSize: 13, color: THEME.textMuted }}>{flow.description}</div>
      )}

      {/* Meta versões (sem falar de deploys) */}
      <div
        style={{
          fontSize: 12,
          color: THEME.textMuted,
          display: "flex",
          gap: 12,
          flexWrap: "wrap",
        }}
      >
        <span>última publicada: <b>{lastPublished ?? "—"}</b></span>
        <span>última versão: <b>{lastVersion ?? "—"}</b></span>
      </div>

      {/* Apenas ícones dos canais vinculados */}
      <div
        style={{
          borderTop: `1px solid ${THEME.border}`,
          paddingTop: 8,
          display: "flex",
          gap: 6,
          flexWrap: "wrap",
        }}
      >
        {channelsBound.length ? (
          channelsBound.slice(0, 8).map((type, idx) => (
            <span
              key={`${type}-${idx}`}
              title={type}
              style={{
                display: "inline-flex",
                alignItems: "center",
                justifyContent: "center",
                width: 32,
                height: 32,
                borderRadius: 10,
                border: `1px solid ${THEME.border}`,
                background: "#fff",
              }}
            >
              {CHANNEL_ICONS[type] || <MessageCircle size={16} />}
            </span>
          ))
        ) : (
          <span style={{ fontSize: 12, color: THEME.textMuted }}>
            Nenhum canal vinculado
          </span>
        )}
      </div>
    </div>
  );
}

function IconButton({ title, ariaLabel, onClick, children }) {
  return (
    <button
      onClick={onClick}
      title={title}
      aria-label={ariaLabel}
      style={{
        width: 34,
        height: 34,
        display: "inline-flex",
        alignItems: "center",
        justifyContent: "center",
        borderRadius: 10,
        border: `1px solid ${THEME.border}`,
        background: "#fff",
        cursor: "pointer",
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
          <input
            autoFocus
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="ex.: Atendimento Geral"
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
              ...(canSave ? {} : { opacity: 0.6, cursor: "not-allowed" }),
            }}
          >
            Criar
          </button>
        </div>
      </div>
    </div>
  );
}

/* estilos menores */
const overlay = {
  position: "fixed",
  inset: 0,
  background: "rgba(15,23,42,.35)",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  padding: 16,
  zIndex: 1000,
};
const modal = {
  background: "#fff",
  border: `1px solid ${THEME.border}`,
  borderRadius: 12,
  width: "min(520px, 96vw)",
  padding: 16,
  boxShadow: THEME.shadow,
};
const label = { fontSize: 12, color: THEME.textMuted };
const input = {
  border: `1px solid ${THEME.border}`,
  borderRadius: 8,
  padding: "10px 12px",
  outline: "none",
  width: "100%",
};
const linkBtn = {
  background: "transparent",
  color: THEME.brand,
  border: "none",
  fontWeight: 700,
  cursor: "pointer",
};
const ghostBtn = {
  background: "#fff",
  border: `1px solid ${THEME.border}`,
  padding: "8px 12px",
  borderRadius: 8,
  cursor: "pointer",
  fontWeight: 700,
};
const primaryBtn = {
  background: THEME.brand,
  color: "#fff",
  border: "none",
  padding: "8px 12px",
  borderRadius: 8,
  cursor: "pointer",
  fontWeight: 700,
};
