// src/pages/QuickReplies/QuickReplyModal.jsx
import React, { useEffect, useState, useCallback } from "react";
import { Save as SaveIcon, X as XIcon, AlertCircle } from "lucide-react";
import { apiPost } from "../../../../shared/apiClient";
import { toast } from "react-toastify";
import styles from "./styles/QuickReplyModal.module.css";

export default function QuickReplyModal({ isOpen, onClose, onCreated, flowId }) {
  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);

  const onEsc = useCallback(
    (e) => {
      if (e.key === "Escape") onClose?.();
    },
    [onClose]
  );

  useEffect(() => {
    if (!isOpen) return;
    document.addEventListener("keydown", onEsc);
    return () => document.removeEventListener("keydown", onEsc);
  }, [isOpen, onEsc]);

  useEffect(() => {
    if (isOpen) {
      setTitle("");
      setContent("");
      setError(null);
      setSaving(false);
    }
  }, [isOpen]);

  const submit = async (e) => {
    e.preventDefault();
    const t = title.trim();
    const c = content.trim();

    if (!t || !c) {
      setError("Por favor, preencha o título e o conteúdo.");
      toast.warn("Preencha título e conteúdo.");
      return;
    }
    if (t.length > 100) {
      setError("O título deve ter no máximo 100 caracteres.");
      toast.warn("O título deve ter no máximo 100 caracteres.");
      return;
    }

    setSaving(true);
    setError(null);
    try {
      const qs = flowId ? `?flow_id=${encodeURIComponent(flowId)}` : "";
      await apiPost(`/quick-replies${qs}`, {
        title: t,
        content: c,
        ...(flowId ? { flow_id: flowId } : {}),
      });
      onCreated?.();
      onClose?.();
    } catch (err) {
      console.error(err);
      setError("Erro ao criar resposta. Tente novamente.");
      toast.error("Erro ao criar resposta. Tente novamente.");
    } finally {
      setSaving(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className={styles.modalOverlay} onMouseDown={onClose}>
      <div
        className={styles.modal}
        role="dialog"
        aria-modal="true"
        aria-labelledby="qr-create-title"
        onMouseDown={(e) => e.stopPropagation()}
      >
        <div className={styles.modalHeader}>
          <h2 id="qr-create-title" className={styles.modalTitle}>
            Nova resposta rápida
          </h2>
          <button
            type="button"
            className={`${styles.btn} ${styles.iconOnly}`}
            onClick={onClose}
            aria-label="Fechar"
          >
            <XIcon size={16} />
          </button>
        </div>

        {error && (
          <div
            className={styles.alertErr}
            role="alert"
            aria-live="assertive"
            style={{ margin: "0 18px" }}
          >
            <span className={styles.alertIcon} aria-hidden="true">
              <AlertCircle size={16} />
            </span>
            <span>{error}</span>
            <button
              className={styles.alertClose}
              onClick={() => setError(null)}
              aria-label="Fechar alerta"
            >
              <XIcon size={14} />
            </button>
          </div>
        )}

        <form onSubmit={submit}>
          <div className={styles.formInner}>
            <div className={styles.inputGroup}>
              <div className={styles.labelRow}>
                <label htmlFor="qr-title" className={styles.label}>
                  Título *
                </label>
                <div className={styles.charCount}>{title.length}/100</div>
              </div>
              <input
                id="qr-title"
                className={styles.input}
                placeholder="Ex.: Saudação inicial"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                maxLength={100}
                autoFocus
              />
            </div>

            <div className={styles.inputGroup}>
              <div className={styles.labelRow}>
                <label htmlFor="qr-content" className={styles.label}>
                  Conteúdo *
                </label>
                <div className={styles.charCount}>
                  {content.length} caracteres
                </div>
              </div>
              <textarea
                id="qr-content"
                className={styles.textarea}
                rows={4}
                placeholder="Digite o conteúdo da resposta rápida…"
                value={content}
                onChange={(e) => setContent(e.target.value)}
              />
            </div>
          </div>

          <div className={styles.modalActions}>
            <button
              type="button"
              className={styles.btn}
              onClick={onClose}
              disabled={saving}
            >
              Cancelar
            </button>
            <button
              type="submit"
              className={styles.btnPrimary}
              disabled={saving}
            >
              <SaveIcon size={16} />
              {saving ? "Salvando…" : "Salvar"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
