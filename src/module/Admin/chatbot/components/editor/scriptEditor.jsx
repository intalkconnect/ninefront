import React, { useRef } from "react";
import AceEditor from "react-ace";
import ace from "ace-builds/src-noconflict/ace";
import "ace-builds/src-noconflict/mode-javascript";
import "ace-builds/src-noconflict/theme-monokai";
import "ace-builds/src-noconflict/ext-language_tools";

ace.require("ace/mode/javascript").Mode.prototype.createWorker = function () {
  return null;
};

export default function ScriptEditorAce({ value, onChange }) {
  const editorRef = useRef();

  const formatCode = () => {
    try {
      if (!window.prettier || !window.prettierPlugins) {
        alert("Prettier não está carregado! Confira o HTML.");
        return;
      }
      const formatted = window.prettier.format(value, {
        parser: "babel",
        plugins: window.prettierPlugins,
        semi: true,
        singleQuote: true,
      });
      if (typeof formatted === "string") {
        onChange(formatted);
      } else {
        alert("Prettier não conseguiu formatar.");
      }
    } catch (err) {
      alert("Erro ao formatar: " + err.message);
    }
  };

  return (
    <div style={{ position: "relative", border: "1px solid #333", borderRadius: 6 }}>
      <AceEditor
        ref={editorRef}
        mode="javascript"
        theme="monokai"
        name="script-editor"
        value={value}
        onChange={onChange}
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
        <button onClick={formatCode} style={buttonStyle}>Format</button>
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
