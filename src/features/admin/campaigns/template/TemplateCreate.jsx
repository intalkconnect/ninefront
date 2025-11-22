// src/pages/admin/management/templates/TemplateCreate.jsx
import React, { useMemo, useRef, useState, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { Save as SaveIcon } from "lucide-react";
import { apiPost } from "../../../../shared/apiClient";
import { toast } from "react-toastify";

import PreviewWhatsApp from "./PreviewWhatsApp";
import styles from "./styles/TemplateCreate.module.css";

/* ---------------- Constants ---------------- */
const CATEGORIES = [
  {
    value: "UTILITY",
    label: "Utilitário",
    desc: "Mensagens relacionadas a serviços prestados",
  },
  {
    value: "MARKETING",
    label: "Marketing",
    desc: "Mensagens promocionais e de engajamento",
  },
  {
    value: "AUTHENTICATION",
    label: "Autenticação",
    desc: "Códigos de autenticação e verificação",
  },
];

const LANGS = [
  { value: "pt_BR", short: "BR", label: "Português (BR)" },
  { value: "en_US", short: "US", label: "Inglês (US)" },
  { value: "es_ES", short: "ES", label: "Espanhol (ES)" },
  { value: "pt_PT", short: "PT", label: "Português (PT)" },
  { value: "es_MX", short: "MX", label: "Espanhol (MX)" },
  { value: "fr_FR", short: "FR", label: "Francês (FR)" },
  { value: "it_IT", short: "IT", label: "Italiano (IT)" },
  { value: "de_DE", short: "DE", label: "Alemão (DE)" },
];

const HEADER_TYPES = [
  { value: "NONE", label: "Nenhum" },
  { value: "TEXT", label: "Texto" },
  { value: "IMAGE", label: "Imagem" },
  { value: "DOCUMENT", label: "Doc" },
  { value: "VIDEO", label: "Vídeo" },
];

const MAX_BTNS = 3;

const LIMITS = {
  headerText: 60,
  bodyText: 1024,
  footerText: 60,
  ctaText: 20,
  quickText: 25,
};

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
}) => {
  return (
    <section className={styles.card}>
      <div className={styles.cardHead}>
        <h2 className={styles.cardTitle}>Informações básicas</h2>
        <p className={styles.cardDesc}>
          Defina a categoria, idioma e o identificador interno do modelo.
        </p>
      </div>

      <div className={styles.infoGrid}>
        {/* Categoria como "cards" sem ícone */}
        <div className={styles.groupFull}>
          <div className={styles.labelRow}>
            <span className={styles.label}>Categoria do template *</span>
          </div>
          <div className={styles.choiceRow}>
            {CATEGORIES.map((c) => {
              const active = c.value === category;
              return (
                <button
                  key={c.value}
                  type="button"
                  className={`${styles.choiceCard} ${
                    active ? styles.choiceCardActive : ""
                  }`}
                  onClick={() => setCategory(c.value)}
                >
                  <div className={styles.choiceTitle}>{c.label}</div>
                  <div className={styles.choiceDesc}>{c.desc}</div>
                </button>
              );
            })}
          </div>
        </div>

        {/* Idioma como "tags cards" */}
        <div className={styles.groupFull}>
          <div className={styles.labelRow}>
            <span className={styles.label}>Idioma *</span>
          </div>
          <div className={styles.choiceRow}>
            {LANGS.map((l) => {
              const active = l.value === language;
              return (
                <button
                  key={l.value}
                  type="button"
                  className={`${styles.langCard} ${
                    active ? styles.langCardActive : ""
                  }`}
                  onClick={() => setLanguage(l.value)}
                >
                  <span className={styles.langShort}>{l.short}</span>
                  <span className={styles.langLabel}>{l.label}</span>
                </button>
              );
            })}
          </div>
        </div>

        <div className={styles.groupFull}>
          <label className={styles.label}>
            Nome do template *
            <span className={styles.helper}> (apenas a-z, 0-9 e _)</span>
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
};

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

      <div className={styles.cardBodyGrid}>
        {/* Tipo de cabeçalho - "tags" sem ícones */}
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

        {/* Cabeçalho: texto ou mídia */}
        {headerType === "TEXT" && (
          <div className={styles.groupFull}>
            <label className={styles.label}>Texto do cabeçalho *</label>
            <input
              className={styles.input}
              value={headerText}
              onChange={(e) => safeSetHeaderText(e.target.value)}
              placeholder="Digite o texto do cabeçalho"
            />
            <small className={styles.helperInline}>
              {headerTextLeft} caracteres restantes (máx. {LIMITS.headerText})
            </small>
          </div>
        )}

        {headerType !== "TEXT" && headerType !== "NONE" && (
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
        )}

        {/* Corpo e rodapé */}
        <div className={styles.groupFull}>
          <label className={styles.label}>Corpo da mensagem *</label>
          <textarea
            className={styles.textarea}
            rows={5}
            value={bodyText}
            onChange={(e) => safeSetBodyText(e.target.value)}
            placeholder="Olá {{1}}, sua mensagem aqui..."
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

  const addCta = () => {
    if (ctas.length >= MAX_BTNS) return;
    setCtas((prev) => [
      ...prev,
      { id: newId(), type: "URL", text: "", url: "", phone_number: "" },
    ]);
  };

  const addQuick = () => {
    if (quicks.length >= MAX_BTNS) return;
    setQuicks((prev) => [...prev, { id: newId(), text: "" }]);
  };

  const removeCta = (id) => setCtas((prev) => prev.filter((cta) => cta.id !== id));
  const removeQuick = (id) =>
    setQuicks((prev) => prev.filter((quick) => quick.id !== id));

  return (
    <section className={styles.card}>
      <div className={styles.cardHead}>
        <h2 className={styles.cardTitle}>Botões de ação</h2>
        <p className={styles.cardDesc}>
          Adicione botões de ação (URL/telefone) ou respostas rápidas.
        </p>
      </div>

      <div className={styles.cardBodyGrid}>
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
                setCtas([]);
                setQuicks([]);
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
                setQuicks([]);
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
                setCtas([]);
              }}
            >
              Resposta rápida
            </button>
          </div>
        </div>

        {buttonMode === "cta" && (
          <div className={styles.groupFull}>
            {ctas.map((cta) => (
              <div key={cta.id} className={styles.ctaEditRow}>
                <select
                  className={styles.select}
                  value={cta.type}
                  onChange={(e) =>
                    setCtas((prev) =>
                      prev.map((c) =>
                        c.id === cta.id ? { ...c, type: e.target.value } : c
                      )
                    )
                  }
                >
                  <option value="URL">Abrir URL</option>
                  <option value="PHONE_NUMBER">Chamar</option>
                </select>

                <div className={styles.flexColumn}>
                  <input
                    className={styles.input}
                    placeholder="Texto do botão"
                    value={cta.text}
                    onChange={(e) =>
                      setCtas((prev) =>
                        prev.map((c) =>
                          c.id === cta.id
                            ? { ...c, text: clampCtaText(e.target.value) }
                            : c
                        )
                      )
                    }
                  />
                </div>

                {cta.type === "URL" ? (
                  <input
                    className={styles.input}
                    placeholder="https://exemplo.com"
                    value={cta.url}
                    onChange={(e) =>
                      setCtas((prev) =>
                        prev.map((c) =>
                          c.id === cta.id ? { ...c, url: e.target.value } : c
                        )
                      )
                    }
                  />
                ) : (
                  <input
                    className={styles.input}
                    placeholder="+5511999999999"
                    value={cta.phone_number}
                    onChange={(e) =>
                      setCtas((prev) =>
                        prev.map((c) =>
                          c.id === cta.id
                            ? { ...c, phone_number: e.target.value }
                            : c
                        )
                      )
                    }
                  />
                )}

                <button
                  type="button"
                  className={styles.btn}
                  onClick={() => removeCta(cta.id)}
                >
                  Remover
                </button>
              </div>
            ))}

            {ctas.length < MAX_BTNS && (
              <button
                type="button"
                className={styles.btnSecondary}
                onClick={addCta}
              >
                + Adicionar botão ({ctas.length}/{MAX_BTNS})
              </button>
            )}
          </div>
        )}

        {buttonMode === "quick" && (
          <div className={styles.groupFull}>
            {quicks.map((quick) => {
              const left = LIMITS.quickText - (quick.text?.length || 0);
              return (
                <div key={quick.id} className={styles.quickEditRow}>
                  <div className={styles.flexColumn}>
                    <input
                      className={styles.input}
                      placeholder="Texto da resposta rápida"
                      value={quick.text}
                      onChange={(e) =>
                        setQuicks((prev) =>
                          prev.map((q) =>
                            q.id === quick.id
                              ? {
                                  ...q,
                                  text: clampQuickText(e.target.value),
                                }
                              : q
                          )
                        )
                      }
                    />
                    <small className={styles.helperInline}>
                      {left} restantes (máx. {LIMITS.quickText})
                    </small>
                  </div>

                  <button
                    type="button"
                    className={styles.btn}
                    onClick={() => removeQuick(quick.id)}
                  >
                    Remover
                  </button>
                </div>
              );
            })}

            {quicks.length < MAX_BTNS && (
              <button
                type="button"
                className={styles.btnSecondary}
                onClick={addQuick}
              >
                + Adicionar resposta ({quicks.length}/{MAX_BTNS})
              </button>
            )}
          </div>
        )}
      </div>
    </section>
  );
};

/* ---------------- Main Component ---------------- */

const STEPS = [
  { id: 1, key: "info", label: "Informações" },
  { id: 2, key: "content", label: "Conteúdo e Botões" },
];

export default function TemplateCreate() {
  const navigate = useNavigate();
  const topRef = useRef(null);

  const [step, setStep] = useState(1);

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
      setStep(1);
      return false;
    }
    if (!bodyText.trim()) {
      toast.error("O corpo da mensagem é obrigatório.");
      setStep(2);
      return false;
    }
    if (headerType === "TEXT" && !headerText.trim()) {
      toast.error("O texto do cabeçalho é obrigatório.");
      setStep(2);
      return false;
    }

    if (headerType !== "TEXT" && headerType !== "NONE") {
      if (!headerMediaUrl?.trim()) {
        toast.error("Informe a URL da mídia do cabeçalho.");
        setStep(2);
        return false;
      }
      if (!isValidHttpUrl(headerMediaUrl)) {
        toast.error("URL de mídia inválida.");
        setStep(2);
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
        setStep(2);
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
            "Quando for aprovado, você poderá sincronizar com a integração " +
            "selecionada em Sincronizar Mensagens."
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

  const goStep = (n) => {
    setStep(n);
    if (topRef.current) {
      topRef.current.scrollIntoView({ behavior: "smooth", block: "start" });
    }
  };

  return (
    <div className={styles.page} ref={topRef}>
      {/* HEADER / WIZARD CARD */}
      <div className={styles.wizardCard}>
        <div className={styles.wizardTopRow}>
          <div>
            <h1 className={styles.wizardTitle}>Criar Template WhatsApp</h1>
            <p className={styles.wizardSubtitle}>
              Configure seu modelo em 2 etapas simples e envie para aprovação
              da Meta.
            </p>
          </div>

          <div className={styles.wizardActions}>
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
        </div>

        <div
          className={styles.stepperRow}
          role="tablist"
          aria-label="Etapas de criação do template"
        >
          {STEPS.map((s, idx) => {
            const isActive = step === s.id;
            const isDone = step > s.id;
            return (
              <button
                key={s.id}
                type="button"
                className={`${styles.stepItem} ${
                  isActive ? styles.stepItemActive : ""
                } ${isDone ? styles.stepItemDone : ""}`}
                onClick={() => goStep(s.id)}
                aria-pressed={isActive}
              >
                <span className={styles.stepCircle}>
                  {isDone ? "✓" : s.id}
                </span>
                <span className={styles.stepLabel}>{s.label}</span>
                {idx < STEPS.length - 1 && (
                  <span className={styles.stepDivider} aria-hidden="true" />
                )}
              </button>
            );
          })}
        </div>
      </div>

      {/* GRID: FORM + PREVIEW */}
      <div className={styles.mainGrid}>
        <div className={styles.colForm}>
          {step === 1 && (
            <TemplateInfoSection
              name={name}
              setName={setName}
              language={language}
              setLanguage={setLanguage}
              category={category}
              setCategory={setCategory}
            />
          )}

          {step === 2 && (
            <>
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
            </>
          )}

          {/* Navegação de etapa (sem ícones) */}
          <div className={styles.stepNav}>
            {step > 1 && (
              <button
                type="button"
                className={styles.stepNavBtn}
                onClick={() => goStep(step - 1)}
              >
                Voltar
              </button>
            )}
            {step < STEPS.length && (
              <button
                type="button"
                className={styles.stepNavBtnPrimary}
                onClick={() => goStep(step + 1)}
              >
                Próximo
              </button>
            )}
          </div>
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
