// src/features/admin/chatbot/components/helpers/nodeHelpers.jsx
import React, { useRef, useEffect } from "react";
import { ArrowLeft, X } from "lucide-react";
import styles from "../styles/NodeConfigPanel.module.css";

/* ================== Caret estável (inputs) ================== */
function useStableCaret() {
  const sel = useRef({ start: null, end: null });
  const onBeforeChange = (el) => {
    if (!el) return;
    try {
      sel.current.start = el.selectionStart;
      sel.current.end = el.selectionEnd;
    } catch {}
  };
  const restore = (el) => {
    if (!el) return;
    const { start, end } = sel.current || {};
    if (start == null || end == null) return;
    requestAnimationFrame(() => {
      try { el.setSelectionRange(start, end); } catch {}
    });
  };
  return { onBeforeChange, restore };
}

export function StableInput({ value, onChange, className, ...rest }) {
  const ref = useRef(null);
  const { onBeforeChange, restore } = useStableCaret();
  const stop = (e) => e.stopPropagation();
  useEffect(() => { restore(ref.current); });
  return (
    <input
      ref={ref}
      value={value ?? ""}
      onChange={(e) => { onBeforeChange(e.target); onChange?.(e); }}
      onKeyDownCapture={stop}
      onKeyUpCapture={stop}
      onKeyPressCapture={stop}
      onMouseDownCapture={stop}
      className={`${styles.inputStyle} ${className || ""}`}
      {...rest}
    />
  );
}

export function StableTextarea({ value, onChange, className, rows = 4, ...rest }) {
  const ref = useRef(null);
  const { onBeforeChange, restore } = useStableCaret();
  const stop = (e) => e.stopPropagation();
  useEffect(() => { restore(ref.current); });
  return (
    <textarea
      ref={ref}
      rows={rows}
      value={value ?? ""}
      onChange={(e) => { onBeforeChange(e.target); onChange?.(e); }}
      onKeyDownCapture={stop}
      onKeyUpCapture={stop}
      onKeyPressCapture={stop}
      onMouseDownCapture={stop}
      className={`${styles.textareaStyle} ${className || ""}`}
      {...rest}
    />
  );
}

/* ================== Utils ================== */
export const deepClone = (obj) =>
  typeof structuredClone === "function" ? structuredClone(obj) : JSON.parse(JSON.stringify(obj ?? {}));
export const clamp = (str = "", max = 100) => (str || "").toString().slice(0, max);
export const makeIdFromTitle = (title, max = 24) => clamp((title || "").toString().trim(), max);
export const pretty = (obj) => { try { return JSON.stringify(obj ?? {}, null, 2); } catch { return "{}"; } };

/* ================== Header reutilizável ================== */
export function OverlayHeader({ title, onBack, onClose, right = null }) {
  return (
    <div className={styles.overlayHeader}>
      <button className={styles.backBtn} onClick={onBack} title="Voltar">
        <ArrowLeft size={18} />
      </button>
      <div className={styles.overlayTitle}>{title}</div>
      <div className={styles.buttonGroup}>
        {right}
        <button className={styles.iconGhost} onClick={onClose} title="Fechar"><X size={16} /></button>
      </div>
    </div>
  );
}

/* ================== Ajuda de caracteres e limites ================== */
export const LIMITS = {
  body: 1024,
  footer: 60,
  headerText: 60,
  listButton: 20,
  rowTitle: 24,
  rowDesc: 72,
  qrButton: 20,
  listMaxRows: 10,
  qrMaxButtons: 3,
};

export const CharHelp = ({ value = "", limit }) => (
  <small className={styles.helpText}>{value?.length || 0}/{limit}</small>
);

/* ================== Teclado: detectar inputs editáveis ================== */
export const isEditableTarget = (el) => {
  if (!el) return false;
  if (el.isContentEditable) return true;
  const tag = el.tagName?.toUpperCase?.();
  if (tag === "TEXTAREA") return true;
  if (tag === "INPUT") {
    const t = (el.type || "").toLowerCase();
    const tl = ["text","search","url","tel","email","password","number","date","datetime-local","time"];
    if (tl.includes(t)) return !el.readOnly && !el.disabled;
  }
  if (tag === "SELECT") return true;
  return false;
};
