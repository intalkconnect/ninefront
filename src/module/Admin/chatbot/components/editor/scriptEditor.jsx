import React, { useEffect, useRef } from "react";
import { EditorState } from "@codemirror/state";
import { EditorView } from "@codemirror/view";
import { basicSetup } from "@codemirror/basic-setup";
import { javascript } from "@codemirror/lang-javascript";
import { oneDark } from "@codemirror/theme-one-dark";

export default function ScriptEditorModal({ code, onChange, onClose }) {
  const editorRef = useRef(null);
  const editorViewRef = useRef(null);

  useEffect(() => {
    if (!editorRef.current || editorViewRef.current) return;

    const updateListener = EditorView.updateListener.of((update) => {
      if (update.docChanged) {
        onChange(update.state.doc.toString());
      }
    });

    const state = EditorState.create({
      doc: code || `function name(params) {\n  \n}`,
      extensions: [
        basicSetup,
        javascript(),
        oneDark,
        updateListener,
      ],
    });

    editorViewRef.current = new EditorView({
      state,
      parent: editorRef.current,
    });

    return () => {
      editorViewRef.current?.destroy();
      editorViewRef.current = null;
    };
  }, []);

  return (
    <div style={modalStyle}>
      <div style={headerStyle}>
        <span>Editor de Script</span>
        <button onClick={onClose} style={closeBtn}>✖</button>
      </div>
      <div ref={editorRef} style={editorContainer} />
    </div>
  );
}

const modalStyle = {
  position: "absolute",
  top: 0,
  left: 0,
  width: "375px",
  height: "100%",
  backgroundColor: "#1e1e1e",
  zIndex: 1000,
  display: "flex",
  flexDirection: "column",
  borderRight: "1px solid #444",
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
};

const editorContainer = {
  flex: 1,
  overflow: "hidden",
};

const closeBtn = {
  background: "transparent",
  border: "none",
  color: "#fff",
  fontSize: "1.2rem",
  cursor: "pointer",
};
