// src/features/admin/chatbot/components/NodeConfigPanel.jsx
import React, { useState, useRef, useCallback, useEffect, useMemo } from "react";
import {
  Trash2,
  Plus,
  X,
  MoreHorizontal,
  PencilLine,
  ArrowLeft,
  SlidersHorizontal,
  AlertCircle,
  Check,
} from "lucide-react";
import styles from "./styles/NodeConfigPanel.module.css";

/* ========= MESSAGE TYPES ========= */
import TextMessage from "../../../flow/history/messageTypes/TextMessage";
import QuickReplyMessage from "../../../flow/history/messageTypes/QuickReplyMessage";
import InteractiveListMessage from "../../../flow/history/messageTypes/ListMessage";
import ImageMessage from "../../../flow/history/messageTypes/ImageMessage";
import DocumentMessage from "../../../flow/history/messageTypes/DocumentMessage";
import AudioMessage from "../../../flow/history/messageTypes/AudioMessage";
import VideoMessage from "../../../flow/history/messageTypes/VideoMessage";
import ContactsMessage from "../../../flow/history/messageTypes/ContactsMessage";

/* ================= Inputs estáveis ================= */
function useStableCaret() {
  const sel = useRef({ start: null, end: null });
  const onBeforeChange = (el) => { if (!el) return; try { sel.current.start = el.selectionStart; sel.current.end = el.selectionEnd; } catch {} };
  const restore = (el) => {
    if (!el) return;
    const { start, end } = sel.current || {};
    if (start == null || end == null) return;
    requestAnimationFrame(() => { try { el.setSelectionRange(start, end); } catch {} });
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

/* ================= Utils ================= */
const deepClone = (obj) =>
  typeof structuredClone === "function" ? structuredClone(obj) : JSON.parse(JSON.stringify(obj ?? {}));
const clamp = (str = "", max = 100) => (str || "").toString().slice(0, max);
const makeIdFromTitle = (title, max = 24) => clamp((title || "").toString().trim(), max);
const ensureArray = (v) => (Array.isArray(v) ? v : []);
const pretty = (obj) => { try { return JSON.stringify(obj ?? {}, null, 2); } catch { return "{}"; } };

/* ================= Normalizadores ================= */
function normalizeInteractive(content) {
  // 🔧 guarda-chuva contra legado content.interactive
  const raw = (content && content.interactive) ? content.interactive : content;
  const base = typeof raw === "object" && raw ? raw : {};
  const type = base.type === "list" ? "list" : "button";

  const header = {
    type: base?.header?.type === "none" ? "none" : "text",
    text: base?.header?.text ?? ""
  };

  if (type === "list") {
    return {
      type: "list",
      header,
      body:   { text: base?.body?.text ?? "" },
      footer: { text: base?.footer?.text ?? "" },
      action: {
        button: base?.action?.button ?? "",
        sections: Array.isArray(base?.action?.sections) && base.action.sections.length
          ? base.action.sections.map((sec) => ({
              title: sec?.title ?? "",
              rows: Array.isArray(sec?.rows)
                ? sec.rows.map((r) => ({
                    id: r?.id ?? (r?.title ?? ""),
                    title: r?.title ?? "",
                    description: r?.description ?? "",
                  }))
                : [],
            }))
          : [{ title: "", rows: [] }],
      },
    };
  }

  return {
    type: "button",
    header,
    body:   { text: base?.body?.text ?? "" },
    footer: { text: base?.footer?.text ?? "" },
    action: {
      buttons: Array.isArray(base?.action?.buttons)
        ? base.action.buttons.map((b) => ({
            type: "reply",
            reply: {
              id: b?.reply?.id ?? b?.reply?.title ?? "",
              title: b?.reply?.title ?? "",
            },
          }))
        : [],
    },
  };
}

function normalizeMedia(content) {
  const m = typeof content === "object" && content ? content : {};
  return {
    mediaType: m.mediaType || m.type || "image",
    url: m.url || "",
    caption: m.caption || "",
  };
}

/* ================= Overlay header ================= */
function OverlayHeader({ title, onBack, onClose, right = null }) {
  return (
    <div className={styles.overlayHeader}>
      <button className={styles.backBtn} onClick={onBack} title="Voltar"><ArrowLeft size={18} /></button>
      <div className={styles.overlayTitle}>{title}</div>
      <div className={styles.buttonGroup}>
        {right}
        <button className={styles.iconGhost} onClick={onClose} title="Fechar"><X size={16} /></button>
      </div>
    </div>
  );
}

/* ================= OverlayAwait ================= */
function OverlayAwaitComp({ draft, setDraft, commit, onBack, onClose }) {
  return (
    <>
      <OverlayHeader
        title="Entrada do usuário"
        onBack={onBack}
        onClose={onClose}
        right={
          <button className={styles.addButtonSmall} onClick={commit}>
            <Check size={14}/> Salvar
          </button>
        }
      />
      <div className={styles.overlayBody} data-stop-hotkeys="true">
        <div className={styles.sectionContainer}>
          <div className={styles.sectionHeaderStatic}><h4 className={styles.sectionTitle}>Aguardar resposta</h4></div>
          <div className={styles.sectionContent}>
            <div className={styles.rowTwoCols}>
              <div className={styles.inputGroup}>
                <label className={styles.inputLabel}>Ativar</label>
                <select
                  value={String(!!draft.awaitResponse)}
                  onChange={(e) => setDraft((d) => ({ ...d, awaitResponse: e.target.value === "true" }))}
                  className={styles.selectStyle}
                >
                  <option value="true">true</option>
                  <option value="false">false</option>
                </select>
              </div>
              <div className={styles.inputGroup}>
                <label className={styles.inputLabel}>Atraso de envio (s)</label>
                <StableInput
                  type="number"
                  value={draft.sendDelayInSeconds}
                  onChange={(e) => setDraft((d) => ({ ...d, sendDelayInSeconds: e.target.value }))}
                />
              </div>
            </div>

            <div className={styles.rowTwoCols}>
              <div className={styles.inputGroup}>
                <label className={styles.inputLabel}>Tempo de inatividade (s)</label>
                <StableInput
                  type="number"
                  value={draft.awaitTimeInSeconds}
                  onChange={(e) => setDraft((d) => ({ ...d, awaitTimeInSeconds: e.target.value }))}
                />
                <small className={styles.helpText}>0 para desativar</small>
              </div>

              <div className={styles.inputGroup}>
                <label className={styles.inputLabel}>Salvar resposta do usuário em</label>
                <StableInput
                  type="text"
                  placeholder="ex.: context.inputMenuPrincipal"
                  value={draft.saveResponseVar}
                  onChange={(e) => setDraft((d) => ({ ...d, saveResponseVar: e.target.value }))}
                />
                <small className={styles.helpText}>Se vazio, não salva.</small>
              </div>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}

/* ================= OverlayConteudo ================= */
function OverlayConteudoComp({
  type,
  draft,
  setDraft,
  commit,
  onBack,
  onClose,
  selectedNode,
  setShowScriptEditor,
  setScriptCode,
  clampFn,
  makeIdFromTitleFn,
  inline = false,
  onPartialUpdate,
}) {
  const setContent = (patch) =>
    setDraft((d) => ({ ...d, content: { ...deepClone(d.content || {}), ...patch } }));

  useEffect(() => {
    if (type === "interactive") {
      setDraft((d) => ({ ...d, content: normalizeInteractive(d.content) }));
    } else if (type === "media") {
      setDraft((d) => ({ ...d, media: normalizeMedia(d.media) }));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const Body = (
    <div className={styles.overlayBody} data-stop-hotkeys="true">
      {(type === "text" || type === "error") && (
        <div className={styles.sectionContainer}>
          <div className={styles.sectionHeaderStatic}><h4 className={styles.sectionTitle}>Mensagem</h4></div>
          <div className={styles.sectionContent}>
            <StableTextarea
              rows={8}
              value={draft.text}
              onChange={(e) => {
                setDraft((d) => ({ ...d, text: e.target.value }));
                inline && onPartialUpdate?.({ content: e.target.value });
              }}
            />
          </div>
        </div>
      )}

      {type === "interactive" && (
        <div className={styles.sectionContainer}>
          <div className={styles.sectionHeaderStatic}><h4 className={styles.sectionTitle}>Interativo</h4></div>
          <div className={styles.sectionContent}>

            {/* HEADER */}
            <div className={styles.rowTwoCols}>
              <div className={styles.inputGroup}>
                <label className={styles.inputLabel}>Header (tipo)</label>
                <select
                  className={styles.selectStyle}
                  value={draft.content?.header?.type ?? "text"}
                  onChange={(e) => {
                    const header = { ...(deepClone(draft.content?.header) || {}), type: e.target.value };
                    const content = normalizeInteractive({ ...draft.content, header });
                    setContent({ header });
                    inline && onPartialUpdate?.({ content });
                  }}
                >
                  <option value="text">text</option>
                  <option value="none">none</option>
                </select>
              </div>
              <div className={styles.inputGroup}>
                <label className={styles.inputLabel}>Header (texto)</label>
                <StableInput
                  type="text"
                  value={draft.content?.header?.text || ""}
                  onChange={(e) => {
                    const header = { ...(deepClone(draft.content?.header) || { type: "text" }), text: e.target.value };
                    const content = normalizeInteractive({ ...draft.content, header });
                    setContent({ header });
                    inline && onPartialUpdate?.({ content });
                  }}
                />
              </div>
            </div>

            <div className={styles.inputGroup}>
              <label className={styles.inputLabel}>Corpo</label>
              <StableInput
                type="text"
                value={draft.content?.body?.text || ""}
                onChange={(e) => {
                  const body = { ...(deepClone(draft.content?.body) || {}), text: e.target.value };
                  const content = normalizeInteractive({ ...draft.content, body });
                  setContent({ body });
                  inline && onPartialUpdate?.({ content });
                }}
              />
            </div>

            <div className={styles.inputGroup}>
              <label className={styles.inputLabel}>Tipo</label>
              <select
                value={draft.content?.type || "button"}
                onChange={(e) => {
                  const newType = e.target.value;
                  let nextContent;
                  if (newType === "list") {
                    nextContent = normalizeInteractive({
                      type: "list",
                      header: { type: draft.content?.header?.type || "text", text: draft.content?.header?.text || "" },
                      body: { text: draft.content?.body?.text || "Escolha um item da lista:" },
                      footer: { text: draft.content?.footer?.text || "Toque para selecionar" },
                      action: { button: "Abrir lista", sections: [{ title: "Seção 1", rows: [{ id: "Item 1", title: "Item 1", description: "" }]}] }
                    });
                  } else {
                    nextContent = normalizeInteractive({
                      type: "button",
                      header: { type: draft.content?.header?.type || "text", text: draft.content?.header?.text || "" },
                      body: { text: draft.content?.body?.text || "Escolha uma opção:" },
                      footer: { text: draft.content?.footer?.text || "" },
                      action: {
                        buttons: [
                          { type: "reply", reply: { id: "Opção 1", title: "Opção 1" } },
                          { type: "reply", reply: { id: "Opção 2", title: "Opção 2" } },
                        ],
                      },
                    });
                  }
                  setDraft((d) => ({ ...d, content: nextContent }));
                  inline && onPartialUpdate?.({ content: nextContent });
                }}
                className={styles.selectStyle}
              >
                <option value="button">Quick Reply</option>
                <option value="list">Menu List</option>
              </select>
            </div>

            {draft.content?.type === "button" && (
              <>
                {(draft.content?.action?.buttons || []).map((btn, idx) => (
                  <div key={idx} className={styles.rowItemStyle}>
                    <StableInput
                      type="text"
                      value={btn?.reply?.title || ""}
                      maxLength={20}
                      placeholder="Texto do botão"
                      onChange={(e) => {
                        const value = clampFn(e.target.value, 20);
                        const buttons = deepClone(draft.content?.action?.buttons || []);
                        buttons[idx] = {
                          ...(buttons[idx] || { type: "reply", reply: { id: "", title: "" } }),
                          reply: { ...(buttons[idx]?.reply || {}), title: value, id: value },
                        };
                        const action = { ...(deepClone(draft.content?.action) || {}), buttons };
                        const content = normalizeInteractive({ ...deepClone(draft.content), action });
                        setDraft((d) => ({ ...d, content }));
                        inline && onPartialUpdate?.({ content });
                      }}
                    />
                    <Trash2
                      size={18}
                      className={styles.trashIcon}
                      onClick={() => {
                        const current = deepClone(draft.content?.action?.buttons || []);
                        current.splice(idx, 1);
                        const action = { ...(deepClone(draft.content?.action) || {}), buttons: current };
                        const content = normalizeInteractive({ ...deepClone(draft.content), action });
                        setDraft((d) => ({ ...d, content }));
                        inline && onPartialUpdate?.({ content });
                      }}
                      title="Remover botão"
                    />
                  </div>
                ))}
                <button
                  onClick={() => {
                    const current = deepClone(draft.content?.action?.buttons || []);
                    if (current.length >= 3) return;
                    const newBtn = { type: "reply", reply: { id: "Novo botão", title: "Novo botão" } };
                    const action = { ...(deepClone(draft.content?.action) || {}), buttons: [...current, newBtn] };
                    const content = normalizeInteractive({ ...deepClone(draft.content), action });
                    setDraft((d) => ({ ...d, content }));
                    inline && onPartialUpdate?.({ content });
                  }}
                  className={styles.addButton}
                >
                  + Adicionar botão
                </button>
              </>
            )}

            {draft.content?.type === "list" && (
              <>
                <div className={styles.inputGroup}>
                  <label className={styles.inputLabel}>Texto do botão (abrir lista)</label>
                  <StableInput
                    type="text"
                    maxLength={20}
                    value={draft.content?.action?.button || ""}
                    onChange={(e) => {
                      const nextVal = (e.target.value || "").slice(0, 20);
                      const action = {
                        ...(deepClone(draft.content?.action) || {}),
                        button: nextVal,
                        sections: deepClone(draft.content?.action?.sections || [{ title: "Seção 1", rows: [] }]),
                      };
                      const content = normalizeInteractive({ ...deepClone(draft.content), action });
                      setDraft((d) => ({ ...d, content }));
                      inline && onPartialUpdate?.({ content });
                    }}
                  />
                </div>

                {(draft.content?.action?.sections?.[0]?.rows || []).map((item, idx) => (
                  <div key={idx} className={styles.rowItemStyle}>
                    <StableInput
                      type="text"
                      value={item.title}
                      maxLength={24}
                      placeholder="Título"
                      onChange={(e) => {
                        const value = e.target.value;
                        const sections = deepClone(draft.content?.action?.sections || [{ title: "Seção 1", rows: [] }]);
                        const rows = [...(sections[0]?.rows || [])];
                        rows[idx] = { ...(rows[idx] || {}), title: clamp(value, 24), id: makeIdFromTitleFn(value, 24) };
                        sections[0] = { ...(sections[0] || {}), rows };
                        const action = { ...(deepClone(draft.content?.action) || {}), sections };
                        const content = normalizeInteractive({ ...deepClone(draft.content), action });
                        setDraft((d) => ({ ...d, content }));
                        inline && onPartialUpdate?.({ content });
                      }}
                    />
                    <StableInput
                      type="text"
                      value={item.description}
                      placeholder="Descrição"
                      onChange={(e) => {
                        const sections = deepClone(draft.content?.action?.sections || [{ title: "Seção 1", rows: [] }]);
                        const rows = [...(sections[0]?.rows || [])];
                        rows[idx] = { ...(rows[idx] || {}), description: e.target.value };
                        sections[0] = { ...(sections[0] || {}), rows };
                        const action = { ...(deepClone(draft.content?.action) || {}), sections };
                        const content = normalizeInteractive({ ...deepClone(draft.content), action });
                        setDraft((d) => ({ ...d, content }));
                        inline && onPartialUpdate?.({ content });
                      }}
                    />
                    <Trash2
                      size={18}
                      className={styles.trashIcon}
                      onClick={() => {
                        const sections = deepClone(draft.content?.action?.sections || [{ title: "", rows: [] }]);
                        const rows = [...(sections[0]?.rows || [])];
                        rows.splice(idx, 1);
                        sections[0] = { ...(sections[0] || {}), rows };
                        const action = { ...(deepClone(draft.content?.action) || {}), sections };
                        const content = normalizeInteractive({ ...deepClone(draft.content), action });
                        setDraft((d) => ({ ...d, content }));
                        inline && onPartialUpdate?.({ content });
                      }}
                      title="Remover item"
                    />
                  </div>
                ))}

                <button
                  onClick={() => {
                    const sections = deepClone(draft.content?.action?.sections || [{ title: "", rows: [] }]);
                    const rows = sections[0]?.rows || [];
                    const n = rows.length + 1;
                    const title = `Item ${n}`;
                    const newItem = { id: makeIdFromTitleFn(title, 24), title, description: "" };
                    const nextRows = [...rows, newItem];
                    const nextSections = [{ ...(sections[0] || {}), rows: nextRows }];
                    const action = { ...(deepClone(draft.content?.action) || {}), sections: nextSections };
                    const content = normalizeInteractive({ ...deepClone(draft.content), action });
                    setDraft((d) => ({ ...d, content }));
                    inline && onPartialUpdate?.({ content });
                  }}
                  className={styles.addButton}
                >
                  + Adicionar item
                </button>
              </>
            )}
          </div>
        </div>
      )}

      {type === "media" && (
        <div className={styles.sectionContainer}>
          <div className={styles.sectionHeaderStatic}><h4 className={styles.sectionTitle}>Mídia</h4></div>
          <div className={styles.sectionContent}>
            <div className={styles.inputGroup}>
              <label className={styles.inputLabel}>Tipo</label>
              <select
                value={draft.media?.mediaType || "image"}
                onChange={(e) => {
                  const media = { ...(draft.media || {}), mediaType: e.target.value };
                  setDraft((d)=>({ ...d, media }));
                  inline && onPartialUpdate?.({ content: normalizeMedia(media) });
                }}
                className={styles.selectStyle}
              >
                <option value="image">Imagem</option>
                <option value="document">Documento</option>
                <option value="audio">Áudio</option>
                <option value="video">Vídeo</option>
              </select>
            </div>
            <div className={styles.inputGroup}>
              <label className={styles.inputLabel}>URL</label>
              <StableInput
                type="text"
                value={draft.media?.url || ""}
                onChange={(e) => {
                  const media = { ...(draft.media || {}), url: e.target.value };
                  setDraft((d)=>({ ...d, media }));
                  inline && onPartialUpdate?.({ content: normalizeMedia(media) });
                }}
              />
            </div>
            <div className={styles.inputGroup}>
              <label className={styles.inputLabel}>Legenda</label>
              <StableInput
                type="text"
                value={draft.media?.caption || ""}
                onChange={(e) => {
                  const media = { ...(draft.media || {}), caption: e.target.value };
                  setDraft((d)=>({ ...d, media }));
                  inline && onPartialUpdate?.({ content: normalizeMedia(media) });
                }}
              />
            </div>
          </div>
        </div>
      )}

      {type === "location" && (
        <div className={styles.sectionContainer}>
          <div className={styles.sectionHeaderStatic}><h4 className={styles.sectionTitle}>Localização</h4></div>
          <div className={styles.sectionContent}>
            <div className={styles.inputGroup}><label className={styles.inputLabel}>Nome</label>
              <StableInput type="text" value={draft.location?.name || ""} onChange={(e) => {
                const location = { ...(draft.location||{}), name: e.target.value };
                setDraft((d)=>({ ...d, location })); inline && onPartialUpdate?.({ content: location });
              }}/></div>
            <div className={styles.inputGroup}><label className={styles.inputLabel}>Endereço</label>
              <StableInput type="text" value={draft.location?.address || ""} onChange={(e) => {
                const location = { ...(draft.location||{}), address: e.target.value };
                setDraft((d)=>({ ...d, location })); inline && onPartialUpdate?.({ content: location });
              }}/></div>
            <div className={styles.inputGroup}><label className={styles.inputLabel}>Latitude</label>
              <StableInput type="text" value={draft.location?.latitude || ""} onChange={(e) => {
                const location = { ...(draft.location||{}), latitude: e.target.value };
                setDraft((d)=>({ ...d, location })); inline && onPartialUpdate?.({ content: location });
              }}/></div>
            <div className={styles.inputGroup}><label className={styles.inputLabel}>Longitude</label>
              <StableInput type="text" value={draft.location?.longitude || ""} onChange={(e) => {
                const location = { ...(draft.location||{}), longitude: e.target.value };
                setDraft((d)=>({ ...d, location })); inline && onPartialUpdate?.({ content: location });
              }}/></div>
          </div>
        </div>
      )}

      {type === "script" && (
        <div className={styles.sectionContainer}>
          <div className={styles.sectionHeaderStatic}><h4 className={styles.sectionTitle}>Script</h4></div>
          <div className={styles.sectionContent}>
            <div className={styles.infoBox}><AlertCircle size={16} /><span>Este bloco executa código JavaScript personalizado.</span></div>

            <button
              onClick={() => {
                setScriptCode(selectedNode?.data?.block?.code || "");
                setShowScriptEditor(true);
              }}
              className={styles.addButton}
            >
              Abrir editor de código
            </button>

            <div className={styles.inputGroup}>
              <label className={styles.inputLabel}>Função</label>
              <StableInput
                type="text"
                value={draft.fnName}
                onChange={(e) => {
                  setDraft((d) => ({ ...d, fnName: e.target.value }));
                  inline && onPartialUpdate?.({ function: e.target.value });
                }}
                placeholder="Nome da função a ser executada"
              />
            </div>

            <div className={styles.inputGroup}>
              <label className={styles.inputLabel}>Variável de saída</label>
              <StableInput
                type="text"
                value={draft.outputVar}
                onChange={(e) => {
                  setDraft((d) => ({ ...d, outputVar: e.target.value }));
                  inline && onPartialUpdate?.({ outputVar: e.target.value });
                }}
                placeholder="ex.: context.resultadoScript"
              />
              <small className={styles.helpText}>Onde o resultado será salvo (opcional)</small>
            </div>
          </div>
        </div>
      )}

      {type === "api_call" && (
        <div className={styles.sectionContainer}>
          <div className={styles.sectionHeaderStatic}><h4 className={styles.sectionTitle}>Requisição HTTP</h4></div>
          <div className={styles.sectionContent}>
            <div className={styles.infoBox}><AlertCircle size={16} /><span>Este bloco faz chamadas HTTP para APIs externas.</span></div>

            <div className={styles.inputGroup}>
              <label className={styles.inputLabel}>Método</label>
              <select
                value={draft.api.method}
                onChange={(e) => {
                  setDraft((d)=>({ ...d, api:{...d.api, method: e.target.value || "GET"} }));
                  inline && onPartialUpdate?.({ method: e.target.value || "GET" });
                }}
                className={styles.selectStyle}
              >
                <option>GET</option><option>POST</option><option>PUT</option><option>DELETE</option><option>PATCH</option>
              </select>
            </div>

            <div className={styles.inputGroup}>
              <label className={styles.inputLabel}>URL</label>
              <StableInput
                type="text"
                value={draft.api.url}
                onChange={(e) => {
                  setDraft((d)=>({ ...d, api:{...d.api, url: e.target.value} }));
                  inline && onPartialUpdate?.({ url: e.target.value });
                }}
                placeholder="https://api.exemplo.com/endpoint"
              />
            </div>

            <div className={styles.inputGroup}>
              <label className={styles.inputLabel}>Headers (JSON)</label>
              <StableTextarea
                rows={3}
                value={draft.api.headersText}
                onChange={(e) => setDraft((d)=>({ ...d, api:{...d.api, headersText: e.target.value} }))}
                onBlur={(e) => {
                  try {
                    const parsed = JSON.parse(e.target.value || "{}");
                    setDraft((d)=>({ ...d, api:{...d.api, headers: parsed, headersText: JSON.stringify(parsed, null, 2)} }));
                    inline && onPartialUpdate?.({ headers: parsed });
                  } catch {}
                }}
                placeholder='{"Content-Type": "application/json", "Authorization": "Bearer token"}'
              />
            </div>

            <div className={styles.inputGroup}>
              <label className={styles.inputLabel}>Body (JSON)</label>
              <StableTextarea
                rows={4}
                value={draft.api.bodyText}
                onChange={(e) => setDraft((d)=>({ ...d, api:{...d.api, bodyText: e.target.value} }))}
                onBlur={(e) => {
                  try {
                    const parsed = JSON.parse(e.target.value || "{}");
                    setDraft((d)=>({ ...d, api:{...d.api, body: parsed, bodyText: JSON.stringify(parsed, null, 2)} }));
                    inline && onPartialUpdate?.({ body: parsed });
                  } catch {}
                }}
                placeholder='{"param1": "valor1", "param2": "valor2"}'
              />
            </div>

            <div className={styles.rowTwoCols}>
              <div className={styles.inputGroup}>
                <label className={styles.inputLabel}>Timeout (ms)</label>
                <StableInput
                  type="number"
                  value={draft.api.timeout}
                  onChange={(e) => {
                    setDraft((d)=>({ ...d, api:{...d.api, timeout: e.target.value} }));
                    inline && onPartialUpdate?.({ timeout: parseInt(e.target.value || 0, 10) });
                  }}
                />
              </div>
              <div className={styles.inputGroup}>
                <label className={styles.inputLabel}>Variável de saída</label>
                <StableInput
                  type="text"
                  value={draft.api.outputVar}
                  onChange={(e) => {
                    setDraft((d)=>({ ...d, api:{...d.api, outputVar: e.target.value} }));
                    inline && onPartialUpdate?.({ outputVar: e.target.value });
                  }}
                  placeholder="ex.: context.apiResponse"
                />
              </div>
              <div className={styles.inputGroup}>
                <label className={styles.inputLabel}>Variável de status</label>
                <StableInput
                  type="text"
                  value={draft.api.statusVar}
                  onChange={(e) => {
                    setDraft((d)=>({ ...d, api:{...d.api, statusVar: e.target.value} }));
                    inline && onPartialUpdate?.({ statusVar: e.target.value });
                  }}
                  placeholder="ex.: context.apiStatus"
                />
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );

  if (inline) return Body;

  return (
    <>
      <OverlayHeader
        title="Conteúdo"
        onBack={onBack}
        onClose={onClose}
        right={<button className={styles.addButtonSmall} onClick={commit}><Check size={14}/> Salvar</button>}
      />
      {Body}
    </>
  );
}

/* ================= OverlayRegras ================= */
/* ================= OverlayRegras ================= */
function OverlayRegrasComp({
  draft,
  setDraft,
  variableOptions,
  allNodes,
  selectedNode,
  onConnectNodes,
  onBack,
  onClose,
  commit,
  isHuman = false,
}) {
  const updateActionsLocal = (next) => setDraft((r) => ({ ...r, actions: deepClone(next) }));

  const addOffhoursAction = (kind) => {
    let conds = [];
    if (kind === "offhours_true") conds = [{ variable: "offhours", type: "equals", value: "true" }];
    else if (kind === "reason_holiday") conds = [{ variable: "offhours_reason", type: "equals", value: "holiday" }];
    else if (kind === "reason_closed") conds = [{ variable: "offhours_reason", type: "equals", value: "closed" }];
    const next = [...(draft.actions || []), { next: "", conditions: conds }];
    updateActionsLocal(next);
  };

  const renderValueInput = (cond, onChangeValue) => {
    if (cond.type === "exists") return null;
    if (cond.variable === "offhours") {
      return (
        <div className={styles.inputGroup}>
          <label className={styles.inputLabel}>Valor</label>
          <select className={styles.selectStyle} value={cond.value ?? "true"} onChange={(e) => onChangeValue(e.target.value)}>
            <option value="true">true</option>
            <option value="false">false</option>
          </select>
        </div>
      );
    }
    if (cond.variable === "offhours_reason") {
      return (
        <div className={styles.inputGroup}>
          <label className={styles.inputLabel}>Valor</label>
          <select className={styles.selectStyle} value={cond.value ?? "holiday"} onChange={(e) => onChangeValue(e.target.value)}>
            <option value="holiday">holiday</option>
            <option value="closed">closed</option>
          </select>
        </div>
      );
    }
    return (
      <div className={styles.inputGroup}>
        <label className={styles.inputLabel}>Valor</label>
        <StableInput
          type="text"
          placeholder="Valor para comparação"
          value={cond.value ?? ""}
          onChange={(e) => onChangeValue(e.target.value)}
        />
      </div>
    );
  };

  return (
    <>
      <OverlayHeader
        title="Regras de saída"
        onBack={onBack}
        onClose={onClose}
        right={
          <button className={styles.addButtonSmall} onClick={commit}>
            <Check size={14}/> Salvar
          </button>
        }
      />
      <div className={styles.overlayBody} data-stop-hotkeys="true">
        <div className={styles.sectionContainer}>
          <div className={styles.sectionHeaderStatic}>
            <h4 className={styles.sectionTitle}>Regras</h4>
            <span className={styles.sectionCount}>({draft.actions.length}/25)</span>
          </div>
          <div className={styles.sectionContent}>

            {isHuman && (
              <div className={styles.buttonGroup} style={{ marginBottom: 8 }}>
                <button className={styles.addButtonSmall} onClick={() => addOffhoursAction("offhours_true")}>+ Se offhours = true</button>
                <button className={styles.addButtonSmall} onClick={() => addOffhoursAction("reason_holiday")}>+ Se motivo = holiday</button>
                <button className={styles.addButtonSmall} onClick={() => addOffhoursAction("reason_closed")}>+ Se motivo = closed</button>
              </div>
            )}

            {draft.actions.map((action, actionIdx) => (
              <React.Fragment key={actionIdx}>
                {actionIdx > 0 && (
                  <div className={styles.dividerContainer}>
                    <div className={styles.dividerLine}></div>
                    <span className={styles.dividerText}>OU</span>
                  </div>
                )}

                <div className={styles.actionBox}>
                  <div className={styles.actionHeader}>
                    <strong className={styles.actionTitle}>Regra {actionIdx + 1}</strong>
                    <Trash2
                      size={16}
                      className={styles.trashIcon}
                      onClick={() => {
                        const updated = deepClone(draft.actions);
                        updated.splice(actionIdx, 1);
                        updateActionsLocal(updated);
                      }}
                    />
                  </div>

                  {(action.conditions || []).map((cond, condIdx) => (
                    <div key={condIdx} className={styles.conditionRow}>
                      <div className={styles.inputGroup}>
                        <label className={styles.inputLabel}>Variável</label>
                        <select
                          value={
                            variableOptions.some((v) => v.value === cond.variable)
                              ? cond.variable
                              : cond.variable
                              ? "custom"
                              : "lastUserMessage"
                          }
                          onChange={(e) => {
                            const nextVar = e.target.value;
                            const updated = deepClone(draft.actions);
                            if (nextVar === "custom") {
                              updated[actionIdx].conditions[condIdx].variable = "";
                            } else {
                              updated[actionIdx].conditions[condIdx].variable = nextVar;
                              if (!updated[actionIdx].conditions[condIdx].type) {
                                updated[actionIdx].conditions[condIdx].type = "equals";
                              }
                              if (nextVar === "offhours") {
                                updated[actionIdx].conditions[condIdx].value = "true";
                              } else if (nextVar === "offhours_reason") {
                                updated[actionIdx].conditions[condIdx].value = "closed";
                              }
                            }
                            updateActionsLocal(updated);
                          }}
                          className={styles.selectStyle}
                        >
                          {variableOptions.map((opt) => (
                            <option key={opt.value} value={opt.value}>{opt.label}</option>
                          ))}
                        </select>
                      </div>

                      {(!variableOptions.some((v) => v.value === cond.variable) || cond.variable === "") && (
                        <div className={styles.inputGroup}>
                          <label className={styles.inputLabel}>Nome da variável</label>
                          <StableInput
                            type="text"
                            placeholder="ex.: meuCampo"
                            value={cond.variable || ""}
                            onChange={(e) => {
                              const updated = deepClone(draft.actions);
                              updated[actionIdx].conditions[condIdx].variable = e.target.value;
                              updateActionsLocal(updated);
                            }}
                          />
                        </div>
                      )}

                      <div className={styles.inputGroup}>
                        <label className={styles.inputLabel}>Tipo de condição</label>
                        <select
                          value={cond.type || ""}
                          onChange={(e) => {
                            const updated = deepClone(draft.actions);
                            updated[actionIdx].conditions[condIdx].type = e.target.value;
                            if (e.target.value === "exists") {
                              updated[actionIdx].conditions[condIdx].value = "";
                            }
                            updateActionsLocal(updated);
                          }}
                          className={styles.selectStyle}
                        >
                          <option value="">Selecione...</option>
                          <option value="exists">Existe</option>
                          <option value="equals">Igual a</option>
                          <option value="not_equals">Diferente de</option>
                          <option value="contains">Contém</option>
                          <option value="not_contains">Não contém</option>
                          <option value="starts_with">Começa com</option>
                          <option value="ends_with">Termina com</option>
                        </select>
                      </div>

                      {renderValueInput(cond, (v) => {
                        const updated = deepClone(draft.actions);
                        updated[actionIdx].conditions[condIdx].value = v;
                        updateActionsLocal(updated);
                      })}

                      <div className={styles.buttonGroup}>
                        <button
                          className={styles.deleteButtonSmall}
                          onClick={() => {
                            const updated = deepClone(draft.actions);
                            updated[actionIdx].conditions.splice(condIdx, 1);
                            updateActionsLocal(updated);
                          }}
                        >
                          <Trash2 size={14} /> Remover condição
                        </button>
                      </div>
                    </div>
                  ))}

                  <div className={styles.inputGroup}>
                    <label className={styles.inputLabel}>Ir para</label>
                    <select
                      value={action.next || ""}
                      onChange={(e) => {
                        const targetId = e.target.value;
                        const updated = deepClone(draft.actions);
                        updated[actionIdx].next = targetId;
                        updateActionsLocal(updated);
                        if (onConnectNodes && targetId) {
                          onConnectNodes({ source: selectedNode.id, target: targetId });
                        }
                      }}
                      className={styles.selectStyle}
                    >
                      <option value="">Selecione um bloco...</option>
                      {allNodes
                        .filter((n) => n.id !== selectedNode.id)
                        .map((node) => (
                          <option key={node.id} value={node.id}>
                            {node.data.label || node.id}
                          </option>
                        ))}
                    </select>
                  </div>
                </div>
              </React.Fragment>
            ))}

            <div className={styles.buttonGroup}>
              <button
                onClick={() => {
                  const newAction = {
                    next: "",
                    conditions: [{ variable: "lastUserMessage", type: "exists", value: "" }],
                  };
                  updateActionsLocal([...(draft.actions || []), newAction]);
                }}
                className={styles.addButton}
              >
                <Plus size={16} /> Adicionar regra
              </button>
            </div>

            <div className={styles.sectionContainer} style={{ marginTop: 12 }}>
              <div className={styles.sectionHeaderStatic}>
                <h4 className={styles.sectionTitle}>Saída padrão</h4>
              </div>
              <div className={styles.sectionContent}>
                <div className={styles.inputGroup}>
                  <label className={styles.inputLabel}>Próximo bloco</label>
                  <select
                    value={draft.defaultNext || ""}
                    onChange={(e) => setDraft((r) => ({ ...r, defaultNext: e.target.value }))}
                    className={styles.selectStyle}
                  >
                    <option value="">Selecione um bloco...</option>
                    {allNodes
                      .filter((n) => n.id !== selectedNode.id)
                      .map((node) => (
                        <option key={node.id} value={node.id}>
                          {node.data.label || node.id}
                        </option>
                      ))}
                  </select>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div> 
    </>
  );
}

/* ================= Especiais ================= */
function SpecialList({ title, section, items, onNew, onEdit, onRemove }) {
  return (
    <div className={styles.sectionContainer}>
      <div className={styles.sectionHeaderStatic}>
        <h4 className={styles.sectionTitle}>{title}</h4>
        <button className={styles.addButtonSmall} onClick={() => onNew(section)}>
          + Nova variável
        </button>
      </div>

      <div className={styles.sectionContent}>
        {!items?.length && (
          <div className={styles.emptyHint}>
            Nenhuma variável ainda. Clique em <strong>Nova variável</strong> para adicionar.
          </div>
        )}

        {items?.map((a, i) => (
          <div key={`${section}-${i}`} className={styles.specialListRow}>
            <div className={styles.rowMain}>
              <div className={styles.rowTitle}>{a.label}</div>
              <div className={styles.rowMeta}>
                <span className={styles.pill}>{a.scope || "context"}</span>
                <span className={styles.metaSep}>•</span>
                <span className={styles.mono}>{a.key || "-"}</span>
                <span className={styles.metaArrow}>→</span>
                <span className={styles.monoTrunc} title={String(a.value ?? "")}>
                  {String(a.value ?? "") || "—"}
                </span>
                {a?.conditions?.length ? (
                  <>
                    <span className={styles.metaSep}>•</span>
                    <span className={styles.pillLight}>{a.conditions.length} condição(ões)</span>
                  </>
                ) : null}
              </div>
            </div>

            <div className={styles.rowActions}>
              <button className={styles.iconGhost} title="Editar" onClick={() => onEdit(section, i)}>
                <PencilLine size={16} />
              </button>
              <button className={styles.iconGhost} title="Remover" onClick={() => onRemove(section, i)}>
                <Trash2 size={16} />
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function EditorOverlay({
  open,
  setOpen,
  draft,
  setDraft,
  mode,
  section,
  save,
  cancel,
  variableOptions,
}) {
  const addCond = () =>
    setDraft((d) => ({ ...d, conditions: [...(d.conditions || []), { variable: "lastUserMessage", type: "exists", value: "" }] }));
  const updateCond = (idx, patch) => {
    const next = deepClone(draft.conditions || []);
    next[idx] = { ...next[idx], ...patch };
    setDraft((d) => ({ ...d, conditions: next }));
  };
  const removeCond = (idx) => {
    const next = deepClone(draft.conditions || []);
    next.splice(idx, 1);
    setDraft((d) => ({ ...d, conditions: next }));
  };

  return (
    <div className={`${styles.subOverlay} ${open ? styles.subOverlayOpen : ""}`} data-stop-hotkeys="true">
      <div className={styles.subOverlayHeader}>
        <button className={styles.backBtn} onClick={() => { setOpen(false); cancel(); }} title="Voltar">
          <ArrowLeft size={18} />
        </button>
        <div className={styles.overlayTitle}>
          {mode === "edit" ? "Editar variável" : "Nova variável"}
          <span className={styles.pillLight} style={{ marginLeft: 8 }}>
            {section === "enter" ? "Ao entrar" : "Ao sair"}
          </span>
        </div>
        <div className={styles.buttonGroup}>
          <button className={styles.deleteButtonSmall} onClick={() => { setOpen(false); cancel(); }}>
            <X size={14}/> Cancelar
          </button>
          <button className={styles.addButtonSmall} onClick={() => { save(); setOpen(false); }}>
            <Check size={14}/> Salvar
          </button>
        </div>
      </div>

      <div className={styles.subOverlayBody}>
        <div className={styles.inputGroup}>
          <label className={styles.inputLabel}>Título *</label>
          <StableInput
            placeholder="Como aparece na lista"
            value={draft.label}
            onChange={(e) => setDraft((d)=>({ ...d, label: e.target.value }))}
          />
        </div>

        <div className={styles.inputGroup}>
          <label className={styles.inputLabel}>Escopo</label>
          <select
            className={styles.selectStyle}
            value={draft.scope || "context"}
            onChange={(e) => setDraft((d)=>({ ...d, scope: e.target.value || "context" }))}
          >
            <option value="context">context</option>
            <option value="contact">contact</option>
            <option value="contact.extra">contact.extra</option>
          </select>
        </div>

        <div className={styles.inputGroup}>
          <label className={styles.inputLabel}>Chave *</label>
          <StableInput
            placeholder="ex.: protocolo"
            value={draft.key}
            onChange={(e) => setDraft((d)=>({ ...d, key: e.target.value }))}
          />
        </div>

        <div className={styles.inputGroup}>
          <label className={styles.inputLabel}>Valor</label>
          <StableInput
            placeholder='ex.: 12345 ou {{context.algo}}'
            value={draft.value}
            onChange={(e) => setDraft((d)=>({ ...d, value: e.target.value }))}
          />
        </div>

        <div className={styles.sectionContainer} style={{ marginTop: 12 }}>
          <div className={styles.sectionHeaderStatic}>
            <h4 className={styles.sectionTitle}>Condições (opcional)</h4>
            <button className={styles.addButtonSmall} onClick={addCond}>+ Adicionar condição</button>
          </div>
          <div className={styles.sectionContent}>
            {!(draft.conditions || []).length && (
              <div className={styles.emptyHint}>
                Se adicionar condições, a variável só será definida quando <strong>todas</strong> forem satisfeitas.
              </div>
            )}

            {(draft.conditions || []).map((cond, idx) => (
              <div key={idx} className={styles.specialCondRow}>
                <div className={styles.inputGroup}>
                  <label className={styles.inputLabel}>Variável</label>
                  <select
                    className={styles.selectStyle}
                    value={
                      variableOptions.some((v) => v.value === cond.variable)
                        ? cond.variable
                        : cond.variable
                        ? "custom"
                        : "lastUserMessage"
                    }
                    onChange={(e) => {
                      const v = e.target.value;
                      if (v === "custom") updateCond(idx, { variable: "" });
                      else {
                        const patch = { variable: v };
                        if (!cond.type) patch.type = "equals";
                        if (v === "offhours") patch.value = "true";
                        if (v === "offhours_reason") patch.value = "closed";
                        updateCond(idx, patch);
                      }
                    }}
                  >
                    {variableOptions.map((opt) => (
                      <option key={opt.value} value={opt.value}>{opt.label}</option>
                    ))}
                  </select>
                </div>

                {(!variableOptions.some((v) => v.value === cond.variable) || cond.variable === "") && (
                  <div className={styles.inputGroup}>
                    <label className={styles.inputLabel}>Nome</label>
                    <StableInput
                      placeholder="ex.: meuCampo"
                      value={cond.variable || ""}
                      onChange={(e) => updateCond(idx, { variable: e.target.value })}
                    />
                  </div>
                )}

                <div className={styles.inputGroup}>
                  <label className={styles.inputLabel}>Tipo</label>
                  <select
                    className={styles.selectStyle}
                    value={cond.type || ""}
                    onChange={(e) => {
                      const v = e.target.value;
                      const patch = { type: v || "" };
                      if (v === "exists") patch.value = "";
                      updateCond(idx, patch);
                    }}
                  >
                    <option value="">Selecione...</option>
                    <option value="exists">Existe</option>
                    <option value="equals">Igual a</option>
                    <option value="not_equals">Diferente de</option>
                    <option value="contains">Contém</option>
                    <option value="not_contains">Não contém</option>
                    <option value="starts_with">Começa com</option>
                    <option value="ends_with">Termina com</option>
                  </select>
                </div>

                {cond.type !== "exists" && (
                  <div className={styles.inputGroup}>
                    <label className={styles.inputLabel}>Valor</label>
                    {cond.variable === "offhours" ? (
                      <select
                        className={styles.selectStyle}
                        value={cond.value ?? "true"}
                        onChange={(e)=>updateCond(idx,{value:e.target.value})}
                      >
                        <option value="true">true</option>
                        <option value="false">false</option>
                      </select>
                    ) : cond.variable === "offhours_reason" ? (
                      <select
                        className={styles.selectStyle}
                        value={cond.value ?? "holiday"}
                        onChange={(e)=>updateCond(idx,{value:e.target.value})}
                      >
                        <option value="holiday">holiday</option>
                        <option value="closed">closed</option>
                      </select>
                    ) : (
                      <StableInput
                        placeholder="Valor para comparação"
                        value={cond.value ?? ""}
                        onChange={(e) => updateCond(idx, { value: e.target.value })}
                      />
                    )}
                  </div>
                )}

                <div className={styles.buttonGroup}>
                  <button className={styles.deleteButtonSmall} onClick={() => removeCond(idx)}>
                    <Trash2 size={14}/> Remover
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

function OverlayEspeciaisComp({
  onBack,
  onClose,
  onChangeNode,
  selectedNode,
  block,
  variableOptions,
  showToast,
}) {
  const { onEnter = [], onExit = [] } = block || {};
  const [editorOpen, setEditorOpen] = React.useState(false);
  const [editing, setEditing] = React.useState({
    mode: "create",
    section: "enter",
    index: -1,
    draft: { label: "", scope: "context", key: "", value: "", conditions: [] },
  });

  const ensureArray = (v) => (Array.isArray(v) ? v : []);
  const deepClone = (obj) =>
    typeof structuredClone === "function" ? structuredClone(obj) : JSON.parse(JSON.stringify(obj ?? {}));

  const resetEditing = () =>
    setEditing({
      mode: "create",
      section: "enter",
      index: -1,
      draft: { label: "", scope: "context", key: "", value: "", conditions: [] },
    });

  const startCreate = (section) => {
    resetEditing();
    setEditing((s) => ({ ...s, section, mode: "create" }));
    setEditorOpen(true);
  };

  const startEdit = (section, index) => {
    const list = section === "enter" ? ensureArray(onEnter) : ensureArray(onExit);
    const item = deepClone(list[index] || {});
    setEditing({
      mode: "edit",
      section,
      index,
      draft: {
        label: item.label || "",
        scope: item.scope || "context",
        key: item.key || "",
        value: item.value ?? "",
        conditions: ensureArray(item.conditions || []),
      },
    });
    setEditorOpen(true);
  };

  const removeItem = (section, index) => {
    const list = section === "enter" ? ensureArray(onEnter).slice() : ensureArray(onExit).slice();
    list.splice(index, 1);
    if (section === "enter") {
      onChangeNode({ onEnter: list });
    } else {
      onChangeNode({ onExit: list });
    }
    showToast?.("success", "Variável removida.");
  };

  const validateDraft = (d) => {
    if (!d.label?.trim()) { showToast?.("error", "Informe o título da variável."); return false; }
    if (!d.key?.trim())   { showToast?.("error", "Informe a chave da variável."); return false; }
    for (let i = 0; i < (d.conditions || []).length; i++) {
      const c = d.conditions[i];
      if (c.variable === undefined) { showToast?.("error", `Condição ${i + 1}: selecione a variável.`); return false; }
      if (!c.type) { showToast?.("error", `Condição ${i + 1}: selecione o tipo.`); return false; }
      if (c.type !== "exists" && (c.value === undefined || c.value === null)) {
        showToast?.("error", `Condição ${i + 1}: informe o valor.`); return false;
      }
    }
    return true;
  };

  const saveEditing = () => {
    const { section, index, mode, draft } = editing;
    if (!validateDraft(draft)) return;

    const list = section === "enter" ? ensureArray(onEnter).slice() : ensureArray(onExit).slice();
    const clean = {
      label: draft.label.trim(),
      scope: draft.scope || "context",
      key: draft.key.trim(),
      value: draft.value ?? "",
      ...(draft.conditions && draft.conditions.length ? { conditions: draft.conditions } : {}),
    };

    if (mode === "create") list.push(clean);
    else list[index] = { ...list[index], ...clean };

    if (section === "enter") onChangeNode({ onEnter: list });
    else onChangeNode({ onExit: list });

    setEditorOpen(false);
    resetEditing();
    showToast?.("success", "Variável salva com sucesso.");
  };

  return (
    <>
      <OverlayHeader title="Ações especiais" onBack={onBack} onClose={onClose} />

      <div className={styles.overlayBody} data-stop-hotkeys="true">
        <SpecialList
          title="Ao entrar no bloco"
          section="enter"
          items={ensureArray(onEnter)}
          onNew={startCreate}
          onEdit={startEdit}
          onRemove={removeItem}
        />
        <SpecialList
          title="Ao sair do bloco"
          section="exit"
          items={ensureArray(onExit)}
          onNew={startCreate}
          onEdit={startEdit}
          onRemove={removeItem}
        />
      </div>

      <EditorOverlay
        open={editorOpen}
        setOpen={setEditorOpen}
        draft={editing.draft}
        setDraft={(d) => setEditing((s) => ({ ...s, draft: typeof d === "function" ? d(s.draft) : d }))}
        mode={editing.mode}
        section={editing.section}
        save={saveEditing}
        cancel={() => setEditing((s) => ({ ...s, draft: { label: "", scope: "context", key: "", value: "", conditions: [] } }))}
        variableOptions={variableOptions}
      />
    </>
  );
}


/* ================= Preview ================= */
function RenderBlockPreview({ type, blockContent, conteudoDraft, overlayMode }) {
  const liveContent =
    overlayMode === "conteudo"
      ? (conteudoDraft?.content ?? (typeof conteudoDraft?.text === "string" ? { body: { text: conteudoDraft.text } } : {}))
      : blockContent;

  if (type === "text" || type === "error") {
    const text = typeof liveContent === "string"
      ? liveContent
      : (liveContent?.text || liveContent?.body?.text || "");
    return <TextMessage content={text} />;
  }

  if (type === "interactive") {
    const safe = normalizeInteractive(liveContent);
    return safe.type === "list"
      ? <InteractiveListMessage data={safe} />
      : <QuickReplyMessage data={safe} />;
  }

  if (type === "media") {
    const m = normalizeMedia(liveContent);
    if (m.mediaType === "image")    return <ImageMessage url={m.url} caption={m.caption} />;
    if (m.mediaType === "document") return <DocumentMessage url={m.url} caption={m.caption} />;
    if (m.mediaType === "audio")    return <AudioMessage url={m.url} />;
    if (m.mediaType === "video")    return <VideoMessage url={m.url} caption={m.caption} />;
    return <TextMessage content="(mídia não suportada)" />;
  }

  if (type === "contacts") return <ContactsMessage data={liveContent || {}} />;

  if (type === "location") {
    const loc = liveContent || {};
    const txt = `${loc?.name || "Local"} — ${loc?.address || ""}`;
    return <TextMessage content={txt} />;
  }

  if (type === "api_call") {
    const method = conteudoDraft?.api?.method || "GET";
    const url = conteudoDraft?.api?.url || "URL não definida";
    return <TextMessage content={`🌐 ${method} ${url}`} />;
  }

  if (type === "human") return <TextMessage content="👤 Este é um bloco de atendimento humano." />;

  const fallback = typeof liveContent === "string"
    ? liveContent
    : (liveContent?.text || liveContent?.body?.text || "");
  return <TextMessage content={fallback} />;
}

/* ================= Painel Principal ================= */
// A partir daqui, mantenha seu NodeConfigPanel completo como no seu projeto.
// As únicas mudanças reais neste arquivo foram:
// 1) `normalizeInteractive` agora desembrulha `content.interactive`.
// 2) Pontos onde `normalizeInteractive(...)` é chamado para garantir consistência.



export default function NodeConfigPanel({
  selectedNode,
  onChange,
  onClose,
  allNodes = [],
  onConnectNodes,
  setShowScriptEditor,
  setScriptCode,
}) {
  if (!selectedNode || !selectedNode.data) return null;

  const [overlayMode, setOverlayMode] = useState("none");
  const panelRef = useRef(null);

  // toasts
  const [toasts, setToasts] = useState([]);
  const showToast = (type, text, ttl = 2600) => {
    const id = Math.random().toString(36).slice(2);
    setToasts((t) => [...t, { id, type, text }]);
    setTimeout(() => setToasts((t) => t.filter((x) => x.id !== id)), ttl);
  };

  const block = selectedNode.data.block || {};
  const {
    type,
    content = {},
    awaitResponse,
    awaitTimeInSeconds,
    sendDelayInSeconds,
    actions = [],
    method,
    url,
    headers,
    body,
    timeout,
    outputVar,
    statusVar,
    function: fnName,
    saveResponseVar,
    defaultNext,
  } = block;

  const isHuman = type === "human";
  const isScript = type === "script";
  const isScriptOrApi = isScript || type === "api_call";
  const isStart = selectedNode?.data?.nodeType === "start";

  const isEditableTarget = (el) => {
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
  const handleKeyDownCapture = useCallback((e) => {
    if (!panelRef.current || !panelRef.current.contains(e.target)) return;
    if (isEditableTarget(e.target)) e.stopPropagation();
  }, []);

  const variableOptions = useMemo(() => (
    isHuman
      ? [
          { value: "lastUserMessage", label: "Resposta do usuário" },
          { value: "offhours", label: "Fora do expediente" },
          { value: "offhours_reason", label: "Motivo do off-hours" },
          { value: "custom", label: "Variável personalizada" },
        ]
      : [
          { value: "lastUserMessage", label: "Resposta do usuário" },
          { value: "custom", label: "Variável personalizada" },
        ]
  ), [isHuman]);

  /* drafts */
  const [awaitDraft, setAwaitDraft] = useState({
    awaitResponse: !!awaitResponse,
    awaitTimeInSeconds: awaitTimeInSeconds ?? 0,
    sendDelayInSeconds: sendDelayInSeconds ?? 0,
    saveResponseVar: saveResponseVar || "",
  });

  const [conteudoDraft, setConteudoDraft] = useState({
    type,
    text: typeof block.content === "string" ? block.content : "",
    content: deepClone(content),
    fnName: fnName || "",
    outputVar: outputVar || "",
    api: {
      method: method || "GET",
      url: url || "",
      headers: deepClone(headers || {}),
      body: deepClone(body || {}),
      timeout: timeout ?? 10000,
      outputVar: outputVar || "apiResponse",
      statusVar: statusVar || "apiStatus",
      headersText: pretty(headers || {}),
      bodyText: pretty(body || {}),
    },
    media: deepClone(content),
    location: deepClone(content),
  });

  // sincroniza drafts ao mudar bloco
  useEffect(() => {
    setConteudoDraft({
      type,
      text: typeof block.content === "string" ? block.content : "",
      content: deepClone(content),
      fnName: fnName || "",
      outputVar: outputVar || "",
      api: {
        method: method || "GET",
        url: url || "",
        headers: deepClone(headers || {}),
        body: deepClone(body || {}),
        timeout: timeout ?? 10000,
        outputVar: outputVar || "apiResponse",
        statusVar: statusVar || "apiStatus",
        headersText: pretty(headers || {}),
        bodyText: pretty(body || {}),
      },
      media: deepClone(content),
      location: deepClone(content),
    });
  }, [type, block.content, content, fnName, outputVar, method, url, headers, body, timeout, statusVar]);

  useEffect(() => {
    if (overlayMode === "await") {
      setAwaitDraft({
        awaitResponse: !!awaitResponse,
        awaitTimeInSeconds: awaitTimeInSeconds ?? 0,
        sendDelayInSeconds: sendDelayInSeconds ?? 0,
        saveResponseVar: saveResponseVar || "",
      });
    }
  }, [overlayMode, awaitResponse, awaitTimeInSeconds, sendDelayInSeconds, saveResponseVar]);

  /* commits */
  const updateBlock = (changes) =>
    onChange({ ...selectedNode, data: { ...selectedNode.data, block: { ...block, ...changes } } });

  const commitAwait = () => {
    updateBlock({
      awaitResponse: !!awaitDraft.awaitResponse,
      awaitTimeInSeconds: parseInt(awaitDraft.awaitTimeInSeconds || 0, 10),
      sendDelayInSeconds: parseInt(awaitDraft.sendDelayInSeconds || 0, 10),
      saveResponseVar: awaitDraft.saveResponseVar || "",
    });
    showToast("success", "Configurações de entrada salvas.");
  };

  const commitConteudo = () => {
    const d = conteudoDraft;
    const next = deepClone(block);

    if (type === "text" || type === "error") next.content = d.text || "";
    if (type === "interactive") next.content = deepClone(normalizeInteractive(d.content || {}));
    if (type === "media") next.content = deepClone(normalizeMedia(d.media || {}));
    if (type === "location") next.content = deepClone(d.location || {});
    if (type === "script") {
      next.function = d.fnName || "";
      next.outputVar = d.outputVar || "";
      delete next.text; delete next.content; delete next.media; delete next.location;
    }
    if (type === "api_call") {
      next.method = d.api.method || "GET";
      next.url = d.api.url || "";
      next.headers = deepClone(d.api.headers || {});
      next.body = deepClone(d.api.body || {});
      next.timeout = parseInt(d.api.timeout || 10000, 10);
      next.outputVar = d.api.outputVar || "apiResponse";
      next.statusVar = d.api.statusVar || "apiStatus";
      delete next.text; delete next.content; delete next.media; delete next.location;
    }

    updateBlock(next);
    showToast("success", "Conteúdo salvo.");
  };

  const commitRegras = (v) => {
    updateBlock({
      actions: deepClone(v.actions || []),
      defaultNext: v.defaultNext || "",
    });
    showToast("success", "Regras salvas.");
  };

  const openOverlay = (mode = "conteudo") => setOverlayMode(mode);
  const closeOverlay = () => setOverlayMode("none");

  /* preview — oculto para script/api_call */

const ChatPreview = () => {
  // não mostrar preview para start, script e api_call
  if (isStart || isScriptOrApi) return null;

  return (
    <div className={styles.chatPreviewCard}>
      <div className={styles.floatingBtns}>
        {/* NÃO mostrar o lápis no bloco de atendimento humano */}
        {!isHuman && (
          <button className={styles.iconGhost} title="Editar conteúdo" onClick={() => openOverlay("conteudo")}>
            <PencilLine size={16} />
          </button>
        )}

        <button className={styles.iconGhost} title="Regras de saída" onClick={() => openOverlay("regras")}>
          <MoreHorizontal size={16} />
        </button>

        {/* nada de especiais para humano e start */}
        {!isHuman && !isStart && (
          <button className={styles.iconGhost} title="Ações especiais" onClick={() => openOverlay("especiais")}>
            <SlidersHorizontal size={16} />
          </button>
        )}
      </div>

      <div className={styles.chatArea}>
        <div className={styles.typingDot}>•••</div>
        <div className={styles.bubble}>
          <div className={styles.bubbleText}>
            <RenderBlockPreview
              type={type}
              blockContent={block.content}
              conteudoDraft={conteudoDraft}
              overlayMode={overlayMode}
            />
          </div>
        </div>

        {!isHuman && (
          <button
            type="button"
            className={styles.userInputChip}
            onClick={() => openOverlay("await")}
            title="Configurar aguardar resposta"
          >
            Entrada do usuário
            <span className={styles.caret} />
          </button>
        )}
      </div>
    </div>
  );
};


  /* render */
  return (
    <aside
      ref={panelRef}
      className={styles.asidePanel}
      data-stop-hotkeys="true"
      onKeyDownCapture={handleKeyDownCapture}
    >
      {/* toasts */}
      <div className={styles.toastStack}>
        {toasts.map((t) => (
          <div key={t.id} className={`${styles.toast} ${styles[`toast_${t.type}`]}`}>
            {t.type === "error" ? <AlertCircle size={16}/> : <Check size={16}/>}
            <span>{t.text}</span>
          </div>
        ))}
      </div>

      <div className={styles.panelHeader}>
        <h3 className={styles.panelTitle}>
          {selectedNode.data.type === "human" ? "atendimento humano" : (selectedNode.data.label || "Novo Bloco")}
        </h3>
        <button onClick={onClose} className={styles.closeButton} title="Fechar">
          <X size={20} />
        </button>
      </div>

      <div className={styles.tabContent}>
        <div className={styles.inputGroup}>
          <label className={styles.inputLabel}>Nome do Bloco</label>
          {selectedNode.data.nodeType === "start" ? (
            <div className={styles.startNodeInfo}>
              Este é o <strong>bloco inicial</strong> do fluxo. Ele é fixo, com redirecionamento automático para o próximo bloco configurado.
            </div>
          ) : selectedNode.data.type === "human" ? (
            <StableInput type="text" value="atendimento humano" readOnly />
          ) : (
            <StableInput
              type="text"
              value={selectedNode.data.label}
              onChange={(e) => onChange({ ...selectedNode, data: { ...selectedNode.data, label: e.target.value } })}
              placeholder="Nomeie este bloco"
            />
          )}
        </div>

        {/* Botão Regras de saída para SCRIPT e API_CALL */}
        {(isStart || isScriptOrApi) && (
          <div className={styles.buttonGroup} style={{ marginBottom: 8 }}>
            <button className={styles.addButtonSmall} onClick={() => openOverlay("regras")}>
              <MoreHorizontal size={14}/> Regras de saída
            </button>
          </div>
        )}


        {/* Preview escondido para script/api_call */}
        <ChatPreview />

        {/* Editores inline (sem cabeçalho Conteúdo / sem Salvar) */}
        {isScriptOrApi && (
          <div style={{ marginTop: 12 }}>
            <OverlayConteudoComp
              type={type}
              draft={conteudoDraft}
              setDraft={(updater) =>
                setConteudoDraft((prev) => (typeof updater === "function" ? updater(prev) : updater))
              }
              inline
              onPartialUpdate={(patch) => updateBlock(patch)}
              selectedNode={selectedNode}
              setShowScriptEditor={setShowScriptEditor}
              setScriptCode={setScriptCode}
              clampFn={clamp}
              makeIdFromTitleFn={makeIdFromTitle}
            />
          </div>
        )}
      </div>

      {/* Overlays */}
      <div className={`${styles.overlay} ${overlayMode !== "none" ? styles.overlayOpen : ""}`}>
        {overlayMode === "await" && (
          <OverlayAwaitComp
            draft={awaitDraft}
            setDraft={setAwaitDraft}
            commit={commitAwait}
            onBack={closeOverlay}
            onClose={closeOverlay}
          />
        )}
        {overlayMode === "conteudo" && !isScriptOrApi && (
          <OverlayConteudoComp
            type={type}
            draft={conteudoDraft}
            setDraft={(updater) =>
              setConteudoDraft((prev) => (typeof updater === "function" ? updater(prev) : updater))
            }
            commit={() => {
              commitConteudo();
              closeOverlay();
            }}
            onBack={closeOverlay}
            onClose={closeOverlay}
            selectedNode={selectedNode}
            setShowScriptEditor={setShowScriptEditor}
            setScriptCode={setScriptCode}
            clampFn={clamp}
            makeIdFromTitleFn={makeIdFromTitle}
          />
        )}
        {overlayMode === "regras" && (
          <OverlayRegrasComp
            draft={{ actions: deepClone(block.actions || []), defaultNext: block.defaultNext || "" }}
            setDraft={(d) => {
              const base = { actions: deepClone(block.actions || []), defaultNext: block.defaultNext || "" };
              const v = typeof d === "function" ? d(base) : d;
              onChange({ ...selectedNode, data: { ...selectedNode.data, block: { ...block, actions: v.actions, defaultNext: v.defaultNext } } });
            }}
            variableOptions={variableOptions}
            allNodes={allNodes}
            selectedNode={selectedNode}
            onConnectNodes={onConnectNodes}
            onBack={closeOverlay}
            onClose={closeOverlay}
            commit={() => { commitRegras({ actions: selectedNode.data.block.actions, defaultNext: selectedNode.data.block.defaultNext }); closeOverlay(); }}
            isHuman={isHuman}
          />
        )}
        {overlayMode === "especiais" && (
          <OverlayEspeciaisComp
            onBack={closeOverlay}
            onClose={closeOverlay}
            onChangeNode={(patch) => updateBlock(patch)}
            selectedNode={selectedNode}
            block={block}
            variableOptions={variableOptions}
            showToast={showToast}
          />
        )}
      </div>
    </aside>
  );
}








