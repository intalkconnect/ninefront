import React, { useEffect, useRef } from "react";
import { EditorView, basicSetup } from "codemirror";
import { javascript } from "@codemirror/lang-javascript";
import { oneDark } from "@codemirror/theme-one-dark";

export default function ScriptEditor({ value, onChange }) {
  const editorRef = useRef(null);
  const viewRef = useRef(null);

  useEffect(() => {
    if (!editorRef.current) return;

    const updateListener = EditorView.updateListener.of((v) => {
      if (v.docChanged) {
        const updatedCode = v.state.doc.toString();
        onChange(updatedCode);
      }
    });

    viewRef.current = new EditorView({
      doc: value,
      extensions: [basicSetup, javascript(), oneDark, updateListener],
      parent: editorRef.current,
    });

    return () => {
      if (viewRef.current) {
        viewRef.current.destroy();
        viewRef.current = null;
      }
    };
  }, []);

  useEffect(() => {
    // Atualiza conteúdo externo, se necessário
    if (viewRef.current && viewRef.current.state.doc.toString() !== value) {
      viewRef.current.dispatch({
        changes: {
          from: 0,
          to: viewRef.current.state.doc.length,
          insert: value,
        },
      });
    }
  }, [value]);

  return (
    <div
      ref={editorRef}
      style={{
        height: "300px",
        width: "100%",
        border: "1px solid #444",
        borderRadius: "6px",
        overflow: "hidden",
        backgroundColor: "#1e1e1e",
      }}
    />
  );
}
