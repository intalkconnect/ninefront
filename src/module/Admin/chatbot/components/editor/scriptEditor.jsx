import React, { useEffect, useRef } from "react";
import { EditorView, basicSetup } from "codemirror";
import { highlightActiveLine } from "@codemirror/view";
import { oneDark } from "@codemirror/theme-one-dark";
import { javascript } from "@codemirror/lang-javascript";
import { linter, lintGutter } from "@codemirror/lint";

import { Linter } from "eslint-linter-browserify";
import prettier from "prettier/standalone";
import parserBabel from "prettier/parser-babel";

export default function ScriptEditor({ value, onChange }) {
  const editorRef = useRef(null);
  const viewRef = useRef(null);

  const eslintLinter = new Linter();

  const validateWithESLint = (code) => {
    try {
      const messages = eslintLinter.verify(code, {
        rules: {
          semi: ["error", "always"],
          "no-unused-vars": "warn",
          "no-undef": "error",
        },
        env: { browser: true, es2021: true },
        parserOptions: { ecmaVersion: 12, sourceType: "module" },
      });

      return messages.map((m) => ({
        from: m.column - 1,
        to: m.endColumn ? m.endColumn - 1 : m.column,
        severity: m.severity === 2 ? "error" : "warning",
        message: m.message,
        source: "eslint",
      }));
    } catch {
      return [];
    }
  };

  const formatWithPrettier = () => {
    if (!viewRef.current) return;

    const currentCode = viewRef.current.state.doc.toString();
    try {
      const formatted = prettier.format(currentCode, {
        parser: "babel",
        plugins: [parserBabel],
        singleQuote: true,
        semi: true,
      });

      viewRef.current.dispatch({
        changes: {
          from: 0,
          to: viewRef.current.state.doc.length,
          insert: formatted,
        },
      });
    } catch (err) {
      console.error("Erro ao formatar com Prettier:", err);
    }
  };

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
        highlightActiveLine(),
        lintGutter(),
        linter((view) => validateWithESLint(view.state.doc.toString())),
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
    <div style={{ position: "relative" }}>
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
      <button
        onClick={formatWithPrettier}
        style={{
          position: "absolute",
          bottom: "8px",
          right: "12px",
          background: "#222",
          color: "#fff",
          border: "1px solid #444",
          borderRadius: "4px",
          padding: "4px 8px",
          fontSize: "12px",
          cursor: "pointer",
        }}
      >
        Format
      </button>
    </div>
  );
}
