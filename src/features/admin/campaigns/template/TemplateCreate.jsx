// src/pages/admin/management/templates/TemplateCreate.jsx
import React, {
  useMemo,
  useRef,
  useState,
  useCallback,
  useEffect,
} from "react";
import { Link, useNavigate } from "react-router-dom";
import { Save as SaveIcon, Plus, X } from "lucide-react";
import { apiPost } from "../../../../shared/apiClient";
import { toast } from "react-toastify";

import PreviewWhatsApp from "./PreviewWhatsApp";
import styles from "./styles/TemplateCreate.module.css";

/* ---------------- Constants ---------------- */
const CATEGORIES = [
  { value: "UTILITY", label: "Utility" },
  { value: "MARKETING", label: "Marketing" },
  { value: "AUTHENTICATION", label: "Authentication" },
];

const LANGS = [
  { value: "pt_BR", label: "Português (BR)" },
  { value: "en_US", label: "Inglês (US)" },
  { value: "es_ES", label: "Espanhol (ES)" },
  { value: "pt_PT", label: "Português (PT)" },
  { value: "es_MX", label: "Espanhol (MX)" },
  { value: "fr_FR", label: "Francês (FR)" },
  { value: "it_IT", label: "Italiano (IT)" },
  { value: "de_DE", label: "Alemão (DE)" },
];

const HEADER_TYPES = [
  { value: "NONE", label: "Nenhum" },
  { value: "TEXT", label: "Texto" },
  { value: "IMAGE", label: "Imagem" },
  { value: "DOCUMENT", label: "Documento" },
  { value: "VIDEO", label: "Vídeo" },
];

const MAX_BTNS = 3;

/* ---------------- Meta character limits ---------------- */
const LIMITS = {
  headerText: 60,
  bodyText: 1024,
  footerText: 60,
  ctaText: 20,
  quickText: 25,
};

/* ---------------- Media rules ---------------- */
const IMG_EXT = ["jpg", "jpeg", "png", "webp", "gif"];
const PDF_EXT = ["pdf"];
const MP4_EXT = ["mp4"];

/* ---------------- Helpers ---------------- */
function sanitizeTemplateName(raw) {
  if (!raw) return "";
  let s = String(raw)
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9_]+/g, "_")
    .replace(/_{2,}/g, "_")
    .replace(/^_+|_+$/g, "");
  if (s.length > 512) s = s.slice(0, 512);
  return s;
}

const clamp = (s, max) => (s?.length > max ? s.slice(0, max) : s || "");

const getUrlExt = (url = "") => {
  try {
    const u = new URL(url);
    const pathname = u.pathname || "";
    const last = pathname.split("/").pop() || "";
    const clean = last.split("?")[0].split("#")[0];
    const ext = (clean.split(".").pop() || "").toLowerCase();
    return ext;
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

const fitsTypeByExt = (type, ext) => {
  if (type === "IMAGE") return IMG_EXT.includes(ext);
  if (type === "DOCUMENT") return PDF_EXT.includes(ext);
  if (type === "VIDEO") return MP4_EXT.includes(ext);
  return true;
};

/* ---------------- Form Sections ---------------- */

const TemplateInfoSection = ({
  name,
  setName,
  language,
  setLanguage,
  category,
  setCategory,
}) => (
  <section className={styles.card}>
    <div className={styles.cardHead}>
      <h2 className={styles.cardTitle}>Informações básicas</h2>
      <p className={styles.cardDesc}>
        Defina categoria, idioma e o identificador interno do modelo.
      </p>
    </div>

    <div className={styles.infoGrid}>
      <div className={styles.group}>
        <label className={styles.label}>Categoria do template *</label>
        <select
          className={styles.select}
          value={category}
          onChange={(e) => setCategory(e.target.value)}
        >
          {CATEGORIES.map((c) => (
            <option key={c.value} value={c.value}>
              {c.label}
            </option>
          ))}
        </select>
      </div>

      <div className={styles.group}>
        <label className={styles.label}>Idioma *</label>
        <select
          className={styles.select}
          value={language}
          onChange={(e) => setLanguage(e.target.value)}
        >
          {LANGS.map((l) => (
            <option key={l.value} value={l.value}>
              {l.label}
            </option>
          ))}
        </select>
      </div>

      <div className={styles.groupFull}>
        <label className={styles.label}>
          Nome do template *{" "}
          <span className={styles.helper}>[a-z0-9_] apenas</span>
        </label>
        <input
          className={styles.input}
          value={name}
          onChange={(e) => setName(sanitizeTemplateName(e.target.value))}
          placeholder="ex: welcome_message_1"
          inputMode="latin"
          autoCapitalize="off"
          autoCorrect="off"
          spellCheck={false}
        />
      </div>
    </div>
  </section>
);

const ContentSection = ({
  headerType,
  onChangeHeaderType,
  headerText,
  setHeaderText,
  headerMediaUrl,
  setHeaderMediaUrl,
  bodyText,
  setBodyText,
  footerText,
  setFooterText,
}) => {
  const headerTextLeft = LIMITS.headerText - (headerText?.length || 0);
  const bodyTextLeft = LIMITS.bodyText - (bodyText?.length || 0);
  const footerTextLeft = LIMITS.footerText - (footerText?.length || 0);

  const safeSetHeaderText = (val) =>
    setHeaderText(clamp(val, LIMITS.headerText));
  const safeSetBodyText = (val) => setBodyText(clamp(val, LIMITS.bodyText));
  const safeSetFooterText = (val) =>
    setFooterText(clamp(val, LIMITS.footerText));

  const onMediaUrlChange = (val) => {
    setHeaderMediaUrl(val);
    if (!val) return;
    if (!isValidHttpUrl(val)) return;
    const ext = getUrlExt(val);
    if (!fitsTypeByExt(headerType, ext)) {
      if (headerType === "DOCUMENT")
        toast.error("Documento: apenas PDF é aceito (.pdf).");
      if (headerType === "VIDEO")
        toast.error("Vídeo: apenas MP4 é aceito (.mp4).");
      if (headerType === "IMAGE")
        toast.error("Imagem: use jpg, jpeg, png, webp ou gif.");
    }
  };

  return (
    <section className={styles.card}>
      <div className={styles.cardHead}>
        <h2 className={styles.cardTitle}>Conteúdo da mensagem</h2>
        <p className={styles.cardDesc}>
          Configure o cabeçalho, corpo e rodapé exibidos para o cliente.
        </p>
      </div>

      {/* Tipo de cabeçalho */}
      <div className={styles.cardBodyGrid}>
        <div className={styles.groupFull}>
          <label className={styles.label}>Tipo de cabeçalho</label>
          <div className={styles.segmented} role="tablist">
            {HEADER_TYPES.map((h) => (
              <button
                key={h.value}
                type="button"
                className={`${styles.segItem} ${
                  headerType === h.value ? styles.segActive : ""
                }`}
                onClick={() => onChangeHeaderType(h.value)}
                aria-pressed={headerType === h.value}
              >
                {h.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Conteúdo do cabeçalho */}
      {headerType === "TEXT" && (
        <div className={styles.cardBodyGrid}>
          <div className={styles.groupFull}>
            <label className={styles.label}>Texto do cabeçalho *</label>
            <input
              className={styles.input}
              value={headerText}
              onChange={(e) => safeSetHeaderText(e.target.value)}
              placeholder="Digite o cabeçalho"
            />
            <small className={styles.helperInline}>
              {headerTextLeft} caracteres restantes (máx. {LIMITS.headerText})
            </small>
          </div>
        </div>
      )}

      {headerType !== "TEXT" && headerType !== "NONE" && (
        <div className={styles.cardBodyGrid}>
          <div className={styles.groupFull}>
            <label className={styles.label}>
              URL da mídia{" "}
              {headerType === "IMAGE"
                ? "(jpg, jpeg, png, webp, gif)"
                : headerType === "DOCUMENT"
                ? "(apenas .pdf)"
                : "(apenas .mp4)"}
            </label>
            <input
              className={styles.input}
              value={headerMediaUrl}
              onChange={(e) => onMediaUrlChange(e.target.value)}
              placeholder={
                headerType === "IMAGE"
                  ? "https://exemplo.com/arquivo.jpg"
                  : headerType === "DOCUMENT"
                  ? "https://exemplo.com/arquivo.pdf"
                  : "https://exemplo.com/video.mp4"
              }
            />
          </div>
        </div>
      )}

      {/* Corpo / rodapé */}
      <div className={styles.cardBodyGrid}>
        <div className={styles.groupFull}>
          <label className={styles.label}>Corpo da mensagem *</label>
          <textarea
            className={styles.textarea}
            rows={5}
            value={bodyText}
            onChange={(e) => safeSetBodyText(e.target.value)}
            placeholder="Olá {{1}}, digite sua mensagem aqui..."
          />
          <small className={styles.helperInline}>
            {bodyTextLeft} caracteres restantes (máx. {LIMITS.bodyText})
          </small>
        </div>

        <div className={styles.groupFull}>
          <label className={styles.label}>Rodapé (opcional)</label>
          <input
            className={styles.input}
            value={footerText}
            onChange={(e) => safeSetFooterText(e.target.value)}
            placeholder="Texto do rodapé"
          />
          <small className={styles.helperInline}>
            {footerTextLeft} caracteres restantes (máx. {LIMITS.footerText})
          </small>
        </div>
      </div>
    </section>
  );
};

const ButtonsSection = ({
  buttonMode,
  setButtonMode,
  ctas,
  setCtas,
  quicks,
  setQuicks,
}) => {
  const newId = () => Date.now() + "-" + Math.random().toString(36).slice(2);

  const clampCtaText = (s) => clamp(s, LIMITS.ctaText);
  const clampQuickText = (s) => clamp(s, LIMITS.quickText);

  // CTA state
  const [selectedCtaId, setSelectedCtaId] = useState(null);
  const [creatingCta, setCreatingCta] = useState(false);
  const [ctaDraft, setCtaDraft] = useState("");
  const ctaDraftRef = useRef(null);

  // Quick replies state
  const [creatingQuick, setCreatingQuick] = useState(false);
  const [quickDraft, setQuickDraft] = useState("");
  const quickDraftRef = useRef(null);

  // Seleciona automaticamente o primeiro CTA
  useEffect(() => {
    if (buttonMode !== "cta") return;
    if (!ctas.length) {
      setSelectedCtaId(null);
      return;
    }
    if (!selectedCtaId || !ctas.find((c) => c.id === selectedCtaId)) {
      setSelectedCtaId(ctas[0].id);
    }
  }, [buttonMode, ctas, selectedCtaId]);

  useEffect(() => {
    if (creatingCta && ctaDraftRef.current) {
      ctaDraftRef.current.focus();
    }
  }, [creatingCta]);

  useEffect(() => {
    if (creatingQuick && quickDraftRef.current) {
      quickDraftRef.current.focus();
    }
  }, [creatingQuick]);

  const selectedCta =
    buttonMode === "cta"
      ? ctas.find((c) => c.id === selectedCtaId) || null
      : null;

  const handleCreateCta = () => {
    const label = clampCtaText(ctaDraft.trim());
    if (!label) return;
    if (ctas.length >= MAX_BTNS) return;

    const btn = {
      id: newId(),
      type: "URL",
      text: label,
      url: "",
      phone_number: "",
    };
    setCtas((prev) => [...prev, btn]);
    setSelectedCtaId(btn.id);
    setCtaDraft("");
    setCreatingCta(false);
  };

  const handleCreateQuick = () => {
    const label = clampQuickText(quickDraft.trim());
    if (!label) return;
    if (quicks.length >= MAX_BTNS) return;

    const q = { id: newId(), text: label };
    setQuicks((prev) => [...prev, q]);
    setQuickDraft("");
    setCreatingQuick(false);
  };

  const removeCta = (id) => {
    setCtas((prev) => {
      const next = prev.filter((c) => c.id !== id);
      if (selectedCtaId === id) {
        setSelectedCtaId(next[0]?.id || null);
      }
      return next;
    });
  };

  const removeQuick = (id) => {
    setQuicks((prev) => prev.filter((q) => q.id !== id));
  };

  const updateSelectedCta = (patch) => {
    if (!selectedCtaId) return;
    setCtas((prev) =>
      prev.map((c) => (c.id === selectedCtaId ? { ...c, ...patch } : c))
    );
  };

  return (
    <section className={styles.card}>
      <div className={styles.cardHead}>
        <h2 className={styles.cardTitle}>Botões de ação</h2>
        <p className={styles.cardDesc}>
          Adicione botões de ação (URL/telefone) ou respostas rápidas.
        </p>
      </div>

      <div className={styles.cardBodyGrid}>
        {/* Tipo de botão */}
        <div className={styles.groupFull}>
          <label className={styles.label}>Tipo de botão</label>
          <div className={styles.pills} role="tablist">
            <button
              type="button"
              className={`${styles.pill} ${
                buttonMode === "none" ? styles.pillActive : ""
              }`}
              onClick={() => {
                setButtonMode("none");
              }}
            >
              Nenhum
            </button>
            <button
              type="button"
              className={`${styles.pill} ${
                buttonMode === "cta" ? styles.pillActive : ""
              }`}
              onClick={() => {
                setButtonMode("cta");
              }}
            >
              Call-to-Action
            </button>
            <button
              type="button"
              className={`${styles.pill} ${
                buttonMode === "quick" ? styles.pillActive : ""
              }`}
              onClick={() => {
                setButtonMode("quick");
              }}
            >
              Resposta rápida
            </button>
          </div>
          <p className={styles.helperInline}>
            Máximo de {MAX_BTNS} botões por template.
          </p>
        </div>

        {/* CTA MODE */}
        {buttonMode === "cta" && (
          <div className={styles.groupFull}>
            <label className={styles.label}>Botões de Call-to-Action</label>

            {/* Tags + input inline */}
            <div className={styles.tagRow}>
              {ctas.map((btn) => (
                <button
                  key={btn.id}
                  type="button"
                  className={`${styles.btnTag} ${
                    btn.id === selectedCtaId ? styles.btnTagActive : ""
                  }`}
                  onClick={() => setSelectedCtaId(btn.id)}
                >
                  <span className={styles.btnTagLabel}>
                    {btn.text || "Sem texto"}
                  </span>
                  <span
                    className={styles.btnTagRemove}
                    onClick={(e) => {
                      e.stopPropagation();
                      removeCta(btn.id);
                    }}
                  >
                    <X size={14} />
                  </span>
                </button>
              ))}

              {creatingCta && ctas.length < MAX_BTNS && (
                <input
                  ref={ctaDraftRef}
                  className={styles.tagInput}
                  value={ctaDraft}
                  maxLength={LIMITS.ctaText}
                  placeholder="Texto do botão (Enter para adicionar)"
                  onChange={(e) =>
                    setCtaDraft(clampCtaText(e.target.value || ""))
                  }
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      e.preventDefault();
                      handleCreateCta();
                    } else if (e.key === "Escape") {
                      e.preventDefault();
                      setCreatingCta(false);
                      setCtaDraft("");
                    }
                  }}
                  onBlur={() => {
                    if (!ctaDraft.trim()) {
                      setCreatingCta(false);
                      setCtaDraft("");
                    }
                  }}
                />
              )}
            </div>

            {ctas.length < MAX_BTNS && !creatingCta && (
              <button
                type="button"
                className={styles.addTagBox}
                onClick={() => setCreatingCta(true)}
              >
                <Plus size={16} />
                <span>Adicionar outro botão</span>
              </button>
            )}

            {/* Editor do CTA selecionado */}
            {selectedCta && (
              <div className={styles.ctaEditPanel}>
                <div className={styles.group}>
                  <label className={styles.label}>Ação do botão</label>
                  <select
                    className={styles.select}
                    value={selectedCta.type}
                    onChange={(e) =>
                      updateSelectedCta({ type: e.target.value })
                    }
                  >
                    <option value="URL">Abrir URL</option>
                    <option value="PHONE_NUMBER">Número de telefone</option>
                  </select>
                </div>

                <div className={styles.group}>
                  <label className={styles.label}>Texto do botão</label>
                  <input
                    className={styles.input}
                    value={selectedCta.text}
                    maxLength={LIMITS.ctaText}
                    onChange={(e) =>
                      updateSelectedCta({
                        text: clampCtaText(e.target.value || ""),
                      })
                    }
                    placeholder="Ex: Falar com atendente"
                  />
                  <small className={styles.helperInline}>
                    Máx. {LIMITS.ctaText} caracteres
                  </small>
                </div>

                {selectedCta.type === "URL" ? (
                  <div className={styles.group}>
                    <label className={styles.label}>URL de destino</label>
                    <input
                      className={styles.input}
                      value={selectedCta.url}
                      onChange={(e) =>
                        updateSelectedCta({ url: e.target.value || "" })
                      }
                      placeholder="https://exemplo.com"
                    />
                  </div>
                ) : (
                  <div className={styles.group}>
                    <label className={styles.label}>Número de telefone</label>
                    <input
                      className={styles.input}
                      value={selectedCta.phone_number}
                      onChange={(e) =>
                        updateSelectedCta({
                          phone_number: e.target.value || "",
                        })
                      }
                      placeholder="+5511999999999"
                    />
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        {/* QUICK REPLY MODE */}
        {buttonMode === "quick" && (
          <div className={styles.groupFull}>
            <label className={styles.label}>Respostas rápidas</label>

            <div className={styles.tagRow}>
              {quicks.map((q) => (
                <span key={q.id} className={styles.btnTag}>
                  <span className={styles.btnTagLabel}>
                    {q.text || "Sem texto"}
                  </span>
                  <button
                    type="button"
                    className={styles.btnTagRemove}
                    onClick={() => removeQuick(q.id)}
                  >
                    <X size={14} />
                  </button>
                </span>
              ))}

              {creatingQuick && quicks.length < MAX_BTNS && (
                <input
                  ref={quickDraftRef}
                  className={styles.tagInput}
                  value={quickDraft}
                  maxLength={LIMITS.quickText}
                  placeholder="Texto da resposta (Enter para adicionar)"
                  onChange={(e) =>
                    setQuickDraft(clampQuickText(e.target.value || ""))
                  }
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      e.preventDefault();
                      handleCreateQuick();
                    } else if (e.key === "Escape") {
                      e.preventDefault();
                      setCreatingQuick(false);
                      setQuickDraft("");
                    }
                  }}
                  onBlur={() => {
                    if (!quickDraft.trim()) {
                      setCreatingQuick(false);
                      setQuickDraft("");
                    }
                  }}
                />
              )}
            </div>

            {quicks.length < MAX_BTNS && !creatingQuick && (
              <button
                type="button"
                className={styles.addTagBox}
                onClick={() => setCreatingQuick(true)}
              >
                <Plus size={16} />
                <span>Adicionar resposta</span>
              </button>
            )}

            <small className={styles.helperInline}>
              Pressione Enter para criar a resposta. Para alterar, remova a tag
              e crie novamente.
            </small>
          </div>
        )}
      </div>
    </section>
  );
};

/* ---------------- Main Component ---------------- */

export default function TemplateCreate() {
  const navigate = useNavigate();
  const topRef = useRef(null);

  const [name, setName] = useState("");
  const [language, setLanguage] = useState("pt_BR");
  const [category, setCategory] = useState("MARKETING");

  const [headerType, setHeaderType] = useState("TEXT");
  const [headerText, setHeaderText] = useState("");
  const [headerMediaUrl, setHeaderMediaUrl] = useState("");

  const [bodyText, setBodyText] = useState("");
  const [footerText, setFooterText] = useState("");

  const [buttonMode, setButtonMode] = useState("none");
  const [ctas, setCtas] = useState([]);
  const [quicks, setQuicks] = useState([]);
  const [saving, setSaving] = useState(false);

  const handleChangeHeaderType = useCallback(
    (nextType) => {
      if (nextType === headerType) return;
      setHeaderType(nextType);
      setHeaderText("");
      setHeaderMediaUrl("");
    },
    [headerType]
  );

  const validateBeforeSubmit = () => {
    if (!name.trim()) {
      toast.error("Informe o nome do template.");
      return false;
    }
    if (!bodyText.trim()) {
      toast.error("O corpo da mensagem é obrigatório.");
      return false;
    }
    if (headerType === "TEXT" && !headerText.trim()) {
      toast.error("O texto do cabeçalho é obrigatório.");
      return false;
    }

    if (headerType !== "TEXT" && headerType !== "NONE") {
      if (!headerMediaUrl?.trim()) {
        toast.error("Informe a URL da mídia do cabeçalho.");
        return false;
      }
      if (!isValidHttpUrl(headerMediaUrl)) {
        toast.error("URL de mídia inválida.");
        return false;
      }
      const ext = getUrlExt(headerMediaUrl);
      if (!fitsTypeByExt(headerType, ext)) {
        toast.error(
          headerType === "IMAGE"
            ? "Imagem inválida. Use jpg, jpeg, png, webp ou gif."
            : headerType === "DOCUMENT"
            ? "Documento inválido. Use apenas PDF (.pdf)."
            : "Vídeo inválido. Use apenas MP4 (.mp4)."
        );
        return false;
      }
    }

    if (headerText.length > LIMITS.headerText) {
      toast.error("Cabeçalho excede o limite.");
      return false;
    }
    if (bodyText.length > LIMITS.bodyText) {
      toast.error("Corpo excede o limite.");
      return false;
    }
    if (footerText.length > LIMITS.footerText) {
      toast.error("Rodapé excede o limite.");
      return false;
    }

    if (buttonMode === "cta") {
      for (const b of ctas) {
        if (!b.text?.trim()) {
          toast.error("Texto do botão CTA é obrigatório.");
          return false;
        }
        if (b.text.length > LIMITS.ctaText) {
          toast.error("Texto do CTA excede o limite.");
          return false;
        }
        if (b.type === "URL" && !b.url?.trim()) {
          toast.error("URL do CTA é obrigatória.");
          return false;
        }
        if (b.type === "URL" && !isValidHttpUrl(b.url)) {
          toast.error("URL do CTA inválida.");
          return false;
        }
        if (b.type === "PHONE_NUMBER" && !b.phone_number?.trim()) {
          toast.error("Telefone do CTA é obrigatório.");
          return false;
        }
      }
    }
    if (buttonMode === "quick") {
      for (const q of quicks) {
        if (!q.text?.trim()) {
          toast.error("Texto da resposta rápida é obrigatório.");
          return false;
        }
        if (q.text.length > LIMITS.quickText) {
          toast.error("Resposta rápida excede o limite.");
          return false;
        }
      }
    }
    return true;
  };

  const canSave = useMemo(() => {
    if (!name.trim()) return false;
    if (!bodyText.trim()) return false;
    if (headerType === "TEXT" && !headerText.trim()) return false;
    if (
      buttonMode === "cta" &&
      ctas.some(
        (b) =>
          !b.text?.trim() ||
          (b.type === "URL" && !b.url?.trim()) ||
          (b.type === "PHONE_NUMBER" && !b.phone_number?.trim())
      )
    )
      return false;
    if (buttonMode === "quick" && quicks.some((q) => !q.text?.trim()))
      return false;
    return true;
  }, [name, bodyText, headerType, headerText, buttonMode, ctas, quicks]);

  const handleSubmit = useCallback(
    async (e) => {
      e?.preventDefault?.();
      if (saving) return;
      if (!validateBeforeSubmit()) return;

      setSaving(true);
      try {
        let buttons = null;
        if (buttonMode === "cta" && ctas.length) {
          buttons = ctas.map((b) =>
            b.type === "URL"
              ? { type: "URL", text: b.text.trim(), url: b.url.trim() }
              : {
                  type: "PHONE_NUMBER",
                  text: b.text.trim(),
                  phone_number: b.phone_number.trim(),
                }
          );
        } else if (buttonMode === "quick" && quicks.length) {
          buttons = quicks.map((q) => ({
            type: "QUICK_REPLY",
            text: q.text.trim(),
          }));
        }

        const payload = {
          name: sanitizeTemplateName(name),
          language_code: language,
          category,
          header_type: headerType || "NONE",
          header_text:
            headerType === "TEXT" ? headerText.trim() || null : null,
          header_media_url:
            headerType !== "TEXT" && headerType !== "NONE"
              ? headerMediaUrl.trim() || null
              : null,
          body_text: bodyText.trim(),
          footer_text: footerText.trim() || null,
          buttons,
          example: null,
        };

        const created = await apiPost("/templates", payload);
        await apiPost(`/templates/${created.id}/submit`, {});
        await apiPost(`/templates/${created.id}/sync`, {});

        toast.success(
          "O template foi adicionado e está em fase de aprovação.\n\n" +
            "O template será analisado (isto pode levar alguns minutos). " +
            "Quando for aprovado pela Meta, você poderá sincronizar e utilizá-lo nas suas campanhas."
        );

        navigate("/management/templates");
      } catch (err) {
        console.error(err);
        toast.error("Falha ao enviar template.");
      } finally {
        setSaving(false);
      }
    },
    [
      saving,
      name,
      language,
      category,
      headerType,
      headerText,
      headerMediaUrl,
      bodyText,
      footerText,
      buttonMode,
      ctas,
      quicks,
      navigate,
    ]
  );

  const previewCtas = useMemo(
    () => (buttonMode === "cta" ? ctas : []),
    [buttonMode, ctas]
  );
  const previewQuicks = useMemo(
    () => (buttonMode === "quick" ? quicks : []),
    [buttonMode, quicks]
  );

  return (
    <div className={styles.page} ref={topRef}>
      {/* Breadcrumbs */}
      <nav className={styles.breadcrumbs} aria-label="Breadcrumb">
        <ol className={styles.bcList}>
          <li>
            <Link to="/" className={styles.bcLink}>
              Dashboard
            </Link>
          </li>
          <li className={styles.bcSep}>/</li>
          <li>
            <Link to="/management/templates" className={styles.bcLink}>
              Templates
            </Link>
          </li>
          <li className={styles.bcSep}>/</li>
          <li>
            <span className={styles.bcCurrent}>Novo template</span>
          </li>
        </ol>
      </nav>

      {/* Header compacto com ação principal */}
      <header className={styles.pageHeader}>
        <div className={styles.pageTitleWrap}>
          <h1 className={styles.pageTitle}>Criar Template WhatsApp</h1>
          <p className={styles.pageSubtitle}>
            Configure seu modelo em 2 etapas simples e envie para aprovação da
            Meta.
          </p>
        </div>
        <div className={styles.pageHeaderActions}>
          <button
            type="button"
            className={styles.btnGhost}
            onClick={() => navigate("/management/templates")}
          >
            Cancelar
          </button>
          <button
            type="button"
            className={styles.btnPrimary}
            onClick={handleSubmit}
            disabled={!canSave || saving}
          >
            <SaveIcon size={16} />
            {saving ? "Enviando…" : "Enviar para avaliação"}
          </button>
        </div>
      </header>

      {/* Conteúdo: formulário + preview */}
      <div className={styles.mainGrid}>
        <div className={styles.colForm}>
          <TemplateInfoSection
            name={name}
            setName={setName}
            language={language}
            setLanguage={setLanguage}
            category={category}
            setCategory={setCategory}
          />

          <ContentSection
            headerType={headerType}
            onChangeHeaderType={handleChangeHeaderType}
            headerText={headerText}
            setHeaderText={setHeaderText}
            headerMediaUrl={headerMediaUrl}
            setHeaderMediaUrl={setHeaderMediaUrl}
            bodyText={bodyText}
            setBodyText={setBodyText}
            footerText={footerText}
            setFooterText={setFooterText}
          />

          <ButtonsSection
            buttonMode={buttonMode}
            setButtonMode={setButtonMode}
            ctas={ctas}
            setCtas={setCtas}
            quicks={quicks}
            setQuicks={setQuicks}
          />
        </div>

        <aside
          className={styles.colPreview}
          aria-label="Prévia do template WhatsApp"
        >
          <PreviewWhatsApp
            name={sanitizeTemplateName(name) || "template_name"}
            headerType={headerType}
            headerText={headerText}
            headerMediaUrl={headerMediaUrl}
            bodyText={bodyText}
            footerText={footerText}
            ctas={previewCtas}
            quicks={previewQuicks}
          />
        </aside>
      </div>
    </div>
  );
}
