import React, { useEffect, useRef } from "react";
import { EditorState } from "@codemirror/state";
import { EditorView, keymap } from "@codemirror/view";
import { basicSetup } from "@codemirror/basic-setup";
import { javascript } from "@codemirror/lang-javascript";
import { githubDark } from "@codemirror/theme-github"; // Tema alterado
import { indentWithTab } from "@codemirror/commands";
import { lintGutter } from "@codemirror/lint";
import { autocompletion } from "@codemirror/autocomplete";

export default function ScriptEditor({ code, onChange, onClose }) {
  const editorRef = useRef(null);
  const editorViewRef = useRef(null);

  const setupEditor = () => {
    if (!editorRef.current) return;

    const updateListener = EditorView.updateListener.of((update) => {
      if (update.docChanged) {
        onChange(update.state.doc.toString());
      }
    });

    const extensions = [
      basicSetup,
      javascript({ jsx: false, typescript: false }),
      githubDark, // Tema GitHub Dark aplicado
      updateListener,
      lintGutter(),
      autocompletion(),
      keymap.of([indentWithTab]),
      EditorView.lineWrapping,
      EditorView.theme({
        "&": { 
          height: "100%",
          fontSize: "14px"
        },
        ".cm-scroller": { 
          overflow: "auto",
          fontFamily: "'Fira Code', monospace",
          lineHeight: "1.5"
        },
        ".cm-gutters": { 
          backgroundColor: "#0d1117",
          borderRight: "1px solid #30363d",
          color: "#8b949e"
        },
        ".cm-activeLine": {
          backgroundColor: "#161b22"
        },
        ".cm-activeLineGutter": {
          backgroundColor: "#161b22"
        }
      })
    ];

    const state = EditorState.create({
      doc: code || getDefaultCode(),
      extensions
    });

    if (editorViewRef.current) {
      editorViewRef.current.destroy();
    }

    editorViewRef.current = new EditorView({
      state,
      parent: editorRef.current,
    });

    setTimeout(() => {
      editorViewRef.current?.focus();
    }, 100);
  };

  const getDefaultCode = () => `// Escreva seu código aqui
// Use "context" para acessar dados da conversa
function handler(context) {
  // exemplo: acessar mensagem do usuário
  // const mensagem = context.lastUserMessage;

  // seu código aqui

  return { resultado: "valor de saída" };
}
`;

  useEffect(() => {
    setupEditor();
    return () => editorViewRef.current?.destroy();
  }, []);

  useEffect(() => {
    if (!editorViewRef.current || code === undefined) return;
    
    const currentValue = editorViewRef.current.state.doc.toString();
    if (code !== currentValue) {
      editorViewRef.current.dispatch({
        changes: { from: 0, to: currentValue.length, insert: code || getDefaultCode() }
      });
    }
  }, [code]);

  return (
    <div style={modalStyle}>
      <div style={headerStyle}>
        <span>Editor de Script</span>
        <button onClick={onClose} style={closeBtn}>
          ✖ Fechar
        </button>
      </div>
      <div ref={editorRef} style={editorContainer} />
    </div>
  );
}

// Estilos (mantidos)
const modalStyle = {
  position: "fixed",
  top: "117px",
  left: 0,
  width: "calc(100% - 375px)",
  height: "calc(100vh - 56px)",
  backgroundColor: "#1e1e1e",
  zIndex: 1000,
  display: "flex",
  flexDirection: "column",
  borderRight: "1px solid #444",
  boxShadow: "0 0 20px rgba(0, 0, 0, 0.5)"
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
  fontSize: "14px"
};

const editorContainer = {
  flex: 1,
  overflow: "hidden",
  fontSize: "14px"
};

const closeBtn = {
  background: "#444",
  border: "none",
  color: "#fff",
  fontSize: "12px",
  cursor: "pointer",
  padding: "5px 10px",
  borderRadius: "4px",
  transition: "background 0.2s",
  ":hover": {
    background: "#555"
  }
};
