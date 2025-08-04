import React from "react";
import Editor from "@monaco-editor/react";

export default function ScriptEditor({ code, onChange, onClose }) {
  return (
    <div style={modalStyle}>
      <div style={headerStyle}>
        <span>Editor de Script</span>
        <button onClick={onClose} style={closeBtn}>✖ Fechar</button>
      </div>
      <Editor
        height="100%"
        defaultLanguage="javascript"
        defaultValue={code || getDefaultCode()}
        value={code}
        theme="vs-dark"
        onChange={(value) => onChange(value || "")}
        options={{
          fontSize: 14,
          wordWrap: "on",
          minimap: { enabled: false },
          lineNumbers: "on",
          automaticLayout: true
        }}
      />
    </div>
  );
}

const getDefaultCode = () => `// Escreva seu código aqui
function handler(context) {
  return { resultado: "valor de saída" };
}
`;

const modalStyle = {
  position: "fixed",
  top: "117px",
  left: 0,
  width: "calc(100% - 375px)",
  height: "calc(100vh - 56px)",
  backgroundColor: "#1e1e1e",
  zIndex: 1000,
  display: "flex",
  flexDirection: "column",
  borderRight: "1px solid #444",
  boxShadow: "0 0 20px rgba(0, 0, 0, 0.5)"
};

const headerStyle = {
  height: "40px",
  backgroundColor: "#2a2a2a",
  display: "flex",
  alignItems: "center",
  justifyContent: "space-between",
  padding: "0 1rem",
  borderBottom: "1px solid #444",
  color: "#fff",
  fontSize: "14px"
};

const closeBtn = {
  background: "#444",
  border: "none",
  color: "#fff",
  fontSize: "12px",
  cursor: "pointer",
  padding: "5px 10px",
  borderRadius: "4px",
  transition: "background 0.2s",
  ":hover": {
    background: "#555"
  }
};
