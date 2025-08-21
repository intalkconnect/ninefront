import React, { useState } from "react";
import { Trash2, ChevronDown, ChevronUp, Plus, X } from "lucide-react";
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
    basic: true,
    content: true,
    actions: true,
    history: true,
    default: true,
    offhoursShortcuts: true,
  });

  const toggleSection = (section) => {
    setExpandedSections((prev) => ({
      ...prev,
      [section]: !prev[section],
    }));
  };

  if (!selectedNode || !selectedNode.data) return null;

  const { block } = selectedNode.data;
  const {
    type,
    content = {},
    awaitResponse,
    sendDelayInSeconds,
    actions = [],
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

  const updateNode = (updatedNode) => onChange(updatedNode);

  const updateBlock = (changes) => {
    const updatedNode = {
      ...selectedNode,
      data: {
        ...selectedNode.data,
        block: {
          ...block,
          ...changes,
        },
      },
    };
    updateNode(updatedNode);
  };

  const updateContent = (field, value) => {
    const cloned = deepClone(content);
    cloned[field] = value;
    updateBlock({ content: cloned });
  };

  const updateActions = (newActions) => {
    updateBlock({ actions: deepClone(newActions) });
  };

  /* -------- atalhos HUMAN -------- */

  const addOffhoursAction = (kind) => {
    let conds = [];
    if (kind === "offhours_true") {
      conds = [{ variable: "offhours", type: "equals", value: "true" }];
    } else if (kind === "reason_holiday") {
      conds = [{ variable: "offhours_reason", type: "equals", value: "holiday" }];
    } else if (kind === "reason_closed") {
      conds = [{ variable: "offhours_reason", type: "equals", value: "closed" }];
    }
    const newAction = { next: "", conditions: conds };
    updateActions([...(actions || []), newAction]);
  };

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

  /* ---------------- tabs ---------------- */

  const renderActionsTab = () => (
    <div className={styles.tabContent}>
      <div className={styles.sectionContainer}>
        <div
          className={styles.sectionHeader}
          onClick={() => toggleSection("actions")}
        >
          <h4 className={styles.sectionTitle}>
            Condições de Saída
            <span className={styles.sectionCount}>({actions.length}/25)</span>
          </h4>
          {expandedSections.actions ? (
            <ChevronUp size={16} />
          ) : (
            <ChevronDown size={16} />
          )}
        </div>

        {expandedSections.actions && (
          <div className={styles.sectionContent}>
            {/* atalhos human (opcional: comente se não quiser) */}
            {isHuman && (
              <div className={styles.buttonGroup} style={{ marginBottom: 8 }}>
                <button
                  className={styles.addButtonSmall}
                  onClick={() => addOffhoursAction("offhours_true")}
                >
                  + Se offhours = true
                </button>
                <button
                  className={styles.addButtonSmall}
                  onClick={() => addOffhoursAction("reason_holiday")}
                >
                  + Se offhours_reason = holiday
                </button>
                <button
                  className={styles.addButtonSmall}
                  onClick={() => addOffhoursAction("reason_closed")}
                >
                  + Se offhours_reason = closed
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
                    <strong className={styles.actionTitle}>
                      Condição {actionIdx + 1}
                    </strong>
                    <Trash2
                      size={16}
                      color="#ff6b6b"
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
                              if (
                                !updated[actionIdx].conditions[condIdx].type ||
                                updated[actionIdx].conditions[condIdx].type === ""
                              ) {
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

                      {/* Nome da variável custom */}
                      {(!variableOptions.some((v) => v.value === cond.variable) ||
                        cond.variable === "") && (
                        <div className={styles.inputGroup}>
                          <label className={styles.inputLabel}>Nome da variável</label>
                          <input
                            type="text"
                            placeholder="ex.: meuCampo"
                            value={cond.variable || ""}
                            onChange={(e) => {
                              const updated = deepClone(actions);
                              updated[actionIdx].conditions[condIdx].variable =
                                e.target.value;
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
                            updated[actionIdx].conditions[condIdx].type =
                              e.target.value;
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
                          <Trash2 size={14} /> Remover Condição
                        </button>
                      </div>
                    </div>
                  ))}

                  <div className={styles.buttonGroup}>
                    <button
                      onClick={() => {
                        const newCondition = {
                          variable: "lastUserMessage",
                          type: "exists",
                          value: "",
                        };
                        const updated = deepClone(actions);
                        if (!updated[actionIdx].conditions) {
                          updated[actionIdx].conditions = [];
                        }
                        updated[actionIdx].conditions.push(newCondition);
                        updateActions(updated);
                      }}
                      className={styles.addButtonSmall}
                    >
                      <Plus size={14} /> Adicionar Condição
                    </button>
                  </div>

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
                          onConnectNodes({
                            source: selectedNode.id,
                            target: targetId,
                          });
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
                    conditions: [
                      { variable: "lastUserMessage", type: "exists", value: "" },
                    ],
                  };
                  updateActions([...(actions || []), newAction]);
                }}
                className={styles.addButton}
              >
                <Plus size={16} /> Adicionar Ação
              </button>
            </div>
          </div>
        )}
      </div>

      <div className={styles.sectionContainer}>
        <div
          className={styles.sectionHeader}
          onClick={() => toggleSection("default")}
        >
          <h4 className={styles.sectionTitle}>Saída Padrão</h4>
          {expandedSections.default ? (
            <ChevronUp size={16} />
          ) : (
            <ChevronDown size={16} />
          )}
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
    if (type === "text") {
      return (
        <div className={styles.sectionContent}>
          <div className={styles.inputGroup}>
            <label className={styles.inputLabel}>Mensagem</label>
            <textarea
              rows={5}
              value={block.content || ""}
              onChange={(e) => updateBlock({ content: e.target.value })}
              className={styles.textareaStyle}
            />
          </div>

          <div className={styles.inputGroup}>
            <label className={styles.inputLabel}>Aguardar resposta?</label>
            <select
              value={String(!!awaitResponse)}
              onChange={(e) =>
                updateBlock({ awaitResponse: e.target.value === "true" })
              }
              className={styles.selectStyle}
            >
              <option value="true">Sim</option>
              <option value="false">Não</option>
            </select>
          </div>

          <div className={styles.inputGroup}>
            <label className={styles.inputLabel}>Atraso de envio (segundos)</label>
            <input
              type="number"
              value={sendDelayInSeconds ?? 0}
              onChange={(e) =>
                updateBlock({
                  sendDelayInSeconds: parseInt(e.target.value || "0", 10),
                })
              }
              className={styles.inputStyle}
            />
          </div>
        </div>
      );
    }

    if (type === "media") {
      return (
        <div className={styles.sectionContent}>
          <div className={styles.inputGroup}>
            <label className={styles.inputLabel}>Tipo de mídia</label>
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
            <input
              type="text"
              value={content.url || ""}
              onChange={(e) => updateContent("url", e.target.value)}
              className={styles.inputStyle}
            />
          </div>

          <div className={styles.inputGroup}>
            <label className={styles.inputLabel}>Legenda</label>
            <input
              type="text"
              value={content.caption || ""}
              onChange={(e) => updateContent("caption", e.target.value)}
              className={styles.inputStyle}
            />
          </div>

          <div className={styles.inputGroup}>
            <label className={styles.inputLabel}>Aguardar resposta?</label>
            <select
              value={String(!!awaitResponse)}
              onChange={(e) =>
                updateBlock({ awaitResponse: e.target.value === "true" })
              }
              className={styles.selectStyle}
            >
              <option value="true">Sim</option>
              <option value="false">Não</option>
            </select>
          </div>

          <div className={styles.inputGroup}>
            <label className={styles.inputLabel}>Atraso de envio (segundos)</label>
            <input
              type="number"
              value={sendDelayInSeconds ?? 0}
              onChange={(e) =>
                updateBlock({
                  sendDelayInSeconds: parseInt(e.target.value || "0", 10),
                })
              }
              className={styles.inputStyle}
            />
          </div>
        </div>
      );
    }

    if (type === "human") {
      return (
        <div className={styles.sectionContent}>
          <div className={styles.inputGroup}>
            <label className={styles.inputLabel}>Nome da fila de atendimento</label>
            <input
              type="text"
              value={content.queueName || ""}
              onChange={(e) => updateContent("queueName", e.target.value)}
              className={styles.inputStyle}
            />
          </div>
        </div>
      );
    }

    if (type === "interactive") {
      const isList = content.type === "list";
      const isQuickReply = content.type === "button";

      /* ------ handlers quick reply ------ */

      const handleAddButton = () => {
        const current = deepClone(content.action?.buttons || []);
        if (current.length >= 3) return alert("Máximo de 3 botões atingido.");
        const newBtn = {
          type: "reply",
          reply: { id: "Novo botão", title: "Novo botão" },
        };
        const nextButtons = [...current, newBtn];
        const nextAction = {
          ...(deepClone(content.action) || {}),
          buttons: nextButtons,
        };
        const nextContent = { ...deepClone(content), action: nextAction };
        updateBlock({ content: nextContent });
      };

      const handleRemoveButton = (index) => {
        const current = deepClone(content.action?.buttons || []);
        current.splice(index, 1);
        const nextAction = { ...(deepClone(content.action) || {}), buttons: current };
        const nextContent = { ...deepClone(content), action: nextAction };
        updateBlock({ content: nextContent });
      };

      /* ------ handlers list ------ */

      const handleAddListItem = () => {
        const sections = deepClone(content.action?.sections || [{ title: "", rows: [] }]);
        const rows = sections[0]?.rows || [];
        if (rows.length >= 10) return alert("Máximo de 10 itens atingido.");
        const n = rows.length + 1;
        const title = `Item ${n}`;
        const newItem = { id: makeIdFromTitle(title, 24), title, description: "" };
        const nextRows = [...rows, newItem];
        const nextSections = [{ ...(sections[0] || {}), rows: nextRows }];
        const nextAction = { ...(deepClone(content.action) || {}), sections: nextSections };
        const nextContent = { ...deepClone(content), action: nextAction };
        updateBlock({ content: nextContent });
      };

      const handleRemoveListItem = (index) => {
        const sections = deepClone(content.action?.sections || [{ title: "", rows: [] }]);
        const rows = [...(sections[0]?.rows || [])];
        rows.splice(index, 1);
        const nextSections = [{ ...(sections[0] || {}), rows }];
        const nextAction = { ...(deepClone(content.action) || {}), sections: nextSections };
        const nextContent = { ...deepClone(content), action: nextAction };
        updateBlock({ content: nextContent });
      };

      const handleUpdateRows = (rows) => {
        const sections = deepClone(content.action?.sections || [{ title: "", rows: [] }]);
        const nextSections = [{ ...(sections[0] || {}), rows }];
        const nextAction = { ...(deepClone(content.action) || {}), sections: nextSections };
        const nextContent = { ...deepClone(content), action: nextAction };
        updateBlock({ content: nextContent });
      };

      return (
        <div className={styles.sectionContent}>
          <div className={styles.inputGroup}>
            <label className={styles.inputLabel}>Tipo de interativo</label>
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
                      header: { text: "🎯 Menu de Opções", type: "text" },
                      action: {
                        // ★ campo editável abaixo
                        button: "Abrir lista",
                        sections: [
                          {
                            title: "Seção 1", // interno; não exposto na UI (pedido: trocar pelo button)
                            rows: [{ id: "Item 1", title: "Item 1", description: "" }],
                          },
                        ],
                      },
                    }),
                  });
                } else {
                  updateBlock({
                    content: deepClone({
                      type: "button",
                      body: { text: "Deseja continuar?" },
                      footer: { text: "Selecione uma opção" },
                      action: {
                        buttons: [
                          { type: "reply", reply: { id: "👍 Sim", title: "👍 Sim" } },
                          { type: "reply", reply: { id: "👎 Não", title: "👎 Não" } },
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
                updateContent("body", {
                  ...(deepClone(content.body) || {}),
                  text: e.target.value,
                })
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
                updateContent("footer", {
                  ...(deepClone(content.footer) || {}),
                  text: e.target.value,
                })
              }
              className={styles.inputStyle}
            />
          </div>

          <div className={styles.inputGroup}>
            <label className={styles.inputLabel}>Aguardar resposta?</label>
            <select
              value={String(!!awaitResponse)}
              onChange={(e) =>
                updateBlock({ awaitResponse: e.target.value === "true" })
              }
              className={styles.selectStyle}
            >
              <option value="true">Sim</option>
              <option value="false">Não</option>
            </select>
          </div>

          <div className={styles.inputGroup}>
            <label className={styles.inputLabel}>Atraso de envio (segundos)</label>
            <input
              type="number"
              value={sendDelayInSeconds ?? 0}
              onChange={(e) =>
                updateBlock({
                  sendDelayInSeconds: parseInt(e.target.value || "0", 10),
                })
              }
              className={styles.inputStyle}
            />
          </div>

          {/* ====== LIST: campo substituto (button) ====== */}
          {isList && (
            <>
              {/* Substitui "Título da seção" por este campo */}
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
                      sections: deepClone(
                        content.action?.sections || [{ title: "Seção 1", rows: [] }]
                      ),
                    };
                    const nextContent = { ...deepClone(content), action: nextAction };
                    updateBlock({ content: nextContent });
                  }}
                  className={styles.inputStyle}
                  placeholder="Ex.: Abrir opções"
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
                      const sections = deepClone(
                        content.action?.sections || [{ title: "Seção 1", rows: [] }]
                      );
                      const rows = [...(sections[0]?.rows || [])];
                      rows[idx] = {
                        ...(rows[idx] || {}),
                        title: clamp(value, 24),
                        // ★ ID segue o título
                        id: makeIdFromTitle(value, 24),
                      };
                      sections[0] = { ...(sections[0] || {}), rows };
                      const nextAction = {
                        ...(deepClone(content.action) || {}),
                        sections,
                      };
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
                      const sections = deepClone(
                        content.action?.sections || [{ title: "Seção 1", rows: [] }]
                      );
                      const rows = [...(sections[0]?.rows || [])];
                      rows[idx] = {
                        ...(rows[idx] || {}),
                        description: e.target.value,
                      };
                      sections[0] = { ...(sections[0] || {}), rows };
                      const nextAction = {
                        ...(deepClone(content.action) || {}),
                        sections,
                      };
                      const nextContent = { ...deepClone(content), action: nextAction };
                      updateBlock({ content: nextContent });
                    }}
                    className={styles.inputStyle}
                  />
                  <Trash2
                    size={18}
                    color="#f55"
                    className={styles.trashIcon}
                    onClick={() => handleRemoveListItem(idx)}
                    title="Remover item"
                  />
                </div>
              ))}

              <button onClick={handleAddListItem} className={styles.addButton}>
                + Adicionar item
              </button>
            </>
          )}

          {/* ====== QUICK REPLY buttons ====== */}
          {isQuickReply && (
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
                        ...(buttons[idx] || {
                          type: "reply",
                          reply: { id: "", title: "" },
                        }),
                        reply: {
                          ...(buttons[idx]?.reply || {}),
                          title: value,
                          id: value, // ★ ID = Título
                        },
                      };
                      const nextAction = {
                        ...(deepClone(content.action) || {}),
                        buttons,
                      };
                      const nextContent = { ...deepClone(content), action: nextAction };
                      updateBlock({ content: nextContent });
                    }}
                    className={styles.inputStyle}
                  />
                  <Trash2
                    size={18}
                    color="#f55"
                    className={styles.trashIcon}
                    onClick={() => handleRemoveButton(idx)}
                    title="Remover botão"
                  />
                </div>
              ))}

              <button onClick={handleAddButton} className={styles.addButton}>
                + Adicionar botão
              </button>
            </>
          )}
        </div>
      );
    }

    if (type === "location") {
      return (
        <div className={styles.sectionContent}>
          <div className={styles.inputGroup}>
            <label className={styles.inputLabel}>Nome</label>
            <input
              type="text"
              value={content.name || ""}
              onChange={(e) => updateContent("name", e.target.value)}
              className={styles.inputStyle}
            />
          </div>

          <div className={styles.inputGroup}>
            <label className={styles.inputLabel}>Endereço</label>
            <input
              type="text"
              value={content.address || ""}
              onChange={(e) => updateContent("address", e.target.value)}
              className={styles.inputStyle}
            />
          </div>

          <div className={styles.inputGroup}>
            <label className={styles.inputLabel}>Latitude</label>
            <input
              type="text"
              value={content.latitude || ""}
              onChange={(e) => updateContent("latitude", e.target.value)}
              className={styles.inputStyle}
            />
          </div>

          <div className={styles.inputGroup}>
            <label className={styles.inputLabel}>Longitude</label>
            <input
              type="text"
              value={content.longitude || ""}
              onChange={(e) => updateContent("longitude", e.target.value)}
              className={styles.inputStyle}
            />
          </div>

          <div className={styles.inputGroup}>
            <label className={styles.inputLabel}>Aguardar resposta?</label>
            <select
              value={String(!!awaitResponse)}
              onChange={(e) =>
                updateBlock({ awaitResponse: e.target.value === "true" })
              }
              className={styles.selectStyle}
            >
              <option value="true">Sim</option>
              <option value="false">Não</option>
            </select>
          </div>

          <div className={styles.inputGroup}>
            <label className={styles.inputLabel}>Atraso de envio (segundos)</label>
            <input
              type="number"
              value={sendDelayInSeconds ?? 0}
              onChange={(e) =>
                updateBlock({
                  sendDelayInSeconds: parseInt(e.target.value || "0", 10),
                })
              }
              className={styles.inputStyle}
            />
          </div>
        </div>
      );
    }

    if (type === "code") {
      return (
        <div className={styles.sectionContent}>
          <button
            onClick={() => {
              setScriptCode(selectedNode?.data?.block?.code || "");
              setShowScriptEditor(true);
            }}
            className={styles.codeButton}
          >
            Abrir editor de código
          </button>

          <div className={styles.inputGroup}>
            <label className={styles.inputLabel}>Função</label>
            <input
              type="text"
              value={block.function || ""}
              onChange={(e) => updateBlock({ function: e.target.value })}
              className={styles.inputStyle}
            />
          </div>

          <div className={styles.inputGroup}>
            <label className={styles.inputLabel}>Variável de saída</label>
            <input
              type="text"
              value={block.outputVar || ""}
              onChange={(e) => updateBlock({ outputVar: e.target.value })}
              className={styles.inputStyle}
            />
          </div>
        </div>
      );
    }

    if (type === "http") {
      return (
        <div className={styles.sectionContent}>
          <div className={styles.inputGroup}>
            <label className={styles.inputLabel}>Método</label>
            <select
              value={content.method || "GET"}
              onChange={(e) => updateContent("method", e.target.value)}
              className={styles.selectStyle}
            >
              <option value="GET">GET</option>
              <option value="POST">POST</option>
              <option value="PUT">PUT</option>
              <option value="DELETE">DELETE</option>
            </select>
          </div>

          <div className={styles.inputGroup}>
            <label className={styles.inputLabel}>URL</label>
            <input
              type="text"
              value={content.url || ""}
              onChange={(e) => updateContent("url", e.target.value)}
              className={styles.inputStyle}
            />
          </div>

          <div className={styles.inputGroup}>
            <label className={styles.inputLabel}>Headers (JSON)</label>
            <textarea
              rows={3}
              value={content.headers || ""}
              onChange={(e) => updateContent("headers", e.target.value)}
              className={styles.textareaStyle}
            />
          </div>

          <div className={styles.inputGroup}>
            <label className={styles.inputLabel}>Body (JSON)</label>
            <textarea
              rows={4}
              value={content.body || ""}
              onChange={(e) => updateContent("body", e.target.value)}
              className={styles.textareaStyle}
            />
          </div>
        </div>
      );
    }

    return null;
  };

  return (
    <aside className={styles.asidePanel}>
      <div className={styles.panelHeader}>
        <h3 className={styles.panelTitle}>
          {selectedNode.data.label || "Novo Bloco"}
        </h3>
        <button
          onClick={() => onClose()}
          className={styles.closeButton}
          title="Fechar"
        >
          <X size={20} />
        </button>
      </div>

      <div className={styles.tabContent}>
        <div>
          <div className={styles.inputGroup}>
            <label className={styles.inputLabel}>Nome do Bloco</label>
            {selectedNode.data.nodeType === "start" ? (
              <div className={styles.startNodeInfo}>
                Este é o <strong>bloco inicial</strong> do fluxo. Ele é fixo,
                com redirecionamento automático para o próximo bloco
                configurado.
              </div>
            ) : (
              <input
                type="text"
                value={selectedNode.data.label}
                onChange={(e) =>
                  onChange({
                    ...selectedNode,
                    data: { ...selectedNode.data, label: e.target.value },
                  })
                }
                className={styles.inputStyle}
                placeholder="Nomeie este bloco"
              />
            )}
          </div>
        </div>

        {selectedNode.data.nodeType === "start" ? (
          <div className={styles.tabButtons}>
            <button className={`${styles.tabButton} ${styles.tabButtonActive}`} disabled>
              Ações
            </button>
          </div>
        ) : (
          <div className={styles.tabButtons}>
            <button
              className={`${styles.tabButton} ${
                tab === "conteudo" ? styles.tabButtonActive : ""
              }`}
              onClick={() => setTab("conteudo")}
            >
              Conteúdo
            </button>
            <button
              className={`${styles.tabButton} ${
                tab === "acoes" ? styles.tabButtonActive : ""
              }`}
              onClick={() => setTab("acoes")}
            >
              Ações
            </button>
          </div>
        )}

        {selectedNode.data.nodeType === "start"
          ? renderActionsTab()
          : tab === "conteudo"
          ? renderContentTab()
          : renderActionsTab()}
      </div>
    </aside>
  );
}
