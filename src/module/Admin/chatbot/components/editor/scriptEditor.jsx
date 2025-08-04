import React, { useEffect, useRef } from "react";
import { EditorState } from "@codemirror/state";
import {
  EditorView,
  keymap,
  lineNumbers,
  highlightActiveLine,
  highlightActiveLineGutter,
  highlightSpecialChars,
  drawSelection,
  dropCursor,
  rectangularSelection,
  crosshairCursor
} from "@codemirror/view";
import {
  defaultKeymap,
  history,
  historyKeymap,
  indentWithTab
} from "@codemirror/commands";
import { searchKeymap, highlightSelectionMatches } from "@codemirror/search";
import {
  autocompletion,
  completionKeymap,
  closeBrackets,
  closeBracketsKeymap
} from "@codemirror/autocomplete";
import { lintGutter, lintKeymap } from "@codemirror/lint";
import {
  syntaxHighlighting,
  defaultHighlightStyle,
  indentOnInput,
  bracketMatching,
  foldGutter,
  foldKeymap
} from "@codemirror/language";  // <-- traz tudo do mesmo pacote
import { javascript } from "@codemirror/lang-javascript";
import { oneDark } from "@codemirror/theme-one-dark";

export default function ScriptEditor({ code, onChange, onClose }) {
  const editorRef = useRef(null);
  const editorViewRef = useRef(null);

  const setupEditor = () => {
    if (!editorRef.current) return;

    const updateListener = EditorView.updateListener.of((update) => {
      if (update.docChanged) onChange(update.state.doc.toString());
    });

    const customAutocomplete = autocompletion({
      override: [
        (context) => {
          const word = context.matchBefore(/\w*/);
          if (!word || word.from === word.to) return null;
          return {
            from: word.from,
            options: [
              {
                label: "function",
                type: "keyword",
                apply: "function ${name}(${params}) {\n  ${}\n}"
              }
            ]
          };
        }
      ]
    });

    const extensions = [
      // Básicas de view
      lineNumbers(),
      highlightActiveLine(),
      highlightActiveLineGutter(),
      highlightSpecialChars(),
      drawSelection(),
      dropCursor(),
      rectangularSelection(),
      crosshairCursor(),

      // Comandos e histórico
      history(),
      foldGutter(),
      indentOnInput(),
      bracketMatching(),
      closeBrackets(),
      autocompletion(),
      highlightSelectionMatches(),
      lintGutter(),

      // Linguagem e highlight
      javascript({ jsx: false, typescript: false }),
      syntaxHighlighting(defaultHighlightStyle, { fallback: true }),
      oneDark,

      // Listeners e keymaps
      updateListener,
      customAutocomplete,
      keymap.of([
        ...closeBracketsKeymap,
        ...defaultKeymap,
        ...searchKeymap,
        ...historyKeymap,
        ...foldKeymap,
        ...completionKeymap,
        ...lintKeymap,
        indentWithTab
      ]),

      // Wrapping e tema customizado
      EditorView.lineWrapping,
      EditorView.theme({
        "&": { height: "100%", fontSize: "14px" },
        ".cm-scroller": {
          overflow: "auto",
          fontFamily: "'Fira Code', monospace",
          lineHeight: "1.5"
        },
        ".cm-tooltip.cm-tooltip-autocomplete ul li[aria-selected]": {
          backgroundColor: "#2a2a2a"
        },
        ".cm-gutters": {
          backgroundColor: "#1e1e1e",
          borderRight: "1px solid #444",
          color: "#858585"
        },
        ".cm-activeLine, .cm-activeLineGutter": {
          backgroundColor: "#2a2a2a"
        },
        ".cm-selectionMatch": {
          backgroundColor: "#3a3a3a"
        }
      })
    ];

    const state = EditorState.create({
      doc: code ?? getDefaultCode(),
      extensions
    });

    editorViewRef.current?.destroy();
    editorViewRef.current = new EditorView({
      state,
      parent: editorRef.current
    });

    setTimeout(() => editorViewRef.current?.focus(), 100);
  };

  const getDefaultCode = () => `// Escreva seu código aqui
// Use "context" para acessar dados da conversa
function handler(context) {
  return { resultado: "valor de saída" };
}
`;

  useEffect(() => {
    setupEditor();
    return () => editorViewRef.current?.destroy();
  }, []);

  useEffect(() => {
    if (!editorViewRef.current || code === undefined) return;
    const cur = editorViewRef.current.state.doc.toString();
    if (code !== cur) {
      editorViewRef.current.dispatch({
        changes: { from: 0, to: cur.length, insert: code ?? getDefaultCode() }
      });
    }
  }, [code]);

  return (
    <div style={modalStyle}>
      <div style={headerStyle}>
        <span>Editor de Script</span>
        <button onClick={onClose} style={closeBtn}>✖ Fechar</button>
      </div>
      <div ref={editorRef} style={editorContainer} />
    </div>
  );
}

// estilos mantidos
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
const editorContainer = { flex: 1, overflow: "hidden", fontSize: "14px" };
const closeBtn = {
  background: "#444",
  border: "none",
  color: "#fff",
  fontSize: "12px",
  cursor: "pointer",
  padding: "5px 10px",
  borderRadius: "4px",
  transition: "background 0.2s",
  ":hover": { background: "#555" }
};
