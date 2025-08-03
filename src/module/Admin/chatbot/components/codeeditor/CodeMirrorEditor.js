// components/CodeMirrorEditor.js
import React, { useEffect, useRef } from "react";
import { EditorState } from "@codemirror/state";
import { EditorView, basicSetup } from "@codemirror/view";
import { javascript } from "@codemirror/lang-javascript";

export default function CodeMirrorEditor({ value = "", onChange }) {
  const editor = useRef();

  useEffect(() => {
    if (!editor.current) return;

    const updateListener = EditorView.updateListener.of((update) => {
      if (update.docChanged) {
        const code = update.state.doc.toString();
        onChange(code);
      }
    });

    const state = EditorState.create({
      doc: value,
      extensions: [basicSetup, javascript(), updateListener],
    });

    const view = new EditorView({
      state,
      parent: editor.current,
    });

    return () => {
      view.destroy();
    };
  }, [value, onChange]);

  return (
    <div
      ref={editor}
      style={{
        height: "200px",
        border: "1px solid #444",
        borderRadius: "6px",
        backgroundColor: "#1e1e1e",
        color: "#fff",
        overflow: "auto",
      }}
    />
  );
}
