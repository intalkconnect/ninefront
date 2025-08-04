import React, { useEffect, useRef } from "react";
import * as monaco from "monaco-editor";
import { Linter } from "eslint-linter-browserify";

// Caminho relativo ao `public`
const prettierWorkerUrl = "/prettier.worker.js";

export default function ScriptEditorMonaco({ value, onChange }) {
  const editorRef = useRef(null);
  const monacoRef = useRef(null);
  const linter = new Linter();

  useEffect(() => {
    if (!editorRef.current) return;

    monacoRef.current = monaco.editor.create(editorRef.current, {
      value,
      language: "javascript",
      theme: "vs-dark",
      automaticLayout: true,
      minimap: { enabled: false },
    });

    monacoRef.current.onDidChangeModelContent(() => {
      const updatedValue = monacoRef.current.getValue();
      onChange(updatedValue);
    });

    return () => monacoRef.current?.dispose();
  }, []);

  useEffect(() => {
    if (monacoRef.current && monacoRef.current.getValue() !== value) {
      monacoRef.current.setValue(value);
    }
  }, [value]);

  const formatCode = () => {
    const rawCode = monacoRef.current.getValue();

    // Web worker para Prettier!
    const worker = new window.Worker(prettierWorkerUrl);

    worker.postMessage({
      code: rawCode,
      options: { singleQuote: true, semi: true }
    });

    worker.onmessage = function (e) {
      const { formatted, error } = e.data;
      if (formatted) monacoRef.current.setValue(formatted);
      if (error) console.error("Erro ao formatar:", error);
      worker.terminate();
    };
  };

  const lintCode = () => {
    const code = monacoRef.current.getValue();

    try {
      const results = linter.verify(code, {
        rules: {
          semi: ["error", "always"],
          "no-unused-vars": "warn",
        },
        env: {
          browser: true,
          es6: true,
        },
        parserOptions: {
          ecmaVersion: 2021,
          sourceType: "module",
        },
      });

      const model = monacoRef.current.getModel();

      monaco.editor.setModelMarkers(model, "eslint", results.map((msg) => ({
        startLineNumber: msg.line,
        startColumn: msg.column,
        endLineNumber: msg.endLine || msg.line,
        endColumn: msg.endColumn || msg.column + 1,
        message: msg.message,
        severity: msg.severity === 2 ? monaco.MarkerSeverity.Error : monaco.MarkerSeverity.Warning,
        source: "eslint",
      })));
    } catch (err) {
      console.error("Erro ao executar lint:", err);
    }
  };

  return (
    <div style={{ position: "relative", border: "1px solid #333", borderRadius: 6 }}>
      <div ref={editorRef} style={{ height: 300 }} />
      <div style={{ position: "absolute", bottom: 8, right: 8, display: "flex", gap: "8px" }}>
        <button onClick={formatCode} style={buttonStyle}>Format</button>
        <button onClick={lintCode} style={buttonStyle}>Lint</button>
      </div>
    </div>
  );
}

const buttonStyle = {
  background: "#222",
  color: "#fff",
  border: "1px solid #444",
  borderRadius: "4px",
  padding: "4px 8px",
  fontSize: "12px",
  cursor: "pointer",
};
