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

/** ======= IMPORTS DOS MESSAGE TYPES (ajuste os caminhos se necessário) ======= */
import TextMessage from "../../../atendimento/components/chat/messageTypes/TextMessage";
import QuickReplyMessage from "../../../atendimento/components/chat/messageTypes/QuickReplyMessage";
import InteractiveListMessage from "../../../atendimento/components/chat/messageTypes/ListMessage";
import ImageMessage from "../../../atendimento/components/chat/messageTypes/ImageMessage";
import DocumentMessage from "../../../atendimento/components/chat/messageTypes/DocumentMessage";
import AudioMessage from "../../../atendimento/components/chat/messageTypes/AudioMessage";
import VideoMessage from "../../../atendimento/components/chat/messageTypes/VideoMessage";
import ContactsMessage from "../../../atendimento/components/chat/messageTypes/ContactsMessage";

/* ================= Inputs estáveis ================= */
function useStableCaret() {
  const sel = useRef({ start: null, end: null });
  const onBeforeChange = (el) => {
    if (!el) return;
    try {
      sel.current.start = el.selectionStart;
      sel.current.end = el.selectionEnd;
    } catch {}
  };
  const restore = (el) => {
    if (!el) return;
    const { start, end } = sel.current || {};
    if (start == null || end == null) return;
    requestAnimationFrame(() => {
      try { el.setSelectionRange(start, end); } catch {}
    });
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

/* ================= Overlay header ================= */
function OverlayHeader({ title, onBack, onClose, right = null }) {
  return (
    <div className={styles.overlayHeader}>
      <button className={styles.backBtn} onClick={onBack} title="Voltar">
        <ArrowLeft size={18} />
      </button>
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
          <div className={styles.sectionHeaderStatic}>
            <h4 className={styles.sectionTitle}>Aguardar resposta</h4>
          </div>
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
}) {
  const setContent = (patch) =>
    setDraft((d) => ({ ...d, content: { ...deepClone(d.content || {}), ...patch } }));

  // helpers LIST
  const getListHeader = () => deepClone(draft.content?.header) || { type: "text", text: "" };
  const getListAction = () =>
    deepClone(draft.content?.action) || { button: "Abrir lista", sections: [{ title: "Seção 1", rows: [] }] };

  // contadores/limites
  const CharHelp = ({ value = "", limit }) => (
    <small className={styles.helpText}>{value?.length || 0}/{limit}</small>
  );
  const LIMITS = {
    body: 1024,
    footer: 60,
    headerText: 60,
    listButton: 20,
    rowTitle: 24,
    rowDesc: 72,
    qrButton: 20,
    listMaxRows: 10,
    qrMaxButtons: 3,
  };

  return (
    <>
      <OverlayHeader
        title="Conteúdo"
        onBack={onBack}
        onClose={onClose}
        right={
          <button className={styles.addButtonSmall} onClick={commit}>
            <Check size={14}/> Salvar
          </button>
        }
      />

      <div className={styles.overlayBody} data-stop-hotkeys="true">

        {/* ========= TEXT ========= */}
        {type === "text" && (
          <div className={styles.sectionContainer}>
            <div className={styles.sectionHeaderStatic}><h4 className={styles.sectionTitle}>Mensagem</h4></div>
            <div className={styles.sectionContent}>
              <StableTextarea
                rows={8}
                value={draft.text}
                maxLength={LIMITS.body}
                onChange={(e) => setDraft((d) => ({ ...d, text: e.target.value?.slice(0, LIMITS.body) }))}
              />
              <CharHelp value={draft.text} limit={LIMITS.body} />
            </div>
          </div>
        )}

        {/* ========= INTERACTIVE ========= */}
        {type === "interactive" && (
          <div className={styles.sectionContainer}>
            <div className={styles.sectionHeaderStatic}><h4 className={styles.sectionTitle}>Interativo</h4></div>
            <div className={styles.sectionContent}>
              <div className={styles.inputGroup}>
                <label className={styles.inputLabel}>Tipo</label>
                <select
                  value={draft.content?.type || "button"}
                  onChange={(e) => {
                    const newType = e.target.value;
                    if (newType === "list") {
                      setDraft((d) => ({
                        ...d,
                        content: deepClone({
                          type: "list",
                          body: { text: "Escolha um item da lista:" },
                          footer: { text: "Toque para selecionar" },
                          header: { type: "text", text: "🎯 Menu de Opções" },
                          action: {
                            button: "Abrir lista",
                            sections: [{ title: "Seção 1", rows: [{ id: "item_1", title: "Item 1", description: "" }]}]
                          }
                        }),
                      }));
                    } else {
                      setDraft((d) => ({
                        ...d,
                        content: deepClone({
                          type: "button",
                          body: { text: "Escolha uma opção:" },
                          footer: { text: "" },
                          action: {
                            buttons: [
                              { type: "reply", reply: { id: "Opção 1", title: "Opção 1" } },
                              { type: "reply", reply: { id: "Opção 2", title: "Opção 2" } },
                            ],
                          },
                        }),
                      }));
                    }
                  }}
                  className={styles.selectStyle}
                >
                  <option value="button">Quick Reply</option>
                  <option value="list">Menu List</option>
                </select>
              </div>

              {/* BODY */}
              <div className={styles.inputGroup}>
                <label className={styles.inputLabel}>Corpo</label>
                <StableInput
                  type="text"
                  value={draft.content?.body?.text || ""}
                  maxLength={LIMITS.body}
                  onChange={(e) => {
                    const body = { ...(deepClone(draft.content?.body) || {}), text: e.target.value?.slice(0, LIMITS.body) };
                    setContent({ body });
                  }}
                />
                <CharHelp value={draft.content?.body?.text} limit={LIMITS.body} />
              </div>

              {/* FOOTER (comum) */}
              <div className={styles.inputGroup}>
                <label className={styles.inputLabel}>Rodapé (opcional)</label>
                <StableInput
                  type="text"
                  value={draft.content?.footer?.text || ""}
                  maxLength={LIMITS.footer}
                  onChange={(e) => {
                    const footer = { ...(deepClone(draft.content?.footer) || {}), text: e.target.value?.slice(0, LIMITS.footer) };
                    setContent({ footer });
                  }}
                />
                <CharHelp value={draft.content?.footer?.text} limit={LIMITS.footer} />
              </div>

              {/* ====== QUICK REPLY ====== */}
              {draft.content?.type === "button" && (
                <>
                  {(draft.content?.action?.buttons || []).map((btn, idx) => (
                    <div key={idx} className={styles.rowItemStyle}>
                      <div className={styles.inputGroup} style={{ flex: 1 }}>
                        <label className={styles.inputLabel}>Botão {idx + 1}</label>
                        <StableInput
                          type="text"
                          value={btn?.reply?.title || ""}
                          maxLength={LIMITS.qrButton}
                          placeholder="Texto do botão"
                          onChange={(e) => {
                            const value = (e.target.value || "").slice(0, LIMITS.qrButton);
                            const buttons = deepClone(draft.content?.action?.buttons || []);
                            buttons[idx] = {
                              ...(buttons[idx] || { type: "reply", reply: { id: "", title: "" } }),
                              reply: { ...(buttons[idx]?.reply || {}), title: value, id: value },
                            };
                            const action = { ...(deepClone(draft.content?.action) || {}), buttons };
                            setDraft((d) => ({ ...d, content: { ...deepClone(d.content), action } }));
                          }}
                        />
                        <CharHelp value={btn?.reply?.title || ""} limit={LIMITS.qrButton} />
                      </div>
                      <Trash2
                        size={18}
                        className={styles.trashIcon}
                        onClick={() => {
                          const current = deepClone(draft.content?.action?.buttons || []);
                          current.splice(idx, 1);
                          const action = { ...(deepClone(draft.content?.action) || {}), buttons: current };
                          setDraft((d) => ({ ...d, content: { ...deepClone(d.content), action } }));
                        }}
                        title="Remover botão"
                      />
                    </div>
                  ))}

                  <div className={styles.buttonGroup}>
                    <button
                      onClick={() => {
                        const current = deepClone(draft.content?.action?.buttons || []);
                        if (current.length >= LIMITS.qrMaxButtons) return;
                        const newBtn = { type: "reply", reply: { id: "Novo botão", title: "Novo botão" } };
                        const action = { ...(deepClone(draft.content?.action) || {}), buttons: [...current, newBtn] };
                        setDraft((d) => ({ ...d, content: { ...deepClone(d.content), action } }));
                      }}
                      className={styles.addButton}
                      disabled={(draft.content?.action?.buttons || []).length >= LIMITS.qrMaxButtons}
                    >
                      + Adicionar botão ({(draft.content?.action?.buttons || []).length}/{LIMITS.qrMaxButtons})
                    </button>
                  </div>
                </>
              )}

              {/* ====== MENU LIST ====== */}
              {draft.content?.type === "list" && (
                <>
                  {/* HEADER EDITÁVEL */}
                  <div className={styles.rowTwoCols}>
                    <div className={styles.inputGroup}>
                      <label className={styles.inputLabel}>Header — tipo</label>
                      <select
                        className={styles.selectStyle}
                        value={getListHeader().type || "text"}
                        onChange={(e) => {
                          const header = { ...getListHeader(), type: e.target.value || "text" };
                          setContent({ header });
                        }}
                      >
                        <option value="text">text</option>
                        <option value="">(sem header)</option>
                      </select>
                      <small className={styles.helpText}>Recomendado: “text”</small>
                    </div>

                    <div className={styles.inputGroup}>
                      <label className={styles.inputLabel}>Header — texto</label>
                      <StableInput
                        type="text"
                        value={getListHeader().text || ""}
                        maxLength={LIMITS.headerText}
                        onChange={(e) => {
                          const header = { ...getListHeader(), text: (e.target.value || "").slice(0, LIMITS.headerText) };
                          setContent({ header });
                        }}
                        placeholder="ex.: 🎯 Menu de Opções"
                      />
                      <CharHelp value={getListHeader().text || ""} limit={LIMITS.headerText} />
                    </div>
                  </div>

                  {/* BOTÃO ABRIR LISTA */}
                  <div className={styles.inputGroup}>
                    <label className={styles.inputLabel}>Texto do botão (abrir lista)</label>
                    <StableInput
                      type="text"
                      maxLength={LIMITS.listButton}
                      value={getListAction().button || ""}
                      onChange={(e) => {
                        const nextVal = (e.target.value || "").slice(0, LIMITS.listButton);
                        const action = { ...getListAction(), button: nextVal };
                        setContent({ action });
                      }}
                    />
                    <CharHelp value={getListAction().button || ""} limit={LIMITS.listButton} />
                  </div>

                  {/* SEÇÕES/ROWS */}
                  {((getListAction().sections?.[0]?.rows) || []).map((item, idx) => (
                    <div key={idx} className={styles.rowItemStyle}>
                      <div className={styles.inputGroup} style={{ flex: 1 }}>
                        <label className={styles.inputLabel}>Opção do menu (título)</label>
                        <StableInput
                          type="text"
                          value={item.title}
                          maxLength={LIMITS.rowTitle}
                          placeholder="Ex.: Agendamento"
                          onChange={(e) => {
                            const value = (e.target.value || "").slice(0, LIMITS.rowTitle);
                            const action = getListAction();
                            const sections = deepClone(action.sections || [{ title: "Seção 1", rows: [] }]);
                            const rows = [...(sections[0]?.rows || [])];
                            rows[idx] = { ...(rows[idx] || {}), title: value, id: makeIdFromTitleFn(value, LIMITS.rowTitle) };
                            sections[0] = { ...(sections[0] || {}), rows };
                            setContent({ action: { ...action, sections } });
                          }}
                        />
                        <CharHelp value={item.title || ""} limit={LIMITS.rowTitle} />
                      </div>

                      <div className={styles.inputGroup} style={{ flex: 1 }}>
                        <label className={styles.inputLabel}>Descrição (opcional)</label>
                        <StableInput
                          type="text"
                          value={item.description}
                          maxLength={LIMITS.rowDesc}
                          placeholder="Texto explicativo mostrado abaixo da opção"
                          onChange={(e) => {
                            const action = getListAction();
                            const sections = deepClone(action.sections || [{ title: "Seção 1", rows: [] }]);
                            const rows = [...(sections[0]?.rows || [])];
                            rows[idx] = { ...(rows[idx] || {}), description: (e.target.value || "").slice(0, LIMITS.rowDesc) };
                            sections[0] = { ...(sections[0] || {}), rows };
                            setContent({ action: { ...action, sections } });
                          }}
                        />
                        <CharHelp value={item.description || ""} limit={LIMITS.rowDesc} />
                      </div>

                      <Trash2
                        size={18}
                        className={styles.trashIcon}
                        onClick={() => {
                          const action = getListAction();
                          const sections = deepClone(action.sections || [{ title: "", rows: [] }]);
                          const rows = [...(sections[0]?.rows || [])];
                          rows.splice(idx, 1);
                          sections[0] = { ...(sections[0] || {}), rows };
                          setContent({ action: { ...action, sections } });
                        }}
                        title="Remover item"
                      />
                    </div>
                  ))}

                  <div className={styles.buttonGroup}>
                    <button
                      onClick={() => {
                        const action = getListAction();
                        const sections = deepClone(action.sections || [{ title: "", rows: [] }]);
                        const rows = sections[0]?.rows || [];
                        if (rows.length >= LIMITS.listMaxRows) return;
                        const n = rows.length + 1;
                        const title = `Item ${n}`;
                        const newItem = { id: makeIdFromTitleFn(title, LIMITS.rowTitle), title, description: "" };
                        const nextRows = [...rows, newItem];
                        const nextSections = [{ ...(sections[0] || {}), rows: nextRows }];
                        setContent({ action: { ...action, sections: nextSections } });
                      }}
                      className={styles.addButton}
                      disabled={(getListAction().sections?.[0]?.rows?.length || 0) >= LIMITS.listMaxRows}
                    >
                      + Adicionar item ({(getListAction().sections?.[0]?.rows?.length || 0)}/{LIMITS.listMaxRows})
                    </button>
                  </div>
                </>
              )}
            </div>
          </div>
        )}

        {/* ========= MEDIA ========= */}
        {type === "media" && (
          <div className={styles.sectionContainer}>
            <div className={styles.sectionHeaderStatic}><h4 className={styles.sectionTitle}>Mídia</h4></div>
            <div className={styles.sectionContent}>
              <div className={styles.inputGroup}>
                <label className={styles.inputLabel}>Tipo</label>
                <select
                  value={draft.media?.mediaType || "image"}
                  onChange={(e) => setDraft((d) => ({ ...d, media: { ...(d.media||{}), mediaType: e.target.value } }))}
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
                  onChange={(e) => setDraft((d) => ({ ...d, media: { ...(d.media||{}), url: e.target.value } }))}
                />
              </div>
              <div className={styles.inputGroup}>
                <label className={styles.inputLabel}>Legenda</label>
                <StableInput
                  type="text"
                  value={draft.media?.caption || ""}
                  maxLength={LIMITS.footer}
                  onChange={(e) => setDraft((d) => ({ ...d, media: { ...(d.media||{}), caption: e.target.value?.slice(0, LIMITS.footer) } }))}
                />
                <CharHelp value={draft.media?.caption || ""} limit={LIMITS.footer} />
              </div>
            </div>
          </div>
        )}

        {/* ========= LOCATION ========= */}
        {type === "location" && (
          <div className={styles.sectionContainer}>
            <div className={styles.sectionHeaderStatic}><h4 className={styles.sectionTitle}>Localização</h4></div>
            <div className={styles.sectionContent}>
              <div className={styles.inputGroup}><label className={styles.inputLabel}>Nome</label>
                <StableInput type="text" value={draft.location?.name || ""} onChange={(e) => setDraft((d) => ({ ...d, location: { ...(d.location||{}), name: e.target.value } }))}/></div>
              <div className={styles.inputGroup}><label className={styles.inputLabel}>Endereço</label>
                <StableInput type="text" value={draft.location?.address || ""} onChange={(e) => setDraft((d) => ({ ...d, location: { ...(d.location||{}), address: e.target.value } }))}/></div>
              <div className={styles.inputGroup}><label className={styles.inputLabel}>Latitude</label>
                <StableInput type="text" value={draft.location?.latitude || ""} onChange={(e) => setDraft((d) => ({ ...d, location: { ...(d.location||{}), latitude: e.target.value } }))}/></div>
              <div className={styles.inputGroup}><label className={styles.inputLabel}>Longitude</label>
                <StableInput type="text" value={draft.location?.longitude || ""} onChange={(e) => setDraft((d) => ({ ...d, location: { ...(d.location||{}), longitude: e.target.value } }))}/></div>
            </div>
          </div>
        )}

        {/* ========= SCRIPT ========= */}
        {type === "script" && (
          <div className={styles.sectionContainer}>
            <div className={styles.sectionHeaderStatic}><h4 className={styles.sectionTitle}>Script</h4></div>
            <div className={styles.sectionContent}>
              <button
                onClick={() => {
                  const code = selectedNode?.data?.block?.code || "";
                  if (typeof setScriptCode === "function" && typeof setShowScriptEditor === "function") {
                    setScriptCode(code);
                    setShowScriptEditor(true);
                  } else {
                    // feedback caso o pai não tenha injetado handlers
                    alert("Editor de código não foi inicializado no componente pai.");
                  }
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
                  onChange={(e) => setDraft((d) => ({ ...d, fnName: e.target.value }))}
                />
              </div>

              <div className={styles.inputGroup}>
                <label className={styles.inputLabel}>Variável de saída</label>
                <StableInput
                  type="text"
                  value={draft.outputVar}
                  onChange={(e) => setDraft((d) => ({ ...d, outputVar: e.target.value }))}
                />
              </div>
            </div>
          </div>
        )}

        {/* ========= API ========= */}
        {type === "api_call" && (
          <div className={styles.sectionContainer}>
            <div className={styles.sectionHeaderStatic}><h4 className={styles.sectionTitle}>Requisição HTTP</h4></div>
            <div className={styles.sectionContent}>
              <div className={styles.inputGroup}>
                <label className={styles.inputLabel}>Método</label>
                <select
                  value={draft.api.method}
                  onChange={(e) => setDraft((d)=>({ ...d, api:{...d.api, method: e.target.value || "GET"} }))}
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
                  onChange={(e) => setDraft((d)=>({ ...d, api:{...d.api, url: e.target.value} }))}
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
                    } catch {}
                  }}
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
                    } catch {}
                  }}
                />
              </div>

              <div className={styles.rowTwoCols}>
                <div className={styles.inputGroup}>
                  <label className={styles.inputLabel}>Timeout (ms)</label>
                  <StableInput
                    type="number"
                    value={draft.api.timeout}
                    onChange={(e) => setDraft((d)=>({ ...d, api:{...d.api, timeout: e.target.value} }))}
                  />
                </div>
                <div className={styles.inputGroup}>
                  <label className={styles.inputLabel}>Variável de saída</label>
                  <StableInput
                    type="text"
                    value={draft.api.outputVar}
                    onChange={(e) => setDraft((d)=>({ ...d, api:{...d.api, outputVar: e.target.value} }))}
                  />
                </div>
                <div className={styles.inputGroup}>
                  <label className={styles.inputLabel}>Variável de status</label>
                  <StableInput
                    type="text"
                    value={draft.api.statusVar}
                    onChange={(e) => setDraft((d)=>({ ...d, api:{...d.api, statusVar: e.target.value} }))}
                  />
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </>
  );
}

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
            <div className={styles.buttonGroup} style={{ marginBottom: 8 }}>
              <button className={styles.addButtonSmall} onClick={() => addOffhoursAction("offhours_true")}>+ Se offhours = true</button>
              <button className={styles.addButtonSmall} onClick={() => addOffhoursAction("reason_holiday")}>+ Se motivo = holiday</button>
              <button className={styles.addButtonSmall} onClick={() => addOffhoursAction("reason_closed")}>+ Se motivo = closed</button>
            </div>

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

/* ================= Painel principal ================= */
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

  // toasts simples
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
  useEffect(() => {
    setAwaitDraft({
      awaitResponse: !!awaitResponse,
      awaitTimeInSeconds: awaitTimeInSeconds ?? 0,
      sendDelayInSeconds: sendDelayInSeconds ?? 0,
      saveResponseVar: saveResponseVar || "",
    });
  }, [awaitResponse, awaitTimeInSeconds, sendDelayInSeconds, saveResponseVar]);

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

  // mantém o draft sincronizado quando o bloco muda
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

  const [regrasDraft, setRegrasDraft] = useState({
    actions: deepClone(block.actions || []),
    defaultNext: defaultNext || "",
  });
  useEffect(() => {
    setRegrasDraft({ actions: deepClone(block.actions || []), defaultNext: defaultNext || "" });
  }, [block.actions, defaultNext]);

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

    if (type === "text") next.content = d.text || "";
    if (type === "interactive") next.content = deepClone(d.content || {});
    if (type === "media") next.content = deepClone(d.media || {});
    if (type === "location") next.content = deepClone(d.location || {});
    if (type === "script") {
      next.function = d.fnName || "";
      next.outputVar = d.outputVar || "";
    }
    if (type === "api_call") {
      next.method = d.api.method || "GET";
      next.url = d.api.url || "";
      next.headers = deepClone(d.api.headers || {});
      next.body = deepClone(d.api.body || {});
      next.timeout = parseInt(d.api.timeout || 10000, 10);
      next.outputVar = d.api.outputVar || "apiResponse";
      next.statusVar = d.api.statusVar || "apiStatus";
    }

    updateBlock(next);
    showToast("success", "Conteúdo salvo.");
  };

  const commitRegras = () => {
    updateBlock({
      actions: deepClone(regrasDraft.actions || []),
      defaultNext: regrasDraft.defaultNext || "",
    });
    showToast("success", "Regras salvas.");
  };

  const openOverlay = (mode = "conteudo") => setOverlayMode(mode);
  const closeOverlay = () => setOverlayMode("none");

  /* preview source */
  const previewType = overlayMode === "conteudo" ? conteudoDraft.type : type;
  const previewContent =
    overlayMode === "conteudo" ? (conteudoDraft.content ?? {}) : (content ?? {});
  const previewText =
    overlayMode === "conteudo" ? conteudoDraft.text : (typeof block.content === "string" ? block.content : "");
  const previewMedia =
    overlayMode === "conteudo" ? (conteudoDraft.media ?? {}) : (typeof content === "object" ? content : {});
  const previewLocation =
    overlayMode === "conteudo" ? (conteudoDraft.location ?? {}) : (typeof content === "object" ? content : {});

  /* preview */
  const ChatPreview = () => (
    <div className={styles.chatPreviewCard}>
      <div className={styles.floatingBtns}>
        <button className={styles.iconGhost} title="Editar conteúdo" onClick={() => openOverlay("conteudo")}>
          <PencilLine size={16} />
        </button>
        <button className={styles.iconGhost} title="Regras de saída" onClick={() => openOverlay("regras")}>
          <MoreHorizontal size={16} />
        </button>
        <button className={styles.iconGhost} title="Ações especiais" onClick={() => openOverlay("especiais")}>
          <SlidersHorizontal size={16} />
        </button>
      </div>

      <div className={styles.chatArea}>
        <div className={styles.typingDot}>•••</div>

        <div className={styles.bubble}>
          <div className={styles.bubbleText}>
            {previewType === "text" && (
              <TextMessage content={previewText} />
            )}

            {previewType === "interactive" && (
              previewContent?.type === "button" ? (
                <QuickReplyMessage data={previewContent} />
              ) : (
                <InteractiveListMessage listData={previewContent} />
              )
            )}

            {previewType === "media" && (() => {
              const t = (previewMedia?.mediaType || "image").toLowerCase();
              if (t === "image") return <ImageMessage data={previewMedia} />;
              if (t === "document") return <DocumentMessage data={previewMedia} />;
              if (t === "audio") return <AudioMessage data={previewMedia} />;
              if (t === "video") return <VideoMessage data={previewMedia} />;
              return <ImageMessage data={previewMedia} />;
            })()}

            {previewType === "location" && (
              <div style={{ fontSize: 14 }}>
                <strong>{previewLocation?.name || "Local"}</strong><br />
                <small>{previewLocation?.address || "Endereço"}</small>
              </div>
            )}

            {previewType === "human" && (
              <div style={{ fontSize: 14 }}>
                Encaminhando para atendimento humano…
              </div>
            )}

            {previewType === "api_call" && (
              <div style={{ fontSize: 14 }}>
                <strong>HTTP {conteudoDraft.api?.method || "GET"}</strong>
                <div>{conteudoDraft.api?.url || "— URL —"}</div>
              </div>
            )}

            {previewType === "script" && (
              <div style={{ fontSize: 14 }}>
                <strong>Função:</strong> {conteudoDraft.fnName || "—"}
              </div>
            )}
          </div>
        </div>

        <button
          type="button"
          className={styles.userInputChip}
          onClick={() => openOverlay("await")}
          title="Configurar aguardar resposta"
        >
          Entrada do usuário
          <span className={styles.caret} />
        </button>
      </div>
    </div>
  );

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

        <ChatPreview />
      </div>

      {/* Overlay principal */}
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
        {overlayMode === "conteudo" && (
          <OverlayConteudoComp
            type={conteudoDraft.type}
            draft={conteudoDraft}
            setDraft={(updater) =>
              setConteudoDraft((prev) => (typeof updater === "function" ? updater(prev) : updater))
            }
            commit={() => {
              // valida JSON antes do commit
              let ok = true;
              try { JSON.parse(conteudoDraft.api.headersText || "{}"); }
              catch { ok = false; showToast("error","Headers inválidos (JSON)."); }
              try { JSON.parse(conteudoDraft.api.bodyText || "{}"); }
              catch { ok = false; showToast("error","Body inválido (JSON)."); }
              if (!ok) return;
              // sincroniza textos parseados
              const parsedHeaders = (() => { try { return JSON.parse(conteudoDraft.api.headersText || "{}"); } catch { return conteudoDraft.api.headers; }})();
              const parsedBody = (() => { try { return JSON.parse(conteudoDraft.api.bodyText || "{}"); } catch { return conteudoDraft.api.body; }})();
              setConteudoDraft((d) => ({ ...d, api: { ...d.api, headers: parsedHeaders, body: parsedBody }}));
              commitConteudo();
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
            draft={regrasDraft}
            setDraft={setRegrasDraft}
            variableOptions={variableOptions}
            allNodes={allNodes}
            selectedNode={selectedNode}
            onConnectNodes={onConnectNodes}
            onBack={closeOverlay}
            onClose={closeOverlay}
            commit={commitRegras}
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
