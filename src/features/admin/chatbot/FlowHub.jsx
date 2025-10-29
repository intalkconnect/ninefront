// File: src/pages/admin/development/FlowHub.jsx
import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Bot, Radio, MessageCircle, Send, Instagram, MonitorSmartphone, Zap, CheckCircle2, Clock } from "lucide-react";
import { apiGet } from "../../../shared/apiClient";

const channelIcon = (ch) => {
  const m = String(ch || "").toLowerCase();
  if (m === "whatsapp") return <MessageCircle size={14} />;
  if (m === "telegram") return <Send size={14} />;
  if (m === "instagram") return <Instagram size={14} />;
  if (m === "facebook" || m === "messenger") return <MonitorSmartphone size={14} />;
  return <Radio size={14} />;
};

function Badge({ children, title }) {
  return (
    <span
      title={title}
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: 6,
        padding: "4px 8px",
        borderRadius: 999,
        fontSize: 12,
        background: "rgba(255,255,255,0.06)",
        border: "1px solid rgba(255,255,255,0.08)",
      }}
    >
      {children}
    </span>
  );
}

function FlowCard({ flow, onOpen }) {
  const name = flow?.data?.name || `Flow #${flow.id}`;
  const channels = Array.isArray(flow?.data?.channels) ? flow.data.channels : (flow?.data?.meta?.channels || []);
  const isActive = flow.active === true;
  const createdAt = flow.created_at ? new Date(flow.created_at) : null;

  return (
    <button
      onClick={() => onOpen(flow)}
      style={{
        textAlign: "left",
        width: "100%",
        borderRadius: 16,
        border: "1px solid rgba(255,255,255,0.08)",
        background: "linear-gradient(180deg, rgba(255,255,255,0.03), rgba(255,255,255,0.01))",
        padding: 16,
        display: "grid",
        gap: 12,
        cursor: "pointer",
      }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
        <div
          style={{
            width: 36,
            height: 36,
            display: "grid",
            placeItems: "center",
            borderRadius: 10,
            background: "rgba(99,102,241,0.15)",
            border: "1px solid rgba(99,102,241,0.35)",
          }}
        >
          <Bot size={18} />
        </div>
        <div style={{ fontWeight: 600, fontSize: 15, lineHeight: 1.2 }}>{name}</div>
      </div>

      <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
        {channels?.length > 0 ? (
          channels.map((ch) => (
            <Badge key={ch} title={`Canal: ${ch}`}>
              {channelIcon(ch)} <span style={{ opacity: 0.9 }}>{ch}</span>
            </Badge>
          ))
        ) : (
          <Badge title="Canais não definidos">
            <Zap size={14} />
            <span style={{ opacity: 0.9 }}>sem canais</span>
          </Badge>
        )}
      </div>

      <div style={{ display: "flex", gap: 10, alignItems: "center", fontSize: 12, opacity: 0.85 }}>
        {isActive ? (
          <Badge title="Versão ativa">
            <CheckCircle2 size={14} />
            ativo
          </Badge>
        ) : (
          <Badge title="Versão inativa">
            <Clock size={14} />
            histórico
          </Badge>
        )}
        {createdAt && (
          <span style={{ marginLeft: "auto" }}>
            criado em {createdAt.toLocaleDateString()} {createdAt.toLocaleTimeString().slice(0,5)}
          </span>
        )}
      </div>
    </button>
  );
}

export default function FlowHub() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [flows, setFlows] = useState([]);

  useEffect(() => {
    let mounted = true;

    const load = async () => {
      setLoading(true);
      try {
        // 1) pega últimas versões (ativo + histórico)
        const history = await apiGet("/flows/history"); // [{id, active, created_at}]
        // 2) para cada id, carrega o data do fluxo (para extrair nome/canais)
        const enriched = await Promise.all(
          (history || []).map(async (row) => {
            try {
              const data = await apiGet(`/flows/data/${row.id}`);
              return { ...row, data };
            } catch {
              return { ...row, data: null };
            }
          })
        );
        if (mounted) setFlows(enriched);
      } finally {
        if (mounted) setLoading(false);
      }
    };

    load();
    return () => { mounted = false; };
  }, []);

  const sorted = useMemo(() => {
    // ativo primeiro, depois por created_at desc
    const arr = [...flows];
    arr.sort((a, b) => {
      if (a.active && !b.active) return -1;
      if (!a.active && b.active) return 1;
      return (new Date(b.created_at) - new Date(a.created_at));
    });
    return arr;
  }, [flows]);

  const openInBuilder = (flow) => {
    // deep-link para o Builder com este flowId
    navigate(`/development/studio/builder?flowId=${flow.id}`);
  };

  return (
    <div style={{ padding: 24, display: "grid", gap: 16 }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <Bot size={18} />
          <h2 style={{ margin: 0, fontSize: 18 }}>Chatbot Studio - Flows</h2>
        </div>
      </div>

      {loading ? (
        <div style={{ opacity: 0.8 }}>Carregando flows…</div>
      ) : (
        <div
          style={{
            display: "grid",
            gap: 16,
            gridTemplateColumns: "repeat(auto-fill, minmax(260px, 1fr))",
          }}
        >
          {sorted.map((f) => (
            <FlowCard key={f.id} flow={f} onOpen={openInBuilder} />
          ))}
        </div>
      )}
    </div>
  );
}
