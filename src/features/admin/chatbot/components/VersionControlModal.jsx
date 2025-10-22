// src/features/admin/chatbot/components/VersionControlModal.jsx
import React, { useEffect, useState } from "react";
import ReactDOM from "react-dom";
import { X, CheckCircle2, RotateCw } from "lucide-react";
import { useConfirm } from "../../../../app/provider/ConfirmProvider.jsx";

/**
 * Props:
 *  - visible: boolean
 *  - onClose: () => void
 *  - versions: Array<{ id: string, created_at: string }>
 *  - onRestore: (id: string) => Promise<void> | void
 *  - loading?: boolean
 *  - activeId?: string
 */
export default function VersionControlModal({
  visible,
  onClose,
  versions = [],
  onRestore,
  loading = false,
  activeId,
}) {
  const confirm = useConfirm();
  const [restoringId, setRestoringId] = useState(null);

  useEffect(() => {
    if (!visible) setRestoringId(null);
  }, [visible]);

  if (!visible) return null;

  const handleRestore = async (flow) => {
    // abre o diálogo de confirmação via ConfirmProvider
    const ok = await confirm({
      title: "Restaurar versão?",
      description:
        `Você está prestes a ativar a versão #${flow.id.slice(0, 8)} ` +
        `criada em ${new Date(flow.created_at).toLocaleString()}.\n\n` +
        "Isso substituirá o fluxo ativo atual.",
      confirmText: "Restaurar",
      cancelText: "Cancelar",
      tone: "warning",
    });
    if (!ok) return;

    try {
      setRestoringId(flow.id);
      await Promise.resolve(onRestore?.(flow.id));
    } finally {
      setRestoringId(null);
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
              {versions.map((flow) => {
                const isActive = activeId && activeId === flow.id;
                const isRestoring = restoringId === flow.id;
                return (
                  <div
                    key={flow.id}
                    style={{
                      ...itemStyle,
                      ...(isActive ? itemActiveStyle : null),
                    }}
                  >
                    <div style={itemLeft}>
                      <span style={badge}>#{flow.id.slice(0, 8)}</span>
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
                        style={{
                          ...restoreBtn,
                          ...(isActive
                            ? { opacity: 0.55, cursor: "not-allowed" }
                            : null),
                        }}
                        disabled={isActive || isRestoring}
                        onClick={() => handleRestore(flow)}
                      >
                        {isRestoring ? "Restaurando…" : "Restaurar"}
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

/* ===== estilos claros para combinar com o padrão do app ===== */
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
  width: "min(560px, 96vw)",
  maxHeight: "min(72vh, 720px)",
  borderRadius: 14,
  border: "1px solid #e2e8f0",
  boxShadow:
    "0 10px 30px rgba(15,23,42,.12), 0 4px 12px rgba(15,23,42,.06)",
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

const titleStyle = {
  margin: 0,
  fontSize: 16,
  fontWeight: 700,
  color: "#0f172a",
};

const iconBtn = {
  background: "transparent",
  border: "none",
  color: "#334155",
  padding: 8,
  borderRadius: 8,
  cursor: "pointer",
};

const bodyStyle = { padding: "10px 12px 16px", overflow: "auto" };

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

const itemActiveStyle = {
  borderColor: "#bfdbfe",
  boxShadow: "0 0 0 3px rgba(37,99,235,.12)",
};

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

const restoreBtn = {
  background: "#2563eb",
