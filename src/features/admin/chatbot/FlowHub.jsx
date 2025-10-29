// src/features/admin/chatbot/FlowHub.jsx
import React, { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { toast } from "react-toastify";
import { apiGet, apiPost } from "../../../shared/apiClient";
import {
  MessageCircle as WaIcon,
  MessageSquareText as FbIcon,
  Instagram as IgIcon,
  Send as TgIcon,
  Package2 as FlowIcon,
  Settings as Gear,
  PencilLine,
} from "lucide-react";

const THEME = {
  bg: "#f9fafb",
  panelBg: "#ffffff",
  text: "#0f172a",
  textMuted: "#475569",
  border: "#e2e8f0",
  shadow: "0 6px 20px rgba(15, 23, 42, 0.08)",
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

  const openBuilder = (flowId, name, preferredChannelKey = null) => {
    navigate(`/development/studio/${flowId}`, {
      state: { meta: { flowId, name, channelKey: preferredChannelKey } },
    });
  };

  const openChannels = () => {
    // sua rota principal de canais, conforme Admin.jsx
    navigate("/settings/channels");
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
          <FlowIcon size={18} />
          <div style={{ fontWeight: 800 }}>FlowHub</div>
        </div>
        <div style={{ display: "flex", gap: 8 }}>
          <button
            onClick={openChannels}
            title="Canais"
            style={{
              background: "#0ea5e9", color: "#fff", border: "none",
              padding: "10px 12px", borderRadius: 10, fontWeight: 700, cursor: "pointer",
              display: "inline-flex", alignItems: "center", gap: 8
            }}
          >
            <Gear size={16}/> Canais
          </button>
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
              onOpenBuilder={(preferredKey) => openBuilder(f.id, f.name, preferredKey)}
              onOpenChannels={openChannels}
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

              openBuilder(created.id, created.name, null);
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
  // deploys: [{ id, channel, version, activated_at }]
  const deploys = Array.isArray(flow?.active_deploys) ? flow.active_deploys : [];

  // Monta chips com ícone e guarda o channelKey exato (no campo channel)
  const chips = useMemo(() => {
    const out = [];
    for (const d of deploys.slice(0, 6)) {
      const raw = String(d?.channel || "").toLowerCase();
      let icon = null;
      let label = raw;

      if (raw.startsWith("whatsapp")) { icon = <WaIcon size={14}/>; label = "WhatsApp"; }
      else if (raw.startsWith("facebook")) { icon = <FbIcon size={14}/>; label = "Facebook"; }
      else if (raw.startsWith("instagram")) { icon = <IgIcon size={14}/>; label = "Instagram"; }
      else if (raw.startsWith("telegram")) { icon = <TgIcon size={14}/>; label = "Telegram"; }

      out.push({
        id: d.id,
        icon,
        label,
        versionTag: `v${d.version}`,
        channelKey: d.channel, // passa pro Builder se o usuário escolher editar por este canal
      });
    }
    return out;
  }, [deploys]);

  const lastPublished = flow?.last_published ?? "—";
  const lastVersion = flow?.last_version ?? "—";

  // Badge FLOW
  const FlowBadge = (
    <span style={{
      display: "inline-flex", alignItems: "center", gap: 6,
      fontSize: 12, fontWeight: 700, color: "#0f172a",
      background: "#eef2ff", border: "1px solid #c7d2fe",
      padding: "4px 10px", borderRadius: 999
    }}>
      <FlowIcon size={14}/> flow
    </span>
  );

  // `preferredKey` para o botão "Editar" principal: usa o primeiro deploy (se houver)
  const preferredKey = chips[0]?.channelKey || null;

  return (
    <div style={{
      background: "#fff", border: `1px solid ${THEME.border}`, borderRadius: 12,
      padding: 14, display: "flex", flexDirection: "column", gap: 10, boxShadow: THEME.shadow
    }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8 }}>
        <div
          style={{ fontWeight: 800, minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", cursor: "pointer" }}
          title="Abrir no Builder"
          onClick={() => onOpenBuilder(preferredKey)}
        >
          {flow.name}
        </div>
        {FlowBadge}
      </div>

      {flow.description && (
        <div style={{ fontSize: 13, color: THEME.textMuted }}>{flow.description}</div>
      )}

      <div style={{ fontSize: 12, color: THEME.textMuted, display: "flex", gap: 10, flexWrap: "wrap" }}>
        <span>última publicada: <b>{lastPublished}</b></span>
        <span>última versão: <b>{lastVersion}</b></span>
      </div>

      {/* canais ativos (abre a página de canais ao clicar) */}
      <div style={{ borderTop: `1px solid ${THEME.border}`, paddingTop: 8 }}>
        <div style={{ fontSize: 12, marginBottom: 6 }}>Canais ativos</div>

        {chips.length > 0 ? (
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            {chips.map((c) => (
              <button
                key={c.id}
                onClick={() => onOpenChannels()}
                title={`${c.label} • ${c.versionTag}`}
                style={{
                  display: "inline-flex", alignItems: "center", gap: 6,
                  fontSize: 12, border: `1px solid ${THEME.border}`,
                  borderRadius: 999, padding: "4px 10px",
                  background: "#f8fafc", cursor: "pointer"
                }}
              >
                {c.icon} <span>{c.label}</span> <span style={{ opacity: 0.7 }}>{c.versionTag}</span>
              </button>
            ))}
          </div>
        ) : (
          <div style={{ fontSize: 12, color: THEME.textMuted }}>
            Nenhum canal vinculado.{" "}
            <button onClick={onOpenChannels} style={{ color: "#2563eb", fontWeight: 700, background: "transparent", border: "none", cursor: "pointer" }}>
              Configurar canais
            </button>
          </div>
        )}
      </div>

      {/* ações */}
      <div style={{ marginTop: 8, display: "flex", gap: 8 }}>
        <button
          onClick={() => onOpenBuilder(preferredKey)}
          style={{
            background: "#2563eb", color: "#fff", border: "none",
            padding: "8px 12px", borderRadius: 8, fontWeight: 700, cursor: "pointer",
            display: "inline-flex", alignItems: "center", gap: 8
          }}
          title="Editar no Builder"
        >
          <PencilLine size={16}/> Editar
        </button>

        <button
          onClick={onOpenChannels}
          style={{
            background: "#0ea5e9", color: "#fff", border: "none",
            padding: "8px 12px", borderRadius: 8, fontWeight: 700, cursor: "pointer",
            display: "inline-flex", alignItems: "center", gap: 8
          }}
          title="Gerenciar canais vinculados"
        >
          <Gear size={16}/> Canais
        </button>
      </div>
    </div>
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
