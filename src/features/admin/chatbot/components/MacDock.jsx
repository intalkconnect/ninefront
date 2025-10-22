import React, { useEffect, useMemo, useRef, useState } from "react";
import styles from "./styles/MacDock.module.css";
import { Undo2, Redo2, Rocket, Download, History } from "lucide-react";

/**
 * Dock estilo mac (horizontal, bottom-centered) com efeito "magnify".
 * Props:
 * - templates: array (nodeTemplates)
 * - iconMap: map { iconName: <Icon/> }
 * - onAdd(template)
 * - onUndo(), onRedo(), onPublish(), onDownload(), onHistory()
 * - isPublishing
 */
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
  canUndo=false,
  canRedo=false,
}) {
  const wrapRef = useRef(null);
  const btnRefs = useRef([]);
  const [scales, setScales] = useState([]);

  useEffect(() => {
    // quantidade = (2 de undo/redo) + templates + (3 ações finais)
    btnRefs.current = btnRefs.current.slice(0, 2 + templates.length + 3);
  }, [templates.length]);

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
      {
        key: "publish",
        title: isPublishing ? "Publicando..." : "Publicar",
        onClick: onPublish,
        icon: <Rocket size={18} />,
        disabled: isPublishing,
      },
      { key: "download", title: "Baixar JSON", onClick: onDownload, icon: <Download size={18} /> },
      { key: "history", title: "Histórico de Versões", onClick: onHistory, icon: <History size={18} /> },
    ];

    // ordem: undo/redo | divider | templates | divider | publish/download/history
    return [ ...undoRedo, "divider", ...tplBtns, "divider", ...actions ];
  }, [templates, iconMap, onAdd, onUndo, onRedo, onPublish, onDownload, onHistory, isPublishing, canUndo, canRedo]);

  // magnify horizontal
  const onMouseMove = (e) => {
    if (!wrapRef.current) return;
    const mouseX = e.clientX;
    const next = btnRefs.current.map((ref) => {
      if (!ref) return 1;
      const r = ref.getBoundingClientRect();
      const cx = r.left + r.width / 2;
      const d = Math.abs(mouseX - cx);
      const influence = 140; // raio de influência
      const max = 0.85;      // ganho máximo (scale final = 1 + max)
      const k = Math.max(0, 1 - d / influence); // 0..1
      return 1 + k * max; // 1..1.85
    });
    setScales(next);
  };

  const onMouseLeave = () => setScales([]);

  let btnIndex = -1;

  return (
    <div className={styles.dockWrap}>
      <div
        className={styles.dock}
        ref={wrapRef}
        onMouseMove={onMouseMove}
        onMouseLeave={onMouseLeave}
      >
        {allButtons.map((item, idx) => {
          if (item === "divider") {
            return <div key={`div-${idx}`} className={styles.hr} />;
          }
          btnIndex += 1;

          const scale = scales[btnIndex] || 1;
          const style = {
            transform: `scale(${scale})`,
            borderColor: item.color || undefined,
            color: item.color || undefined,
            boxShadow: item.color
              ? `0 0 0 2px ${item.color}11, 0 6px 18px rgba(2,6,23,.10)`
              : undefined,
          };

          return (
            <div key={item.key} className={styles.btnWrap}>
              <button
                ref={(el) => (btnRefs.current[btnIndex] = el)}
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
