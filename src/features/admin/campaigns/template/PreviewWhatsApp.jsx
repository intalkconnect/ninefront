// src/pages/admin/management/templates/PreviewWhatsApp.jsx
import React, { useEffect, useMemo, useState } from "react";
import styles from "./styles/PreviewWhatsApp.module.css";

/* ---------------- Helpers ---------------- */
const nowTime = () =>
  new Date().toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });

const getUrlExt = (url = "") => {
  try {
    const u = new URL(url);
    const pathname = u.pathname || "";
    const last = pathname.split("/").pop() || "";
    const clean = last.split("?")[0].split("#")[0];
    return (clean.split(".").pop() || "").toLowerCase();
  } catch {
    return "";
  }
};

const isValidHttpUrl = (value = "") => {
  try {
    const u = new URL(value);
    return u.protocol === "http:" || u.protocol === "https:";
  } catch {
    return false;
  }
};

const IMG_EXT = ["jpg", "jpeg", "png", "webp", "gif"];
const PDF_EXT = ["pdf"];
const MP4_EXT = ["mp4"];

const fitsTypeByExt = (type, ext) => {
  if (type === "IMAGE") return IMG_EXT.includes(ext);
  if (type === "DOCUMENT") return PDF_EXT.includes(ext);
  if (type === "VIDEO") return MP4_EXT.includes(ext);
  return true;
};

/* ---------------- SVG Icons ---------------- */
const IconReply = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" className={styles.iBlue} aria-hidden="true">
    <path d="M10 9V5l-7 7 7 7v-4.1c5 0 8.5 1.6 11 5.1-1-5-4-10-11-11z" fill="currentColor"/>
  </svg>
);

const IconExternal = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" className={styles.iBlue} aria-hidden="true">
    <path d="M14 3h7v7h-2V6.41l-9.29 9.3-1.42-1.42 9.3-9.29H14V3z" fill="currentColor"/>
    <path d="M5 5h6v2H7v10h10v-4h2v6H5z" fill="currentColor"/>
  </svg>
);

const IconPhone = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" className={styles.iBlue} aria-hidden="true">
    <path d="M6.62 10.79a15.053 15.053 0 0 0 6.59 6.59l2.2-2.2a1 1 0 0 1 1.01-.24 11.36 11.36 0 0 0 3.56.57 1 1 0 0 1 1 1v3.5a1 1 0 0 1-1 1A17.5 17.5 0 0 1 2.5 5a1 1 0 0 1 1-1H7a1 1 0 0 1 1 1c0 1.21.2 2.41.57 3.56a1 1 0 0 1-.25 1.01l-1.7 1.22z" fill="currentColor"/>
  </svg>
);

const IconCamera = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" className={styles.iMedia} aria-hidden="true">
    <path d="M9 3l2 2h6a2 2 0 0 1 2 2v10a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V7a2 2 0 0 1 2-2h2l2-2zM12 8a5 5 0 1 0 .001 10.001A5 5 0 0 0 12 8zm0 2a3 3 0 1 1 0 6 3 3 0 0 1 0-6z" fill="currentColor"/>
  </svg>
);

const IconDoc = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" className={styles.iMedia} aria-hidden="true">
    <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" fill="currentColor" opacity=".3"/>
    <path d="M14 2v6h6M8 13h8M8 9h4M8 17h8" fill="none" stroke="currentColor" strokeWidth="1.5"/>
  </svg>
);

const IconVideo = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" className={styles.iMedia} aria-hidden="true">
    <path d="M4 5h12a2 2 0 0 1 2 2v2l3-2v10l-3-2v2a2 2 0 0 1-2 2H4z" fill="currentColor" opacity=".3"/>
    <path d="M4 7h12v10H4zM18 9l3-2v10l-3-2z" fill="none" stroke="currentColor" strokeWidth="1.5"/>
  </svg>
);

/* ---------------- Token Renderer ---------------- */
const TokenRenderer = ({ text }) => {
  const parts = String(text || "").split(/(\{\{.*?\}\})/g);
  return parts.map((part, i) =>
    /\{\{.*\}\}/.test(part) ? (
      <span key={i} className={styles.token}>{part}</span>
    ) : (
      <span key={i}>{part}</span>
    )
  );
};

/* ---------------- Preview Component ---------------- */
export default function PreviewWhatsApp({
  name = "template_name",
  headerType = "TEXT",
  headerText = "",
  headerMediaUrl = "",
  bodyText = "",
  footerText = "",
  // Se vier do Create: passe ctas/quicks
  // Se vier da API/lista: passe buttons (URL/PHONE_NUMBER/QUICK_REPLY)
  ctas: ctasIn,
  quicks: quicksIn,
  buttons: apiButtons,
}) {
  // Normaliza botões quando vierem da API
  const { ctas, quicks } = useMemo(() => {
    if (ctasIn || quicksIn) return { ctas: ctasIn || [], quicks: quicksIn || [] };
    const arr = Array.isArray(apiButtons) ? apiButtons : [];
    return {
      ctas: arr.filter(b => b.type === "URL" || b.type === "PHONE_NUMBER"),
      quicks: arr.filter(b => b.type === "QUICK_REPLY"),
    };
  }, [ctasIn, quicksIn, apiButtons]);

  const hasButtons = (ctas?.length || 0) > 0 || (quicks?.length || 0) > 0;
  const hasMediaAbove = headerType !== "TEXT" && headerType !== "NONE";

  const [imgOk, setImgOk] = useState(false);
  const [mediaOk, setMediaOk] = useState(false);

  useEffect(() => { setImgOk(false); setMediaOk(false); }, [headerMediaUrl, headerType]);

  const mediaPreview = () => {
    if (!hasMediaAbove) return null;

    const url = (headerMediaUrl || "").trim();
    const hasUrl = url.length > 0;
    const isUrl = hasUrl && isValidHttpUrl(url);
    const ext = hasUrl ? getUrlExt(url) : "";

    const DefaultPlaceholder = (
      <div className={`${styles.mediaPlaceholder} ${styles.mediaAttached}`}>
        <div className={styles.mediaIcon}>
          {headerType === "IMAGE" && <IconCamera />}
          {headerType === "DOCUMENT" && <IconDoc />}
          {headerType === "VIDEO" && <IconVideo />}
        </div>
        <div className={styles.mediaLabel}>
          {headerType === "IMAGE" ? "Imagem" : headerType === "DOCUMENT" ? "Documento" : "Vídeo"}
        </div>
        {hasUrl && <div className={styles.mediaUrl}>{url.length > 40 ? `${url.slice(0,40)}…` : url}</div>}
      </div>
    );

    if (!hasUrl) return DefaultPlaceholder;

    if (!isUrl) {
      return (
        <div className={`${styles.mediaPlaceholder} ${styles.mediaAttached}`}>
          <div className={styles.mediaIcon}>
            {headerType === "IMAGE" && <IconCamera />}
            {headerType === "DOCUMENT" && <IconDoc />}
            {headerType === "VIDEO" && <IconVideo />}
          </div>
          <div className={styles.mediaLabel}>URL inválida</div>
          <div className={styles.mediaUrl}>{url}</div>
        </div>
      );
    }

    if (headerType === "IMAGE") {
      return (
        <div className={`${styles.mediaImgWrap} ${styles.mediaAttached}`}>
          <img
            src={url}
            alt="Imagem do Cabeçalho"
            className={styles.mediaImage}
            onLoad={() => { setImgOk(true); setMediaOk(true); }}
            onError={() => { setImgOk(false); setMediaOk(false); }}
          />
          {!imgOk && (
            <div className={styles.mediaFallback}>
              <div className={styles.mediaIcon}><IconCamera /></div>
              <div className={styles.mediaLabel}>Carregando imagem…</div>
              <div className={styles.mediaUrl}>{url.length > 40 ? `${url.slice(0,40)}…` : url}</div>
            </div>
          )}
        </div>
      );
    }

    if (headerType === "DOCUMENT") {
      if (!PDF_EXT.includes(ext)) {
        return (
          <div className={`${styles.mediaPlaceholder} ${styles.mediaAttached}`}>
            <div className={styles.mediaIcon}><IconDoc /></div>
            <div className={styles.mediaLabel}>Apenas PDF é suportado</div>
            <div className={styles.mediaUrl}>{url}</div>
          </div>
        );
      }
      return (
        <div className={`${styles.mediaImgWrap} ${styles.mediaAttached}`} style={{ height: 220 }}>
          <iframe title="PDF" src={url} className={styles.mediaIframe} onLoad={() => setMediaOk(true)} />
          {!mediaOk && (
            <div className={styles.mediaFallback}>
              <div className={styles.mediaIcon}><IconDoc /></div>
              <div className={styles.mediaLabel}>Carregando PDF…</div>
            </div>
          )}
        </div>
      );
    }

    if (headerType === "VIDEO") {
      if (!MP4_EXT.includes(ext)) {
        return (
          <div className={`${styles.mediaPlaceholder} ${styles.mediaAttached}`}>
            <div className={styles.mediaIcon}><IconVideo /></div>
            <div className={styles.mediaLabel}>Apenas MP4 é suportado</div>
            <div className={styles.mediaUrl}>{url}</div>
          </div>
        );
      }
      return (
        <div className={`${styles.mediaImgWrap} ${styles.mediaAttached}`} style={{ height: 220 }}>
          <video
            className={styles.mediaVideo}
            src={url}
            controls
            onCanPlay={() => setMediaOk(true)}
            onError={() => setMediaOk(false)}
          />
          {!mediaOk && (
            <div className={styles.mediaFallback}>
              <div className={styles.mediaIcon}><IconVideo /></div>
              <div className={styles.mediaLabel}>Carregando vídeo…</div>
            </div>
          )}
        </div>
      );
    }

    return null;
  };

  return (
    <aside className={styles.previewWrap} aria-label="Prévia do template">
      <div className={styles.phoneCard}>
        {/* WhatsApp Header */}
        <div className={styles.whatsappHeader}>
          <div className={styles.contactInfo}>
            <div className={styles.contactDetails}>
              <div className={styles.contactName}>{name || "template_name"}</div>
              <div className={styles.contactStatus}>Template • WhatsApp Business</div>
            </div>
          </div>
          <div className={styles.headerActions}>
            <button className={styles.headerBtn}>⋮</button>
          </div>
        </div>

        {/* Chat Area */}
        <div className={styles.chatArea}>
          <div className={styles.messageContainer}>
            {/* Media Header */}
            {hasMediaAbove && (
              <div className={styles.mediaHeader}>
                {mediaPreview()}
              </div>
            )}

            {/* Message Bubble + Buttons */}
            <div className={styles.bubbleBlock}>
              <div
                className={[
                  styles.messageBubble,
                  hasMediaAbove && styles.bubbleAttachTop,
                  hasButtons && styles.bubbleAttachBottom,
                ].filter(Boolean).join(" ")}
              >
                {/* Header Text */}
                {headerType === "TEXT" && headerText?.trim() && (
                  <div className={styles.headerText}>
                    <TokenRenderer text={headerText} />
                  </div>
                )}

                {/* Body Text */}
                <div className={styles.bodyText}>
                  {String(bodyText || "")
                    .split("\n")
                    .map((line, i) => (
                      <div key={i}><TokenRenderer text={line} /></div>
                    ))}
                </div>

                {/* Footer Text */}
                {footerText?.trim() && (
                  <div className={styles.footerText}>
                    <TokenRenderer text={footerText} />
                  </div>
                )}

                {/* Timestamp */}
                <div className={styles.timestamp}>{nowTime()}</div>
              </div>

              {/* CTA Buttons */}
              {(ctas?.length || 0) > 0 && (
                <div className={`${styles.buttonGroup} ${styles.buttonGroupAttached}`}>
                  {ctas.map((btn, i) => (
                    <div key={i} className={styles.ctaButton}>
                      <div className={styles.btnIcon}>
                        {btn.type === "PHONE_NUMBER" ? <IconPhone /> : <IconExternal />}
                      </div>
                      <div className={styles.btnText}>{btn.text || "Botão de Ação"}</div>
                    </div>
                  ))}
                </div>
              )}

              {/* Quick Reply Buttons */}
              {(quicks?.length || 0) > 0 && (
                <div className={`${styles.buttonGroup} ${styles.buttonGroupAttached}`}>
                  {quicks.map((q, i) => (
                    <div key={i} className={styles.quickButton}>
                      <div className={styles.btnIcon}><IconReply /></div>
                      <div className={styles.btnText}>{q.text || "Resposta Rápida"}</div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      <div className={styles.previewLabel}>Prévia do Template</div>
    </aside>
  );
}
