// src/features/admin/chatbot/FlowHub.jsx
import React, { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { toast } from "react-toastify";
import { apiGet, apiPost } from "../../../shared/apiClient";

// Ícones
import {
  Bot,
  MessageCircle as WhatsIcon,
  Instagram as InstaIcon,
  Send as TgIcon,
  Globe as WebIcon,
  ChevronRight,
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
  ring: "0 0 0 3px rgba(37, 99, 235, 0.15)",
};

/* =========================
 * Helpers
 * ========================= */
const channelIcon = (type) => {
  const t = String(type || "").toLowerCase();
  if (t === "whatsapp") return <WhatsIcon size={16} />;
  if (t === "instagram") return <InstaIcon size={16} />;
  if (t === "telegram") return <TgIcon size={16} />;
  return <WebIcon size={16} />;
};

const CHANNELS_ORDER = ["whatsapp", "instagram", "telegram", "web"];

/* =========================
 * FlowHub
 * ========================= */
export default function FlowHub() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [rows, setRows] = useState([]);
  const [showNewModal, setShowNewModal] = useState(false);

  const load = async () => {
    try {
      setLoading(true);
      // Lista de flows com últimas versões e deploys
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

  // Abre Builder com meta mínima
  const handleOpenBuilder = (flow, preferredChannelKey) => {
    navigate(`/development/studio/${flow.id}`, {
      state: {
        meta: {
          flowId: flow.id,
          name: flow.name,
          // se você já tiver channelKey preferido, passe aqui
          channelKey: preferredChannelKey || null,
        },
      },
    });
  };

  // Abre pagina de canais por flow
  const handleOpenChannels = (flowId) => {
    navigate(`/development/flowhub/${flowId}/channels`);
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
            <Bot size={18} />
            FlowHub
          </span>
        </div>

        <button
          onClick={() => setShowNewModal(true)}
          style={{
            background: "#2563eb",
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

      {/* Grid de cards */}
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
              onOpenBuilder={() => handleOpenBuilder(f, null)}
              onOpenChannels={() => handleOpenChannels(f.id)}
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
              await load();

              // Abre o Builder do novo flow
              navigate(`/admin/development/studio/${created.id}`, {
                state: {
                  meta: {
                    flowId: created.id,
                    name: created.name,
                    channelKey: null,
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

/* =========================
 * Card do Flow
 * ========================= */
function FlowCard({ flow, onOpenBuilder, onOpenChannels }) {
  // Dados vindos de /flows/meta
  const lastPublished = flow?.last_published ?? null;
  const lastVersion = flow?.last_version ?? null;
  const deploys = Array.isArray(flow?.active_deploys) ? flow.active_deploys : [];

  // Carrega canais desse flow on-demand
  const [channels, setChannels] = useState([]);
  const [chLoading, setChLoading] = useState(true);

  const loadChannels = async () => {
    try {
      setChLoading(true);
      const rows = await apiGet(`/flows/${flow.id}/channels`);
      setChannels(Array.isArray(rows) ? rows : []);
    } catch (e) {
      console.error(e);
    } finally {
      setChLoading(false);
    }
  };

  useEffect(() => {
    loadChannels();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [flow?.id]);

  // Ordena canais pelos tipos padrão
  const sortedChannels = useMemo(() => {
    return [...channels].sort((a, b) => {
      const ai = CHANNELS_ORDER.indexOf((a.channel_type || "").toLowerCase());
      const bi = CHANNELS_ORDER.indexOf((b.channel_type || "").toLowerCase());
      const as = ai === -1 ? 999 : ai;
      const bs = bi === -1 ? 999 : bi;
      return as - bs;
    });
  }, [channels]);

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
      {/* badge Flow */}
      <div
        style={{
          display: "inline-flex",
          alignItems: "center",
          gap: 6,
          fontSize: 12,
          fontWeight: 700,
          borderRadius: 999,
          border: `1px solid ${THEME.border}`,
          padding: "4px 10px",
          background: "#f8fafc",
          width: "fit-content",
          color: THEME.text,
        }}
      >
        <Bot size={14} />
        flow
      </div>

      {/* Título + descrição */}
      <div style={{ display: "grid", gap: 4 }}>
        <div style={{ fontWeight: 800 }}>{flow.name}</div>
        {flow.description && (
          <div style={{ fontSize: 13, color: THEME.textMuted }}>
            {flow.description}
          </div>
        )}
      </div>

      {/* Versões */}
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

      {/* Deploys ativos (resumo) */}
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

      {/* Canais vinculados (ícones clicáveis) */}
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
        <div style={{ fontSize: 12, color: THEME.textMuted }}>Canais</div>

        <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
          {chLoading ? (
            <span style={{ fontSize: 12, color: THEME.textMuted }}>
              carregando…
            </span>
          ) : sortedChannels.length === 0 ? (
            <button
              onClick={onOpenChannels}
              style={linkBtnSmall}
              title="Configurar canais deste flow"
            >
              Configurar canais <ChevronRight size={14} />
            </button>
          ) : (
            <>
              {sortedChannels.slice(0, 6).map((c) => (
                <button
                  key={c.id}
                  onClick={onOpenChannels}
                  title={`${c.display_name || c.channel_key} (${c.channel_type})`}
                  style={channelIconBtn(c.is_active)}
                >
                  {channelIcon(c.channel_type)}
                </button>
              ))}
              {sortedChannels.length > 6 && (
                <button onClick={onOpenChannels} style={moreBtn}>
                  +{sortedChannels.length - 6}
                </button>
              )}
            </>
          )}
        </div>
      </div>

      {/* Ações */}
      <div style={{ display: "flex", gap: 8 }}>
        <button onClick={onOpenBuilder} style={primaryBtn}>
          Editar
        </button>
        <button onClick={onOpenChannels} style={ghostBtn}>
          Canais
        </button>
      </div>
    </div>
  );
}

/* =========================
 * Modal: Novo Flow
 * ========================= */
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

/* =========================
 * Estilos compartilhados
 * ========================= */
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

const pill = {
  fontSize: 12,
  border: `1px solid ${THEME.border}`,
  borderRadius: 999,
  padding: "4px 10px",
  background: "#f8fafc",
};

const linkBtn = {
  background: "transparent",
  color: "#2563eb",
  border: "none",
  fontWeight: 700,
  cursor: "pointer",
};
const linkBtnSmall = {
  ...linkBtn,
  display: "inline-flex",
  alignItems: "center",
  gap: 6,
  padding: 0,
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

const channelIconBtn = (active) => ({
  display: "inline-flex",
  alignItems: "center",
  justifyContent: "center",
  width: 32,
  height: 32,
  borderRadius: 8,
  background: active ? "#ecfeff" : "#fff",
  border: `1px solid ${active ? "#a5f3fc" : THEME.border}`,
  cursor: "pointer",
  transition: "box-shadow .12s ease, transform .08s ease",
});
const moreBtn = {
  display: "inline-flex",
  alignItems: "center",
  justifyContent: "center",
  height: 32,
  minWidth: 32,
  padding: "0 8px",
  borderRadius: 8,
  background: "#fff",
  border: `1px solid ${THEME.border}`,
  cursor: "pointer",
  fontSize: 12,
  fontWeight: 700,
};
