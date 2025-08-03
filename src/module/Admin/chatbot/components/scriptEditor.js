// components/ScriptEditorModal.js
import React, { useEffect, useRef } from "react";
import { EditorState } from "@codemirror/state";
import { EditorView, basicSetup } from "@codemirror/view";
import { javascript } from "@codemirror/lang-javascript";

export default function ScriptEditorModal({ code, onChange, onClose }) {
  const editorRef = useRef();

  useEffect(() => {
    if (!editorRef.current) return;

    const updateListener = EditorView.updateListener.of((v) => {
      if (v.docChanged) {
        onChange(v.state.doc.toString());
      }
    });

    const state = EditorState.create({
      doc: code || "",
      extensions: [basicSetup, javascript(), updateListener],
    });

    const view = new EditorView({
      state,
      parent: editorRef.current,
    });

    return () => view.destroy();
  }, [code, onChange]);

  return (
    <div style={modalStyle}>
      <div style={headerStyle}>
        <span>Editor de Script</span>
        <button style={closeBtn} onClick={onClose}>✖</button>
      </div>
      <div ref={editorRef} style={editorContainer} />
    </div>
  );
}

const modalStyle = {
  position: "fixed",
  top: 0,
  left: 0,
  width: "100vw",
  height: "100vh",
  backgroundColor: "#1e1e1e",
  zIndex: 9999,
  display: "flex",
  flexDirection: "column",
};

const headerStyle = {
  height: "40px",
  backgroundColor: "#2a2a2a",
  color: "#fff",
  padding: "0 1rem",
  display: "flex",
  alignItems: "center",
  justifyContent: "space-between",
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
