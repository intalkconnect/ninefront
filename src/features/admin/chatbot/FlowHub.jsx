// src/features/admin/chatbot/FlowHub.jsx
import React, { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { toast } from "react-toastify";
import { apiGet, apiPost } from "../../../shared/apiClient";
import { PlugZap, Bot, Workflow, Wrench, Plus } from "lucide-react";

/* =========================
 * Logos reais (SVG)
 * ========================= */
const WhatsAppLogo = ({ size = 16 }) => (
  <svg width={size} height={size} viewBox="0 0 32 32" aria-hidden="true">
    <path fill="#25D366" d="M16 3C9.372 3 4 8.372 4 15c0 2.124.56 4.118 1.545 5.856L4 29l8.35-1.514A11.93 11.93 0 0 0 16 27c6.628 0 12-5.372 12-12S22.628 3 16 3z"/>
    <path fill="#fff" d="M23.09 19.18c-.2.56-1.16 1.07-1.6 1.1-.44.03-1 .03-1.61-.1-.37-.09-.84-.27-1.45-.53-2.55-1.1-4.2-3.65-4.33-3.82-.13-.17-1.03-1.37-1.03-2.62 0-1.25.65-1.86.88-2.11.23-.25.5-.31.67-.31.17 0 .34.01.49.01.16 0 .37-.06.58.44.2.5.69 1.73.75 1.85.06.12.1.26.02.42-.08.16-.12.26-.24.4-.12.14-.25.31-.36.42-.12.12-.24.25-.1.49.14.25.62 1.02 1.34 1.66.92.82 1.7 1.08 1.95 1.2.25.12.39.1.53-.06.14-.16.61-.71.78-.95.17-.24.33-.2.55-.12.23.08 1.44.68 1.69.81.25.13.41.19.47.3.06.11.06.64-.14 1.24z"/>
  </svg>
);
const InstagramLogo = ({ size = 16 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" aria-hidden="true">
    <linearGradient id="ig" x1="0" x2="1" y1="1" y2="0">
      <stop offset="0%" stopColor="#feda75"/><stop offset="25%" stopColor="#fa7e1e"/>
      <stop offset="50%" stopColor="#d62976"/><stop offset="75%" stopColor="#962fbf"/>
      <stop offset="100%" stopColor="#4f5bd5"/>
    </linearGradient>
    <path fill="url(#ig)" d="M7 2h10a5 5 0 0 1 5 5v10a5 5 0 0 1-5 5H7a5 5 0 0 1-5-5V7a5 5 0 0 1 5-5z"/>
    <circle cx="18" cy="6" r="1.3" fill="#fff"/>
    <circle cx="12" cy="12" r="3.5" fill="none" stroke="#fff" strokeWidth="2"/>
    <rect x="4" y="4" width="16" height="16" rx="4" ry="4" fill="none" stroke="#fff" strokeWidth="2"/>
  </svg>
);
const FacebookLogo = ({ size = 16 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" aria-hidden="true">
    <path fill="#1877F2" d="M24 12.073C24 5.403 18.627 0 12 0S0 5.403 0 12.073C0 18.1 4.388 23.093 10.125 24v-8.44H7.078v-3.487h3.047V9.41c0-3.007 1.79-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953h-1.513c-1.49 0-1.954.927-1.954 1.878v2.26h3.328l-.532 3.487h-2.796V24C19.612 23.093 24 18.1 24 12.073z"/>
  </svg>
);
const TelegramLogo = ({ size = 16 }) => (
  <svg width={size} height={size} viewBox="0 0 240 240" aria-hidden="true">
    <circle cx="120" cy="120" r="120" fill="#29A9EB"/>
    <path fill="#fff" d="M52 123l117-45c5-2 9 2 8 7l-20 93c-1 6-8 8-12 5l-33-24-18 18c-2 2-6 1-6-2l1-26 63-60c2-2 0-2-3 0l-78 49-34-14c-6-2-6-10 0-12z"/>
  </svg>
);

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
};

const CHANNEL_ICONS = {
  whatsapp: <WhatsAppLogo />,
  facebook: <FacebookLogo />,
  instagram: <InstagramLogo />,
  telegram: <TelegramLogo />,
};

export default function FlowHub() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [rows, setRows] = useState([]);
  const [showNewModal, setShowNewModal] = useState(false);

  const load = async () => {
    try {
      setLoading(true);
      const data = await apiGet("/flows/meta");
      setRows(Array.isArray(data) ? data : []);
    } catch (e) {
      console.error(e);
      toast.error("Falha ao carregar flows");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

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
            <FlowCard
              key={f.id}
              flow={f}
              onOpenStudio={() => openStudio(f)}
              onOpenChannels={() => openFlowChannels(f)}
            />
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
              await load(); // permanece no hub
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

  // Preferir channels[] (flow_channels); fallback: active_deploys[].channel
  const channelsBound = useMemo(() => {
    if (Array.isArray(flow?.channels) && flow.channels.length) {
      return flow.channels
        .filter((c) => c?.channel_type)
        .map((c) => String(c.channel_type).toLowerCase());
    }
    if (Array.isArray(flow?.active_deploys) && flow.active_deploys.length) {
      const uniq = new Set(
        flow.active_deploys.map((d) => (d.channel || "").toLowerCase())
      );
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
      {/* Top row: bag + action icons */}
      <div style={{ display: "flex", alignItems: "center" }}>
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
          title="Tipo de objeto"
        >
          <Workflow size={14} /> flow
        </span>

        <div style={{ marginLeft: "auto", display: "flex", alignItems: "center", gap: 8 }}>
          {/* Canais (ícone) */}
          <IconButton title="Canais do flow" ariaLabel="Canais do flow" onClick={onOpenChannels}>
            <PlugZap size={16} />
          </IconButton>
          {/* Studio (ícone) */}
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

      {/* Meta */}
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

      {/* Ícones dos canais vinculados (reais) */}
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
              {CHANNEL_ICONS[type] || <Bot size={16} />}
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
  color: "#2563eb",
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
  background: "#2563eb",
  color: "#fff",
  border: "none",
  padding: "8px 12px",
  borderRadius: 8,
  cursor: "pointer",
  fontWeight: 700,
};
