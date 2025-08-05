import React, { useEffect, useState } from "react";

export default function VersionControlModal({ visible, onClose }) {
  const [flowHistory, setFlowHistory] = useState([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (visible) fetchHistory();
  }, [visible]);

  const fetchHistory = async () => {
    setLoading(true);
    try {
      const res = await fetch(
        "https://ia-srv-meta.9j9goo.easypanel.host/api/v1/flow/latest"
      );
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
      await fetch(
        "https://ia-srv-meta.9j9goo.easypanel.host/api/v1/flow/activate",
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ id }),
        }
      );
      window.location.reload();
    } catch (e) {
      alert("Erro ao restaurar versão.");
    }
  };

  if (!visible) return null;

  return (
    <div style={overlay}>
      <div style={modal}>
        <div style={header}>
          <strong>Controle de Versões</strong>
          <button onClick={onClose} style={closeButton}>✕</button>
        </div>

        <div style={body}>
          {loading ? (
            <div style={{ color: "#aaa" }}>Carregando...</div>
          ) : (
            flowHistory.map((flow) => (
              <div key={flow.id} style={item}>
                <div style={info}>
                  <span style={id}>#{flow.id.slice(0, 8)}</span>
                  <span style={date}>
                    {new Date(flow.created_at).toLocaleString()}
                  </span>
                </div>
                <button
                  onClick={() => handleRestore(flow.id)}
                  style={restoreBtn}
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

const overlay = {
  position: "fixed",
  top: 0,
  left: 0,
  right: 0,
  bottom: 0,
  backgroundColor: "rgba(0,0,0,0.5)",
  display: "flex",
  alignItems: "flex-start",
  justifyContent: "flex-end",
  zIndex: 1200,
};

const modal = {
  margin: "2rem",
  background: "#252525",
  borderRadius: "8px",
  width: "350px",
  maxHeight: "80vh",
  overflowY: "auto",
  boxShadow: "0 4px 16px rgba(0, 0, 0, 0.4)",
};

const header = {
  display: "flex",
  justifyContent: "space-between",
  alignItems: "center",
  padding: "1rem",
  borderBottom: "1px solid #333",
  color: "#fff",
};

const closeButton = {
  background: "transparent",
  border: "none",
  color: "#999",
  fontSize: "1.2rem",
  cursor: "pointer",
};

const body = {
  padding: "1rem",
};

const item = {
  background: "#2e2e2e",
  padding: "0.75rem",
  borderRadius: "6px",
  marginBottom: "0.75rem",
  display: "flex",
  justifyContent: "space-between",
  alignItems: "center",
  border: "1px solid #3a3a3a",
};

const info = {
  display: "flex",
  flexDirection: "column",
  gap: "0.25rem",
};

const id = {
  color: "#4FC3F7",
  fontWeight: "bold",
  fontSize: "0.9rem",
};

const date = {
  fontSize: "0.8rem",
  color: "#aaa",
};

const restoreBtn = {
  padding: "0.5rem 0.75rem",
  background: "#2e7d32",
  color: "#fff",
  border: "none",
  borderRadius: "4px",
  cursor: "pointer",
  fontSize: "0.8rem",
};
