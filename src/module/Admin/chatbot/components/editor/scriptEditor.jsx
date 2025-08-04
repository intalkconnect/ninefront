import React, { useRef, useEffect } from "react";
import AceEditor from "react-ace";
import prettier from "prettier/standalone";
import * as parserBabel from "prettier/parser-babel";

import ace from "ace-builds/src-noconflict/ace";
import "ace-builds/src-noconflict/mode-javascript";
import "ace-builds/src-noconflict/theme-monokai";
import "ace-builds/src-noconflict/ext-language_tools";

// Desativa o worker do modo javascript para evitar erro de importScripts
ace.require("ace/mode/javascript").Mode.prototype.createWorker = function () {
  return null;
};

export default function ScriptEditorAce({ value, onChange }) {
  const editorRef = useRef();

  // Formata automaticamente ao perder foco ou digitar (escolha um dos dois)
  const handleFormat = async (rawValue) => {
    try {
const formatted = await prettier.format(value, {
  parser: "babel",
  plugins: [parserBabel],
        semi: true,
        singleQuote: true,
      });
      if (formatted !== rawValue) onChange(formatted);
    } catch (err) {
      // Não alerta na tela para não irritar, só mostra no console
      console.error("Erro ao formatar: " + err.message);
    }
  };

  // Opção: formata ao digitar (cuidado: pode ser incômodo)
  // useEffect(() => {
  //   if (value) handleFormat(value);
  // }, [value]);

  // Opção: formata só ao clicar no botão ou ao perder o foco
  const handleBlur = () => handleFormat(value);

  return (
    <div style={{ position: "relative", border: "1px solid #333", borderRadius: 6 }}>
      <AceEditor
        ref={editorRef}
        mode="javascript"
        theme="monokai"
        name="script-editor"
        value={value}
        onChange={onChange}
        onBlur={handleBlur}
        width="100%"
        height="300px"
        fontSize={14}
        showPrintMargin={false}
        showGutter={true}
        highlightActiveLine={true}
        setOptions={{
          enableBasicAutocompletion: true,
          enableLiveAutocompletion: false,
          enableSnippets: false,
          showLineNumbers: true,
          tabSize: 2,
        }}
        style={{
          borderRadius: 6,
          background: "#232323",
        }}
      />
      <div style={{ position: "absolute", bottom: 10, right: 12, display: "flex", gap: 8 }}>
        <button onClick={() => handleFormat(value)} style={buttonStyle}>Format</button>
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
