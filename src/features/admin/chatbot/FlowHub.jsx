// src/features/admin/chatbot/FlowHub.jsx
import React, { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { toast } from "react-toastify";
import { apiGet, apiPost } from "../../../shared/apiClient";
import { Bot, MessageCircle, Instagram as IgIcon, MessageSquareText as FbIcon, Send, Link as LinkIcon } from "lucide-react";

/* =========================
 * Tema
 * ========================= */
const THEME = {
  bg: "#f9fafb",
  panelBg: "#ffffff",
  text: "#0f172a",
  textMuted: "#475569",
  border: "#e2e8f0",
  borderMuted: "#cbd5e1",
  shadow: "0 6px 20px rgba(15, 23, 42, 0.08)",
  brand: "#2563eb",
  info: "#0ea5e9",
};

const CHANNELS = ["whatsapp", "facebook", "instagram", "telegram"];
const CHANNEL_ICONS = {
  whatsapp: <MessageCircle size={14} />,
  facebook: <FbIcon size={14} />,
  instagram: <IgIcon size={14} />,
  telegram: <Send size={14} />,
};

export default function FlowHub() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [rows, setRows] = useState([]);
  const [showNewModal, setShowNewModal] = useState(false);

  const load = async () => {
    try {
      setLoading(true);
      // usa a rota /flows/meta enriquecida com "channels"
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

  // abre o Builder do flow (mantemos canal "visual" como escolha local)
  const handleOpenBuilder = (flow, channel) => {
    navigate(`/development/studio/${flow.id}`, {
      state: {
        meta: { flowId: flow.id, name: flow.name, channel },
      },
    });
  };

  // único ponto do card para editar canais do flow
  const handleOpenFlowChannels = (flow) => {
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
          <span
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: 8,
              fontWeight: 800,
            }}
          >
            FlowHub
          </span>
        </div>
        <button
          onClick={() => setShowNewModal(true)}
          style={{
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

      {/* Grid */}
      {loading ? (
        <div style={{ color: THEME.textMuted }}>Carregando…</div>
      ) : rows.length === 0 ? (
        <div style={{ color: THEME.textMuted }}>
          Nenhum flow ainda. Crie o primeiro!
        </div>
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
              onOpenBuilder={(channel) => handleOpenBuilder(f, channel)}
              onOpenChannels={() => handleOpenFlowChannels(f)} // único ponto clicável para editar canais
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
              await load();

              // abre já o Builder do novo flow
              navigate(`/development/studio/${created.id}`, {
                state: {
                  meta: {
                    flowId: created.id,
                    name: created.name,
                    channel: "whatsapp",
                  },
                },
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

function FlowCard({ flow, onOpenBuilder, onOpenChannels }) {
  const lastPublished = flow?.last_published ?? null;
  const lastVersion = flow?.last_version ?? null;
  const deploys = Array.isArray(flow?.active_deploys) ? flow.active_deploys : [];
  const channelsBound = Array.isArray(flow?.channels) ? flow.channels : [];

  // canal “sugerido”: se tem algum deploy usa o primeiro canal do deploy; senão "whatsapp"
  const suggestedChannel = useMemo(() => {
    if (deploys.length > 0) return deploys[0].channel || "whatsapp";
    return "whatsapp";
  }, [deploys]);

  return (
    <div
      style={{
        background: "#fff",
        border: `1px solid ${THEME.border}`,
        borderRadius: 12,
        padding: 14,
        display: "flex",
        flexDirection: "column",
        gap: 10,
        boxShadow: THEME.shadow,
      }}
    >
      {/* Bag "flow" */}
      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
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
        >
          <Bot size={14} /> flow
        </span>
      </div>

      <div style={{ fontWeight: 800 }}>{flow.name}</div>
      {flow.description && (
        <div style={{ fontSize: 13, color: THEME.textMuted }}>
          {flow.description}
        </div>
      )}

      {/* Meta versões */}
      <div
        style={{
          fontSize: 12,
          color: THEME.textMuted,
          display: "flex",
          gap: 10,
          flexWrap: "wrap",
        }}
      >
        <span>
          última publicada: <b>{lastPublished ?? "—"}</b>
        </span>
        <span>
          última versão: <b>{lastVersion ?? "—"}</b>
        </span>
      </div>

      {/* Linha de Canais (informativa) + único CTA para editar */}
      <div
        style={{
          borderTop: `1px solid ${THEME.border}`,
          paddingTop: 8,
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          gap: 8,
        }}
      >
        <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
          {channelsBound.length ? (
            channelsBound.slice(0, 6).map((c) => (
              <span
                key={`${c.channel_type}:${c.channel_id}`}
                title={`${c.channel_type}`}
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  justifyContent: "center",
                  width: 28,
                  height: 28,
                  borderRadius: 8,
                  border: `1px solid ${THEME.border}`,
                  background: "#fff",
                }}
              >
                {CHANNEL_ICONS[c.channel_type] || <MessageCircle size={14} />}
              </span>
            ))
          ) : (
            <span style={{ fontSize: 12, color: THEME.textMuted }}>
              Nenhum canal vinculado
            </span>
          )}
        </div>

        {/* ÚNICO local clicável do card para editar canais */}
        <button
          onClick={onOpenChannels}
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: 6,
            fontSize: 12,
            padding: "6px 10px",
            borderRadius: 8,
            border: `1px solid ${THEME.border}`,
            background: "#fff",
            cursor: "pointer",
            fontWeight: 700,
          }}
          title="Editar canais deste flow"
        >
          <LinkIcon size={14} />
          Canais do Flow
        </button>
      </div>

      {/* Deploys ativos (se houver) */}
      {deploys.length > 0 ? (
        <div>
          <div style={{ fontSize: 12, marginBottom: 6 }}>Deploys ativos</div>
          <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
            {deploys.slice(0, 4).map((d) => (
              <span
                key={d.id}
                style={{
                  fontSize: 12,
                  border: `1px solid ${THEME.border}`,
                  borderRadius: 999,
                  padding: "4px 10px",
                  background: "#f8fafc",
                }}
              >
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

      {/* Ações (apenas Editar Builder; canal é editado no CTA único acima) */}
      <div style={{ marginTop: 8, display: "flex", gap: 8 }}>
        <ChannelPicker
          defaultValue={suggestedChannel}
          onOpen={(ch) => onOpenBuilder(ch)}
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
          border: `1px solid ${THEME.border}`,
          borderRadius: 8,
          padding: "8px 10px",
          background: "#fff",
        }}
      >
        {CHANNELS.map((c) => (
          <option key={c} value={c}>
            {c}
          </option>
        ))}
      </select>
      <button
        onClick={() => onOpen(channel)}
        style={{
          background: THEME.info,
          color: "#fff",
          border: "none",
          padding: "8px 12px",
          borderRadius: 8,
          fontWeight: 700,
          cursor: "pointer",
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
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
          }}
        >
          <strong>Novo Flow</strong>
          <button onClick={onClose} style={linkBtn}>
            Fechar
          </button>
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

        <div
          style={{
            display: "flex",
            justifyContent: "flex-end",
            gap: 8,
            marginTop: 14,
          }}
        >
          <button onClick={onClose} style={ghostBtn}>
            Cancelar
          </button>
          <button
            disabled={!canSave}
            onClick={() =>
              onCreate({
                name: name.trim(),
                description: description.trim() || "",
              })
            }
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
