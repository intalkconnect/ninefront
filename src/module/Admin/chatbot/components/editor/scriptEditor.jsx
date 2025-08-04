import React, { useEffect, useRef } from "react";
import { EditorState } from "@codemirror/state";
import { EditorView, keymap, lineNumbers, highlightActiveLineGutter, highlightSpecialChars, drawSelection, dropCursor, rectangularSelection, crosshairCursor, highlightSelectionMatches } from "@codemirror/view";
import { Extension, EditorSelection } from "@codemirror/state";
import { defaultHighlightStyle, syntaxHighlighting, indentOnInput, bracketMatching, foldGutter, foldKeymap } from "@codemirror/language";
import { defaultKeymap, history, historyKeymap } from "@codemirror/commands";
import { searchKeymap } from "@codemirror/search";
import { autocompletion, completionKeymap, closeBrackets, closeBracketsKeymap } from "@codemirror/autocomplete";
import { lintKeymap } from "@codemirror/lint";
import { javascript } from "@codemirror/lang-javascript";
import { oneDark } from "@codemirror/theme-one-dark";
import { indentWithTab } from "@codemirror/commands";

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

    // Extensões básicas do CodeMirror 6
    const basicExtensions = [
      lineNumbers(),
      highlightActiveLineGutter(),
      highlightSpecialChars(),
      history(),
      foldGutter(),
      drawSelection(),
      dropCursor(),
      EditorState.allowMultipleSelections.of(true),
      indentOnInput(),
      bracketMatching(),
      closeBrackets(),
      autocompletion(),
      rectangularSelection(),
      crosshairCursor(),
      highlightSelectionMatches(),
      searchKeymap
    ];

    // Configuração do tema e highlighting
    const themeExtensions = [
      oneDark,
      syntaxHighlighting(defaultHighlightStyle, { fallback: true }),
      EditorView.theme({
        "&": { 
          height: "100%",
          fontSize: "14px"
        },
        ".cm-scroller": { 
          overflow: "auto",
          fontFamily: "'Fira Code', 'Monaco', 'Menlo', 'Ubuntu Mono', monospace",
          lineHeight: "1.5"
        },
        ".cm-tooltip.cm-tooltip-autocomplete": {
          "& > ul > li": {
            padding: "4px 8px",
            "&[aria-selected]": {
              background: "#2a2a2a"
            }
          }
        },
        ".cm-gutters": { 
          backgroundColor: "#1e1e1e",
          borderRight: "1px solid #444",
          color: "#858585"
        },
        ".cm-activeLine": {
          backgroundColor: "#2a2a2a"
        },
        ".cm-activeLineGutter": {
          backgroundColor: "#2a2a2a"
        },
        ".cm-focused": {
          outline: "none"
        }
      })
    ];

    // Keymaps
    const keymapExtensions = [
      keymap.of([
        ...closeBracketsKeymap,
        ...defaultKeymap,
        ...searchKeymap,
        ...historyKeymap,
        ...foldKeymap,
        ...completionKeymap,
        ...lintKeymap,
        indentWithTab
      ])
    ];

    const extensions = [
      ...basicExtensions,
      ...themeExtensions,
      ...keymapExtensions,
      javascript({ jsx: false, typescript: false }),
      updateListener,
      EditorView.lineWrapping
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
  const mensagem = context.lastUserMessage;

  // seu código aqui
  if (mensagem) {
    console.log("Mensagem recebida:", mensagem);
  }

  return { resultado: "valor de saída" };
}

// Exemplo de função auxiliar
function processarDados(dados) {
  return dados.map(item => ({
    ...item,
    processado: true
  }));
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

// Estilos mantidos
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
  transition: "background 0.2s"
};
