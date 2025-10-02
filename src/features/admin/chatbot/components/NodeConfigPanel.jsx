import React, { useState, useRef, useCallback, useEffect } from "react";
import {
  Trash2,
  Plus,
  X,
  MoreHorizontal,
  PencilLine,
  ArrowLeft,
  SlidersHorizontal
} from "lucide-react";
import styles from "./styles/NodeConfigPanel.module.css";

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

  /* ---------------- state ---------------- */
  // overlay: 'none' | 'conteudo' | 'regras' | 'await' | 'especiais'
  const [overlayMode, setOverlayMode] = useState("none");
  const panelRef = useRef(null);

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

  /* ---------------- helpers ---------------- */

  const deepClone = (obj) =>
    typeof structuredClone === "function"
      ? structuredClone(obj)
      : JSON.parse(JSON.stringify(obj ?? {}));

  const clamp = (str = "", max = 100) => (str || "").toString().slice(0, max);
  const makeIdFromTitle = (title, max = 24) => clamp((title || "").toString().trim(), max);

  const safeParseJson = (txt, fallback) => {
    try {
      if (typeof txt === "string" && txt.trim() !== "") return JSON.parse(txt);
      return typeof txt === "object" && txt !== null ? txt : fallback;
    } catch {
      return fallback;
    }
  };
  const pretty = (obj) => { try { return JSON.stringify(obj ?? {}, null, 2); } catch { return "{}"; } };
  const ensureArray = (v) => (Array.isArray(v) ? v : []);

  const updateBlock = (changes) =>
    onChange({ ...selectedNode, data: { ...selectedNode.data, block: { ...block, ...changes } } });

  const updateContent = (field, value) => {
    const cloned = deepClone(content);
    cloned[field] = value;
    updateBlock({ content: cloned });
  };
  const updateActions = (newActions) => updateBlock({ actions: deepClone(newActions) });

  /* atalhos human */
  const addOffhoursAction = (kind) => {
    let conds = [];
    if (kind === "offhours_true") conds = [{ variable: "offhours", type: "equals", value: "true" }];
    else if (kind === "reason_holiday") conds = [{ variable: "offhours_reason", type: "equals", value: "holiday" }];
    else if (kind === "reason_closed") conds = [{ variable: "offhours_reason", type: "equals", value: "closed" }];
    updateActions([...(actions || []), { next: "", conditions: conds }]);
  };

  /* bloquear hotkeys do builder quando digita */
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

  /* ---------------- variável para “regras” ---------------- */
  const variableOptions = isHuman
    ? [
        { value: "lastUserMessage", label: "Resposta do usuário" },
        { value: "offhours", label: "Fora do expediente" },
        { value: "offhours_reason", label: "Motivo do off-hours" },
        { value: "custom", label: "Variável personalizada" },
      ]
    : [
        { value: "lastUserMessage", label: "Resposta do usuário" },
        { value: "custom", label: "Variável personalizada" },
      ];

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
        <input
          type="text"
          placeholder="Valor para comparação"
          value={cond.value ?? ""}
          onChange={(e) => onChangeValue(e.target.value)}
          className={styles.inputStyle}
        />
      </div>
    );
  };

  /* ---------------- preview estilo chat ---------------- */

  const renderQuickReplies = () => {
    if (type !== "interactive" || content?.type !== "button") return null;
    const buttons = content?.action?.buttons || [];
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
    if (type !== "interactive" || content?.type !== "list") return null;
    const rows = content?.action?.sections?.[0]?.rows || [];
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

  useEffect(() => { /* placeholder p/ futuros efeitos */ }, [overlayMode]);

  const SpecialChips = () => {
    const list = [...(onEnter || []), ...(onExit || [])];
    if (!list.length) return null;
    const max = 3;
    const extra = list.length - max;
    return (
      <div className={styles.specialStrip} title="Ações especiais">
        {list.slice(0, max).map((a, i) => (
          <span key={i} className={styles.specialChip} onClick={() => openOverlay("especiais")}>
            {a.title || a.key || "Ação"}
          </span>
        ))}
        {extra > 0 && (
          <span className={styles.specialChipMuted} onClick={() => openOverlay("especiais")}>+{extra}</span>
        )}
      </div>
    );
  };

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
            {type === "text" && (block.content || <em className={styles.placeholder}>Sem mensagem</em>)}

            {type === "interactive" && (
              <>
                <div>{content?.body?.text || <em className={styles.placeholder}>Sem corpo</em>}</div>
                {renderQuickReplies()}
                {renderListPreview()}
              </>
            )}

            {type === "media" && (
              <>
                <div><strong>Mídia:</strong> {content?.mediaType || "image"}</div>
                <div>{content?.caption || <em className={styles.placeholder}>Sem legenda</em>}</div>
              </>
            )}

            {type === "location" && (
              <>
                <div><strong>{content?.name || "Local"}</strong></div>
                <small>{content?.address || "Endereço"}</small>
              </>
            )}

            {isHuman && (
              <div className={styles.infoBlock}>
                Este bloco transfere a conversa para <strong>atendimento humano</strong>.
              </div>
            )}
          </div>
        </div>

        <SpecialChips />

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

  /* ---------------- overlay: AWAIT (somente opções de resposta) ---------------- */

  const OverlayAwait = () => (
    <>
      <div className={styles.overlayHeader}>
        <button className={styles.backBtn} onClick={closeOverlay} title="Voltar">
          <ArrowLeft size={18} />
        </button>
        <div className={styles.overlayTitle}>Entrada do usuário</div>
        <button className={styles.iconGhost} onClick={closeOverlay} title="Fechar"><X size={16} /></button>
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
                  value={String(!!awaitResponse)}
                  onChange={(e) => updateBlock({ awaitResponse: e.target.value === "true" })}
                  className={styles.selectStyle}
                >
                  <option value="true">Sim</option>
                  <option value="false">Não</option>
                </select>
              </div>

              <div className={styles.inputGroup}>
                <label className={styles.inputLabel}>Atraso de envio (s)</label>
                <input
                  type="number"
                  value={sendDelayInSeconds ?? 0}
                  onChange={(e) => updateBlock({ sendDelayInSeconds: parseInt(e.target.value || "0", 10) })}
                  className={styles.inputStyle}
                />
              </div>
            </div>

            <div className={styles.rowTwoCols}>
              <div className={styles.inputGroup}>
                <label className={styles.inputLabel}>Tempo de inatividade (s)</label>
                <input
                  type="number"
                  value={awaitTimeInSeconds ?? 0}
                  onChange={(e) => updateBlock({ awaitTimeInSeconds: parseInt(e.target.value || "0", 10) })}
                  className={styles.inputStyle}
                />
                <small className={styles.helpText}>0 para desativar</small>
              </div>

              <div className={styles.inputGroup}>
                <label className={styles.inputLabel}>Salvar resposta do usuário em</label>
                <input
                  type="text"
                  placeholder="ex.: context.inputMenuPrincipal"
                  value={saveResponseVar || ""}
                  onChange={(e) => updateBlock({ saveResponseVar: e.target.value })}
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

  /* ---------------- overlay: CONTEÚDO (somente editor do conteúdo) ---------------- */

  const OverlayConteudo = () => (
    <>
      <div className={styles.overlayHeader}>
        <button className={styles.backBtn} onClick={closeOverlay} title="Voltar">
          <ArrowLeft size={18} />
        </button>
        <div className={styles.overlayTitle}>Conteúdo</div>
        <button className={styles.iconGhost} onClick={closeOverlay} title="Fechar"><X size={16} /></button>
      </div>

      <div className={styles.overlayBody}>
        {type === "text" && (
          <div className={styles.sectionContainer}>
            <div className={styles.sectionHeaderStatic}><h4 className={styles.sectionTitle}>Mensagem</h4></div>
            <div className={styles.sectionContent}>
              <textarea
                rows={8}
                value={block.content || ""}
                onChange={(e) => updateBlock({ content: e.target.value })}
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
                <select
                  value={content.type || "button"}
                  onChange={(e) => {
                    const newType = e.target.value;
                    if (newType === "list") {
                      updateBlock({
                        content: deepClone({
                          type: "list",
                          body: { text: "Escolha um item da lista:" },
                          footer: { text: "Toque para selecionar" },
                          header: { text: "Menu de Opções", type: "text" },
                          action: { button: "Abrir lista", sections: [{ title: "Seção 1", rows: [{ id: "Item 1", title: "Item 1", description: "" }]}] }
                        }),
                      });
                    } else {
                      updateBlock({
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
                      });
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
                <input
                  type="text"
                  value={content.body?.text || ""}
                  onChange={(e) =>
                    updateContent("body", { ...(deepClone(content.body) || {}), text: e.target.value })
                  }
                  className={styles.inputStyle}
                />
              </div>

              {content.type === "button" && (
                <>
                  {(content.action?.buttons || []).map((btn, idx) => (
                    <div key={idx} className={styles.rowItemStyle}>
                      <input
                        type="text"
                        value={btn.reply?.title || ""}
                        maxLength={20}
                        placeholder="Texto do botão"
                        onChange={(e) => {
                          const value = clamp(e.target.value, 20);
                          const buttons = deepClone(content.action?.buttons || []);
                          buttons[idx] = {
                            ...(buttons[idx] || { type: "reply", reply: { id: "", title: "" } }),
                            reply: { ...(buttons[idx]?.reply || {}), title: value, id: value },
                          };
                          const nextAction = { ...(deepClone(content.action) || {}), buttons };
                          const nextContent = { ...deepClone(content), action: nextAction };
                          updateBlock({ content: nextContent });
                        }}
                        className={styles.inputStyle}
                      />
                      <Trash2
                        size={18}
                        className={styles.trashIcon}
                        onClick={() => {
                          const current = deepClone(content.action?.buttons || []);
                          current.splice(idx, 1);
                          const nextAction = { ...(deepClone(content.action) || {}), buttons: current };
                          const nextContent = { ...deepClone(content), action: nextAction };
                          updateBlock({ content: nextContent });
                        }}
                        title="Remover botão"
                      />
                    </div>
                  ))}
                  <button
                    onClick={() => {
                      const current = deepClone(content.action?.buttons || []);
                      if (current.length >= 3) return;
                      const newBtn = { type: "reply", reply: { id: "Novo botão", title: "Novo botão" } };
                      const nextAction = { ...(deepClone(content.action) || {}), buttons: [...current, newBtn] };
                      const nextContent = { ...deepClone(content), action: nextAction };
                      updateBlock({ content: nextContent });
                    }}
                    className={styles.addButton}
                  >
                    + Adicionar botão
                  </button>
                </>
              )}

              {content.type === "list" && (
                <>
                  <div className={styles.inputGroup}>
                    <label className={styles.inputLabel}>Texto do botão (abrir lista)</label>
                    <input
                      type="text"
                      maxLength={20}
                      value={content.action?.button || ""}
                      onChange={(e) => {
                        const nextVal = (e.target.value || "").slice(0, 20);
                        const nextAction = {
                          ...(deepClone(content.action) || {}),
                          button: nextVal,
                          sections: deepClone(content.action?.sections || [{ title: "Seção 1", rows: [] }]),
                        };
                        const nextContent = { ...deepClone(content), action: nextAction };
                        updateBlock({ content: nextContent });
                      }}
                      className={styles.inputStyle}
                    />
                  </div>

                  {(content.action?.sections?.[0]?.rows || []).map((item, idx) => (
                    <div key={idx} className={styles.rowItemStyle}>
                      <input
                        type="text"
                        value={item.title}
                        maxLength={24}
                        placeholder="Título"
                        onChange={(e) => {
                          const value = e.target.value;
                          const sections = deepClone(content.action?.sections || [{ title: "Seção 1", rows: [] }]);
                          const rows = [...(sections[0]?.rows || [])];
                          rows[idx] = { ...(rows[idx] || {}), title: clamp(value, 24), id: makeIdFromTitle(value, 24) };
                          sections[0] = { ...(sections[0] || {}), rows };
                          const nextAction = { ...(deepClone(content.action) || {}), sections };
                          const nextContent = { ...deepClone(content), action: nextAction };
                          updateBlock({ content: nextContent });
                        }}
                        className={styles.inputStyle}
                      />
                      <input
                        type="text"
                        value={item.description}
                        placeholder="Descrição"
                        onChange={(e) => {
                          const sections = deepClone(content.action?.sections || [{ title: "Seção 1", rows: [] }]);
                          const rows = [...(sections[0]?.rows || [])];
                          rows[idx] = { ...(rows[idx] || {}), description: e.target.value };
                          sections[0] = { ...(sections[0] || {}), rows };
                          const nextAction = { ...(deepClone(content.action) || {}), sections };
                          const nextContent = { ...deepClone(content), action: nextAction };
                          updateBlock({ content: nextContent });
                        }}
                        className={styles.inputStyle}
                      />
                      <Trash2
                        size={18}
                        className={styles.trashIcon}
                        onClick={() => {
                          const sections = deepClone(content.action?.sections || [{ title: "", rows: [] }]);
                          const rows = [...(sections[0]?.rows || [])];
                          rows.splice(idx, 1);
                          sections[0] = { ...(sections[0] || {}), rows };
                          const nextAction = { ...(deepClone(content.action) || {}), sections };
                          const nextContent = { ...deepClone(content), action: nextAction };
                          updateBlock({ content: nextContent });
                        }}
                        title="Remover item"
                      />
                    </div>
                  ))}

                  <button
                    onClick={() => {
                      const sections = deepClone(content.action?.sections || [{ title: "", rows: [] }]);
                      const rows = sections[0]?.rows || [];
                      const n = rows.length + 1;
                      const title = `Item ${n}`;
                      const newItem = { id: makeIdFromTitle(title, 24), title, description: "" };
                      const nextRows = [...rows, newItem];
                      const nextSections = [{ ...(sections[0] || {}), rows: nextRows }];
                      const nextAction = { ...(deepClone(content.action) || {}), sections: nextSections };
                      const nextContent = { ...deepClone(content), action: nextAction };
                      updateBlock({ content: nextContent });
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
                  value={content.mediaType || "image"}
                  onChange={(e) => updateContent("mediaType", e.target.value)}
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
                <input type="text" value={content.url || ""} onChange={(e) => updateContent("url", e.target.value)} className={styles.inputStyle}/>
              </div>
              <div className={styles.inputGroup}>
                <label className={styles.inputLabel}>Legenda</label>
                <input type="text" value={content.caption || ""} onChange={(e) => updateContent("caption", e.target.value)} className={styles.inputStyle}/>
              </div>
            </div>
          </div>
        )}

        {type === "location" && (
          <div className={styles.sectionContainer}>
            <div className={styles.sectionHeaderStatic}><h4 className={styles.sectionTitle}>Localização</h4></div>
            <div className={styles.sectionContent}>
              <div className={styles.inputGroup}><label className={styles.inputLabel}>Nome</label>
                <input type="text" value={content.name || ""} onChange={(e) => updateContent("name", e.target.value)} className={styles.inputStyle}/></div>
              <div className={styles.inputGroup}><label className={styles.inputLabel}>Endereço</label>
                <input type="text" value={content.address || ""} onChange={(e) => updateContent("address", e.target.value)} className={styles.inputStyle}/></div>
              <div className={styles.inputGroup}><label className={styles.inputLabel}>Latitude</label>
                <input type="text" value={content.latitude || ""} onChange={(e) => updateContent("latitude", e.target.value)} className={styles.inputStyle}/></div>
              <div className={styles.inputGroup}><label className={styles.inputLabel}>Longitude</label>
                <input type="text" value={content.longitude || ""} onChange={(e) => updateContent("longitude", e.target.value)} className={styles.inputStyle}/></div>
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
                  value={fnName || ""}
                  onChange={(e) => updateBlock({ function: e.target.value })}
                  className={styles.inputStyle}
                />
              </div>

              <div className={styles.inputGroup}>
                <label className={styles.inputLabel}>Variável de saída</label>
                <input
                  type="text"
                  value={outputVar || ""}
                  onChange={(e) => updateBlock({ outputVar: e.target.value })}
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
                <select
                  value={method || "GET"}
                  onChange={(e) => updateBlock({ method: e.target.value })}
                  className={styles.selectStyle}
                >
                  <option value="GET">GET</option>
                  <option value="POST">POST</option>
                  <option value="PUT">PUT</option>
                  <option value="DELETE">DELETE</option>
                  <option value="PATCH">PATCH</option>
                </select>
              </div>

              <div className={styles.inputGroup}>
                <label className={styles.inputLabel}>URL</label>
                <input
                  type="text"
                  value={url || ""}
                  onChange={(e) => updateBlock({ url: e.target.value })}
                  className={styles.inputStyle}
                />
              </div>

              <div className={styles.inputGroup}>
                <label className={styles.inputLabel}>Headers (JSON)</label>
                <textarea
                  rows={3}
                  defaultValue={pretty(headers)}
                  onBlur={(e) => updateBlock({ headers: safeParseJson(e.target.value, headers || {}) })}
                  className={styles.textareaStyle}
                />
              </div>

              <div className={styles.inputGroup}>
                <label className={styles.inputLabel}>Body (JSON)</label>
                <textarea
                  rows={4}
                  defaultValue={pretty(body)}
                  onBlur={(e) => updateBlock({ body: safeParseJson(e.target.value, body || {}) })}
                  className={styles.textareaStyle}
                />
              </div>

              <div className={styles.rowTwoCols}>
                <div className={styles.inputGroup}>
                  <label className={styles.inputLabel}>Timeout (ms)</label>
                  <input
                    type="number"
                    value={timeout ?? 10000}
                    onChange={(e) => updateBlock({ timeout: parseInt(e.target.value || "0", 10) })}
                    className={styles.inputStyle}
                  />
                </div>
                <div className={styles.inputGroup}>
                  <label className={styles.inputLabel}>Variável de saída</label>
                  <input
                    type="text"
                    value={outputVar || "apiResponse"}
                    onChange={(e) => updateBlock({ outputVar: e.target.value })}
                    className={styles.inputStyle}
                  />
                </div>
                <div className={styles.inputGroup}>
                  <label className={styles.inputLabel}>Variável de status</label>
                  <input
                    type="text"
                    value={statusVar || "apiStatus"}
                    onChange={(e) => updateBlock({ statusVar: e.target.value })}
                    className={styles.inputStyle}
                  />
                </div>
              </div>
            </div>
          </div>
        )}

        {type === "http" && (
          <div className={styles.sectionContainer}>
            <div className={styles.sectionHeaderStatic}><h4 className={styles.sectionTitle}>Formato antigo</h4></div>
            <div className={styles.sectionContent}>
              <button
                className={styles.addButton}
                onClick={() => {
                  const c = deepClone(content || {});
                  updateBlock({
                    type: "api_call",
                    method: c.method || "GET",
                    url: c.url || "",
                    headers: safeParseJson(c.headers, {}),
                    body: safeParseJson(c.body, {}),
                    timeout: c.timeout ?? 10000,
                    outputVar: c.outputVar || "apiResponse",
                    statusVar: c.statusVar || "apiStatus",
                    content: undefined,
                  });
                }}
              >
                Migrar para api_call
              </button>
            </div>
          </div>
        )}
      </div>
    </>
  );

  /* ---------------- overlay: REGRAS (somente regras de saída) ---------------- */

  const OverlayRegras = () => (
    <>
      <div className={styles.overlayHeader}>
        <button className={styles.backBtn} onClick={closeOverlay} title="Voltar">
          <ArrowLeft size={18} />
        </button>
        <div className={styles.overlayTitle}>Regras de saída</div>
        <button className={styles.iconGhost} onClick={closeOverlay} title="Fechar"><X size={16} /></button>
      </div>
      <div className={styles.overlayBody}>
        <div className={styles.sectionContainer}>
          <div className={styles.sectionHeaderStatic}>
            <h4 className={styles.sectionTitle}>Regras</h4>
            <span className={styles.sectionCount}>({actions.length}/25)</span>
          </div>
          <div className={styles.sectionContent}>
            {isHuman && (
              <div className={styles.buttonGroup} style={{ marginBottom: 8 }}>
                <button className={styles.addButtonSmall} onClick={() => addOffhoursAction("offhours_true")}>+ Se offhours = true</button>
                <button className={styles.addButtonSmall} onClick={() => addOffhoursAction("reason_holiday")}>+ Se motivo = holiday</button>
                <button className={styles.addButtonSmall} onClick={() => addOffhoursAction("reason_closed")}>+ Se motivo = closed</button>
              </div>
            )}

            {actions.map((action, actionIdx) => (
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
                        const updated = deepClone(actions);
                        updated.splice(actionIdx, 1);
                        updateActions(updated);
                      }}
                    />
                  </div>

                  {(action.conditions || []).map((cond, condIdx) => (
                    <div key={condIdx} className={styles.conditionRow}>
                      {/* Variável */}
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
                            const updated = deepClone(actions);
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
                            updateActions(updated);
                          }}
                          className={styles.selectStyle}
                        >
                          {variableOptions.map((opt) => (
                            <option key={opt.value} value={opt.value}>{opt.label}</option>
                          ))}
                        </select>
                      </div>

                      {/* Nome var custom */}
                      {(!variableOptions.some((v) => v.value === cond.variable) || cond.variable === "") && (
                        <div className={styles.inputGroup}>
                          <label className={styles.inputLabel}>Nome da variável</label>
                          <input
                            type="text"
                            placeholder="ex.: meuCampo"
                            value={cond.variable || ""}
                            onChange={(e) => {
                              const updated = deepClone(actions);
                              updated[actionIdx].conditions[condIdx].variable = e.target.value;
                              updateActions(updated);
                            }}
                            className={styles.inputStyle}
                          />
                        </div>
                      )}

                      {/* Tipo */}
                      <div className={styles.inputGroup}>
                        <label className={styles.inputLabel}>Tipo de condição</label>
                        <select
                          value={cond.type || ""}
                          onChange={(e) => {
                            const updated = deepClone(actions);
                            updated[actionIdx].conditions[condIdx].type = e.target.value;
                            if (e.target.value === "exists") {
                              updated[actionIdx].conditions[condIdx].value = "";
                            }
                            updateActions(updated);
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

                      {/* Valor */}
                      {renderValueInput(cond, (v) => {
                        const updated = deepClone(actions);
                        updated[actionIdx].conditions[condIdx].value = v;
                        updateActions(updated);
                      })}

                      <div className={styles.buttonGroup}>
                        <button
                          className={styles.deleteButtonSmall}
                          onClick={() => {
                            const updated = deepClone(actions);
                            updated[actionIdx].conditions.splice(condIdx, 1);
                            updateActions(updated);
                          }}
                        >
                          <Trash2 size={14} /> Remover condição
                        </button>
                      </div>
                    </div>
                  ))}

                  {/* Próximo bloco */}
                  <div className={styles.inputGroup}>
                    <label className={styles.inputLabel}>Ir para</label>
                    <select
                      value={action.next || ""}
                      onChange={(e) => {
                        const targetId = e.target.value;
                        const updated = deepClone(actions);
                        updated[actionIdx].next = targetId;
                        updateActions(updated);
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
                  updateActions([...(actions || []), newAction]);
                }}
                className={styles.addButton}
              >
                <Plus size={16} /> Adicionar regra
              </button>
            </div>

            {/* Saída padrão */}
            <div className={styles.sectionContainer} style={{ marginTop: 12 }}>
              <div className={styles.sectionHeaderStatic}>
                <h4 className={styles.sectionTitle}>Saída padrão</h4>
              </div>
              <div className={styles.sectionContent}>
                <div className={styles.inputGroup}>
                  <label className={styles.inputLabel}>Próximo bloco</label>
                  <select
                    value={defaultNext || ""}
                    onChange={(e) => updateBlock({ defaultNext: e.target.value })}
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

  /* ---------------- overlay: AÇÕES ESPECIAIS (onEnter / onExit) ---------------- */

  const renderSpecialRow = (list, setKey) => (a, i) => {
    const update = (patch) => {
      const next = ensureArray(list).slice();
      next[i] = { ...next[i], ...patch };
      updateBlock({ [setKey]: next });
    };
    const remove = () => updateBlock({ [setKey]: (list || []).filter((_, idx) => idx !== i) });

    const exampleRef = `{{${a?.scope || "context"}.${a?.key || "nome"}}}`;

    return (
      <div key={`${setKey}-${i}`} className={styles.specialRow}>
        {/* Título (exibido na tela principal) */}
        <div className={styles.inputGroup}>
          <label className={styles.inputLabel}>Título (aparece na tela anterior)</label>
          <input
            className={styles.inputStyle}
            placeholder="ex.: Definir protocolo"
            value={a.title || ""}
            onChange={(e) => update({ title: e.target.value })}
          />
        </div>

        <div className={styles.rowColsAdaptive}>
          <div className={styles.inputGroup}>
            <label className={styles.inputLabel}>Escopo</label>
            <select
              className={styles.selectStyle}
              value={a.scope || "context"}
              onChange={(e) => update({ scope: e.target.value })}
            >
              <option value="context">context</option>
              <option value="contact">contact</option>
              <option value="contact.extra">contact.extra</option>
            </select>
          </div>

          <div className={styles.inputGroup}>
            <label className={styles.inputLabel}>Chave</label>
            <input
              className={styles.inputStyle}
              placeholder="ex.: protocolo"
              value={a.key || ""}
              onChange={(e) => update({ key: e.target.value })}
            />
          </div>

          <div className={styles.inputGroup}>
            <label className={styles.inputLabel}>Valor</label>
            <input
              className={styles.inputStyle}
              placeholder="ex.: 12345"
              value={a.value || ""}
              onChange={(e) => update({ value: e.target.value })}
            />
          </div>

          <div className={styles.inputGroup}>
            <label className={styles.inputLabel}>&nbsp;</label>
            <button className={styles.deleteButtonSmall} onClick={remove}>Remover</button>
          </div>
        </div>

        <div className={styles.headHelp}>
          Essa ação define o valor de uma variável em <strong>{a?.scope || "context"}</strong>.{" "}
          Para usar no fluxo: <code>{exampleRef}</code>
        </div>
      </div>
    );
  };

  const OverlayEspeciais = () => (
    <>
      <div className={styles.overlayHeader}>
        <button className={styles.backBtn} onClick={closeOverlay} title="Voltar">
          <ArrowLeft size={18} />
        </button>
        <div className={styles.overlayTitle}>Ações especiais</div>
        <button className={styles.iconGhost} onClick={closeOverlay} title="Fechar"><X size={16} /></button>
      </div>
      <div className={styles.overlayBody}>
        {/* ENTRADA */}
        <div className={styles.sectionContainer}>
          <div className={styles.sectionHeaderStatic}>
            <h4 className={styles.sectionTitle}>Ao entrar no bloco</h4>
          </div>
          <div className={styles.sectionContent}>
            {(onEnter || []).map(renderSpecialRow(onEnter, "onEnter"))}
            <button
              className={styles.addButtonSmall}
              onClick={() => updateBlock({ onEnter: [...(onEnter || []), { title: "", scope: "context", key: "", value: "" }] })}
            >
              + adicionar na entrada
            </button>
          </div>
        </div>

        {/* SAÍDA */}
        <div className={styles.sectionContainer}>
          <div className={styles.sectionHeaderStatic}>
            <h4 className={styles.sectionTitle}>Ao sair do bloco</h4>
          </div>
          <div className={styles.sectionContent}>
            {(onExit || []).map(renderSpecialRow(onExit, "onExit"))}
            <button
              className={styles.addButtonSmall}
              onClick={() => updateBlock({ onExit: [...(onExit || []), { title: "", scope: "context", key: "", value: "" }] })}
            >
              + adicionar na saída
            </button>
          </div>
        </div>
      </div>
    </>
  );

  /* ---------------- render ---------------- */

  return (
    <aside
      ref={panelRef}
      className={styles.asidePanel}
      data-stop-hotkeys="true"
      onKeyDownCapture={handleKeyDownCapture}
    >
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

      {/* -------- Overlay interno ao componente -------- */}
      <div className={`${styles.overlay} ${overlayMode !== "none" ? styles.overlayOpen : ""}`}>
        {overlayMode === "await" && <OverlayAwait />}
        {overlayMode === "conteudo" && <OverlayConteudo />}
        {overlayMode === "regras" && <OverlayRegras />}
        {overlayMode === "especiais" && <OverlayEspeciais />}
      </div>
    </aside>
  );
}
