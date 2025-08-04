import React, { useEffect, useRef } from "react";
import { EditorView } from "@codemirror/view";
import { basicSetup } from "@codemirror/basic-setup";
import { oneDark } from "@codemirror/theme-one-dark";
import { javascript } from "@codemirror/lang-javascript";

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
      extensions: [
        basicSetup,
        javascript(),
        oneDark,
        updateListener,
      ],
      parent: editorRef.current,
    });

    return () => {
      viewRef.current?.destroy();
      viewRef.current = null;
    };
  }, []);

  useEffect(() => {
    const currentValue = viewRef.current?.state.doc.toString();
    if (viewRef.current && currentValue !== value) {
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
