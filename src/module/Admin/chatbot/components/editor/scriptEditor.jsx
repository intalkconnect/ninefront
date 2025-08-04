import React, { useEffect, useRef } from "react";
import * as monaco from "monaco-editor";
import prettier from "prettier/standalone";
import parserBabel from "prettier/parser-babel";
import { Linter } from "eslint-linter-browserify";

// Evita erro de worker
self.MonacoEnvironment = {
  getWorker: () =>
    new Worker(
      URL.createObjectURL(new Blob(["self.onmessage = () => {}"]))
    ),
};

export default function ScriptEditorMonaco({ value, onChange }) {
  const editorRef = useRef(null);
  const monacoRef = useRef(null);

  const eslintLinter = new Linter();

  const runLint = (code) => {
    try {
      const messages = eslintLinter.verify(
        code,
        [
          {
            files: ["**/*.js"],
            languageOptions: {
              ecmaVersion: 2021,
              sourceType: "module",
            },
            rules: {
              semi: ["error", "always"],
              "no-unused-vars": "warn",
              "no-undef": "error",
            },
          },
        ]
      );

      monaco.editor.setModelMarkers(monacoRef.current.getModel(), "eslint", messages.map(msg => ({
        startLineNumber: msg.line,
        startColumn: msg.column,
        endLineNumber: msg.endLine || msg.line,
        endColumn: msg.endColumn || msg.column + 1,
        message: msg.message,
        severity: msg.severity === 2 ? monaco.MarkerSeverity.Error : monaco.MarkerSeverity.Warning,
        source: "eslint"
      })));
    } catch (e) {
      console.warn("Erro ao validar ESLint:", e);
    }
  };

  const formatWithPrettier = () => {
    if (!monacoRef.current) return;

    const current = monacoRef.current.getValue();
    try {
      const formatted = prettier.format(current, {
        parser: "babel",
        plugins: [parserBabel],
        singleQuote: true,
        semi: true,
      });
      monacoRef.current.setValue(formatted);
    } catch (err) {
      console.error("Erro ao formatar:", err);
    }
  };

  useEffect(() => {
    if (!editorRef.current) return;

    monacoRef.current = monaco.editor.create(editorRef.current, {
      value,
      language: "javascript",
      theme: "vs-dark",
      automaticLayout: true,
      minimap: { enabled: false },
      fontSize: 14,
    });

    monacoRef.current.onDidChangeModelContent(() => {
      const newVal = monacoRef.current.getValue();
      onChange(newVal);
      runLint(newVal);
    });

    runLint(value);

    return () => {
      if (monacoRef.current) monacoRef.current.dispose();
    };
  }, []);

  useEffect(() => {
    if (
      monacoRef.current &&
      monacoRef.current.getValue() !== value
    ) {
      monacoRef.current.setValue(value);
    }
  }, [value]);

  return (
    <div style={{ position: "relative", height: "400px", width: "100%" }}>
      <div
        ref={editorRef}
        style={{
          position: "absolute",
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          border: "1px solid #333",
          borderRadius: "6px",
        }}
      />
      <button
        onClick={formatWithPrettier}
        style={{
          position: "absolute",
          bottom: 10,
          right: 12,
          background: "#222",
          color: "#fff",
          border: "1px solid #444",
          borderRadius: "4px",
          padding: "4px 10px",
          fontSize: "12px",
          cursor: "pointer",
          zIndex: 10,
        }}
      >
        Format
      </button>
    </div>
  );
}
