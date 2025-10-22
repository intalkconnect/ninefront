import React from "react";
import { X, RotateCw, CheckCircle2 } from "lucide-react";
import ReactDOM from "react-dom";

/**
 * Props:
 * - visible: boolean
 * - onClose: () => void
 * - versions: Array<{ id: string, created_at: string }>
 * - onRestore: (id: string) => void
 * - loading: boolean
 * - activeId?: string  // opcional: versão atualmente ativa/pública
 */
export default function VersionControlModal({
  visible,
  onClose,
  versions = [],
  onRestore,
  loading,
  activeId,
}) {
  if (!visible) return null;

  return ReactDOM.createPortal(
    <div style={overlayStyle} onClick={onClose}>
      <div
        style={modalStyle}
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-labelledby="versions-title"
      >
        {/* Header (sticky) */}
        <div style={headerStyle}>
          <h4 id="versions-title" style={titleStyle}>Histórico de versões</h4>
          <button onClick={onClose} style={iconBtn} aria-label="Fechar">
            <X size={18} />
          </button>
        </div>

        {/* Corpo */}
        <div style={bodyStyle}>
          {loading ? (
            <div style={loadingWrap}>
              <RotateCw className="spin" size={18} />
              <span>Carregando...</span>
            </div>
          ) : versions.length === 0 ? (
            <div style={emptyWrap}>
              Nenhuma versão encontrada.
            </div>
          ) : (
            <div style={listStyle}>
              {versions.map((flow) => {
                const isActive = activeId && activeId === flow.id;
                return (
                  <div
                    key={flow.id}
                    style={{
                      ...itemStyle,
                      ...(isActive ? itemActiveStyle : null),
                    }}
                  >
                    <div style={itemLeft}>
                      <span style={badge}>
                        #{flow.id.slice(0, 8)}
                      </span>

                      <span style={dateText}>
                        {new Date(flow.created_at).toLocaleString()}
                      </span>

                      {isActive && (
                        <span style={activePill}>
                          <CheckCircle2 size={14} style={{ marginRight: 6 }} />
                          ativo
                        </span>
                      )}
                    </div>

                    <div style={itemRight}>
                      <button
                        style={restoreBtn}
                        onClick={() => onRestore?.(flow.id)}
                        disabled={loading || isActive}
                        aria-disabled={loading || isActive}
                      >
                        Restaurar
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* CSS inline para animação do ícone */}
      <style>{`.spin{animation:spin 0.9s linear infinite}@keyframes spin{to{transform:rotate(360deg)}}`}</style>
    </div>,
    document.body
  );
}

/* ======= Styles (light, clean) ======= */
const overlayStyle = {
  position: "fixed",
  inset: 0,
  background: "rgba(15, 23, 42, 0.35)", // slate-900 @35%
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  padding: "24px",
  zIndex: 2000,
};

const modalStyle = {
  background: "#ffffff",
  width: "min(560px, 96vw)",
  maxHeight: "min(72vh, 720px)",
  borderRadius: "14px",
  border: "1px solid #e2e8f0", // slate-200
  boxShadow:
    "0 10px 30px rgba(15, 23, 42, 0.12), 0 4px 12px rgba(15, 23, 42, 0.06)",
  display: "flex",
  flexDirection: "column",
  overflow: "hidden",
};

const headerStyle = {
  position: "sticky",
  top: 0,
  background: "#ffffff",
  padding: "14px 16px",
  borderBottom: "1px solid #e2e8f0",
  display: "flex",
  alignItems: "center",
  justifyContent: "space-between",
  zIndex: 1,
};

const titleStyle = {
  margin: 0,
  fontSize: "16px",
  fontWeight: 700,
  color: "#0f172a", // slate-900
  letterSpacing: 0.2,
};

const iconBtn = {
  background: "transparent",
  border: "none",
  color: "#334155",
  padding: 8,
  borderRadius: 8,
  cursor: "pointer",
};

const bodyStyle = {
  padding: "10px 12px 16px",
  overflow: "auto",
};

const listStyle = {
  display: "flex",
  flexDirection: "column",
  gap: 10,
};

const itemStyle = {
  display: "flex",
  alignItems: "center",
  justifyContent: "space-between",
  padding: "12px 14px",
  borderRadius: 10,
  border: "1px solid #e5e7eb", // gray-200
  background: "#ffffff",
  transition: "border-color 120ms ease, box-shadow 120ms ease, transform 80ms",
  boxShadow: "0 1px 0 rgba(15, 23, 42, 0.03)",
};

const itemActiveStyle = {
  borderColor: "#bfdbfe", // blue-200
  boxShadow: "0 0 0 3px rgba(37, 99, 235, 0.12)", // ring azul claro
};

const itemLeft = {
  display: "flex",
  alignItems: "center",
  gap: 10,
  minWidth: 0,
};

const itemRight = { display: "flex", alignItems: "center", gap: 8 };

const badge = {
  fontFamily: "ui-monospace, SFMono-Regular, Menlo, monospace",
  fontSize: 12,
  padding: "4px 8px",
  borderRadius: 8,
  border: "1px solid #cbd5e1", // slate-300
  background: "#f8fafc", // slate-50
  color: "#0f172a",
};

const dateText = { fontSize: 12, color: "#64748b" }; // slate-500

const activePill = {
  display: "inline-flex",
  alignItems: "center",
  gap: 4,
  fontSize: 12,
  fontWeight: 600,
  padding: "2px 8px",
  borderRadius: 999,
  background: "#eff6ff", // blue-50
  color: "#1d4ed8", // blue-700
  border: "1px solid #bfdbfe", // blue-200
};

const restoreBtn = {
  backgroundColor: "#2563eb", // blue-600
  color: "#fff",
  border: "none",
  padding: "8px 12px",
  borderRadius: 8,
  cursor: "pointer",
  fontSize: 13,
  fontWeight: 700,
  minWidth: 96,
  transition: "filter 120ms ease, transform 60ms ease, opacity 120ms",
  opacity: 1,
};

const loadingWrap = {
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  gap: 8,
  color: "#475569",
  height: 120,
};

const emptyWrap = {
  textAlign: "center",
  color: "#64748b",
  padding: "24px 8px",
};
