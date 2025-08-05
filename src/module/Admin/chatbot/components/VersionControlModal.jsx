import React from "react";
import { X } from "lucide-react";

export default function VersionHistoryModal({ visible, onClose, versions, onRestore }) {
  if (!visible) return null;

  return (
    <div style={overlayStyle}>
      <div style={modalStyle}>
        <div style={headerStyle}>
          <h4 style={titleStyle}>Histórico de Versões</h4>
          <button onClick={onClose} style={closeStyle}>
            <X size={18} />
          </button>
        </div>

        <div style={listContainerStyle}>
          {versions.length === 0 ? (
            <p style={{ color: '#888', padding: '1rem' }}>Nenhuma versão encontrada.</p>
          ) : (
            versions.map((v) => (
              <div key={v.id} style={itemStyle}>
                <div>
                  <div style={versionIdStyle}>{v.id.slice(0, 8)}...</div>
                  <div style={versionDateStyle}>{new Date(v.created_at).toLocaleString()}</div>
                </div>
                <button
                  style={restoreButtonStyle}
                  onClick={() => onRestore(v.id)}
                >
                  Restaurar
                </button>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}

const overlayStyle = {
  position: "fixed",
  top: 0,
  right: 0,
  width: 0,
  height: 0,
  overflow: "hidden",
  zIndex: 2000,
};

const modalStyle = {
  position: "absolute",
  top: "1rem",
  right: "1rem",
  background: "#1e1e1e",
  width: "360px",
  maxHeight: "80vh",
  borderRadius: "8px",
  overflowY: "auto",
  boxShadow: "0 0 12px rgba(0,0,0,0.5)",
  animation: "slideIn 0.3s ease-out",
};

const headerStyle = {
  display: "flex",
  justifyContent: "space-between",
  alignItems: "center",
  padding: "1rem",
  borderBottom: "1px solid #333",
};

const titleStyle = {
  margin: 0,
  fontSize: "1rem",
  color: "#4FC3F7",
};

const closeStyle = {
  background: "transparent",
  border: "none",
  color: "#aaa",
  cursor: "pointer",
};

const listContainerStyle = {
  display: "flex",
  flexDirection: "column",
  padding: "0.5rem 1rem 1rem 1rem",
  gap: "0.75rem",
};

const itemStyle = {
  background: "#2b2b2b",
  padding: "0.75rem 1rem",
  borderRadius: "6px",
  border: "1px solid #333",
  display: "flex",
  justifyContent: "space-between",
  alignItems: "center",
};

const versionIdStyle = {
  fontSize: "0.9rem",
  color: "#4FC3F7",
  fontWeight: 500,
};

const versionDateStyle = {
  fontSize: "0.8rem",
  color: "#aaa",
};

const restoreButtonStyle = {
  backgroundColor: "#2e7d32",
  color: "#fff",
  border: "none",
  padding: "0.5rem 0.75rem",
  borderRadius: "6px",
  cursor: "pointer",
  fontSize: "0.8rem",
  fontWeight: 500,
};

// CSS Animations (adicione ao seu global.css ou style tag)
/*
@keyframes fadeIn {
  from { opacity: 0; }
  to { opacity: 1; }
}

@keyframes slideIn {
  from { transform: translateY(-20px); opacity: 0; }
  to { transform: translateY(0); opacity: 1; }
}
*/
