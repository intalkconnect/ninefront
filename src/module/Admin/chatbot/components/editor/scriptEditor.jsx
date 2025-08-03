import React, { useEffect, useRef } from "react";
import { EditorState } from "@codemirror/state";
import { EditorView } from "@codemirror/view";
import { basicSetup } from "codemirror";
import { javascript } from "@codemirror/lang-javascript";

export default function ScriptEditorModal({ code, onChange, onClose }) {
  const editorContainerRef = useRef(null);
  const editorViewRef = useRef(null);

  useEffect(() => {
    if (!editorContainerRef.current || editorViewRef.current) return;

    const updateListener = EditorView.updateListener.of((v) => {
      if (v.docChanged) {
        const newCode = v.state.doc.toString();
        onChange?.(newCode);
      }
    });

    const state = EditorState.create({
      doc:
        code?.trim() !== ""
          ? code
          : `// Script de exemplo\nfunction main() {\n  console.log("Olá mundo!");\n}`,
      extensions: [basicSetup, javascript(), updateListener],
    });

    editorViewRef.current = new EditorView({
      state,
      parent: editorContainerRef.current,
    });

    return () => {
      editorViewRef.current?.destroy();
      editorViewRef.current = null;
    };
  }, []);

  return (
    <div style={modalStyle}>
      <div style={headerStyle}>
        <span style={{ color: "#fff", fontWeight: "bold" }}>Editor de Script</span>
        <button onClick={onClose} style={closeBtn}>✖</button>
      </div>
      <div ref={editorContainerRef} style={editorContainer} />
    </div>
  );
}

const modalStyle = {
  position: "absolute",
  top: 0,
  left: 0, // exibe à esquerda
  width: "600px",
  height: "100%",
  backgroundColor: "#1e1e1e",
  zIndex: 999,
  display: "flex",
  flexDirection: "column",
  borderRight: "1px solid #444",
  boxShadow: "4px 0 12px rgba(0, 0, 0, 0.3)",
};

const headerStyle = {
  height: "40px",
  backgroundColor: "#2a2a2a",
  display: "flex",
  alignItems: "center",
  justifyContent: "space-between",
  padding: "0 1rem",
  borderBottom: "1px solid #444",
};

const editorContainer = {
  flex: 1,
  overflow: "auto",
};

const closeBtn = {
  background: "transparent",
  border: "none",
  color: "#fff",
  fontSize: "1.2rem",
  cursor: "pointer",
};
