import React, { useState, useRef, useCallback } from "react";
import {
  Trash2,
  ChevronDown,
  ChevronUp,
  Plus,
  X,
  MoreHorizontal,
  PencilLine
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
  const [tab, setTab] = useState("conteudo");
  const [expandedSections, setExpandedSections] = useState({
    actions: true,
    default: true,
    special: true,
  });

  const [awaitOpen, setAwaitOpen] = useState(false); // abre tudo do await
  const [editingContent, setEditingContent] = useState(false); // lápis

  const panelRef = useRef(null);
  if (!selectedNode || !selectedNode.data) return null;

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
    saveResponseVar,
    saveContentVar,
  } = block;

  const isHuman = type === "human";

  /* ---------------- helpers ---------------- */
  const deepClone = (obj) => {
    if (typeof structuredClone === "function") return structuredClone(obj);
    return JSON.parse(JSON.stringify(obj ?? {}));
  };
  const clamp = (str = "", max = 100) => (str || "").toString().slice(0, max);
  const makeIdFromTitle = (title, max = 24) =>
    clamp((title || "").toString().trim(), max);
  const safeParseJson = (txt, fallback) => {
    try {
      if (typeof txt === "string" && txt.trim() !== "") return JSON.parse(txt);
      return typeof txt === "object" && txt !== null ? txt : fallback;
    } catch {
      return fallback;
    }
  };
  const pretty = (obj) => {
    try { return JSON.stringify(obj ?? {}, null, 2); } catch { return "{}"; }
  };
  const ensureArray = (v) => (Array.isArray(v) ? v : []);
  const toggleSection = (k) =>
    setExpandedSections((p) => ({ ...p, [k]: !p[k] }));

  const updateNode = (updatedNode) => onChange(updatedNode);
  const updateBlock = (changes) => {
    const updatedNode = {
      ...selectedNode,
      data: { ...selectedNode.data, block: { ...block, ...changes } },
    };
    updateNode(updatedNode);
  };
  const updateContent = (field, value) => {
    const cloned = deepClone(content);
    cloned[field] = value;
    updateBlock({ content: cloned });
  };
  const updateActions = (newActions) => updateBlock({ actions: deepClone(newActions) });

  /* ---- atalhos human ---- */
  const addOffhoursAction = (kind) => {
    let conds = [];
    if (kind === "offhours_true") conds = [{ variable: "offhours", type: "equals", value: "true" }];
    else if (kind === "reason_holiday") conds = [{ variable: "offhours_reason", type: "equals", value: "holiday" }];
    else if (kind === "reason_closed") conds = [{ variable: "offhours_reason", type: "equals", value: "closed" }];
    updateActions([...(actions || []), { next: "", conditions: conds }]);
  };

  /* ---- evitar hotkeys do builder ---- */
  const isEditableTarget = (el) => {
    if (!el) return false;
    if (el.isContentEditable) return true;
    const tag = el.tagName?.toUpperCase?.();
    if (tag === "TEXTAREA") return true;
    if (tag === "INPUT") {
      const t = (el.type || "").toLowerCase();
      const textLike = ["text","search","url","tel","email","password","number","date","datetime-local","time"];
      if (textLike.includes(t)) return !el.readOnly && !el.disabled;
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

  /* ---------------- UI: Preview estilo chat ---------------- */

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

  const ChatPreview = () => (
    <div className={styles.chatPreviewCard}>
      {/* botões flutuantes no topo direito */}
      <div className={styles.floatingBtns}>
        <button
          className={styles.iconGhost}
          title="Editar conteúdo"
          onClick={() => setEditingContent((v) => !v)}
        >
          <PencilLine size={16} />
        </button>
        <button className={styles.iconGhost} title="Mais opções">
          <MoreHorizontal size={16} />
        </button>
      </div>

      <div className={styles.chatArea}>
        <div className={styles.typingDot}>•••</div>

        <div className={styles.bubble}>
          <div className={styles.bubbleText}>
            {type === "text" && (block.content || <em className={styles.placeholder}>Sem mensagem</em>)}

            {type === "interactive" && (
              <>
                <div>
                  {(content?.body?.text || "").length
                    ? content?.body?.text
                    : <em className={styles.placeholder}>Sem corpo</em>}
                </div>
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

        {/* Chip: Entrada do usuário — abre o card do await */}
        <button
          type="button"
          className={styles.userInputChip}
          onClick={() => setAwaitOpen((v) => !v)}
          title="Configurar aguardar resposta"
        >
          Entrada do usuário
          <span className={`${styles.caret} ${awaitOpen ? styles.caretUp : ""}`} />
        </button>
      </div>
    </div>
  );

  /* ---------------- Card "Aguardar resposta" (tudo do await) ---------------- */

  const renderAwaitCard = () => (
    <div className={styles.cardToggle}>
      <button
        type="button"
        className={styles.cardToggleHeaderBtn}
        onClick={() => setAwaitOpen((v) => !v)}
      >
        <span className={styles.cardTitleStrong}>Aguardar resposta</span>
        {awaitOpen ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
      </button>

      {awaitOpen && (
        <div className={styles.cardToggleBody}>
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
              <small className={styles.helpText}>
                Se vazio, não salva.
              </small>
            </div>
          </div>

          {(type === "interactive" || type === "media") && (
            <div className={styles.inputGroup}>
              <label className={styles.inputLabel}>Salvar conteúdo rico em</label>
              <input
                type="text"
                placeholder="ex.: context.lastcontentmessage"
                value={saveContentVar || ""}
                onChange={(e) => updateBlock({ saveContentVar: e.target.value })}
                className={styles.inputStyle}
              />
              <small className={styles.helpText}>
                Guarda o payload/ID/URL do item escolhido.
              </small>
            </div>
          )}
        </div>
      )}
    </div>
  );

  /* ---------------- Variáveis para condições ---------------- */

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
          <select
            className={styles.selectStyle}
            value={cond.value ?? "true"}
            onChange={(e) => onChangeValue(e.target.value)}
          >
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
          <select
            className={styles.selectStyle}
            value={cond.value ?? "holiday"}
            onChange={(e) => onChangeValue(e.target.value)}
          >
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

  /* ---------------- Abas ---------------- */

  const renderActionsTab = () => (
    <div className={styles.tabContent}>
      <div className={styles.sectionContainer}>
        <div className={styles.sectionHeader} onClick={() => toggleSection("actions")}>
          <h4 className={styles.sectionTitle}>
            Condições de Saída
            <span className={styles.sectionCount}>({actions.length}/25)</span>
          </h4>
          {expandedSections.actions ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
        </div>

        {expandedSections.actions && (
          <div className={styles.sectionContent}>
            {isHuman && (
              <div className={styles.buttonGroup} style={{ marginBottom: 8 }}>
                <button className={styles.addButtonSmall} onClick={() => addOffhoursAction("offhours_true")}>
                  + Se offhours = true
                </button>
                <button className={styles.addButtonSmall} onClick={() => addOffhoursAction("reason_holiday")}>
                  + Se motivo = holiday
                </button>
                <button className={styles.addButtonSmall} onClick={() => addOffhoursAction("reason_closed")}>
                  + Se motivo = closed
                </button>
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
                    <strong className={styles.actionTitle}>Condição {actionIdx + 1}</strong>
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
                            <option key={opt.value} value={opt.value}>
                              {opt.label}
                            </option>
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
                    <label className={styles.inputLabel}>Próximo Bloco</label>
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
                <Plus size={16} /> Adicionar condição
              </button>
            </div>
          </div>
        )}
      </div>

      {/* ===== Ações especiais (variáveis) ===== */}
      <div className={styles.sectionContainer}>
        <div className={styles.sectionHeader} onClick={() => toggleSection("special")}>
          <h4 className={styles.sectionTitle}>Ações especiais (variáveis)</h4>
          {expandedSections.special ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
        </div>

        {expandedSections.special && (
          <div className={styles.sectionContent}>
            {/* ENTRADA */}
            <h5 className={styles.smallTitle}>Ao entrar no bloco</h5>
            {(block.onEnter || []).map((a, i) => (
              <div key={`en-${i}`} className={styles.rowItemStyle}>
                <select
                  className={styles.selectStyle}
                  value={a.scope || "context"}
                  onChange={(e) => {
                    const next = ensureArray(block.onEnter).slice();
                    next[i] = { ...next[i], scope: e.target.value };
                    updateBlock({ onEnter: next });
                  }}
                >
                  <option value="context">context</option>
                  <option value="contact">contact</option>
                  <option value="contact.extra">contact.extra</option>
                </select>
                <input
                  className={styles.inputStyle}
                  placeholder="chave (ex.: protocolo)"
                  value={a.key || ""}
                  onChange={(e) => {
                    const next = ensureArray(block.onEnter).slice();
                    next[i] = { ...next[i], key: e.target.value };
                    updateBlock({ onEnter: next });
                  }}
                />
                <input
                  className={styles.inputStyle}
                  placeholder="valor (ex.: 12345)"
                  value={a.value || ""}
                  onChange={(e) => {
                    const next = ensureArray(block.onEnter).slice();
                    next[i] = { ...next[i], value: e.target.value };
                    updateBlock({ onEnter: next });
                  }}
                />
                <button
                  className={styles.deleteButtonSmall}
                  onClick={() => updateBlock({ onEnter: (block.onEnter || []).filter((_, idx) => idx !== i) })}
                >
                  Remover
                </button>
              </div>
            ))}
            <button
              className={styles.addButtonSmall}
              onClick={() => updateBlock({ onEnter: [...(block.onEnter || []), { scope: "context", key: "", value: "" }] })}
            >
              + adicionar na entrada
            </button>

            <div className={styles.dividerLine} style={{ margin: "12px 0" }} />

            {/* SAÍDA */}
            <h5 className={styles.smallTitle}>Ao sair do bloco</h5>
            {(block.onExit || []).map((a, i) => (
              <div key={`ex-${i}`} className={styles.rowItemStyle}>
                <select
                  className={styles.selectStyle}
                  value={a.scope || "context"}
                  onChange={(e) => {
                    const next = ensureArray(block.onExit).slice();
                    next[i] = { ...next[i], scope: e.target.value };
                    updateBlock({ onExit: next });
                  }}
                >
                  <option value="context">context</option>
                  <option value="contact">contact</option>
                  <option value="contact.extra">contact.extra</option>
                </select>
                <input
                  className={styles.inputStyle}
                  placeholder="chave (ex.: etapaAtual)"
                  value={a.key || ""}
                  onChange={(e) => {
                    const next = ensureArray(block.onExit).slice();
                    next[i] = { ...next[i], key: e.target.value };
                    updateBlock({ onExit: next });
                  }}
                />
                <input
                  className={styles.inputStyle}
                  placeholder="valor (ex.: finalizado)"
                  value={a.value || ""}
                  onChange={(e) => {
                    const next = ensureArray(block.onExit).slice();
                    next[i] = { ...next[i], value: e.target.value };
                    updateBlock({ onExit: next });
                  }}
                />
                <button
                  className={styles.deleteButtonSmall}
                  onClick={() => updateBlock({ onExit: (block.onExit || []).filter((_, idx) => idx !== i) })}
                >
                  Remover
                </button>
              </div>
            ))}
            <button
              className={styles.addButtonSmall}
              onClick={() => updateBlock({ onExit: [...(block.onExit || []), { scope: "context", key: "", value: "" }] })}
            >
              + adicionar na saída
            </button>
          </div>
        )}
      </div>

      {/* Saída padrão */}
      <div className={styles.sectionContainer}>
        <div className={styles.sectionHeader} onClick={() => toggleSection("default")}>
          <h4 className={styles.sectionTitle}>Saída Padrão</h4>
          {expandedSections.default ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
        </div>

        {expandedSections.default && (
          <div className={styles.sectionContent}>
            <div className={styles.inputGroup}>
              <label className={styles.inputLabel}>Próximo Bloco</label>
              <select
                value={block.defaultNext || ""}
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
        )}
      </div>
    </div>
  );

  const renderContentTab = () => {
    if (isHuman) {
      return (
        <div className={styles.tabContent}>
          <div className={styles.infoBlock}>
            Este bloco envia a conversa para <strong>atendimento humano</strong>.
            Não há configurações adicionais.
          </div>
          <ChatPreview />
          {renderAwaitCard()}
        </div>
      );
    }

    return (
      <div className={styles.tabContent}>
        <ChatPreview />

        {/* Editores por tipo (abrir/fechar com o lápis opcionalmente) */}
        {(editingContent || type !== "text") && type === "text" && (
          <div className={styles.sectionContainer}>
            <div className={styles.sectionHeader}>
              <h4 className={styles.sectionTitle}>Mensagem</h4>
            </div>
            <div className={styles.sectionContent}>
              <div className={styles.inputGroup}>
                <label className={styles.inputLabel}>Texto</label>
                <textarea
                  rows={6}
                  value={block.content || ""}
                  onChange={(e) => updateBlock({ content: e.target.value })}
                  className={styles.textareaStyle}
                />
              </div>
            </div>
          </div>
        )}

        {type === "interactive" && (
          <div className={styles.sectionContainer}>
            <div className={styles.sectionHeader}>
              <h4 className={styles.sectionTitle}>Interativo</h4>
            </div>
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
                          action: {
                            button: "Abrir lista",
                            sections: [{ title: "Seção 1", rows: [{ id: "Item 1", title: "Item 1", description: "" }]}],
                          },
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

              <div className={styles.inputGroup}>
                <label className={styles.inputLabel}>Rodapé</label>
                <input
                  type="text"
                  value={content.footer?.text || ""}
                  onChange={(e) =>
                    updateContent("footer", { ...(deepClone(content.footer) || {}), text: e.target.value })
                  }
                  className={styles.inputStyle}
                />
              </div>

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
                    <small className={styles.helpText}>máx. 20 caracteres</small>
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
            </div>
          </div>
        )}

        {type === "media" && (
          <div className={styles.sectionContainer}>
            <div className={styles.sectionHeader}><h4 className={styles.sectionTitle}>Mídia</h4></div>
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
            <div className={styles.sectionHeader}><h4 className={styles.sectionTitle}>Localização</h4></div>
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
            <div className={styles.sectionHeader}><h4 className={styles.sectionTitle}>Script</h4></div>
            <div className={styles.sectionContent}>
              <button
                onClick={() => { setScriptCode(selectedNode?.data?.block?.code || ""); setShowScriptEditor(true); }}
                className={styles.addButtonSmall}
              >
                Abrir editor de código
              </button>
              <div className={styles.inputGroup}><label className={styles.inputLabel}>Função</label>
                <input type="text" value={block.function || ""} onChange={(e) => updateBlock({ function: e.target.value })} className={styles.inputStyle}/></div>
              <div className={styles.inputGroup}><label className={styles.inputLabel}>Variável de saída</label>
                <input type="text" value={block.outputVar || ""} onChange={(e) => updateBlock({ outputVar: e.target.value })} className={styles.inputStyle}/></div>
            </div>
          </div>
        )}

        {/* Card "Aguardar resposta" — abre também pelo chip */}
        {renderAwaitCard()}
      </div>
    );
  };

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

        {selectedNode.data.nodeType === "start" ? (
          <div className={styles.tabButtons}>
            <button className={`${styles.tabButton} ${styles.tabButtonActive}`} disabled>Ações</button>
          </div>
        ) : (
          <div className={styles.tabButtons}>
            <button className={`${styles.tabButton} ${tab === "conteudo" ? styles.tabButtonActive : ""}`} onClick={() => setTab("conteudo")}>Conteúdo</button>
            <button className={`${styles.tabButton} ${tab === "acoes" ? styles.tabButtonActive : ""}`} onClick={() => setTab("acoes")}>Condições de saída</button>
          </div>
        )}

        {selectedNode.data.nodeType === "start" ? renderActionsTab() : tab === "conteudo" ? renderContentTab() : renderActionsTab()}
      </div>
    </aside>
  );
}
