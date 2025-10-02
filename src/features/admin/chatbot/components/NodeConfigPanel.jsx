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

/* ----------------- UI helpers ----------------- */

// ComboBox leve via <input list>
function ComboBox({ id, options = [], value, onChange, placeholder, className, onBlur }) {
  const listId = `${id || "cb"}-list`;
  return (
    <>
      <input
        list={listId}
        className={`${styles.inputStyle} ${className || ""}`}
        value={value ?? ""}
        placeholder={placeholder}
        onChange={(e) => onChange?.(e.target.value)}
        onBlur={onBlur}
      />
      <datalist id={listId}>
        {options.map((opt) =>
          typeof opt === "string" ? (
            <option key={opt} value={opt} />
          ) : (
            <option key={opt.value} value={opt.value} label={opt.label} />
          )
        )}
      </datalist>
    </>
  );
}

// util
const deepClone = (obj) =>
  typeof structuredClone === "function" ? structuredClone(obj) : JSON.parse(JSON.stringify(obj ?? {}));
const clamp = (str = "", max = 100) => (str || "").toString().slice(0, max);
const makeIdFromTitle = (title, max = 24) => clamp((title || "").toString().trim(), max);
const pretty = (obj) => {
  try { return JSON.stringify(obj ?? {}, null, 2); } catch { return "{}"; }
};
const ensureArray = (v) => (Array.isArray(v) ? v : []);

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

  /* ---------------- state base ---------------- */
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
    onEnter = [],
    onExit = [],
  } = block;
  const isHuman = type === "human";

  // bloquear hotkeys do builder quando digita
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
    return false;
  };
  const handleKeyDownCapture = useCallback((e) => {
    if (!panelRef.current || !panelRef.current.contains(e.target)) return;
    const k = e.key?.toLowerCase?.() || "";
    if (isEditableTarget(e.target)) {
      const isDelete = e.key === "Delete" || e.key === "Backspace";
      const isUndo = (e.ctrlKey || e.metaKey) && !e.shiftKey && k === "z";
      const isRedo = (e.ctrlKey || e.metaKey) && (k === "y" || (k === "z" && e.shiftKey));
      if (isDelete || isUndo || isRedo) e.stopPropagation();
    }
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

  /* ------------- drafts por overlay (evita perder cursor) ------------- */
  // Await
  const [awaitDraft, setAwaitDraft] = useState({
    awaitResponse: !!awaitResponse,
    awaitTimeInSeconds: awaitTimeInSeconds ?? 0,
    sendDelayInSeconds: sendDelayInSeconds ?? 0,
    saveResponseVar: saveResponseVar || "",
  });
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

  // Conteúdo
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
    },
    media: deepClone(content),
    location: deepClone(content),
  });
  useEffect(() => {
    if (overlayMode === "conteudo") {
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
        },
        media: deepClone(content),
        location: deepClone(content),
      });
    }
  }, [overlayMode, type, block.content, content, fnName, outputVar, method, url, headers, body, timeout, statusVar]);

  // Regras
  const [regrasDraft, setRegrasDraft] = useState({
    actions: deepClone(actions || []),
    defaultNext: defaultNext || "",
  });
  useEffect(() => {
    if (overlayMode === "regras") {
      setRegrasDraft({ actions: deepClone(actions || []), defaultNext: defaultNext || "" });
    }
  }, [overlayMode, actions, defaultNext]);

  /* ---------------- helpers de commit ---------------- */
  const commitAwait = () => {
    onChange({
      ...selectedNode,
      data: {
        ...selectedNode.data,
        block: {
          ...block,
          awaitResponse: !!awaitDraft.awaitResponse,
          awaitTimeInSeconds: parseInt(awaitDraft.awaitTimeInSeconds || 0, 10),
          sendDelayInSeconds: parseInt(awaitDraft.sendDelayInSeconds || 0, 10),
          saveResponseVar: awaitDraft.saveResponseVar || "",
        },
      },
    });
    showToast("success", "Configurações de entrada salvas.");
  };

  const commitConteudo = () => {
    const d = conteudoDraft;
    const next = deepClone(block);

    if (type === "text") {
      next.content = d.text || "";
    }
    if (type === "interactive") {
      next.content = deepClone(d.content || {});
    }
    if (type === "media") {
      next.content = deepClone(d.media || {});
    }
    if (type === "location") {
      next.content = deepClone(d.location || {});
    }
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

    onChange({ ...selectedNode, data: { ...selectedNode.data, block: next } });
    showToast("success", "Conteúdo salvo.");
  };

  const commitRegras = () => {
    onChange({
      ...selectedNode,
      data: {
        ...selectedNode.data,
        block: {
          ...block,
          actions: deepClone(regrasDraft.actions || []),
          defaultNext: regrasDraft.defaultNext || "",
        },
      },
    });
    showToast("success", "Regras salvas.");
  };

  const updateActionsLocal = (next) =>
    setRegrasDraft((r) => ({ ...r, actions: deepClone(next) }));

  /* atalhos human (regras) */
  const addOffhoursAction = (kind) => {
    let conds = [];
    if (kind === "offhours_true") conds = [{ variable: "offhours", type: "equals", value: "true" }];
    else if (kind === "reason_holiday") conds = [{ variable: "offhours_reason", type: "equals", value: "holiday" }];
    else if (kind === "reason_closed") conds = [{ variable: "offhours_reason", type: "equals", value: "closed" }];
    const next = [...(regrasDraft.actions || []), { next: "", conditions: conds }];
    updateActionsLocal(next);
  };

  /* ---------------- preview/chat ---------------- */

  const renderQuickReplies = () => {
    const c = conteudoDraft.content;
    if (type !== "interactive" || c?.type !== "button") return null;
    const buttons = c?.action?.buttons || [];
    if (!buttons.length) return null;
    return (
      <div className={styles.quickReplies}>
        {buttons.map((btn, i) => (
          <span key={i} className={styles.quickReplyChip}>
            {btn?.reply?.title || "Botão"}
          </span>
        ))}
      </div>
    );
  };

  const renderListPreview = () => {
    const c = conteudoDraft.content;
    if (type !== "interactive" || c?.type !== "list") return null;
    const rows = c?.action?.sections?.[0]?.rows || [];
    if (!rows.length) return null;
    return (
      <div className={styles.listPreview}>
        {rows.slice(0, 3).map((row, i) => (
          <div key={i} className={styles.listRow}>
            <span className={styles.listDot} />
            <div className={styles.listTexts}>
              <strong>{row?.title || "Item"}</strong>
              {row?.description ? <small>{row.description}</small> : null}
            </div>
          </div>
        ))}
        {rows.length > 3 && <small className={styles.moreHint}>e mais {rows.length - 3}…</small>}
      </div>
    );
  };

  const openOverlay = (mode = "conteudo") => setOverlayMode(mode);
  const closeOverlay = () => setOverlayMode("none");

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
            {type === "text" && (conteudoDraft.text || <em className={styles.placeholder}>Sem mensagem</em>)}

            {type === "interactive" && (
              <>
                <div>{conteudoDraft.content?.body?.text || <em className={styles.placeholder}>Sem corpo</em>}</div>
                {renderQuickReplies()}
                {renderListPreview()}
              </>
            )}

            {type === "media" && (
              <>
                <div><strong>Mídia:</strong> {conteudoDraft.media?.mediaType || "image"}</div>
                <div>{conteudoDraft.media?.caption || <em className={styles.placeholder}>Sem legenda</em>}</div>
              </>
            )}

            {type === "location" && (
              <>
                <div><strong>{conteudoDraft.location?.name || "Local"}</strong></div>
                <small>{conteudoDraft.location?.address || "Endereço"}</small>
              </>
            )}

            {isHuman && (
              <div className={styles.infoBlock}>
                Este bloco transfere a conversa para <strong>atendimento humano</strong>.
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

  /* ---------------- overlay: AWAIT (usa draft + botão salvar) ---------------- */
  const OverlayAwait = () => (
    <>
      <div className={styles.overlayHeader}>
        <button className={styles.backBtn} onClick={closeOverlay} title="Voltar">
          <ArrowLeft size={18} />
        </button>
        <div className={styles.overlayTitle}>Entrada do usuário</div>
        <div className={styles.buttonGroup}>
          <button className={styles.addButtonSmall} onClick={commitAwait}><Check size={14}/> Salvar</button>
          <button className={styles.iconGhost} onClick={closeOverlay} title="Fechar"><X size={16} /></button>
        </div>
      </div>

      <div className={styles.overlayBody}>
        <div className={styles.sectionContainer}>
          <div className={styles.sectionHeaderStatic}>
            <h4 className={styles.sectionTitle}>Aguardar resposta</h4>
          </div>
          <div className={styles.sectionContent}>
            <div className={styles.rowTwoCols}>
              <div className={styles.inputGroup}>
                <label className={styles.inputLabel}>Ativar</label>
                <ComboBox
                  id="await-ativar"
                  options={["true", "false"]}
                  value={String(!!awaitDraft.awaitResponse)}
                  onChange={(v) => setAwaitDraft((d) => ({ ...d, awaitResponse: v === "true" }))}
                />
              </div>

              <div className={styles.inputGroup}>
                <label className={styles.inputLabel}>Atraso de envio (s)</label>
                <input
                  type="number"
                  value={awaitDraft.sendDelayInSeconds}
                  onChange={(e) => setAwaitDraft((d) => ({ ...d, sendDelayInSeconds: e.target.value }))}
                  className={styles.inputStyle}
                />
              </div>
            </div>

            <div className={styles.rowTwoCols}>
              <div className={styles.inputGroup}>
                <label className={styles.inputLabel}>Tempo de inatividade (s)</label>
                <input
                  type="number"
                  value={awaitDraft.awaitTimeInSeconds}
                  onChange={(e) => setAwaitDraft((d) => ({ ...d, awaitTimeInSeconds: e.target.value }))}
                  className={styles.inputStyle}
                />
                <small className={styles.helpText}>0 para desativar</small>
              </div>

              <div className={styles.inputGroup}>
                <label className={styles.inputLabel}>Salvar resposta do usuário em</label>
                <input
                  type="text"
                  placeholder="ex.: context.inputMenuPrincipal"
                  value={awaitDraft.saveResponseVar}
                  onChange={(e) => setAwaitDraft((d) => ({ ...d, saveResponseVar: e.target.value }))}
                  className={styles.inputStyle}
                />
                <small className={styles.helpText}>Se vazio, não salva.</small>
              </div>
            </div>
          </div>
        </div>
      </div>
    </>
  );

  /* ---------------- overlay: CONTEÚDO (usa draft + salvar) ---------------- */
  const OverlayConteudo = () => {
    const c = conteudoDraft;

    const setContent = (patch) =>
      setConteudoDraft((d) => ({ ...d, content: { ...deepClone(d.content || {}), ...patch } }));

    return (
      <>
        <div className={styles.overlayHeader}>
          <button className={styles.backBtn} onClick={closeOverlay} title="Voltar">
            <ArrowLeft size={18} />
          </button>
          <div className={styles.overlayTitle}>Conteúdo</div>
          <div className={styles.buttonGroup}>
            <button className={styles.addButtonSmall} onClick={commitConteudo}><Check size={14}/> Salvar</button>
            <button className={styles.iconGhost} onClick={closeOverlay} title="Fechar"><X size={16} /></button>
          </div>
        </div>

        <div className={styles.overlayBody}>
          {type === "text" && (
            <div className={styles.sectionContainer}>
              <div className={styles.sectionHeaderStatic}><h4 className={styles.sectionTitle}>Mensagem</h4></div>
              <div className={styles.sectionContent}>
                <textarea
                  rows={8}
                  value={c.text}
                  onChange={(e) => setConteudoDraft((d) => ({ ...d, text: e.target.value }))}
                  className={styles.textareaStyle}
                />
              </div>
            </div>
          )}

          {type === "interactive" && (
            <div className={styles.sectionContainer}>
              <div className={styles.sectionHeaderStatic}><h4 className={styles.sectionTitle}>Interativo</h4></div>
              <div className={styles.sectionContent}>
                <div className={styles.inputGroup}>
                  <label className={styles.inputLabel}>Tipo</label>
                  <ComboBox
                    id="int-type"
                    options={[{value:"button",label:"Quick Reply"},{value:"list",label:"Menu List"}]}
                    value={c.content?.type || "button"}
                    onChange={(v) => {
                      const newType = v === "list" ? "list" : "button";
                      if (newType === "list") {
                        setConteudoDraft((d) => ({
                          ...d,
                          content: deepClone({
                            type: "list",
                            body: { text: "Escolha um item da lista:" },
                            footer: { text: "Toque para selecionar" },
                            header: { text: "Menu de Opções", type: "text" },
                            action: { button: "Abrir lista", sections: [{ title: "Seção 1", rows: [{ id: "Item 1", title: "Item 1", description: "" }]}] }
                          }),
                        }));
                      } else {
                        setConteudoDraft((d) => ({
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
                  />
                </div>

                <div className={styles.inputGroup}>
                  <label className={styles.inputLabel}>Corpo</label>
                  <input
                    type="text"
                    value={c.content?.body?.text || ""}
                    onChange={(e) => {
                      const body = { ...(deepClone(c.content?.body) || {}), text: e.target.value };
                      setContent({ body });
                    }}
                    className={styles.inputStyle}
                  />
                </div>

                {c.content?.type === "button" && (
                  <>
                    {(c.content?.action?.buttons || []).map((btn, idx) => (
                      <div key={idx} className={styles.rowItemStyle}>
                        <input
                          type="text"
                          value={btn?.reply?.title || ""}
                          maxLength={20}
                          placeholder="Texto do botão"
                          onChange={(e) => {
                            const value = clamp(e.target.value, 20);
                            const buttons = deepClone(c.content?.action?.buttons || []);
                            buttons[idx] = {
                              ...(buttons[idx] || { type: "reply", reply: { id: "", title: "" } }),
                              reply: { ...(buttons[idx]?.reply || {}), title: value, id: value },
                            };
                            const action = { ...(deepClone(c.content?.action) || {}), buttons };
                            setConteudoDraft((d) => ({ ...d, content: { ...deepClone(d.content), action } }));
                          }}
                          className={styles.inputStyle}
                        />
                        <Trash2
                          size={18}
                          className={styles.trashIcon}
                          onClick={() => {
                            const current = deepClone(c.content?.action?.buttons || []);
                            current.splice(idx, 1);
                            const action = { ...(deepClone(c.content?.action) || {}), buttons: current };
                            setConteudoDraft((d) => ({ ...d, content: { ...deepClone(d.content), action } }));
                          }}
                          title="Remover botão"
                        />
                      </div>
                    ))}
                    <button
                      onClick={() => {
                        const current = deepClone(c.content?.action?.buttons || []);
                        if (current.length >= 3) return;
                        const newBtn = { type: "reply", reply: { id: "Novo botão", title: "Novo botão" } };
                        const action = { ...(deepClone(c.content?.action) || {}), buttons: [...current, newBtn] };
                        setConteudoDraft((d) => ({ ...d, content: { ...deepClone(d.content), action } }));
                      }}
                      className={styles.addButton}
                    >
                      + Adicionar botão
                    </button>
                  </>
                )}

                {c.content?.type === "list" && (
                  <>
                    <div className={styles.inputGroup}>
                      <label className={styles.inputLabel}>Texto do botão (abrir lista)</label>
                      <input
                        type="text"
                        maxLength={20}
                        value={c.content?.action?.button || ""}
                        onChange={(e) => {
                          const nextVal = (e.target.value || "").slice(0, 20);
                          const action = {
                            ...(deepClone(c.content?.action) || {}),
                            button: nextVal,
                            sections: deepClone(c.content?.action?.sections || [{ title: "Seção 1", rows: [] }]),
                          };
                          setConteudoDraft((d) => ({ ...d, content: { ...deepClone(d.content), action } }));
                        }}
                        className={styles.inputStyle}
                      />
                    </div>

                    {(c.content?.action?.sections?.[0]?.rows || []).map((item, idx) => (
                      <div key={idx} className={styles.rowItemStyle}>
                        <input
                          type="text"
                          value={item.title}
                          maxLength={24}
                          placeholder="Título"
                          onChange={(e) => {
                            const value = e.target.value;
                            const sections = deepClone(c.content?.action?.sections || [{ title: "Seção 1", rows: [] }]);
                            const rows = [...(sections[0]?.rows || [])];
                            rows[idx] = { ...(rows[idx] || {}), title: clamp(value, 24), id: makeIdFromTitle(value, 24) };
                            sections[0] = { ...(sections[0] || {}), rows };
                            const action = { ...(deepClone(c.content?.action) || {}), sections };
                            setConteudoDraft((d) => ({ ...d, content: { ...deepClone(d.content), action } }));
                          }}
                          className={styles.inputStyle}
                        />
                        <input
                          type="text"
                          value={item.description}
                          placeholder="Descrição"
                          onChange={(e) => {
                            const sections = deepClone(c.content?.action?.sections || [{ title: "Seção 1", rows: [] }]);
                            const rows = [...(sections[0]?.rows || [])];
                            rows[idx] = { ...(rows[idx] || {}), description: e.target.value };
                            sections[0] = { ...(sections[0] || {}), rows };
                            const action = { ...(deepClone(c.content?.action) || {}), sections };
                            setConteudoDraft((d) => ({ ...d, content: { ...deepClone(d.content), action } }));
                          }}
                          className={styles.inputStyle}
                        />
                        <Trash2
                          size={18}
                          className={styles.trashIcon}
                          onClick={() => {
                            const sections = deepClone(c.content?.action?.sections || [{ title: "", rows: [] }]);
                            const rows = [...(sections[0]?.rows || [])];
                            rows.splice(idx, 1);
                            sections[0] = { ...(sections[0] || {}), rows };
                            const action = { ...(deepClone(c.content?.action) || {}), sections };
                            setConteudoDraft((d) => ({ ...d, content: { ...deepClone(d.content), action } }));
                          }}
                          title="Remover item"
                        />
                      </div>
                    ))}

                    <button
                      onClick={() => {
                        const sections = deepClone(c.content?.action?.sections || [{ title: "", rows: [] }]);
                        const rows = sections[0]?.rows || [];
                        const n = rows.length + 1;
                        const title = `Item ${n}`;
                        const newItem = { id: makeIdFromTitle(title, 24), title, description: "" };
                        const nextRows = [...rows, newItem];
                        const nextSections = [{ ...(sections[0] || {}), rows: nextRows }];
                        const action = { ...(deepClone(c.content?.action) || {}), sections: nextSections };
                        setConteudoDraft((d) => ({ ...d, content: { ...deepClone(d.content), action } }));
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
                  <ComboBox
                    id="media-type"
                    options={["image", "document", "audio", "video"]}
                    value={c.media?.mediaType || "image"}
                    onChange={(v) => setConteudoDraft((d) => ({ ...d, media: { ...(d.media||{}), mediaType: v || "image" } }))}
                  />
                </div>
                <div className={styles.inputGroup}>
                  <label className={styles.inputLabel}>URL</label>
                  <input
                    type="text"
                    value={c.media?.url || ""}
                    onChange={(e) => setConteudoDraft((d) => ({ ...d, media: { ...(d.media||{}), url: e.target.value } }))}
                    className={styles.inputStyle}
                  />
                </div>
                <div className={styles.inputGroup}>
                  <label className={styles.inputLabel}>Legenda</label>
                  <input
                    type="text"
                    value={c.media?.caption || ""}
                    onChange={(e) => setConteudoDraft((d) => ({ ...d, media: { ...(d.media||{}), caption: e.target.value } }))}
                    className={styles.inputStyle}
                  />
                </div>
              </div>
            </div>
          )}

          {type === "location" && (
            <div className={styles.sectionContainer}>
              <div className={styles.sectionHeaderStatic}><h4 className={styles.sectionTitle}>Localização</h4></div>
              <div className={styles.sectionContent}>
                <div className={styles.inputGroup}>
                  <label className={styles.inputLabel}>Nome</label>
                  <input
                    type="text"
                    value={c.location?.name || ""}
                    onChange={(e) => setConteudoDraft((d) => ({ ...d, location: { ...(d.location||{}), name: e.target.value } }))}
                    className={styles.inputStyle}
                  />
                </div>
                <div className={styles.inputGroup}>
                  <label className={styles.inputLabel}>Endereço</label>
                  <input
                    type="text"
                    value={c.location?.address || ""}
                    onChange={(e) => setConteudoDraft((d) => ({ ...d, location: { ...(d.location||{}), address: e.target.value } }))}
                    className={styles.inputStyle}
                  />
                </div>
                <div className={styles.inputGroup}>
                  <label className={styles.inputLabel}>Latitude</label>
                  <input
                    type="text"
                    value={c.location?.latitude || ""}
                    onChange={(e) => setConteudoDraft((d) => ({ ...d, location: { ...(d.location||{}), latitude: e.target.value } }))}
                    className={styles.inputStyle}
                  />
                </div>
                <div className={styles.inputGroup}>
                  <label className={styles.inputLabel}>Longitude</label>
                  <input
                    type="text"
                    value={c.location?.longitude || ""}
                    onChange={(e) => setConteudoDraft((d) => ({ ...d, location: { ...(d.location||{}), longitude: e.target.value } }))}
                    className={styles.inputStyle}
                  />
                </div>
              </div>
            </div>
          )}

          {type === "script" && (
            <div className={styles.sectionContainer}>
              <div className={styles.sectionHeaderStatic}><h4 className={styles.sectionTitle}>Script</h4></div>
              <div className={styles.sectionContent}>
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
                  <input
                    type="text"
                    value={conteudoDraft.fnName}
                    onChange={(e) => setConteudoDraft((d) => ({ ...d, fnName: e.target.value }))}
                    className={styles.inputStyle}
                  />
                </div>

                <div className={styles.inputGroup}>
                  <label className={styles.inputLabel}>Variável de saída</label>
                  <input
                    type="text"
                    value={conteudoDraft.outputVar}
                    onChange={(e) => setConteudoDraft((d) => ({ ...d, outputVar: e.target.value }))}
                    className={styles.inputStyle}
                  />
                </div>
              </div>
            </div>
          )}

          {type === "api_call" && (
            <div className={styles.sectionContainer}>
              <div className={styles.sectionHeaderStatic}><h4 className={styles.sectionTitle}>Requisição HTTP</h4></div>
              <div className={styles.sectionContent}>
                <div className={styles.inputGroup}>
                  <label className={styles.inputLabel}>Método</label>
                  <ComboBox
                    id="api-method"
                    options={["GET","POST","PUT","DELETE","PATCH"]}
                    value={conteudoDraft.api.method}
                    onChange={(v) => setConteudoDraft((d)=>({ ...d, api:{...d.api, method: v || "GET"} }))}
                  />
                </div>

                <div className={styles.inputGroup}>
                  <label className={styles.inputLabel}>URL</label>
                  <input
                    type="text"
                    value={conteudoDraft.api.url}
                    onChange={(e) => setConteudoDraft((d)=>({ ...d, api:{...d.api, url: e.target.value} }))}
                    className={styles.inputStyle}
                  />
                </div>

                <div className={styles.inputGroup}>
                  <label className={styles.inputLabel}>Headers (JSON)</label>
                  <textarea
                    rows={3}
                    defaultValue={pretty(conteudoDraft.api.headers)}
                    onBlur={(e) => {
                      try {
                        const parsed = JSON.parse(e.target.value || "{}");
                        setConteudoDraft((d)=>({ ...d, api:{...d.api, headers: parsed} }));
                      } catch {
                        showToast("error", "Headers inválidos (JSON).");
                      }
                    }}
                    className={styles.textareaStyle}
                  />
                </div>

                <div className={styles.inputGroup}>
                  <label className={styles.inputLabel}>Body (JSON)</label>
                  <textarea
                    rows={4}
                    defaultValue={pretty(conteudoDraft.api.body)}
                    onBlur={(e) => {
                      try {
                        const parsed = JSON.parse(e.target.value || "{}");
                        setConteudoDraft((d)=>({ ...d, api:{...d.api, body: parsed} }));
                      } catch {
                        showToast("error", "Body inválido (JSON).");
                      }
                    }}
                    className={styles.textareaStyle}
                  />
                </div>

                <div className={styles.rowTwoCols}>
                  <div className={styles.inputGroup}>
                    <label className={styles.inputLabel}>Timeout (ms)</label>
                    <input
                      type="number"
                      value={conteudoDraft.api.timeout}
                      onChange={(e) => setConteudoDraft((d)=>({ ...d, api:{...d.api, timeout: e.target.value} }))}
                      className={styles.inputStyle}
                    />
                  </div>
                  <div className={styles.inputGroup}>
                    <label className={styles.inputLabel}>Variável de saída</label>
                    <input
                      type="text"
                      value={conteudoDraft.api.outputVar}
                      onChange={(e) => setConteudoDraft((d)=>({ ...d, api:{...d.api, outputVar: e.target.value} }))}
                      className={styles.inputStyle}
                    />
                  </div>
                  <div className={styles.inputGroup}>
                    <label className={styles.inputLabel}>Variável de status</label>
                    <input
                      type="text"
                      value={conteudoDraft.api.statusVar}
                      onChange={(e) => setConteudoDraft((d)=>({ ...d, api:{...d.api, statusVar: e.target.value} }))}
                      className={styles.inputStyle}
                    />
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      </>
    );
  };

  /* ---------------- overlay: REGRAS (draft + salvar; empilhado) ---------------- */
  const OverlayRegras = () => (
    <>
      <div className={styles.overlayHeader}>
        <button className={styles.backBtn} onClick={closeOverlay} title="Voltar">
          <ArrowLeft size={18} />
        </button>
        <div className={styles.overlayTitle}>Regras de saída</div>
        <div className={styles.buttonGroup}>
          <button className={styles.addButtonSmall} onClick={commitRegras}><Check size={14}/> Salvar</button>
          <button className={styles.iconGhost} onClick={closeOverlay} title="Fechar"><X size={16} /></button>
        </div>
      </div>
      <div className={styles.overlayBody}>
        <div className={styles.sectionContainer}>
          <div className={styles.sectionHeaderStatic}>
            <h4 className={styles.sectionTitle}>Regras</h4>
            <span className={styles.sectionCount}>({regrasDraft.actions.length}/25)</span>
          </div>
          <div className={styles.sectionContent}>
            {isHuman && (
              <div className={styles.buttonGroup} style={{ marginBottom: 8 }}>
                <button className={styles.addButtonSmall} onClick={() => addOffhoursAction("offhours_true")}>+ Se offhours = true</button>
                <button className={styles.addButtonSmall} onClick={() => addOffhoursAction("reason_holiday")}>+ Se motivo = holiday</button>
                <button className={styles.addButtonSmall} onClick={() => addOffhoursAction("reason_closed")}>+ Se motivo = closed</button>
              </div>
            )}

            {regrasDraft.actions.map((action, actionIdx) => (
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
                        const updated = deepClone(regrasDraft.actions);
                        updated.splice(actionIdx, 1);
                        updateActionsLocal(updated);
                      }}
                    />
                  </div>

                  {(action.conditions || []).map((cond, condIdx) => (
                    <div key={condIdx} className={styles.conditionRow}>
                      <div className={styles.inputGroup}>
                        <label className={styles.inputLabel}>Variável</label>
                        <ComboBox
                          id={`cond-var-${actionIdx}-${condIdx}`}
                          options={variableOptions.map(o => o.value)}
                          value={
                            variableOptions.some((v) => v.value === cond.variable)
                              ? cond.variable
                              : cond.variable
                              ? "custom"
                              : "lastUserMessage"
                          }
                          onChange={(v) => {
                            const nextVar = v;
                            const updated = deepClone(regrasDraft.actions);
                            if (nextVar === "custom") {
                              updated[actionIdx].conditions[condIdx].variable = "";
                            } else {
                              updated[actionIdx].conditions[condIdx].variable = nextVar;
                              if (!updated[actionIdx].conditions[condIdx].type) {
                                updated[actionIdx].conditions[condIdx].type = "equals";
                              }
                              if (nextVar === "offhours") updated[actionIdx].conditions[condIdx].value = "true";
                              if (nextVar === "offhours_reason") updated[actionIdx].conditions[condIdx].value = "closed";
                            }
                            updateActionsLocal(updated);
                          }}
                          placeholder="variável…"
                        />
                      </div>

                      {(!variableOptions.some((v) => v.value === cond.variable) || cond.variable === "") && (
                        <div className={styles.inputGroup}>
                          <label className={styles.inputLabel}>Nome da variável</label>
                          <input
                            type="text"
                            placeholder="ex.: meuCampo"
                            value={cond.variable || ""}
                            onChange={(e) => {
                              const updated = deepClone(regrasDraft.actions);
                              updated[actionIdx].conditions[condIdx].variable = e.target.value;
                              updateActionsLocal(updated);
                            }}
                            className={styles.inputStyle}
                          />
                        </div>
                      )}

                      <div className={styles.inputGroup}>
                        <label className={styles.inputLabel}>Tipo de condição</label>
                        <ComboBox
                          id={`cond-type-${actionIdx}-${condIdx}`}
                          options={["exists","equals","not_equals","contains","not_contains","starts_with","ends_with"]}
                          value={cond.type || ""}
                          onChange={(v) => {
                            const updated = deepClone(regrasDraft.actions);
                            updated[actionIdx].conditions[condIdx].type = v || "";
                            if (v === "exists") updated[actionIdx].conditions[condIdx].value = "";
                            updateActionsLocal(updated);
                          }}
                          placeholder="Selecione…"
                        />
                      </div>

                      {cond.type !== "exists" && (
                        <div className={styles.inputGroup}>
                          <label className={styles.inputLabel}>Valor</label>
                          {(() => {
                            const onChangeVal = (v) => {
                              const updated = deepClone(regrasDraft.actions);
                              updated[actionIdx].conditions[condIdx].value = v;
                              updateActionsLocal(updated);
                            };
                            if (cond.variable === "offhours") {
                              return (
                                <ComboBox
                                  id={`cond-val-${actionIdx}-${condIdx}`}
                                  options={["true","false"]}
                                  value={cond.value ?? "true"}
                                  onChange={onChangeVal}
                                />
                              );
                            }
                            if (cond.variable === "offhours_reason") {
                              return (
                                <ComboBox
                                  id={`cond-val2-${actionIdx}-${condIdx}`}
                                  options={["holiday","closed"]}
                                  value={cond.value ?? "holiday"}
                                  onChange={onChangeVal}
                                />
                              );
                            }
                            return (
                              <input
                                type="text"
                                placeholder="Valor para comparação"
                                value={cond.value ?? ""}
                                onChange={(e) => onChangeVal(e.target.value)}
                                className={styles.inputStyle}
                              />
                            );
                          })()}
                        </div>
                      )}

                      <div className={styles.buttonGroup}>
                        <button
                          className={styles.deleteButtonSmall}
                          onClick={() => {
                            const updated = deepClone(regrasDraft.actions);
                            updated[actionIdx].conditions.splice(condIdx, 1);
                            updateActionsLocal(updated);
                          }}
                        >
                          <Trash2 size={14} /> Remover condição
                        </button>
                      </div>
                    </div>
                  ))}

                  <div className={styles.buttonGroup}>
                    <button
                      className={styles.addButtonSmall}
                      onClick={() => {
                        const updated = deepClone(regrasDraft.actions);
                        updated[actionIdx].conditions = updated[actionIdx].conditions || [];
                        updated[actionIdx].conditions.push({ variable: "lastUserMessage", type: "exists", value: "" });
                        updateActionsLocal(updated);
                      }}
                    >
                      + Adicionar condição
                    </button>
                  </div>

                  <div className={styles.inputGroup}>
                    <label className={styles.inputLabel}>Ir para</label>
                    <ComboBox
                      id={`go-${actionIdx}`}
                      options={allNodes.filter(n => n.id !== selectedNode.id).map(n => n.id)}
                      value={action.next || ""}
                      onChange={(v) => {
                        const targetId = v;
                        const updated = deepClone(regrasDraft.actions);
                        updated[actionIdx].next = targetId;
                        updateActionsLocal(updated);
                        if (onConnectNodes && targetId) onConnectNodes({ source: selectedNode.id, target: targetId });
                      }}
                      placeholder="Selecione um bloco…"
                    />
                  </div>
                </div>
              </React.Fragment>
            ))}

            <div className={styles.buttonGroup}>
              <button
                onClick={() => {
                  const newAction = { next: "", conditions: [{ variable: "lastUserMessage", type: "exists", value: "" }] };
                  updateActionsLocal([...(regrasDraft.actions || []), newAction]);
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
                  <ComboBox
                    id="default-next"
                    options={allNodes.filter(n => n.id !== selectedNode.id).map(n => n.id)}
                    value={regrasDraft.defaultNext}
                    onChange={(v) => setRegrasDraft((r)=>({ ...r, defaultNext: v }))}
                    placeholder="Selecione um bloco…"
                  />
                </div>
              </div>
            </div>
          </div>
        </div>
      </div> 
    </>
  );

  /* ---------------- overlay: AÇÕES ESPECIAIS (lista + overlay editor) ---------------- */
  const OverlayEspeciais = () => {
    const [editorOpen, setEditorOpen] = useState(false);
    const [editing, setEditing] = useState({
      mode: "create",
      section: "enter",
      index: -1,
      draft: { label: "", scope: "context", key: "", value: "", conditions: [] },
    });

    const resetEditing = () =>
      setEditing({ mode: "create", section: "enter", index: -1, draft: { label: "", scope: "context", key: "", value: "", conditions: [] } });

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
        onChange({ ...selectedNode, data: { ...selectedNode.data, block: { ...block, onEnter: list } } });
      } else {
        onChange({ ...selectedNode, data: { ...selectedNode.data, block: { ...block, onExit: list } } });
      }
      showToast("success", "Variável removida.");
    };

    const validateDraft = (d) => {
      if (!d.label?.trim()) { showToast("error", "Informe o título da variável."); return false; }
      if (!d.key?.trim()) { showToast("error", "Informe a chave da variável."); return false; }
      for (let i = 0; i < (d.conditions || []).length; i++) {
        const c = d.conditions[i];
        if (c.variable === undefined) { showToast("error", `Condição ${i + 1}: selecione a variável.`); return false; }
        if (!c.type) { showToast("error", `Condição ${i + 1}: selecione o tipo.`); return false; }
        if (c.type !== "exists" && (c.value === undefined || c.value === null)) {
          showToast("error", `Condição ${i + 1}: informe o valor.`); return false;
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

      if (section === "enter") {
        onChange({ ...selectedNode, data: { ...selectedNode.data, block: { ...block, onEnter: list } } });
      } else {
        onChange({ ...selectedNode, data: { ...selectedNode.data, block: { ...block, onExit: list } } });
      }

      setEditorOpen(false);
      resetEditing();
      showToast("success", "Variável salva com sucesso.");
    };

    const SpecialList = ({ title, section, items }) => (
      <div className={styles.sectionContainer}>
        <div className={styles.sectionHeaderStatic}>
          <h4 className={styles.sectionTitle}>{title}</h4>
          <button className={styles.addButtonSmall} onClick={() => startCreate(section)}>
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
                <button className={styles.iconGhost} title="Editar" onClick={() => startEdit(section, i)}>
                  <PencilLine size={16} />
                </button>
                <button className={styles.iconGhost} title="Remover" onClick={() => removeItem(section, i)}>
                  <Trash2 size={16} />
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>
    );

    // drawer interno
    const EditorOverlay = () => {
      const { draft, mode, section } = editing;
      const setDraft = (patch) => setEditing((s) => ({ ...s, draft: { ...s.draft, ...patch } }));

      const addCond = () => setDraft({ conditions: [...(draft.conditions || []), { variable: "lastUserMessage", type: "exists", value: "" }] });
      const updateCond = (idx, patch) => {
        const next = deepClone(draft.conditions || []);
        next[idx] = { ...next[idx], ...patch };
        setDraft({ conditions: next });
      };
      const removeCond = (idx) => {
        const next = deepClone(draft.conditions || []);
        next.splice(idx, 1);
        setDraft({ conditions: next });
      };

      return (
        <div className={`${styles.subOverlay} ${editorOpen ? styles.subOverlayOpen : ""}`}>
          <div className={styles.subOverlayHeader}>
            <button className={styles.backBtn} onClick={() => { setEditorOpen(false); resetEditing(); }} title="Voltar">
              <ArrowLeft size={18} />
            </button>
            <div className={styles.overlayTitle}>
              {mode === "edit" ? "Editar variável" : "Nova variável"}
              <span className={styles.pillLight} style={{ marginLeft: 8 }}>
                {section === "enter" ? "Ao entrar" : "Ao sair"}
              </span>
            </div>
            <div className={styles.buttonGroup}>
              <button className={styles.deleteButtonSmall} onClick={() => { setEditorOpen(false); resetEditing(); }}>
                <X size={14}/> Cancelar
              </button>
              <button className={styles.addButtonSmall} onClick={saveEditing}>
                <Check size={14}/> Salvar
              </button>
            </div>
          </div>

          <div className={styles.subOverlayBody}>
            <div className={styles.inputGroup}>
              <label className={styles.inputLabel}>Título *</label>
              <input
                className={styles.inputStyle}
                placeholder="Como aparece na lista"
                value={draft.label}
                onChange={(e) => setDraft({ label: e.target.value })}
              />
            </div>

            <div className={styles.inputGroup}>
              <label className={styles.inputLabel}>Escopo</label>
              <ComboBox
                id="var-scope"
                options={["context","contact","contact.extra"]}
                value={draft.scope || "context"}
                onChange={(v) => setDraft({ scope: v || "context" })}
                placeholder="context/contact…"
              />
            </div>

            <div className={styles.inputGroup}>
              <label className={styles.inputLabel}>Chave *</label>
              <input
                className={styles.inputStyle}
                placeholder="ex.: protocolo"
                value={draft.key}
                onChange={(e) => setDraft({ key: e.target.value })}
              />
            </div>

            <div className={styles.inputGroup}>
              <label className={styles.inputLabel}>Valor</label>
              <input
                className={styles.inputStyle}
                placeholder='ex.: 12345 ou {{context.algo}}'
                value={draft.value}
                onChange={(e) => setDraft({ value: e.target.value })}
              />
            </div>

            <small className={styles.helpText}>
              Dica: use <code className={styles.mono}>{"{{context.nome}}"}</code> para interpolar valores.
            </small>

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
                      <ComboBox
                        id={`v-cond-var-${idx}`}
                        options={variableOptions.map(o=>o.value)}
                        value={
                          variableOptions.some((v) => v.value === cond.variable)
                            ? cond.variable
                            : cond.variable
                            ? "custom"
                            : "lastUserMessage"
                        }
                        onChange={(v) => {
                          if (v === "custom") updateCond(idx, { variable: "" });
                          else {
                            const patch = { variable: v };
                            if (!cond.type) patch.type = "equals";
                            if (v === "offhours") patch.value = "true";
                            if (v === "offhours_reason") patch.value = "closed";
                            updateCond(idx, patch);
                          }
                        }}
                        placeholder="variável…"
                      />
                    </div>

                    {(!variableOptions.some((v) => v.value === cond.variable) || cond.variable === "") && (
                      <div className={styles.inputGroup}>
                        <label className={styles.inputLabel}>Nome</label>
                        <input
                          className={styles.inputStyle}
                          placeholder="ex.: meuCampo"
                          value={cond.variable || ""}
                          onChange={(e) => updateCond(idx, { variable: e.target.value })}
                        />
                      </div>
                    )}

                    <div className={styles.inputGroup}>
                      <label className={styles.inputLabel}>Tipo</label>
                      <ComboBox
                        id={`v-cond-type-${idx}`}
                        options={["exists","equals","not_equals","contains","not_contains","starts_with","ends_with"]}
                        value={cond.type || ""}
                        onChange={(v) => {
                          const patch = { type: v || "" };
                          if (v === "exists") patch.value = "";
                          updateCond(idx, patch);
                        }}
                        placeholder="Selecione…"
                      />
                    </div>

                    {cond.type !== "exists" && (
                      <div className={styles.inputGroup}>
                        <label className={styles.inputLabel}>Valor</label>
                        {cond.variable === "offhours" ? (
                          <ComboBox id={`v-cond-val-${idx}`} options={["true","false"]} value={cond.value ?? "true"} onChange={(v)=>updateCond(idx,{value:v})} />
                        ) : cond.variable === "offhours_reason" ? (
                          <ComboBox id={`v-cond-val2-${idx}`} options={["holiday","closed"]} value={cond.value ?? "holiday"} onChange={(v)=>updateCond(idx,{value:v})} />
                        ) : (
                          <input
                            className={styles.inputStyle}
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
    };

    return (
      <>
        <div className={styles.overlayHeader}>
          <button className={styles.backBtn} onClick={closeOverlay} title="Voltar">
            <ArrowLeft size={18} />
          </button>
          <div className={styles.overlayTitle}>Ações especiais</div>
          <button className={styles.iconGhost} onClick={closeOverlay} title="Fechar">
            <X size={16} />
          </button>
        </div>

        <div className={styles.overlayBody}>
          <SpecialList title="Ao entrar no bloco" section="enter" items={ensureArray(onEnter)} />
          <SpecialList title="Ao sair do bloco" section="exit" items={ensureArray(onExit)} />
        </div>

        {/* Overlay interno (drawer) para criar/editar variável */}
        <EditorOverlay />
      </>
    );
  };

  /* ---------------- render ---------------- */

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
            <input type="text" value="atendimento humano" disabled className={styles.inputStyle} />
          ) : (
            <input
              type="text"
              value={selectedNode.data.label}
              onChange={(e) => onChange({ ...selectedNode, data: { ...selectedNode.data, label: e.target.value } })}
              className={styles.inputStyle}
              placeholder="Nomeie este bloco"
            />
          )}
        </div>

        {/* Prévia e acionadores */}
        <ChatPreview />
      </div>

      {/* -------- Overlay principal -------- */}
      <div className={`${styles.overlay} ${overlayMode !== "none" ? styles.overlayOpen : ""}`}>
        {overlayMode === "await" && <OverlayAwait />}
        {overlayMode === "conteudo" && <OverlayConteudo />}
        {overlayMode === "regras" && <OverlayRegras />}
        {overlayMode === "especiais" && <OverlayEspeciais />}
      </div>
    </aside>
  );
}
