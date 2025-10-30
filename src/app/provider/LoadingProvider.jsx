import React, { createContext, useCallback, useContext, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import LogoLoader from "../LogoLoader";
import "./styles/overlay.css"; // estilos do overlay

const Ctx = createContext(null);

export function LoadingProvider({ children }) {
  const [visible, setVisible] = useState(false);
  const [message, setMessage] = useState("");

  const show = useCallback((msg = "") => {
    setMessage(String(msg || ""));
    setVisible(true);
  }, []);

  const hide = useCallback(() => {
    setVisible(false);
    setMessage("");
  }, []);

  const value = useMemo(() => ({ show, hide, setMessage }), [show, hide]);

  return (
    <Ctx.Provider value={value}>
      {children}
      {visible && createPortal(
        <div className="nc-loader-overlay" aria-live="polite" aria-busy="true">
          <LogoLoader full size={56} label={message} />
        </div>,
        document.body
      )}
    </Ctx.Provider>
  );
}

export function useLoader() {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error("useLoader must be used within <LoadingProvider />");
  return ctx;
}
