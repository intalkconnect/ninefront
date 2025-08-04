import React, { useRef, useEffect } from "react";
import * as monaco from "monaco-editor";
import prettier from "prettier/standalone";
import parserBabel from "prettier/parser-babel";
import { Linter } from "eslint-linter-browserify";

export default function ScriptEditor({ value, onChange }) {
  const containerRef = useRef(null);
  const editorRef = useRef(null);
  const eslint = new Linter();

  useEffect(() => {
    if (!containerRef.current) return;

    editorRef.current = monaco.editor.create(containerRef.current, {
      value: value || "",
      language: "javascript",
      theme: "vs-dark",
      automaticLayout: true,
      fontSize: 14,
      minimap: { enabled: false },
    });

    editorRef.current.onDidChangeModelContent(() => {
      const updatedCode = editorRef.current.getValue();
      onChange?.(updatedCode);
      runESLint(updatedCode);
    });

    runESLint(value);

    return () => editorRef.current?.dispose();
  }, []);

  const runESLint = (code) => {
    if (!eslint || !monaco) return;

    const results = eslint.verify(code, {
      env: { browser: true, es2021: true },
      parserOptions: { ecmaVersion: 12, sourceType: "module" },
      rules: {
        semi: ["error", "always"],
        "no-unused-vars": "warn",
        "no-undef": "error",
      },
    });

    const markers = results.map((m) => ({
      severity:
        m.severity === 2
          ? monaco.MarkerSeverity.Error
          : monaco.MarkerSeverity.Warning,
      message: m.message,
      startLineNumber: m.line,
      startColumn: m.column,
      endLineNumber: m.endLine || m.line,
      endColumn: m.endColumn || m.column + 1,
    }));

    const model = editorRef.current?.getModel();
    if (model) {
      monaco.editor.setModelMarkers(model, "eslint", markers);
    }
  };

  const handleFormat = () => {
    const code = editorRef.current?.getValue();
    try {
      const formatted = prettier.format(code, {
        parser: "babel",
        plugins: [parserBabel],
        semi: true,
        singleQuote: true,
      });

      editorRef.current?.setValue(formatted);
    } catch (err) {
      console.error("Erro ao formatar com Prettier:", err);
    }
  };

  return (
    <div style={{ position: "relative", height: "300px", width: "100%" }}>
      <div
        ref={containerRef}
        style={{
          position: "absolute",
          inset: 0,
          borderRadius: "6px",
          border: "1px solid #444",
        }}
      />
      <button
        onClick={handleFormat}
        style={{
          position: "absolute",
          bottom: 10,
          right: 10,
          padding: "4px 8px",
          fontSize: "12px",
          background: "#222",
          color: "#fff",
          border: "1px solid #444",
          borderRadius: "4px",
          cursor: "pointer",
          zIndex: 1,
        }}
      >
        Format
      </button>
    </div>
  );
}
