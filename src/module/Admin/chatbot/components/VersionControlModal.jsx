/**
 * Modal de Histórico de Versões (mais limpo e controlado externamente).
 */
import React from "react";
import { X } from "lucide-react";
import ReactDOM from "react-dom";

export default function VersionControlModal({ visible, onClose, versions = [], onRestore, loading }) {
  if (!visible) return null;

  return ReactDOM.createPortal(
    <div style={overlayStyle}>
      <div style={modalStyle}>
        <div style={headerStyle}>
          <h4 style={titleStyle}>Histórico de Versões</h4>
          <button onClick={onClose} style={closeStyle}><X size={18} /></button>
        </div>

        <div style={listContainerStyle}>
          {loading ? (
            <p style={{ color: "#aaa" }}>Carregando...</p>
          ) : versions.length === 0 ? (
            <p style={{ color: '#888', padding: '1rem' }}>Nenhuma versão encontrada.</p>
          ) : (
            versions.map((flow) => (
              <div key={flow.id} style={itemStyle}>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
                  <span style={versionIdStyle}>#{flow.id.slice(0, 8)}</span>
                  <span style={versionDateStyle}>{new Date(flow.created_at).toLocaleString()}</span>
                </div>
                <button style={restoreButtonStyle} onClick={() => onRestore(flow.id)}>Restaurar</button>
              </div>
            ))
          )}
        </div>
      </div>
    </div>,
    document.body
  );
}

const overlayStyle = {
  position: "fixed",
  top: 0,
  left: 0,
  width: "100vw",
  height: "100vh",
  backgroundColor: "rgba(0, 0, 0, 0.4)",
  display: "flex",
  justifyContent: "flex-end",
  alignItems: "flex-start",
  zIndex: 2000,
};

const modalStyle = {
  margin: "2rem",
  background: "#1e1e1e",
  width: "360px",
  maxHeight: "80vh",
  borderRadius: "10px",
  overflowY: "auto",
  boxShadow: "0 6px 18px rgba(0,0,0,0.6)",
  animation: "slideIn 0.3s ease-out",
  border: "1px solid #333",
};

const headerStyle = {
  display: "flex",
  justifyContent: "space-between",
  alignItems: "center",
  padding: "1rem",
  borderBottom: "1px solid #444",
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
  padding: "1rem",
  gap: "0.75rem",
};

const itemStyle = {
  background: "#292929",
  padding: "0.75rem 1rem",
  borderRadius: "6px",
  border: "1px solid #3c3c3c",
  display: "flex",
  justifyContent: "space-between",
  alignItems: "center",
};

const versionIdStyle = {
  fontSize: "0.85rem",
  color: "#4FC3F7",
  fontWeight: 600,
};

const versionDateStyle = {
  fontSize: "0.75rem",
  color: "#bbb",
};

const restoreButtonStyle = {
  backgroundColor: "#2e7d32",
  color: "#fff",
  border: "none",
  padding: "0.5rem 0.75rem",
  borderRadius: "6px",
  cursor: "pointer",
  fontSize: "0.75rem",
  fontWeight: 600,
  transition: "background 0.2s ease",
};
