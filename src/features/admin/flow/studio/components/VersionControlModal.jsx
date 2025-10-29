// src/features/admin/chatbot/components/VersionControlModal.jsx
import React, { useEffect, useMemo, useState } from "react";
import ReactDOM from "react-dom";
import { X, CheckCircle2, RotateCw, ExternalLink } from "lucide-react";
import { useConfirm } from "../../../../app/provider/ConfirmProvider.jsx";

/**
 * Props (novo modelo, compatível com o seu):
 *  - visible: boolean
 *  - onClose: () => void
 *  - versions: Array<{
 *      id: string,           // <- version_id (PK)
 *      flow_id?: string,
 *      version: number,      // <- número da versão
 *      status?: 'draft'|'published'|'deprecated',
 *      created_at?: string,
 *      published_at?: string
 *    }>
 *  - onRestore: (versionNumber: number) => Promise<void> | void   // ativa a versão (deploy)
 *  - onOpenVersion?: (versionId: string) => Promise<void> | void  // abre essa versão no canvas (somente pré-visualização)
 *  - loading?: boolean
 *  - activeId?: string                 // compat legado (version_id ativo)
 *  - activeVersion?: number            // recomendado (número da versão ativa)
 *  - meta?: { flowId?: string, channel?: string, environment?: string, name?: string }
 */
export default function VersionControlModal({
  visible,
  onClose,
  versions = [],
  onRestore,
  onOpenVersion,
  loading = false,
  activeId,
  activeVersion,
  meta,
}) {
  const confirm = useConfirm();
  const [restoringKey, setRestoringKey] = useState(null);

  useEffect(() => {
    if (!visible) setRestoringKey(null);
  }, [visible]);

  const hasActiveByNumber = typeof activeVersion === "number" && !Number.isNaN(activeVersion);
  const activeMatcher = useMemo(() => {
    if (hasActiveByNumber) {
      return (v) => Number(v.version) === Number(activeVersion);
    }
    if (activeId) {
      return (v) => String(v.id) === String(activeId);
    }
    return () => false;
  }, [hasActiveByNumber, activeVersion, activeId]);

  if (!visible) return null;

  const handleRestore = async (item) => {
    // item.version (number) é o que o back espera no POST /flows/:flow_id/deploy
    const ver = item.version;
    const when = item.published_at || item.created_at;
    const whenStr = when ? new Date(when).toLocaleString() : "data desconhecida";

    const ok = await confirm({
      title: "Ativar versão?",
      description:
        `Você está prestes a ativar a versão v${ver} ` +
        (meta?.channel && meta?.environment
          ? `em ${meta.channel}/${meta.environment}.`
          : "no ambiente configurado.") +
        `\n\nCriada/Publicada em: ${whenStr}\nIsso substituirá o deployment ativo.`,
      confirmText: "Ativar",
      cancelText: "Cancelar",
      tone: "warning",
    });
    if (!ok) return;

    try {
      setRestoringKey(`restore:${item.id}`);
      await Promise.resolve(onRestore?.(ver));
    } finally {
      setRestoringKey(null);
    }
  };

  const handleOpen = async (item) => {
    if (!onOpenVersion) return;
    try {
      setRestoringKey(`open:${item.id}`);
      await Promise.resolve(onOpenVersion(item.id));
    } finally {
      setRestoringKey(null);
    }
  };

  return ReactDOM.createPortal(
    <div style={overlayStyle} onClick={onClose}>
      <div
        style={modalStyle}
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
      >
        {/* header */}
        <div style={headerStyle}>
          <h4 style={titleStyle}>Histórico de versões</h4>
          <button onClick={onClose} style={iconBtn} aria-label="Fechar">
            <X size={18} />
          </button>
        </div>

        {/* contexto */}
        {meta && (
          <div style={contextBar}>
            <span>Flow: <b>{meta.name || meta.flowId || "—"}</b></span>
            {meta.channel && <span>Canal: <b>{meta.channel}</b></span>}
            {meta.environment && <span>Env: <b>{meta.environment}</b></span>}
            {hasActiveByNumber && (
              <span>Ativa: <b>v{activeVersion}</b></span>
            )}
          </div>
        )}

        {/* body */}
        <div style={bodyStyle}>
          {loading ? (
            <div style={loadingWrap}>
              <RotateCw className="spin" size={18} />
              <span>Carregando…</span>
            </div>
          ) : versions.length === 0 ? (
            <div style={emptyWrap}>Nenhuma versão encontrada.</div>
          ) : (
            <div style={listStyle}>
              {versions.map((v) => {
                const isActive = activeMatcher(v);
                const isActionOpen = restoringKey === `open:${v.id}`;
                const isActionRestore = restoringKey === `restore:${v.id}`;

                return (
                  <div
                    key={v.id}
                    style={{
                      ...itemStyle,
                      ...(isActive ? itemActiveStyle : null),
                    }}
                  >
                    <div style={itemLeft}>
                      <span style={badge}>v{v.version}</span>
                      <span style={monoBadge}>#{String(v.id).slice(0, 8)}</span>
                      {v.status && (
                        <span style={statusPill(v.status)}>{v.status}</span>
                      )}
                      <span style={dateText}>
                        {v.published_at
                          ? `Publicado: ${new Date(v.published_at).toLocaleString()}`
                          : v.created_at
                          ? `Criado: ${new Date(v.created_at).toLocaleString()}`
                          : "Sem data"}
                      </span>

                      {isActive && (
                        <span style={activePill}>
                          <CheckCircle2 size={14} style={{ marginRight: 6 }} />
                          ativo
                        </span>
                      )}
                    </div>

                    <div style={itemRight}>
                      {/* Abrir (pré-visualizar no canvas sem ativar) */}
                      {onOpenVersion && (
                        <button
                          style={openBtn}
                          disabled={!!restoringKey}
                          onClick={() => handleOpen(v)}
                          title="Abrir esta versão no Builder"
                        >
                          {isActionOpen ? "Abrindo…" : (<><ExternalLink size={14} style={{marginRight:6}}/>Abrir</>)}
                        </button>
                      )}

                      {/* Ativar (deploy) */}
                      <button
                        style={{
                          ...restoreBtn,
                          ...(isActive ? { opacity: 0.55, cursor: "not-allowed" } : null),
                        }}
                        disabled={isActive || !!restoringKey}
                        onClick={() => handleRestore(v)}
                        title="Ativar esta versão no canal/ENV atuais"
                      >
                        {isActionRestore ? "Ativando…" : "Ativar"}
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* animação do ícone */}
      <style>{`.spin{animation:spin 0.9s linear infinite}@keyframes spin{to{transform:rotate(360deg)}}`}</style>
    </div>,
    document.body
  );
}

/* ===== estilos ===== */
const overlayStyle = {
  position: "fixed",
  inset: 0,
  background: "rgba(15, 23, 42, 0.35)",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  padding: 24,
  zIndex: 2000,
};

const modalStyle = {
  background: "#ffffff",
  width: "min(620px, 96vw)",
  maxHeight: "min(76vh, 740px)",
  borderRadius: 14,
  border: "1px solid #e2e8f0",
  boxShadow: "0 10px 30px rgba(15,23,42,.12), 0 4px 12px rgba(15,23,42,.06)",
  display: "flex",
  flexDirection: "column",
  overflow: "hidden",
};

const headerStyle = {
  position: "sticky",
  top: 0,
  background: "#fff",
  padding: "14px 16px",
  borderBottom: "1px solid #e2e8f0",
  display: "flex",
  alignItems: "center",
  justifyContent: "space-between",
  zIndex: 1,
};

const contextBar = {
  display: "flex",
  gap: 12,
  alignItems: "center",
  padding: "8px 14px",
  borderBottom: "1px solid #eef2f7",
  fontSize: 12,
  color: "#475569",
};

const titleStyle = { margin: 0, fontSize: 16, fontWeight: 700, color: "#0f172a" };
const iconBtn = { background: "transparent", border: "none", color: "#334155", padding: 8, borderRadius: 8, cursor: "pointer" };
const bodyStyle = { padding: "10px 12px 16px", overflow: "auto" };

const loadingWrap = {
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  gap: 8,
  color: "#475569",
  height: 120,
};

const emptyWrap = { textAlign: "center", color: "#64748b", padding: "24px 8px" };
const listStyle = { display: "flex", flexDirection: "column", gap: 10 };

const itemStyle = {
  display: "flex",
  alignItems: "center",
  justifyContent: "space-between",
  padding: "12px 14px",
  borderRadius: 10,
  border: "1px solid #e5e7eb",
  background: "#fff",
  boxShadow: "0 1px 0 rgba(15,23,42,.03)",
};
const itemActiveStyle = { borderColor: "#bfdbfe", boxShadow: "0 0 0 3px rgba(37,99,235,.12)" };

const itemLeft = { display: "flex", alignItems: "center", gap: 10, minWidth: 0 };
const itemRight = { display: "flex", alignItems: "center", gap: 8 };

const badge = {
  fontFamily: "ui-monospace, SFMono-Regular, Menlo, monospace",
  fontSize: 12,
  padding: "4px 8px",
  borderRadius: 8,
  border: "1px solid #cbd5e1",
  background: "#f8fafc",
  color: "#0f172a",
};

const monoBadge = {
  fontFamily: "ui-monospace, SFMono-Regular, Menlo, monospace",
  fontSize: 12,
  padding: "4px 8px",
  borderRadius: 8,
  border: "1px dashed #e2e8f0",
  background: "#ffffff",
  color: "#0f172a",
};

const dateText = { fontSize: 12, color: "#64748b" };

const activePill = {
  display: "inline-flex",
  alignItems: "center",
  gap: 4,
  fontSize: 12,
  fontWeight: 600,
  padding: "2px 8px",
  borderRadius: 999,
  background: "#eff6ff",
  color: "#1d4ed8",
  border: "1px solid #bfdbfe",
};

const statusPill = (status) => ({
  display: "inline-flex",
  alignItems: "center",
  gap: 6,
  fontSize: 11,
  fontWeight: 700,
  padding: "3px 8px",
  borderRadius: 999,
  textTransform: "uppercase",
  letterSpacing: 0.3,
  ...(status === "published"
    ? { background: "#ecfdf5", color: "#065f46", border: "1px solid #a7f3d0" }
    : status === "deprecated"
    ? { background: "#fff7ed", color: "#9a3412", border: "1px solid #fed7aa" }
    : { background: "#f1f5f9", color: "#0f172a", border: "1px solid #e2e8f0" }),
});

const openBtn = {
  background: "transparent",
  color: "#374151",
  border: "1px solid #d1d5db",
  padding: "7px 10px",
  borderRadius: 8,
  cursor: "pointer",
  fontSize: 13,
  fontWeight: 700,
  minWidth: 98,
  display: "inline-flex",
  alignItems: "center",
  justifyContent: "center",
};

const restoreBtn = {
  background: "#2563eb",
  color: "#fff",
  border: "none",
  padding: "8px 12px",
  borderRadius: 8,
  cursor: "pointer",
  fontSize: 13,
  fontWeight: 700,
  minWidth: 104,
};
