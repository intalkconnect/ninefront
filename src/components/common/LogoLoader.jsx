import React from "react";
import styles from "./styles/LogoLoader.module.css";

/**
 * LogoLoader
 * Props:
 * - full?: ocupa toda a área (centralizado absoluto)
 * - size?: tamanho da logo (px) — default 56
 * - label?: texto abaixo (ou "" para ocultar) — default "Carregando…"
 * - src?: caminho da imagem da logo (se não usar `icon`)
 * - icon?: ReactNode para renderizar no centro (ex.: <img/> ou <BrandIcon/>)
 */
export default function LogoLoader({
  full = true,
  size = 56,
  label = "Carregando…",
  src = "/logo.png",
  icon,
}) {
  const ringSize = size * 2; // diâmetro do anel

  return (
    <div className={full ? styles.full : styles.inline}>
      <div
        className={styles.ring}
        style={{ width: ringSize, height: ringSize }}
        aria-label={label || "Carregando"}
        role="status"
      >
        <div
          className={styles.logoWrap}
          style={{ width: size, height: size }}
        >
          {icon ? (
            <div className={styles.iconSlot}>{icon}</div>
          ) : (
            <img
              src={src}
              alt="logo"
              className={styles.logoImg}
              draggable={false}
            />
          )}
        </div>
      </div>

      {label ? <div className={styles.caption}>{label}</div> : null}
    </div>
  );
}
