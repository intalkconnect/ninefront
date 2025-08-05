/**
 * Modal de Histórico de Versões com busca automática e restauração.
 */
import React, { useEffect, useState } from "react";
import { X } from "lucide-react";
import ReactDOM from "react-dom";

export default function VersionControlModal({ visible, onClose }) {
  const [flowHistory, setFlowHistory] = useState([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (visible) fetchHistory();
  }, [visible]);

  const fetchHistory = async () => {
    setLoading(true);
    try {
      const res = await fetch("https://ia-srv-meta.9j9goo.easypanel.host/api/v1/flow/latest");
      const data = await res.json();
      setFlowHistory(data.slice(0, 10));
    } catch (e) {
      console.error("Erro ao buscar histórico:", e);
    } finally {
      setLoading(false);
    }
  };

  const handleRestore = async (id) => {
    try {
      await fetch("https://ia-srv-meta.9j9goo.easypanel.host/api/v1/flow/activate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id }),
      });
      window.location.reload();
    } catch (e) {
      alert("Erro ao restaurar versão.");
    }
  };

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
          ) : flowHistory.length === 0 ? (
            <p style={{ color: '#888', padding: '1rem' }}>Nenhuma versão encontrada.</p>
          ) : (
            flowHistory.map((flow) => (
              <div key={flow.id} style={itemStyle}>
                <div>
                  <div style={versionIdStyle}>#{flow.id.slice(0, 8)}</div>
                  <div style={versionDateStyle}>{new Date(flow.created_at).toLocaleString()}</div>
                </div>
                <button style={restoreButtonStyle} onClick={() => handleRestore(flow.id)}>Restaurar</button>
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
  borderRadius: "8px",
  overflowY: "auto",
  boxShadow: "0 4px 16px rgba(0,0,0,0.5)",
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
