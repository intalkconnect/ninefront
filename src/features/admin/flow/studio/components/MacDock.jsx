import React, { useMemo } from "react";
import styles from "./styles/MacDock.module.css";
import { Undo2, Redo2, Rocket, Download, History } from "lucide-react";

export default function MacDock({
  templates = [],
  iconMap = {},
  onAdd,
  onUndo,
  onRedo,
  onPublish,
  onDownload,
  onHistory,
  isPublishing = false,
  canUndo = false,
  canRedo = false,
}) {
  const allButtons = useMemo(() => {
    const undoRedo = [
      { key: "undo", title: "Desfazer (Ctrl/Cmd+Z)", onClick: onUndo, icon: <Undo2 size={18} />, disabled: !canUndo },
      { key: "redo", title: "Refazer (Ctrl+Shift+Z / Ctrl+Y)", onClick: onRedo, icon: <Redo2 size={18} />, disabled: !canRedo },
    ];

    const tplBtns = templates.map((t) => ({
      key: `tpl-${t.type}-${t.label}`,
      color: t.color,
      title: t.label,
      onClick: () => onAdd?.(t),
      icon: iconMap[t.iconName] || null,
    }));

    const actions = [
      { key: "publish", title: isPublishing ? "Publicando..." : "Publicar", onClick: onPublish, icon: <Rocket size={18} />, disabled: isPublishing },
      { key: "download", title: "Baixar JSON", onClick: onDownload, icon: <Download size={18} /> },
      { key: "history", title: "Histórico de Versões", onClick: onHistory, icon: <History size={18} /> },
    ];

    return [...undoRedo, "divider", ...tplBtns, "divider", ...actions];
  }, [templates, iconMap, onAdd, onUndo, onRedo, onPublish, onDownload, onHistory, isPublishing, canUndo, canRedo]);

  return (
    <div className={styles.dockWrap}>
      <div className={styles.dock}>
        {allButtons.map((item, idx) => {
          if (item === "divider") {
            return <div key={`div-${idx}`} className={styles.hr} />;
          }

          const style = {
            // sem transform/scale
            borderColor: item.color || undefined,
            color: item.color || undefined,
            boxShadow: item.color
              ? `0 0 0 2px ${item.color}11, 0 6px 18px rgba(2,6,23,.10)`
              : undefined,
          };

          return (
            <div key={item.key} className={styles.btnWrap}>
              <button
                className={styles.btn}
                style={style}
                title={item.title}
                onClick={item.onClick}
                disabled={item.disabled}
              >
                {item.icon}
              </button>
              <span className={styles.tooltip}>{item.title}</span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
