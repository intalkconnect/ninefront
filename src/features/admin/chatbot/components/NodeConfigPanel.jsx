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

/* ----------------- inputs autocontrolados (não perdem foco) ----------------- */
function Field({
  id,
  type = "text",
  initialValue = "",
  placeholder = "",
  className = "",
  onCommit,      // chamado no blur (opcional)
  onChangeLive,  // se quiser refletir em preview, chamado a cada tecla (opcional)
}) {
  const [val, setVal] = useState(initialValue ?? "");
  const first = useRef(true);

  // só sincroniza quando a prop initialValue mudar "externamente" (ex.: ao abrir overlay)
  useEffect(() => {
    if (!first.current) setVal(initialValue ?? "");
    first.current = false;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initialValue]);

  return (
    <input
      id={id}
      type={type}
      value={val}
      placeholder={placeholder}
      className={`${styles.inputStyle} ${className}`}
      onChange={(e) => {
        setVal(e.target.value);
        onChangeLive?.(e.target.value);
      }}
      onBlur={() => onCommit?.(val)}
    />
  );
}

function FieldArea({
  id,
  rows = 4,
  initialValue = "",
  placeholder = "",
  className = "",
  onCommit,
  onChangeLive,
}) {
  const [val, setVal] = useState(initialValue ?? "");
  const first = useRef(true);

  useEffect(() => {
    if (!first.current) setVal(initialValue ?? "");
    first.current = false;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initialValue]);

  return (
    <textarea
      id={id}
      rows={rows}
      value={val}
      placeholder={placeholder}
      className={`${styles.textareaStyle} ${className}`}
      onChange={(e) => {
        setVal(e.target.value);
        onChangeLive?.(e.target.value);
      }}
      onBlur={() => onCommit?.(val)}
    />
  );
}

/* ----------------- utils ----------------- */
const deepClone = (obj) =>
  typeof structuredClone === "function" ? structuredClone(obj) : JSON.parse(JSON.stringify(obj ?? {}));
const clamp = (str = "", max = 100) => (str || "").toString().slice(0, max);
const makeIdFromTitle = (title, max = 24) => clamp((title || "").toString().trim(), max);
const pretty = (obj) => { try { return JSON.stringify(obj ?? {}, null, 2); } catch { return "{}"; } };
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

  // evita que hotkeys do builder capturem delete/undo/redo dentro do painel
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

  /* ---------------- drafts por overlay ---------------- */
  // await
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

  // conteúdo
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

  // regras
  const [regrasDraft, setRegrasDraft] = useState({
    actions: deepClone(actions || []),
    defaultNext: defaultNext || "",
  });
  useEffect(() => {
    if (overlayMode === "regras") {
      setRegrasDraft({ actions: deepClone(actions || []), defaultNext: defaultNext || "" });
    }
  }, [overlayMode, actions, defaultNext]);

  /* ---------------- commits ---------------- */
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

    if (type === "text") next.content = d.text || "";
    if (type === "interactive") next.content = deepClone(d.content || {});
    if (type === "media") next.content = deepClone(d.media || {});
    if (type === "location") next.content = deepClone(d.location || {});
    if (type === "script") { next.function = d.fnName || ""; next.outputVar = d.outputVar || ""; }
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

  /* atalhos human */
  const addOffhoursAction = (kind) => {
    let conds = [];
    if (kind === "offhours_true") conds = [{ variable: "offhours", type: "equals", value: "true" }];
    else if (kind === "reason_holiday") conds = [{ variable: "offhours_reason", type: "equals", value: "holiday" }];
    else if (kind === "reason_closed") conds = [{ variable: "offhours_reason", type: "equals", value: "closed" }];
    const next = [...(regrasDraft.actions || []), { next: "", conditions: conds }];
    updateActionsLocal(next);
  };

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

  /* ---------------- overlay: AWAIT ---------------- */
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
                <select
                  value={String(!!awaitDraft.awaitResponse)}
                  onChange={(e) => setAwaitDraft((d)=>({ ...d, awaitResponse: e.target.value === "true" }))}
                  className={styles.selectStyle}
                >
                  <option value="true">Sim</option>
                  <option value="false">Não</option>
                </select>
              </div>

              <div className={styles.inputGroup}>
                <label className={styles.inputLabel}>Atraso de envio (s)</label>
                <Field
                  type="number"
                  initialValue={String(awaitDraft.sendDelayInSeconds ?? 0)}
                  onCommit={(v)=> setAwaitDraft((d)=>({ ...d, sendDelayInSeconds: Number(v||0) }))}
                />
              </div>
            </div>

            <div className={styles.rowTwoCols}>
              <div className={styles.inputGroup}>
                <label className={styles.inputLabel}>Tempo de inatividade (s)</label>
                <Field
                  type="number"
                  initialValue={String(awaitDraft.awaitTimeInSeconds ?? 0)}
                  onCommit={(v)=> setAwaitDraft((d)=>({ ...d, awaitTimeInSeconds: Number(v||0) }))}
                />
                <small className={styles.helpText}>0 para desativar</small>
              </div>

              <div className={styles.inputGroup}>
                <label className={styles.inputLabel}>Salvar resposta do usuário em</label>
                <Field
                  initialValue={awaitDraft.saveResponseVar || ""}
                  placeholder="ex.: context.inputMenuPrincipal"
                  onCommit={(v)=> setAwaitDraft((d)=>({ ...d, saveResponseVar: v }))}
                />
                <small className={styles.helpText}>Se vazio, não salva.</small>
              </div>
            </div>
          </div>
        </div>
      </div>
    </>
  );

  /* ---------------- overlay: CONTEÚDO ---------------- */
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
                <FieldArea
                  rows={8}
                  initialValue={c.text}
                  onCommit={(v)=> setConteudoDraft((d)=>({ ...d, text: v }))}
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
                  <select
                    value={c.content?.type || "button"}
                    onChange={(e) => {
                      const newType = e.target.value;
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
                    className={styles.selectStyle}
                  >
                    <option value="button">Quick Reply</option>
                    <option value="list">Menu List</option>
                  </select>
                </div>

                <div className={styles.inputGroup}>
                  <label className={styles.inputLabel}>Corpo</label>
                  <Field
                    initialValue={c.content?.body?.text || ""}
                    onCommit={(v) => {
                      const body = { ...(deepClone(c.content?.body) || {}), text: v };
                      setContent({ body });
                    }}
                  />
                </div>

                {c.content?.type === "button" && (
                  <>
                    {(c.content?.action?.buttons || []).map((btn, idx) => (
                      <div key={idx} className={styles.rowItemStyle}>
                        <Field
                          initialValue={btn?.reply?.title || ""}
                          placeholder="Texto do botão"
                          onCommit={(value) => {
                            const v = clamp(value, 20);
                            const buttons = deepClone(c.content?.action?.buttons || []);
                            buttons[idx] = {
                              ...(buttons[idx] || { type: "reply", reply: { id: "", title: "" } }),
                              reply: { ...(buttons[idx]?.reply || {}), title: v, id: v },
                            };
                            const action = { ...(deepClone(c.content?.action) || {}), buttons };
                            setConteudoDraft((d) => ({ ...d, content: { ...deepClone(d.content), action } }));
                          }}
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
                      <Field
                        initialValue={c.content?.action?.button || ""}
                        onCommit={(v) => {
                          const action = {
                            ...(deepClone(c.content?.action) || {}),
                            button: (v || "").slice(0, 20),
                            sections: deepClone(c.content?.action?.sections || [{ title: "Seção 1", rows: [] }]),
                          };
                          setConteudoDraft((d) => ({ ...d, content: { ...deepClone(d.content), action } }));
                        }}
                      />
                    </div>

                    {(c.content?.action?.sections?.[0]?.rows || []).map((item, idx) => (
                      <div key={idx} className={styles.rowItemStyle}>
                        <Field
                          initialValue={item.title}
                          placeholder="Título"
                          onCommit={(v) => {
                            const value = v;
                            const sections = deepClone(c.content?.action?.sections || [{ title: "Seção 1", rows: [] }]);
                            const rows = [...(sections[0]?.rows || [])];
                            rows[idx] = { ...(rows[idx] || {}), title: clamp(value, 24), id: makeIdFromTitle(value, 24) };
                            sections[0] = { ...(sections[0] || {}), rows };
                            const action = { ...(deepClone(c.content?.action) || {}), sections };
                            setConteudoDraft((d) => ({ ...d, content: { ...deepClone(d.content), action } }));
                          }}
                        />
                        <Field
                          initialValue={item.description}
                          placeholder="Descrição"
                          onCommit={(v) => {
                            const sections = deepClone(c.content?.action?.sections || [{ title: "Seção 1", rows: [] }]);
                            const rows = [...(sections[0]?.rows || [])];
                            rows[idx] = { ...(rows[idx] || {}), description: v };
                            sections[0] = { ...(sections[0] || {}), rows };
                            const action = { ...(deepClone(c.content?.action) || {}), sections };
                            setConteudoDraft((d) => ({ ...d, content: { ...deepClone(d.content), action } }));
                          }}
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
                  <select
                    value={c.media?.mediaType || "image"}
                    onChange={(e)=> setConteudoDraft((d)=>({ ...d, media: { ...(d.media||{}), mediaType: e.target.value } }))}
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
                  <Field
                    initialValue={c.media?.url || ""}
                    onCommit={(v)=> setConteudoDraft((d)=>({ ...d, media: { ...(d.media||{}), url: v } }))}
                  />
                </div>
                <div className={styles.inputGroup}>
                  <label className={styles.inputLabel}>Legenda</label>
                  <Field
                    initialValue={c.media?.caption || ""}
                    onCommit={(v)=> setConteudoDraft((d)=>({ ...d, media: { ...(d.media||{}), caption: v } }))}
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
                  <Field
                    initialValue={c.location?.name || ""}
                    onCommit={(v)=> setConteudoDraft((d)=>({ ...d, location: { ...(d.location||{}), name: v } }))}
                  />
                </div>
                <div className={styles.inputGroup}>
                  <label className={styles.inputLabel}>Endereço</label>
                  <Field
                    initialValue={c.location?.address || ""}
                    onCommit={(v)=> setConteudoDraft((d)=>({ ...d, location: { ...(d.location||{}), address: v } }))}
                  />
                </div>
                <div className={styles.inputGroup}>
                  <label className={styles.inputLabel}>Latitude</label>
                  <Field
                    initialValue={c.location?.latitude || ""}
                    onCommit={(v)=> setConteudoDraft((d)=>({ ...d, location: { ...(d.location||{}), latitude: v } }))}
                  />
                </div>
                <div className={styles.inputGroup}>
                  <label className={styles.inputLabel}>Longitude</label>
                  <Field
                    initialValue={c.location?.longitude || ""}
                    onCommit={(v)=> setConteudoDraft((d)=>({ ...d, location: { ...(d.location||{}), longitude: v } }))}
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
                  <Field
                    initialValue={conteudoDraft.fnName}
                    onCommit={(v)=> setConteudoDraft((d)=>({ ...d, fnName: v }))}
                  />
                </div>

                <div className={styles.inputGroup}>
                  <label className={styles.inputLabel}>Variável de saída</label>
                  <Field
                    initialValue={conteudoDraft.outputVar}
                    onCommit={(v)=> setConteudoDraft((d)=>({ ...d, outputVar: v }))}
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
                  <select
                    value={conteudoDraft.api.method}
                    onChange={(e)=> setConteudoDraft((d)=>({ ...d, api:{...d.api, method: e.target.value} }))}
                    className={styles.selectStyle}
                  >
                    <option>GET</option><option>POST</option><option>PUT</option><option>DELETE</option><option>PATCH</option>
                  </select>
                </div>

                <div className={styles.inputGroup}>
                  <label className={styles.inputLabel}>URL</label>
                  <Field
                    initialValue={conteudoDraft.api.url}
                    onCommit={(v)=> setConteudoDraft((d)=>({ ...d, api:{...d.api, url: v} }))}
                  />
                </div>

                <div className={styles.inputGroup}>
                  <label className={styles.inputLabel}>Headers (JSON)</label>
                  <FieldArea
                    rows={3}
                    initialValue={pretty(conteudoDraft.api.headers)}
                    onCommit={(v) => {
                      try {
                        const parsed = JSON.parse(v || "{}");
                        setConteudoDraft((d)=>({ ...d, api:{...d.api, headers: parsed} }));
                      } catch {
                        showToast("error", "Headers inválidos (JSON).");
                      }
                    }}
                  />
                </div>

                <div className={styles.inputGroup}>
                  <label className={styles.inputLabel}>Body (JSON)</label>
                  <FieldArea
                    rows={4}
                    initialValue={pretty(conteudoDraft.api.body)}
                    onCommit={(v) => {
                      try {
                        const parsed = JSON.parse(v || "{}");
                        setConteudoDraft((d)=>({ ...d, api:{...d.api, body: parsed} }));
                      } catch {
                        showToast("error", "Body inválido (JSON).");
                      }
                    }}
                  />
                </div>

                <div className={styles.rowTwoCols}>
                  <div className={styles.inputGroup}>
                    <label className={styles.inputLabel}>Timeout (ms)</label>
                    <Field
                      type="number"
                      initialValue={String(conteudoDraft.api.timeout)}
                      onCommit={(v)=> setConteudoDraft((d)=>({ ...d, api:{...d.api, timeout: Number(v||0)} }))}
                    />
                  </div>
                  <div className={styles.inputGroup}>
                    <label className={styles.inputLabel}>Variável de saída</label>
                    <Field
                      initialValue={conteudoDraft.api.outputVar}
                      onCommit={(v)=> setConteudoDraft((d)=>({ ...d, api:{...d.api, outputVar: v} }))}
                    />
                  </div>
                  <div className={styles.inputGroup}>
                    <label className={styles.inputLabel}>Variável de status</label>
                    <Field
                      initialValue={conteudoDraft.api.statusVar}
                      onCommit={(v)=> setConteudoDraft((d)=>({ ...d, api:{...d.api, statusVar: v} }))}
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

  /* ---------------- overlay: REGRAS ---------------- */
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
                            const updated = deepClone(regrasDraft.actions);
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
                          <Field
                            initialValue={cond.variable || ""}
                            placeholder="ex.: meuCampo"
                            onCommit={(v) => {
                              const updated = deepClone(regrasDraft.actions);
                              updated[actionIdx].conditions[condIdx].variable = v;
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
                            const updated = deepClone(regrasDraft.actions);
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

                      {cond.type !== "exists" && (
                        <div className={styles.inputGroup}>
                          <label className={styles.inputLabel}>Valor</label>
                          {cond.variable === "offhours" ? (
                            <select
                              value={cond.value ?? "true"}
                              onChange={(e) => {
                                const updated = deepClone(regrasDraft.actions);
                                updated[actionIdx].conditions[condIdx].value = e.target.value;
                                updateActionsLocal(updated);
                              }}
                              className={styles.selectStyle}
                            >
                              <option value="true">true</option>
                              <option value="false">false</option>
                            </select>
                          ) : cond.variable === "offhours_reason" ? (
                            <select
                              value={cond.value ?? "holiday"}
                              onChange={(e) => {
                                const updated = deepClone(regrasDraft.actions);
                                updated[actionIdx].conditions[condIdx].value = e.target.value;
                                updateActionsLocal(updated);
                              }}
                              className={styles.selectStyle}
                            >
                              <option value="holiday">holiday</option>
                              <option value="closed">closed</option>
                            </select>
                          ) : (
                            <Field
                              initialValue={cond.value ?? ""}
                              placeholder="Valor para comparação"
                              onCommit={(v) => {
                                const updated = deepClone(regrasDraft.actions);
                                updated[actionIdx].conditions[condIdx].value = v;
                                updateActionsLocal(updated);
                              }}
                            />
                          )}
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
                    <select
                      value={action.next || ""}
                      onChange={(e) => {
                        const targetId = e.target.value;
                        const updated = deepClone(regrasDraft.actions);
                        updated[actionIdx].next = targetId;
                        updateActionsLocal(updated);
                        if (onConnectNodes && targetId) onConnectNodes({ source: selectedNode.id, target: targetId });
                      }}
                      className={styles.selectStyle}
                    >
                      <option value="">Selecione um bloco...</option>
                      {allNodes.filter(n => n.id !== selectedNode.id).map((n) => (
                        <option key={n.id} value={n.id}>{n.data.label || n.id}</option>
                      ))}
                    </select>
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
                  <select
                    value={regrasDraft.defaultNext || ""}
                    onChange={(e) => setRegrasDraft((r)=>({ ...r, defaultNext: e.target.value }))}
                    className={styles.selectStyle}
                  >
                    <option value="">Selecione um bloco...</option>
                    {allNodes.filter(n => n.id !== selectedNode.id).map((n) => (
                      <option key={n.id} value={n.id}>{n.data.label || n.id}</option>
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

  /* ---------------- overlay: ESPECIAIS (lista + editor overlay) ---------------- */
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
      const changes = section === "enter" ? { onEnter: list } : { onExit: list };
      onChange({ ...selectedNode, data: { ...selectedNode.data, block: { ...block, ...changes } } });
      showToast("success", "Variável removida.");
    };

    const validateDraft = (d) => {
      if (!d.label?.trim()) { showToast("error", "Título é obrigatório."); return false; }
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

      const changes = section === "enter" ? { onEnter: list } : { onExit: list };
      onChange({ ...selectedNode, data: { ...selectedNode.data, block: { ...block, ...changes } } });

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
              <Field
                initialValue={draft.label}
                placeholder="Como aparece na lista"
                onCommit={(v)=> setDraft({ label: v })}
              />
            </div>

            <div className={styles.inputGroup}>
              <label className={styles.inputLabel}>Escopo</label>
              <select
                value={draft.scope || "context"}
                onChange={(e)=> setDraft({ scope: e.target.value })}
                className={styles.selectStyle}
              >
                <option value="context">context</option>
                <option value="contact">contact</option>
                <option value="contact.extra">contact.extra</option>
              </select>
            </div>

            <div className={styles.inputGroup}>
              <label className={styles.inputLabel}>Chave *</label>
              <Field
                initialValue={draft.key}
                placeholder="ex.: protocolo"
                onCommit={(v)=> setDraft({ key: v })}
              />
            </div>

            <div className={styles.inputGroup}>
              <label className={styles.inputLabel}>Valor</label>
              <Field
                initialValue={draft.value}
                placeholder='ex.: 12345 ou {{context.algo}}'
                onCommit={(v)=> setDraft({ value: v })}
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
                      <select
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
                        className={styles.selectStyle}
                      >
                        {variableOptions.map((opt) => (
                          <option key={opt.value} value={opt.value}>{opt.label}</option>
                        ))}
                      </select>
                    </div>

                    {(!variableOptions.some((v) => v.value === cond.variable) || cond.variable === "") && (
                      <div className={styles.inputGroup}>
                        <label className={styles.inputLabel}>Nome</label>
                        <Field
                          initialValue={cond.variable || ""}
                          placeholder="ex.: meuCampo"
                          onCommit={(v)=> updateCond(idx, { variable: v })}
                        />
                      </div>
                    )}

                    <div className={styles.inputGroup}>
                      <label className={styles.inputLabel}>Tipo</label>
                      <select
                        value={cond.type || ""}
                        onChange={(e) => {
                          const v = e.target.value;
                          const patch = { type: v || "" };
                          if (v === "exists") patch.value = "";
                          updateCond(idx, patch);
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

                    {cond.type !== "exists" && (
                      <div className={styles.inputGroup}>
                        <label className={styles.inputLabel}>Valor</label>
                        {cond.variable === "offhours" ? (
                          <select
                            value={cond.value ?? "true"}
                            onChange={(e)=> updateCond(idx, { value: e.target.value })}
                            className={styles.selectStyle}
                          >
                            <option value="true">true</option>
                            <option value="false">false</option>
                          </select>
                        ) : cond.variable === "offhours_reason" ? (
                          <select
                            value={cond.value ?? "holiday"}
                            onChange={(e)=> updateCond(idx, { value: e.target.value })}
                            className={styles.selectStyle}
                          >
                            <option value="holiday">holiday</option>
                            <option value="closed">closed</option>
                          </select>
                        ) : (
                          <Field
                            initialValue={cond.value ?? ""}
                            placeholder="Valor para comparação"
                            onCommit={(v)=> updateCond(idx, { value: v })}
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

        {/* overlay interno para criar/editar variável */}
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
            <Field
              initialValue={selectedNode.data.label}
              placeholder="Nomeie este bloco"
              onCommit={(v)=> onChange({ ...selectedNode, data: { ...selectedNode.data, label: v } })}
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
