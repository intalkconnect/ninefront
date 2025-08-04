import React, { useRef } from "react";
import AceEditor from "react-ace";
import prettier from "prettier/standalone";
import parserBabel from "prettier/plugins/babel";
import { Linter } from "eslint-linter-browserify";

import "ace-builds/src-noconflict/mode-javascript";
import "ace-builds/src-noconflict/theme-monokai";
import "ace-builds/src-noconflict/ext-language_tools";

export default function ScriptEditorAce({ value, onChange }) {
  const editorRef = useRef();

  // ESLint Linter
  const linter = new Linter();

  const formatCode = async () => {
    try {
      const formatted = await prettier.format(value, {
        parser: "babel",
        plugins: [parserBabel],
        semi: true,
        singleQuote: true,
      });
      onChange(formatted);
    } catch (err) {
      alert("Erro ao formatar: " + err.message);
    }
  };

  const lintCode = () => {
    try {
      const messages = linter.verify(value, {
        rules: {
          semi: ["error", "always"],
          "no-unused-vars": "warn",
        },
        env: { browser: true, es6: true },
        parserOptions: { ecmaVersion: 2021, sourceType: "module" },
      });
      if (messages.length) {
        const msg = messages
          .map((m) => `${m.message} [${m.line}:${m.column}]`)
          .join("\n");
        alert(msg);
      } else {
        alert("Nenhum erro encontrado!");
      }
    } catch (e) {
      alert("Erro ao lintar: " + e.message);
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
