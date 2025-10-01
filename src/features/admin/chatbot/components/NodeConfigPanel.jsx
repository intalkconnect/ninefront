import React, { useState, useRef, useCallback, useMemo } from "react";
import {
  Trash2,
  ChevronDown,
  ChevronUp,
  Plus,
  X,
  PencilLine,
  Save
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
  const [editingOpen, setEditingOpen] = useState(false);
  const [awaitOpen, setAwaitOpen] = useState(false);

  const panelRef = useRef(null);

  // ========== VALIDAÇÕES ==========
  if (!selectedNode?.data) return null;

  const block = selectedNode.data.block || {};
  const {
    type,
    content = {},
    awaitResponse,
    awaitTimeInSeconds,
    sendDelayInSeconds,
    actions = [],
  } = block;

  const isHuman = type === "human";
  const isStart = selectedNode.data.nodeType === "start";

  // ========== HELPERS ==========
  const deepClone = (obj) =>
    typeof structuredClone === "function" 
      ? structuredClone(obj) 
      : JSON.parse(JSON.stringify(obj ?? {}));

  const clamp = (str = "", max = 100) => (str || "").toString().slice(0, max);
  
  const makeIdFromTitle = (title, max = 24) => 
    clamp((title || "").toString().trim(), max);

  const ensureArray = (v) => (Array.isArray(v) ? v : []);

  const toggleSection = (k) =>
    setExpandedSections((p) => ({ ...p, [k]: !p[k] }));

  const updateBlock = useCallback((changes) => {
    onChange({ 
      ...selectedNode, 
      data: { 
        ...selectedNode.data, 
        block: { ...block, ...changes } 
      } 
    });
  }, [selectedNode, block, onChange]);

  const updateContent = useCallback((field, value) => {
    const cloned = deepClone(content);
    cloned[field] = value;
    updateBlock({ content: cloned });
  }, [content, updateBlock]);

  const updateActions = useCallback((newActions) => {
    updateBlock({ actions: deepClone(newActions) });
  }, [updateBlock]);

  // ========== VARIÁVEIS PARA CONDIÇÕES ==========
  const variableOptions = useMemo(() => {
    const base = [
      { value: "lastUserMessage", label: "Resposta do usuário" },
      { value: "custom", label: "Variável personalizada" },
    ];
    
    if (isHuman) {
      base.splice(1, 0,
        { value: "offhours", label: "Fora do expediente" },
        { value: "offhours_reason", label: "Motivo do off-hours" }
      );
    }
    
    return base;
  }, [isHuman]);

  // ========== ATALHOS HUMAN ==========
  const addOffhoursAction = useCallback((kind) => {
    let conds = [];
    if (kind === "offhours_true") {
      conds = [{ variable: "offhours", type: "equals", value: "true" }];
    } else if (kind === "reason_holiday") {
      conds = [{ variable: "offhours_reason", type: "equals", value: "holiday" }];
    } else if (kind === "reason_closed") {
      conds = [{ variable: "offhours_reason", type: "equals", value: "closed" }];
    }
    updateActions([...(actions || []), { next: "", conditions: conds }]);
  }, [actions, updateActions]);

  // ========== PROTEÇÃO DE HOTKEYS ==========
  const isEditableTarget = useCallback((el) => {
    if (!el) return false;
    if (el.isContentEditable) return true;
    const tag = el.tagName?.toUpperCase?.();
    if (tag === "TEXTAREA") return true;
    if (tag === "INPUT") {
      const t = (el.type || "").toLowerCase();
      const textLike = ["text","search","url","tel","email","password","number","date","datetime-local","time"];
      return textLike.includes(t) && !el.readOnly && !el.disabled;
    }
    return false;
  }, []);

  const handleKeyDownCapture = useCallback((e) => {
    if (!panelRef.current?.contains(e.target)) return;
    const k = e.key?.toLowerCase?.() || "";
    if (isEditableTarget(e.target)) {
      const isDelete = e.key === "Delete" || e.key === "Backspace";
      const isUndo = (e.ctrlKey || e.metaKey) && !e.shiftKey && k === "z";
      const isRedo = (e.ctrlKey || e.metaKey) && (k === "y" || (k === "z" && e.shiftKey));
      if (isDelete || isUndo || isRedo) e.stopPropagation();
    }
  }, [isEditableTarget]);

  // ========== COMPONENTES DE INPUT ==========
  const InputGroup = ({ label, children, helpText }) => (
    <div className={styles.inputGroup}>
      {label && <label className={styles.inputLabel}>{label}</label>}
      {children}
      {helpText && <small className={styles.helpText}>{helpText}</small>}
    </div>
  );

  const TextInput = ({ label, value, onChange, placeholder, helpText, ...props }) => (
    <InputGroup label={label} helpText={helpText}>
      <input
        type="text"
        value={value || ""}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className={styles.inputStyle}
        {...props}
      />
    </InputGroup>
  );

  const NumberInput = ({ label, value, onChange, helpText, ...props }) => (
    <InputGroup label={label} helpText={helpText}>
      <input
        type="number"
        value={value ?? 0}
        onChange={(e) => onChange(parseInt(e.target.value || "0", 10))}
        className={styles.inputStyle}
        {...props}
      />
    </InputGroup>
  );

  const SelectInput = ({ label, value, onChange, options, helpText }) => (
    <InputGroup label={label} helpText={helpText}>
      <select value={value || ""} onChange={(e) => onChange(e.target.value)} className={styles.selectStyle}>
        {options.map((opt) => (
          <option key={opt.value} value={opt.value}>
            {opt.label}
          </option>
        ))}
      </select>
    </InputGroup>
  );

  const TextAreaInput = ({ label, value, onChange, rows = 8, helpText, ...props }) => (
    <InputGroup label={label} helpText={helpText}>
      <textarea
        rows={rows}
        value={value || ""}
        onChange={(e) => onChange(e.target.value)}
        className={styles.textareaStyle}
        {...props}
      />
    </InputGroup>
  );

  // ========== RENDERIZAR VALOR DE CONDIÇÃO ==========
  const renderValueInput = useCallback((cond, onChangeValue) => {
    if (cond.type === "exists") return null;
    
    if (cond.variable === "offhours") {
      return (
        <SelectInput
          label="Valor"
          value={cond.value ?? "true"}
          onChange={onChangeValue}
          options={[
            { value: "true", label: "true" },
            { value: "false", label: "false" }
          ]}
        />
      );
    }
    
    if (cond.variable === "offhours_reason") {
      return (
        <SelectInput
          label="Valor"
          value={cond.value ?? "holiday"}
          onChange={onChangeValue}
          options={[
            { value: "holiday", label: "holiday" },
            { value: "closed", label: "closed" }
          ]}
        />
      );
    }
    
    return (
      <TextInput
        label="Valor"
        value={cond.value}
        onChange={onChangeValue}
        placeholder="Valor para comparação"
      />
    );
  }, []);

  // ========== PREVIEW CHAT ==========
  const QuickReplies = () => {
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

  const ListPreview = () => {
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
              {row?.description && <small>{row.description}</small>}
            </div>
          </div>
        ))}
        {rows.length > 3 && (
          <small className={styles.moreHint}>e mais {rows.length - 3}…</small>
        )}
      </div>
    );
  };

  const ChatBubbleContent = () => {
    if (type === "text") {
      return block.content || <em className={styles.placeholder}>Sem mensagem</em>;
    }
    
    if (type === "interactive") {
      return (
        <>
          <div>
            {content?.body?.text?.length 
              ? content.body.text 
              : <em className={styles.placeholder}>Sem corpo</em>}
          </div>
          <QuickReplies />
          <ListPreview />
        </>
      );
    }
    
    if (type === "media") {
      return (
        <>
          <div><strong>Mídia:</strong> {content?.mediaType || "image"}</div>
          <div>{content?.caption || <em className={styles.placeholder}>Sem legenda</em>}</div>
        </>
      );
    }
    
    if (type === "location") {
      return (
        <>
          <div><strong>{content?.name || "Local"}</strong></div>
          <small>{content?.address || "Endereço"}</small>
        </>
      );
    }
    
    if (isHuman) {
      return (
        <div className={styles.infoBlock}>
          Este bloco transfere a conversa para <strong>atendimento humano</strong>.
        </div>
      );
    }
    
    return null;
  };

  const ChatPreview = () => (
    <div className={styles.chatPreviewCard}>
      <div className={styles.floatingBtns}>
        <button
          className={styles.iconGhost}
          title="Editar conteúdo"
          onClick={() => setEditingOpen(true)}
        >
          <PencilLine size={16} />
        </button>
      </div>

      <div className={styles.chatArea}>
        <div className={styles.typingDot}>•••</div>
        <div className={styles.bubble}>
          <div className={styles.bubbleText}>
            <ChatBubbleContent />
          </div>
        </div>

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

      <ContentEditor />
    </div>
  );

  // ========== EDITOR DE CONTEÚDO ==========
  const ContentEditor = () => (
    <div className={`${styles.slideOverlay} ${editingOpen ? styles.open : ""}`}>
      <div className={styles.slideHeader}>
        <strong>Editar conteúdo</strong>
        <button 
          className={styles.iconGhost} 
          onClick={() => setEditingOpen(false)} 
          title="Fechar"
        >
          <X size={16} />
        </button>
      </div>

      <div className={styles.slideBody}>
        {type === "text" && <TextTypeEditor />}
        {type === "interactive" && <InteractiveTypeEditor />}
        {type === "media" && <MediaTypeEditor />}
        {type === "location" && <LocationTypeEditor />}
        {type === "script" && <ScriptTypeEditor />}
      </div>
    </div>
  );

  // ========== EDITORES POR TIPO ==========
  const TextTypeEditor = () => (
    <>
      <TextAreaInput
        label="Mensagem"
        value={block.content}
        onChange={(v) => updateBlock({ content: v })}
        rows={8}
      />
      <NumberInput
        label="Atraso de envio (s)"
        value={sendDelayInSeconds}
        onChange={(v) => updateBlock({ sendDelayInSeconds: v })}
      />
    </>
  );

  const InteractiveTypeEditor = () => {
    const isButton = content.type === "button";
    const isList = content.type === "list";

    const switchToList = () => {
      updateBlock({
        content: deepClone({
          type: "list",
          body: { text: "Escolha um item da lista:" },
          footer: { text: "Toque para selecionar" },
          header: { text: "Menu de Opções", type: "text" },
          action: {
            button: "Abrir lista",
            sections: [{
              title: "Seção 1",
              rows: [{ id: "Item 1", title: "Item 1", description: "" }]
            }]
          }
        }),
      });
    };

    const switchToButton = () => {
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
    };

    return (
      <>
        <SelectInput
          label="Tipo"
          value={content.type || "button"}
          onChange={(v) => v === "list" ? switchToList() : switchToButton()}
          options={[
            { value: "button", label: "Quick Reply" },
            { value: "list", label: "Menu List" }
          ]}
        />

        <TextInput
          label="Corpo"
          value={content.body?.text}
          onChange={(v) => updateContent("body", { ...(deepClone(content.body) || {}), text: v })}
        />

        {isButton && <ButtonsEditor />}
        {isList && <ListEditor />}
      </>
    );
  };

  const ButtonsEditor = () => {
    const buttons = content.action?.buttons || [];

    const updateButton = (idx, title) => {
      const value = clamp(title, 20);
      const newButtons = deepClone(buttons);
      newButtons[idx] = {
        ...(newButtons[idx] || { type: "reply", reply: { id: "", title: "" } }),
        reply: { ...(newButtons[idx]?.reply || {}), title: value, id: value },
      };
      const nextAction = { ...(deepClone(content.action) || {}), buttons: newButtons };
      updateBlock({ content: { ...deepClone(content), action: nextAction } });
    };

    const removeButton = (idx) => {
      const newButtons = deepClone(buttons);
      newButtons.splice(idx, 1);
      const nextAction = { ...(deepClone(content.action) || {}), buttons: newButtons };
      updateBlock({ content: { ...deepClone(content), action: nextAction } });
    };

    const addButton = () => {
      if (buttons.length >= 3) return;
      const newButtons = [...deepClone(buttons), {
        type: "reply",
        reply: { id: "Novo botão", title: "Novo botão" }
      }];
      const nextAction = { ...(deepClone(content.action) || {}), buttons: newButtons };
      updateBlock({ content: { ...deepClone(content), action: nextAction } });
    };

    return (
      <>
        {buttons.map((btn, idx) => (
          <div key={idx} className={styles.rowItemStyle}>
            <input
              type="text"
              value={btn.reply?.title || ""}
              maxLength={20}
              placeholder="Texto do botão"
              onChange={(e) => updateButton(idx, e.target.value)}
              className={styles.inputStyle}
            />
            <Trash2
              size={18}
              className={styles.trashIcon}
              onClick={() => removeButton(idx)}
              title="Remover botão"
            />
          </div>
        ))}
        <button onClick={addButton} className={styles.addButton}>
          + Adicionar botão
        </button>
      </>
    );
  };

  const ListEditor = () => {
    const rows = content.action?.sections?.[0]?.rows || [];

    const updateRow = (idx, field, value) => {
      const sections = deepClone(content.action?.sections || [{ title: "Seção 1", rows: [] }]);
      const newRows = [...(sections[0]?.rows || [])];
      
      if (field === "title") {
        const clampedTitle = clamp(value, 24);
        newRows[idx] = {
          ...(newRows[idx] || {}),
          title: clampedTitle,
          id: makeIdFromTitle(clampedTitle, 24)
        };
      } else {
        newRows[idx] = { ...(newRows[idx] || {}), [field]: value };
      }
      
      sections[0] = { ...(sections[0] || {}), rows: newRows };
      const nextAction = { ...(deepClone(content.action) || {}), sections };
      updateBlock({ content: { ...deepClone(content), action: nextAction } });
    };

    const removeRow = (idx) => {
      const sections = deepClone(content.action?.sections || [{ title: "", rows: [] }]);
      const newRows = [...(sections[0]?.rows || [])];
      newRows.splice(idx, 1);
      sections[0] = { ...(sections[0] || {}), rows: newRows };
      const nextAction = { ...(deepClone(content.action) || {}), sections };
      updateBlock({ content: { ...deepClone(content), action: nextAction } });
    };

    const addRow = () => {
      const sections = deepClone(content.action?.sections || [{ title: "", rows: [] }]);
      const currentRows = sections[0]?.rows || [];
      const n = currentRows.length + 1;
      const title = `Item ${n}`;
      const newRow = { id: makeIdFromTitle(title, 24), title, description: "" };
      const newRows = [...currentRows, newRow];
      sections[0] = { ...(sections[0] || {}), rows: newRows };
      const nextAction = { ...(deepClone(content.action) || {}), sections };
      updateBlock({ content: { ...deepClone(content), action: nextAction } });
    };

    return (
      <>
        <TextInput
          label="Texto do botão (abrir lista)"
          value={content.action?.button}
          onChange={(v) => {
            const nextAction = {
              ...(deepClone(content.action) || {}),
              button: v.slice(0, 20),
              sections: deepClone(content.action?.sections || [{ title: "Seção 1", rows: [] }])
            };
            updateBlock({ content: { ...deepClone(content), action: nextAction } });
          }}
          maxLength={20}
        />

        {rows.map((item, idx) => (
          <div key={idx} className={styles.rowItemStyle}>
            <input
              type="text"
              value={item.title}
              maxLength={24}
              placeholder="Título"
              onChange={(e) => updateRow(idx, "title", e.target.value)}
              className={styles.inputStyle}
            />
            <input
              type="text"
              value={item.description}
              placeholder="Descrição"
              onChange={(e) => updateRow(idx, "description", e.target.value)}
              className={styles.inputStyle}
            />
            <Trash2
              size={18}
              className={styles.trashIcon}
              onClick={() => removeRow(idx)}
              title="Remover item"
            />
          </div>
        ))}

        <button onClick={addRow} className={styles.addButton}>
          + Adicionar item
        </button>
      </>
    );
  };

  const MediaTypeEditor = () => (
    <>
      <SelectInput
        label="Tipo"
        value={content.mediaType}
        onChange={(v) => updateContent("mediaType", v)}
        options={[
          { value: "image", label: "Imagem" },
          { value: "document", label: "Documento" },
          { value: "audio", label: "Áudio" },
          { value: "video", label: "Vídeo" }
        ]}
      />
      <TextInput
        label="URL"
        value={content.url}
        onChange={(v) => updateContent("url", v)}
      />
      <TextInput
        label="Legenda"
        value={content.caption}
        onChange={(v) => updateContent("caption", v)}
      />
    </>
  );

  const LocationTypeEditor = () => (
    <>
      <TextInput label="Nome" value={content.name} onChange={(v) => updateContent("name", v)} />
      <TextInput label="Endereço" value={content.address} onChange={(v) => updateContent("address", v)} />
      <TextInput label="Latitude" value={content.latitude} onChange={(v) => updateContent("latitude", v)} />
      <TextInput label="Longitude" value={content.longitude} onChange={(v) => updateContent("longitude", v)} />
    </>
  );

  const ScriptTypeEditor = () => (
    <>
      <button
        onClick={() => {
          setScriptCode(selectedNode?.data?.block?.code || "");
          setShowScriptEditor(true);
        }}
        className={styles.addButton}
      >
        Abrir editor de código
      </button>
      <TextInput
        label="Função"
        value={block.function}
        onChange={(v) => updateBlock({ function: v })}
      />
      <TextInput
        label="Variável de saída"
        value={block.outputVar}
        onChange={(v) => updateBlock({ outputVar: v })}
      />
    </>
  );

  // ========== CARD AGUARDAR RESPOSTA ==========
  const AwaitResponseCard = () => (
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
            <SelectInput
              label="Ativar"
              value={String(!!awaitResponse)}
              onChange={(v) => updateBlock({ awaitResponse: v === "true" })}
              options={[
                { value: "true", label: "Sim" },
                { value: "false", label: "Não" }
              ]}
            />

            <NumberInput
              label="Atraso de envio (s)"
              value={sendDelayInSeconds}
              onChange={(v) => updateBlock({ sendDelayInSeconds: v })}
            />
          </div>

          <div className={styles.rowTwoCols}>
            <NumberInput
              label="Tempo de inatividade (s)"
              value={awaitTimeInSeconds}
              onChange={(v) => updateBlock({ awaitTimeInSeconds: v })}
              helpText="0 para desativar"
            />

            <TextInput
              label="Salvar resposta do usuário em"
              value={block.saveResponseVar}
              onChange={(v) => updateBlock({ saveResponseVar: v })}
              placeholder="ex.: context.inputMenuPrincipal"
              helpText="Se vazio, não salva."
            />
          </div>

          {(type === "interactive" || type === "media") && (
            <TextInput
              label="Salvar conteúdo rico em"
              value={block.saveContentVar}
              onChange={(v) => updateBlock({ saveContentVar: v })}
              placeholder="ex.: context.lastcontentmessage"
              helpText="Guarda o payload/ID/URL escolhido."
            />
          )}
        </div>
      )}
    </div>
  );

  // ========== ABA DE AÇÕES ==========
  const ActionsTab = () => (
    <div className={styles.tabContent}>
      <ConditionsSection />
      <SpecialActionsSection />
      <DefaultExitSection />
    </div>
  );

  const ConditionsSection = () => (
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

              <ConditionBox
                action={action}
                actionIdx={actionIdx}
                onUpdate={(updated) => {
                  const newActions = deepClone(actions);
                  newActions[actionIdx] = updated;
                  updateActions(newActions);
                }}
                onRemove={() => {
                  const newActions = deepClone(actions);
                  newActions.splice(actionIdx, 1);
                  updateActions(newActions);
                }}
              />
            </React.Fragment>
          ))}

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
      )}
    </div>
  );

  const ConditionBox = ({ action, actionIdx, onUpdate, onRemove }) => {
    const updateCondition = (condIdx, updates) => {
      const newConditions = deepClone(action.conditions || []);
      newConditions[condIdx] = { ...newConditions[condIdx], ...updates };
      onUpdate({ ...action, conditions: newConditions });
    };

    const removeCondition = (condIdx) => {
      const newConditions = deepClone(action.conditions || []);
      newConditions.splice(condIdx, 1);
      onUpdate({ ...action, conditions: newConditions });
    };

    return (
      <div className={styles.actionBox}>
        <div className={styles.actionHeader}>
          <strong className={styles.actionTitle}>Condição {actionIdx + 1}</strong>
          <Trash2
            size={16}
            className={styles.trashIcon}
            onClick={onRemove}
          />
        </div>

        {(action.conditions || []).map((cond, condIdx) => (
          <div key={condIdx} className={styles.conditionRow}>
            <SelectInput
              label="Variável"
              value={
                variableOptions.some((v) => v.value === cond.variable)
                  ? cond.variable
                  : cond.variable
                  ? "custom"
                  : "lastUserMessage"
              }
              onChange={(nextVar) => {
                if (nextVar === "custom") {
                  updateCondition(condIdx, { variable: "" });
                } else {
                  const updates = { variable: nextVar };
                  if (!cond.type) updates.type = "equals";
                  if (nextVar === "offhours") updates.value = "true";
                  if (nextVar === "offhours_reason") updates.value = "closed";
                  updateCondition(condIdx, updates);
                }
              }}
              options={variableOptions}
            />

            {(!variableOptions.some((v) => v.value === cond.variable) || cond.variable === "") && (
              <TextInput
                label="Nome da variável"
                value={cond.variable}
                onChange={(v) => updateCondition(condIdx, { variable: v })}
                placeholder="ex.: meuCampo"
              />
            )}

            <SelectInput
              label="Tipo de condição"
              value={cond.type}
              onChange={(v) => {
                const updates = { type: v };
                if (v === "exists") updates.value = "";
                updateCondition(condIdx, updates);
              }}
              options={[
                { value: "", label: "Selecione..." },
                { value: "exists", label: "Existe" },
                { value: "equals", label: "Igual a" },
                { value: "not_equals", label: "Diferente de" },
                { value: "contains", label: "Contém" },
                { value: "not_contains", label: "Não contém" },
                { value: "starts_with", label: "Começa com" },
                { value: "ends_with", label: "Termina com" }
              ]}
            />

            {renderValueInput(cond, (v) => updateCondition(condIdx, { value: v }))}

            <div className={styles.buttonGroup}>
              <button
                className={styles.deleteButtonSmall}
                onClick={() => removeCondition(condIdx)}
              >
                <Trash2 size={14} /> Remover condição
              </button>
            </div>
          </div>
        ))}

        <SelectInput
          label="Próximo Bloco"
          value={action.next}
          onChange={(targetId) => {
            onUpdate({ ...action, next: targetId });
            if (onConnectNodes && targetId) {
              onConnectNodes({ source: selectedNode.id, target: targetId });
            }
          }}
          options={[
            { value: "", label: "Selecione um bloco..." },
            ...allNodes
              .filter((n) => n.id !== selectedNode.id)
              .map((node) => ({
                value: node.id,
                label: node.data.label || node.id
              }))
          ]}
        />
      </div>
    );
  };

  const SpecialActionsSection = () => (
    <div className={styles.sectionContainer}>
      <div className={styles.sectionHeader} onClick={() => toggleSection("special")}>
        <h4 className={styles.sectionTitle}>Ações especiais (variáveis)</h4>
        {expandedSections.special ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
      </div>

      {expandedSections.special && (
        <div className={styles.sectionContent}>
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
  );

  const DefaultExitSection = () => (
    <div className={styles.sectionContainer}>
      <div className={styles.sectionHeader} onClick={() => toggleSection("default")}>
        <h4 className={styles.sectionTitle}>Saída Padrão</h4>
        {expandedSections.default ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
      </div>

      {expandedSections.default && (
        <div className={styles.sectionContent}>
          <SelectInput
            label="Próximo Bloco"
            value={block.defaultNext}
            onChange={(v) => updateBlock({ defaultNext: v })}
            options={[
              { value: "", label: "Selecione um bloco..." },
              ...allNodes
                .filter((n) => n.id !== selectedNode.id)
                .map((node) => ({
                  value: node.id,
                  label: node.data.label || node.id
                }))
            ]}
          />
        </div>
      )}
    </div>
  );

  // ========== RENDER PRINCIPAL ==========
  return (
    <aside
      ref={panelRef}
      className={styles.asidePanel}
      data-stop-hotkeys="true"
      onKeyDownCapture={handleKeyDownCapture}
    >
      <div className={styles.panelHeader}>
        <h3 className={styles.panelTitle}>
          {isHuman 
            ? "atendimento humano" 
            : (selectedNode.data.label || "Novo Bloco")}
        </h3>
        <button onClick={onClose} className={styles.closeButton} title="Fechar">
          <X size={20} />
        </button>
      </div>

      <div className={styles.tabContent}>
        <div className={styles.inputGroup}>
          <label className={styles.inputLabel}>Nome do Bloco</label>
          {isStart ? (
            <div className={styles.startNodeInfo}>
              Este é o <strong>bloco inicial</strong> do fluxo. Ele é fixo, com 
              redirecionamento automático para o próximo bloco configurado.
            </div>
          ) : isHuman ? (
            <input 
              type="text" 
              value="atendimento humano" 
              disabled 
              className={styles.inputStyle} 
            />
          ) : (
            <input
              type="text"
              value={selectedNode.data.label}
              onChange={(e) => onChange({ 
                ...selectedNode, 
                data: { ...selectedNode.data, label: e.target.value } 
              })}
              className={styles.inputStyle}
              placeholder="Nomeie este bloco"
            />
          )}
        </div>

        {isStart ? (
          <div className={styles.tabButtons}>
            <button className={`${styles.tabButton} ${styles.tabButtonActive}`} disabled>
              Condições de saída
            </button>
          </div>
        ) : (
          <div className={styles.tabButtons}>
            <button
              className={`${styles.tabButton} ${tab === "conteudo" ? styles.tabButtonActive : ""}`}
              onClick={() => setTab("conteudo")}
            >
              Conteúdo
            </button>
            <button
              className={`${styles.tabButton} ${tab === "acoes" ? styles.tabButtonActive : ""}`}
              onClick={() => setTab("acoes")}
            >
              Condições de saída
            </button>
          </div>
        )}

        {isStart ? (
          <ActionsTab />
        ) : tab === "conteudo" ? (
          <>
            <ChatPreview />
            <AwaitResponseCard />
          </>
        ) : (
          <ActionsTab />
        )}
      </div>
    </aside>
  );
}
