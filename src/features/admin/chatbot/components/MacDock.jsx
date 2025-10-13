import React, { useEffect, useMemo, useRef, useState } from "react";
import styles from "./styles/MacDock.module.css";

/**
 * Dock estilo mac com efeito "magnify".
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
}) {
  const wrapRef = useRef(null);
  const btnRefs = useRef([]);
  const [scales, setScales] = useState([]);

  useEffect(() => {
    btnRefs.current = btnRefs.current.slice(0, templates.length + 3); // +3 = ações (pub, dl, hist) | undo/redo ficam antes
  }, [templates.length]);

  const allButtons = useMemo(() => {
    const tplBtns = templates.map((t) => ({
      key: `tpl-${t.type}-${t.label}`,
      color: t.color,
      title: t.label,
      onClick: () => onAdd?.(t),
      icon: iconMap[t.iconName] || null,
      isAction: false,
    }));

    const actionBtns = [
      { key: "undo", title: "Desfazer (Ctrl/Cmd+Z)", onClick: onUndo, icon: "undo" },
      { key: "redo", title: "Refazer (Ctrl+Shift+Z / Ctrl+Y)", onClick: onRedo, icon: "redo" },
      { key: "publish", title: "Publicar", onClick: onPublish, icon: "rocket", disabled: isPublishing },
      { key: "download", title: "Baixar JSON", onClick: onDownload, icon: "download" },
      { key: "history", title: "Histórico de Versões", onClick: onHistory, icon: "clock" },
    ].map(a => ({ ...a, isAction: true }));

    // ordem: undo/redo | divider | templates | divider | publish/download/history
    return [
      actionBtns[0], actionBtns[1], "divider",
      ...tplBtns,
      "divider",
      actionBtns[2], actionBtns[3], actionBtns[4],
    ];
  }, [templates, iconMap, onAdd, onUndo, onRedo, onPublish, onDownload, onHistory, isPublishing]);

  const renderIcon = (id) => {
    // use os ícones que já tem no projeto (lucide-react)
    switch (id) {
      case "undo":    return <span style={{fontSize:16}}>↶</span>;
      case "redo":    return <span style={{fontSize:16}}>↷</span>;
      case "rocket":  return <span style={{fontSize:16}}>🚀</span>;
      case "download":return <span style={{fontSize:16}}>⬇️</span>;
      case "clock":   return <span style={{fontSize:16}}>🕘</span>;
      default:        return null;
    }
  };

  // magnify
  const onMouseMove = (e) => {
    if (!wrapRef.current) return;
    const mouseY = e.clientY;
    const next = btnRefs.current.map((ref) => {
      if (!ref) return 1;
      const r = ref.getBoundingClientRect();
      const cy = r.top + r.height / 2;
      const d = Math.abs(mouseY - cy);           // distância vertical até o centro do botão
      const influence = 120;                     // raio de influência do efeito
      const max = 0.85;                          // ganho máximo (scale final = 1 + max)
      const k = Math.max(0, 1 - d / influence);  // 0..1
      return 1 + k * max;                        // 1..1.85
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
                {item.icon || renderIcon(item.icon)}
              </button>
              <span className={styles.tooltip}>{item.title}</span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
