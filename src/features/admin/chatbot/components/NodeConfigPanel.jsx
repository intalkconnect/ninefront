import React, { useState, useRef, useCallback } from "react";
import {
  Trash2,
  ChevronDown,
  ChevronUp,
  Plus,
  X,
  Edit3,
  MessageSquare,
  Image as ImageIcon,
  MapPin,
  Code,
  Network,
  Timer,
  CheckCircle2,
  Circle,
} from "lucide-react";
import { toast } from "react-toastify";
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
  const [tab, setTab] = useState("visual"); // visual | acoes
  const [editOpen, setEditOpen] = useState(true); // editor expandido dentro da pré-visualização
  const [expandedSections, setExpandedSections] = useState({
    actions: true,
    default: true,
    special: true,
  });

  const panelRef = useRef(null);

  if (!selectedNode || !selectedNode.data) return null;

  const { block = {} } = selectedNode.data;
  const {
    type = "text",
    content = {},
    awaitResponse,
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
  } = block;

  const isHuman = type === "human";

  /* --------------------------------- helpers --------------------------------- */

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
    try {
      return JSON.stringify(obj ?? {}, null, 2);
    } catch {
      return "{}";
    }
  };

  const ensureArray = (v) => (Array.isArray(v) ? v : []);

  const toggleSection = (k) =>
    setExpandedSections((p) => ({ ...p, [k]: !p[k] }));

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

  const updateContentField = (field, value) => {
    const cloned = deepClone(content);
    cloned[field] = value;
    updateBlock({ content: cloned });
  };

  const updateActions = (newActions) => {
    updateBlock({ actions: deepClone(newActions) });
  };

  const isEditableTarget = (el) => {
    if (!el) return false;
    if (el.isContentEditable) return true;
    const tag = el.tagName?.toUpperCase?.();
    if (tag === "TEXTAREA") return true;
    if (tag === "INPUT") {
      const t = (el.type || "").toLowerCase();
      const textLike = [
        "text",
        "search",
        "url",
        "tel",
        "email",
        "password",
        "number",
        "date",
        "datetime-local",
        "time",
      ];
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
      const isRedo =
        (e.ctrlKey || e.metaKey) && (k === "y" || (k === "z" && e.shiftKey));
      if (isDelete || isUndo || isRedo) {
        e.stopPropagation();
      }
    }
  }, []);

  /* --------------------------------- chips --------------------------------- */

  const Chip = ({ icon: Icon, children, active, onClick, title, tone = "blue" }) => {
    return (
      <button
        className={`${styles.chip} ${active ? styles[`chipActive_${tone}`] : styles[`chip_${tone}`]}`}
        onClick={onClick}
        title={title}
        type="button"
      >
        {Icon && <Icon size={14} />}
        <span>{children}</span>
      </button>
    );
  };

  const Field = ({ label, children, hint }) => (
    <div className={styles.field}>
      <label className={styles.fieldLabel}>{label}</label>
      {children}
      {hint ? <small className={styles.hint}>{hint}</small> : null}
    </div>
  );

  const Divider = ({ label }) => (
    <div className={styles.dividerRow}>
      <div className={styles.dividerLine} />
      {label ? <span className={styles.dividerText}>{label}</span> : null}
      <div className={styles.dividerLine} />
    </div>
  );

  /* ------------------------------- chat preview ------------------------------ */

  // avatar do bloco (varia com o tipo)
  const iconForType = () => {
    if (type === "text" || type === "interactive") return MessageSquare;
    if (type === "media") return ImageIcon;
    if (type === "location") return MapPin;
    if (type === "script") return Code;
    if (type === "api_call" || type === "http") return Network;
    if (type === "human") return CheckCircle2;
    return MessageSquare;
  };

  const ChatBubble = ({ side = "bot", children }) => (
    <div className={`${styles.msgRow} ${side === "bot" ? styles.msgRowBot : styles.msgRowUser}`}>
      <div className={styles.avatar}>
        {React.createElement(iconForType(), { size: 16 })}
      </div>
      <div className={styles.bubble}>{children}</div>
    </div>
  );

  const Kbd = ({ children }) => <kbd className={styles.kbd}>{children}</kbd>;

  /* ------------------------------- OFFHOURS UI ------------------------------- */

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
        <Field label="Valor">
          <select
            className={styles.input}
            value={cond.value ?? "true"}
            onChange={(e) => onChangeValue(e.target.value)}
          >
            <option value="true">true</option>
            <option value="false">false</option>
          </select>
        </Field>
      );
    }
    if (cond.variable === "offhours_reason") {
      return (
        <Field label="Valor">
          <select
            className={styles.input}
            value={cond.value ?? "holiday"}
            onChange={(e) => onChangeValue(e.target.value)}
          >
            <option value="holiday">holiday</option>
            <option value="closed">closed</option>
          </select>
        </Field>
      );
    }
    return (
      <Field label="Valor">
        <input
          type="text"
          placeholder="Valor para comparação"
          value={cond.value ?? ""}
          onChange={(e) => onChangeValue(e.target.value)}
          className={styles.input}
        />
      </Field>
    );
  };

  /* ------------------------------ visual (chat) ------------------------------ */

  const VisualEditor = () => {
    // chips topo
    const chips = (
      <div className={styles.chipsBar}>
        <Chip
          icon={awaitResponse ? CheckCircle2 : Circle}
          active={!!awaitResponse}
          onClick={() => updateBlock({ awaitResponse: !awaitResponse })}
          title="Alternar aguardar resposta"
          tone="green"
        >
          {awaitResponse ? "Aguardando resposta" : "Sem espera"}
        </Chip>

        <Chip icon={Timer} active={!!sendDelayInSeconds} title="Atraso de envio" onClick={() => {
          if (!sendDelayInSeconds) updateBlock({ sendDelayInSeconds: 1 });
          setEditOpen(true);
        }}>
          {`${sendDelayInSeconds || 0}s`}
        </Chip>

        {type === "script" && (
          <Chip icon={Code} title="Abrir editor de código" onClick={() => {
            setScriptCode(selectedNode?.data?.block?.code || "");
            setShowScriptEditor(true);
          }}>
            Código
          </Chip>
        )}

        {type === "api_call" && (
          <Chip icon={Network} title="Configurar requisição" onClick={() => setEditOpen(true)}>
            API
          </Chip>
        )}
      </div>
    );

    // bubble: render por tipo
    const bubbleBody = (() => {
      if (type === "text") {
        return (
          <>
            <div className={styles.msgText}>
              {(typeof block.content === "string" && block.content) || "Escreva a mensagem…"}
            </div>
            <button
              className={styles.editInline}
              onClick={() => setEditOpen((v) => !v)}
              title="Editar conteúdo"
            >
              <Edit3 size={16} /> {editOpen ? "Fechar edição" : "Editar"}
            </button>
            {editOpen && (
              <div className={styles.inlineEditor}>
                <Field label="Mensagem">
                  <textarea
                    rows={4}
                    className={styles.textarea}
                    value={block.content || ""}
                    onChange={(e) => updateBlock({ content: e.target.value })}
                  />
                </Field>

                <div className={styles.inlineRow}>
                  <Field label="Aguardar resposta?">
                    <select
                      className={styles.input}
                      value={String(!!awaitResponse)}
                      onChange={(e) =>
                        updateBlock({ awaitResponse: e.target.value === "true" })
                      }
                    >
                      <option value="true">Sim</option>
                      <option value="false">Não</option>
                    </select>
                  </Field>

                  <Field label="Atraso de envio (s)">
                    <input
                      type="number"
                      className={styles.input}
                      value={sendDelayInSeconds ?? 0}
                      onChange={(e) =>
                        updateBlock({
                          sendDelayInSeconds: parseInt(e.target.value || "0", 10),
                        })
                      }
                    />
                  </Field>
                </div>

                {Boolean(awaitResponse) && (
                  <Field label="Salvar resposta do usuário em">
                    <input
                      type="text"
                      className={styles.input}
                      placeholder="ex.: context.respostaTexto"
                      value={saveResponseVar || ""}
                      onChange={(e) => updateBlock({ saveResponseVar: e.target.value })}
                    />
                    <small className={styles.hint}>Deixe em branco para não salvar</small>
                  </Field>
                )}
              </div>
            )}
          </>
        );
      }

      if (type === "media") {
        return (
          <>
            <div className={styles.msgText}>
              <strong>Mídia</strong> {content.mediaType ? `(${content.mediaType})` : ""} • {content.url || "URL não definida"}
              {content.caption ? <><br/><em>{content.caption}</em></> : null}
            </div>
            <button className={styles.editInline} onClick={() => setEditOpen((v) => !v)}>
              <Edit3 size={16} /> {editOpen ? "Fechar edição" : "Editar"}
            </button>
            {editOpen && (
              <div className={styles.inlineEditor}>
                <div className={styles.inlineRow}>
                  <Field label="Tipo de mídia">
                    <select
                      className={styles.input}
                      value={content.mediaType || "image"}
                      onChange={(e) => updateContentField("mediaType", e.target.value)}
                    >
                      <option value="image">Imagem</option>
                      <option value="document">Documento</option>
                      <option value="audio">Áudio</option>
                      <option value="video">Vídeo</option>
                    </select>
                  </Field>

                  <Field label="Aguardar resposta?">
                    <select
                      className={styles.input}
                      value={String(!!awaitResponse)}
                      onChange={(e) => updateBlock({ awaitResponse: e.target.value === "true" })}
                    >
                      <option value="true">Sim</option>
                      <option value="false">Não</option>
                    </select>
                  </Field>
                </div>

                <Field label="URL">
                  <input
                    type="text"
                    className={styles.input}
                    value={content.url || ""}
                    onChange={(e) => updateContentField("url", e.target.value)}
                  />
                </Field>

                <Field label="Legenda">
                  <input
                    type="text"
                    className={styles.input}
                    value={content.caption || ""}
                    onChange={(e) => updateContentField("caption", e.target.value)}
                  />
                </Field>

                {Boolean(awaitResponse) && (
                  <Field label="Salvar resposta do usuário em">
                    <input
                      type="text"
                      className={styles.input}
                      placeholder="ex.: context.respostaMidia"
                      value={saveResponseVar || ""}
                      onChange={(e) => updateBlock({ saveResponseVar: e.target.value })}
                    />
                  </Field>
                )}

                <Field label="Atraso de envio (s)">
                  <input
                    type="number"
                    className={styles.input}
                    value={sendDelayInSeconds ?? 0}
                    onChange={(e) =>
                      updateBlock({
                        sendDelayInSeconds: parseInt(e.target.value || "0", 10),
                      })
                    }
                  />
                </Field>
              </div>
            )}
          </>
        );
      }

      if (type === "interactive") {
        const isList = content.type === "list";
        const isQuickReply = content.type !== "list"; // default button

        const handleAddButton = () => {
          const current = deepClone(content.action?.buttons || []);
          if (current.length >= 3) {
            toast.warn("Máximo de 3 botões atingido.");
            return;
          }
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

        const handleAddListItem = () => {
          const sections = deepClone(content.action?.sections || [{ title: "", rows: [] }]);
          const rows = sections[0]?.rows || [];
          if (rows.length >= 10) {
            toast.warn("Máximo de 10 itens atingido.");
            return;
          }
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

        return (
          <>
            <div className={styles.msgText}>
              <strong>Mensagem interativa</strong>
              <br />
              <div className={styles.previewInteractive}>
                <div className={styles.previewBody}>
                  {content.body?.text || "Corpo da mensagem…"}
                </div>
                {isQuickReply && (
                  <div className={styles.previewButtons}>
                    {(content.action?.buttons || []).map((b, i) => (
                      <span key={i} className={styles.previewBtn}>{b.reply?.title || "Botão"}</span>
                    ))}
                    {(content.action?.buttons || []).length === 0 && (
                      <span className={styles.previewBtnMuted}>+ botão</span>
                    )}
                  </div>
                )}
                {isList && (
                  <div className={styles.previewList}>
                    {(content.action?.sections?.[0]?.rows || []).map((r, i) => (
                      <div key={i} className={styles.previewListItem}>
                        <div className={styles.previewListTitle}>{r.title}</div>
                        {r.description ? (
                          <div className={styles.previewListDesc}>{r.description}</div>
                        ) : null}
                      </div>
                    ))}
                    {(content.action?.sections?.[0]?.rows || []).length === 0 && (
                      <div className={styles.previewListEmpty}>+ item de lista</div>
                    )}
                  </div>
                )}
              </div>
            </div>
            <button className={styles.editInline} onClick={() => setEditOpen((v) => !v)}>
              <Edit3 size={16} /> {editOpen ? "Fechar edição" : "Editar"}
            </button>

            {editOpen && (
              <div className={styles.inlineEditor}>
                <div className={styles.inlineRow}>
                  <Field label="Tipo">
                    <select
                      className={styles.input}
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
                                button: "Abrir lista",
                                sections: [
                                  { title: "Seção 1", rows: [{ id: "Item 1", title: "Item 1", description: "" }] },
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
                    >
                      <option value="button">Quick Reply</option>
                      <option value="list">Menu List</option>
                    </select>
                  </Field>

                  <Field label="Aguardar resposta?">
                    <select
                      className={styles.input}
                      value={String(!!awaitResponse)}
                      onChange={(e) => updateBlock({ awaitResponse: e.target.value === "true" })}
                    >
                      <option value="true">Sim</option>
                      <option value="false">Não</option>
                    </select>
                  </Field>
                </div>

                <Field label="Corpo">
                  <input
                    type="text"
                    className={styles.input}
                    value={content.body?.text || ""}
                    onChange={(e) =>
                      updateContentField("body", {
                        ...(deepClone(content.body) || {}),
                        text: e.target.value,
                      })
                    }
                  />
                </Field>

                <Field label="Rodapé">
                  <input
                    type="text"
                    className={styles.input}
                    value={content.footer?.text || ""}
                    onChange={(e) =>
                      updateContentField("footer", {
                        ...(deepClone(content.footer) || {}),
                        text: e.target.value,
                      })
                    }
                  />
                </Field>

                {content.type === "list" ? (
                  <>
                    <Field label="Texto do botão (abrir lista)">
                      <input
                        type="text"
                        maxLength={20}
                        className={styles.input}
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
                        placeholder="Ex.: Abrir opções"
                      />
                      <small className={styles.hint}>
                        máx. 20 caracteres
                      </small>
                    </Field>

                    {(content.action?.sections?.[0]?.rows || []).map((item, idx) => (
                      <div key={idx} className={styles.rowItem}>
                        <input
                          type="text"
                          className={styles.input}
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
                              id: makeIdFromTitle(value, 24),
                            };
                            sections[0] = { ...(sections[0] || {}), rows };
                            const nextAction = { ...(deepClone(content.action) || {}), sections };
                            const nextContent = { ...deepClone(content), action: nextAction };
                            updateBlock({ content: nextContent });
                          }}
                        />
                        <input
                          type="text"
                          className={styles.input}
                          value={item.description}
                          placeholder="Descrição"
                          onChange={(e) => {
                            const sections = deepClone(
                              content.action?.sections || [{ title: "Seção 1", rows: [] }]
                            );
                            const rows = [...(sections[0]?.rows || [])];
                            rows[idx] = { ...(rows[idx] || {}), description: e.target.value };
                            sections[0] = { ...(sections[0] || {}), rows };
                            const nextAction = { ...(deepClone(content.action) || {}), sections };
                            const nextContent = { ...deepClone(content), action: nextAction };
                            updateBlock({ content: nextContent });
                          }}
                        />
                        <Trash2
                          size={18}
                          className={styles.trashIcon}
                          onClick={() => handleRemoveListItem(idx)}
                          title="Remover item"
                        />
                      </div>
                    ))}

                    <button onClick={handleAddListItem} className={styles.btnSecondary}>
                      + Adicionar item
                    </button>
                  </>
                ) : (
                  <>
                    {(content.action?.buttons || []).map((btn, idx) => (
                      <div key={idx} className={styles.rowItem}>
                        <input
                          type="text"
                          className={styles.input}
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
                                id: value,
                              },
                            };
                            const nextAction = {
                              ...(deepClone(content.action) || {}),
                              buttons,
                            };
                            const nextContent = { ...deepClone(content), action: nextAction };
                            updateBlock({ content: nextContent });
                          }}
                        />
                        <Trash2
                          size={18}
                          className={styles.trashIcon}
                          onClick={() => handleRemoveButton(idx)}
                          title="Remover botão"
                        />
                      </div>
                    ))}
                    <button onClick={handleAddButton} className={styles.btnSecondary}>
                      + Adicionar botão
                    </button>
                  </>
                )}

                {Boolean(awaitResponse) && (
                  <Field label="Salvar resposta do usuário em">
                    <input
                      type="text"
                      className={styles.input}
                      placeholder="ex.: context.respostaMenu"
                      value={saveResponseVar || ""}
                      onChange={(e) => updateBlock({ saveResponseVar: e.target.value })}
                    />
                  </Field>
                )}

                <Field label="Atraso de envio (s)">
                  <input
                    type="number"
                    className={styles.input}
                    value={sendDelayInSeconds ?? 0}
                    onChange={(e) =>
                      updateBlock({
                        sendDelayInSeconds: parseInt(e.target.value || "0", 10),
                      })
                    }
                  />
                </Field>
              </div>
            )}
          </>
        );
      }

      if (type === "location") {
        return (
          <>
            <div className={styles.msgText}>
              <strong>Localização</strong>
              <br />
              {(content.name || content.address) ? (
                <>
                  {content.name ? <>{content.name}<br/></> : null}
                  {content.address ? <>{content.address}<br/></> : null}
                </>
              ) : (
                "Defina nome/endereço/lat/long…"
              )}
            </div>
            <button className={styles.editInline} onClick={() => setEditOpen((v) => !v)}>
              <Edit3 size={16} /> {editOpen ? "Fechar edição" : "Editar"}
            </button>

            {editOpen && (
              <div className={styles.inlineEditor}>
                <Field label="Nome">
                  <input
                    type="text"
                    className={styles.input}
                    value={content.name || ""}
                    onChange={(e) => updateContentField("name", e.target.value)}
                  />
                </Field>

                <Field label="Endereço">
                  <input
                    type="text"
                    className={styles.input}
                    value={content.address || ""}
                    onChange={(e) => updateContentField("address", e.target.value)}
                  />
                </Field>

                <div className={styles.inlineRow}>
                  <Field label="Latitude">
                    <input
                      type="text"
                      className={styles.input}
                      value={content.latitude || ""}
                      onChange={(e) => updateContentField("latitude", e.target.value)}
                    />
                  </Field>
                  <Field label="Longitude">
                    <input
                      type="text"
                      className={styles.input}
                      value={content.longitude || ""}
                      onChange={(e) => updateContentField("longitude", e.target.value)}
                    />
                  </Field>
                </div>

                <div className={styles.inlineRow}>
                  <Field label="Aguardar resposta?">
                    <select
                      className={styles.input}
                      value={String(!!awaitResponse)}
                      onChange={(e) =>
                        updateBlock({ awaitResponse: e.target.value === "true" })
                      }
                    >
                      <option value="true">Sim</option>
                      <option value="false">Não</option>
                    </select>
                  </Field>

                  <Field label="Atraso de envio (s)">
                    <input
                      type="number"
                      className={styles.input}
                      value={sendDelayInSeconds ?? 0}
                      onChange={(e) =>
                        updateBlock({
                          sendDelayInSeconds: parseInt(e.target.value || "0", 10),
                        })
                      }
                    />
                  </Field>
                </div>

                {Boolean(awaitResponse) && (
                  <Field label="Salvar resposta do usuário em">
                    <input
                      type="text"
                      className={styles.input}
                      placeholder="ex.: context.localizacao"
                      value={saveResponseVar || ""}
                      onChange={(e) => updateBlock({ saveResponseVar: e.target.value })}
                    />
                  </Field>
                )}
              </div>
            )}
          </>
        );
      }

      if (type === "script") {
        return (
          <>
            <div className={styles.msgText}>
              Executa um <strong>Script</strong> e pode armazenar em <Kbd>{outputVar || "outputVar"}</Kbd>.
            </div>
            <div className={styles.inlineEditor}>
              <div className={styles.inlineRow}>
                <Field label="Função">
                  <input
                    type="text"
                    className={styles.input}
                    value={block.function || ""}
                    onChange={(e) => updateBlock({ function: e.target.value })}
                  />
                </Field>
                <Field label="Variável de saída">
                  <input
                    type="text"
                    className={styles.input}
                    value={block.outputVar || ""}
                    onChange={(e) => updateBlock({ outputVar: e.target.value })}
                  />
                </Field>
              </div>

              <button
                className={styles.btnCode}
                onClick={() => {
                  setScriptCode(selectedNode?.data?.block?.code || "");
                  setShowScriptEditor(true);
                }}
              >
                <Code size={16} /> Abrir editor de código
              </button>
            </div>
          </>
        );
      }

      if (type === "api_call" || type === "http") {
        return (
          <>
            <div className={styles.msgText}>
              Chamada de <strong>API</strong> {method ? `(${method})` : ""} • {url || "URL não definida"}
            </div>

            <div className={styles.inlineEditor}>
              <div className={styles.inlineRow}>
                <Field label="Método">
                  <select
                    className={styles.input}
                    value={method || "GET"}
                    onChange={(e) => updateBlock({ method: e.target.value })}
                  >
                    <option value="GET">GET</option>
                    <option value="POST">POST</option>
                    <option value="PUT">PUT</option>
                    <option value="DELETE">DELETE</option>
                    <option value="PATCH">PATCH</option>
                  </select>
                </Field>

                <Field label="Timeout (ms)">
                  <input
                    type="number"
                    className={styles.input}
                    value={timeout ?? 10000}
                    onChange={(e) =>
                      updateBlock({ timeout: parseInt(e.target.value || "0", 10) })
                    }
                  />
                </Field>
              </div>

              <Field label="URL">
                <input
                  type="text"
                  className={styles.input}
                  value={url || ""}
                  onChange={(e) => updateBlock({ url: e.target.value })}
                />
              </Field>

              <Field label="Headers (JSON)">
                <textarea
                  rows={3}
                  className={styles.textarea}
                  defaultValue={pretty(headers)}
                  onBlur={(e) =>
                    updateBlock({
                      headers: safeParseJson(e.target.value, headers || {}),
                    })
                  }
                />
              </Field>

              <Field label="Body (JSON)">
                <textarea
                  rows={4}
                  className={styles.textarea}
                  defaultValue={pretty(body)}
                  onBlur={(e) =>
                    updateBlock({ body: safeParseJson(e.target.value, body || {}) })
                  }
                />
              </Field>

              <div className={styles.inlineRow}>
                <Field label="Variável de saída">
                  <input
                    type="text"
                    className={styles.input}
                    value={outputVar || "apiResponse"}
                    onChange={(e) => updateBlock({ outputVar: e.target.value })}
                  />
                </Field>
                <Field label="Variável de status">
                  <input
                    type="text"
                    className={styles.input}
                    value={statusVar || "apiStatus"}
                    onChange={(e) => updateBlock({ statusVar: e.target.value })}
                  />
                </Field>
              </div>

              {type === "http" && (
                <button
                  className={styles.btnSecondary}
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
              )}
            </div>
          </>
        );
      }

      if (type === "human") {
        return (
          <div className={styles.msgText}>
            Este bloco envia a conversa para <strong>atendimento humano</strong>.
            O nome é fixo: <Kbd>atendimento humano</Kbd>.
          </div>
        );
      }

      return <div className={styles.msgText}>Tipo não suportado.</div>;
    })();

    return (
      <div className={styles.chatPreview}>
        {chips}
        <ChatBubble side="bot">{bubbleBody}</ChatBubble>
      </div>
    );
  };

  /* --------------------------------- ações tab -------------------------------- */

  const ActionsTab = () => {
    return (
      <div className={styles.tabBody}>
        {/* Condições */}
        <div className={styles.card}>
          <div className={styles.cardHeader} onClick={() => toggleSection("actions")}>
            <h4>Condições de Saída <span className={styles.badge}>{actions.length}/25</span></h4>
            {expandedSections.actions ? <ChevronUp size={16}/> : <ChevronDown size={16}/>}
          </div>

          {expandedSections.actions && (
            <div className={styles.cardBody}>
              {isHuman && (
                <div className={styles.inlineRow}>
                  <button className={styles.btnGhost} onClick={() => addOffhoursAction("offhours_true")}>
                    + Se offhours = true
                  </button>
                  <button className={styles.btnGhost} onClick={() => addOffhoursAction("reason_holiday")}>
                    + Se offhours_reason = holiday
                  </button>
                  <button className={styles.btnGhost} onClick={() => addOffhoursAction("reason_closed")}>
                    + Se offhours_reason = closed
                  </button>
                </div>
              )}

              {actions.map((action, actionIdx) => (
                <div key={actionIdx} className={styles.actionBox}>
                  <div className={styles.actionHeader}>
                    <strong>Condição {actionIdx + 1}</strong>
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
                      <Field label="Variável">
                        <select
                          className={styles.input}
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
                        >
                          {variableOptions.map((opt) => (
                            <option key={opt.value} value={opt.value}>
                              {opt.label}
                            </option>
                          ))}
                        </select>
                      </Field>

                      {(!variableOptions.some((v) => v.value === cond.variable) || cond.variable === "") && (
                        <Field label="Nome da variável">
                          <input
                            type="text"
                            className={styles.input}
                            placeholder="ex.: meuCampo"
                            value={cond.variable || ""}
                            onChange={(e) => {
                              const updated = deepClone(actions);
                              updated[actionIdx].conditions[condIdx].variable = e.target.value;
                              updateActions(updated);
                            }}
                          />
                        </Field>
                      )}

                      <Field label="Tipo de condição">
                        <select
                          className={styles.input}
                          value={cond.type || ""}
                          onChange={(e) => {
                            const updated = deepClone(actions);
                            updated[actionIdx].conditions[condIdx].type = e.target.value;
                            if (e.target.value === "exists") {
                              updated[actionIdx].conditions[condIdx].value = "";
                            }
                            updateActions(updated);
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
                      </Field>

                      {renderValueInput(cond, (v) => {
                        const updated = deepClone(actions);
                        updated[actionIdx].conditions[condIdx].value = v;
                        updateActions(updated);
                      })}

                      <div className={styles.rowEnd}>
                        <button
                          className={styles.btnDanger}
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

                  <Field label="Próximo bloco">
                    <select
                      className={styles.input}
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
                  </Field>
                </div>
              ))}

              <button
                className={styles.btnPrimary}
                onClick={() => {
                  const newAction = {
                    next: "",
                    conditions: [{ variable: "lastUserMessage", type: "exists", value: "" }],
                  };
                  updateActions([...(actions || []), newAction]);
                }}
              >
                <Plus size={16} /> Adicionar Ação
              </button>
            </div>
          )}
        </div>

        {/* especiais */}
        <div className={styles.card}>
          <div className={styles.cardHeader} onClick={() => toggleSection("special")}>
            <h4>Ações especiais (variáveis)</h4>
            {expandedSections.special ? <ChevronUp size={16}/> : <ChevronDown size={16}/>}
          </div>
          {expandedSections.special && (
            <div className={styles.cardBody}>
              <h5 className={styles.smallTitle}>Ao entrar no bloco</h5>
              {(block.onEnter || []).map((a, i) => (
                <div key={`en-${i}`} className={styles.rowItem}>
                  <select
                    className={styles.input}
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
                    className={styles.input}
                    placeholder="chave (ex.: protocolo)"
                    value={a.key || ""}
                    onChange={(e) => {
                      const next = ensureArray(block.onEnter).slice();
                      next[i] = { ...next[i], key: e.target.value };
                      updateBlock({ onEnter: next });
                    }}
                  />
                  <input
                    className={styles.input}
                    placeholder="valor (ex.: 12345)"
                    value={a.value || ""}
                    onChange={(e) => {
                      const next = ensureArray(block.onEnter).slice();
                      next[i] = { ...next[i], value: e.target.value };
                      updateBlock({ onEnter: next });
                    }}
                  />
                  <button
                    className={styles.btnDanger}
                    onClick={() => updateBlock({ onEnter: (block.onEnter || []).filter((_, idx) => idx !== i) })}
                  >
                    Remover
                  </button>
                </div>
              ))}
              <button
                className={styles.btnSecondary}
                onClick={() => updateBlock({ onEnter: [...(block.onEnter || []), { scope: "context", key: "", value: "" }] })}
              >
                + adicionar na entrada
              </button>

              <Divider />

              <h5 className={styles.smallTitle}>Ao sair do bloco</h5>
              {(block.onExit || []).map((a, i) => (
                <div key={`ex-${i}`} className={styles.rowItem}>
                  <select
                    className={styles.input}
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
                    className={styles.input}
                    placeholder="chave (ex.: etapaAtual)"
                    value={a.key || ""}
                    onChange={(e) => {
                      const next = ensureArray(block.onExit).slice();
                      next[i] = { ...next[i], key: e.target.value };
                      updateBlock({ onExit: next });
                    }}
                  />
                  <input
                    className={styles.input}
                    placeholder="valor (ex.: finalizado)"
                    value={a.value || ""}
                    onChange={(e) => {
                      const next = ensureArray(block.onExit).slice();
                      next[i] = { ...next[i], value: e.target.value };
                      updateBlock({ onExit: next });
                    }}
                  />
                  <button
                    className={styles.btnDanger}
                    onClick={() => updateBlock({ onExit: (block.onExit || []).filter((_, idx) => idx !== i) })}
                  >
                    Remover
                  </button>
                </div>
              ))}
              <button
                className={styles.btnSecondary}
                onClick={() => updateBlock({ onExit: [...(block.onExit || []), { scope: "context", key: "", value: "" }] })}
              >
                + adicionar na saída
              </button>
            </div>
          )}
        </div>

        {/* saída padrão */}
        <div className={styles.card}>
          <div className={styles.cardHeader} onClick={() => toggleSection("default")}>
            <h4>Saída Padrão</h4>
            {expandedSections.default ? <ChevronUp size={16}/> : <ChevronDown size={16}/>}
          </div>
          {expandedSections.default && (
            <div className={styles.cardBody}>
              <Field label="Próximo Bloco">
                <select
                  className={styles.input}
                  value={block.defaultNext || ""}
                  onChange={(e) => updateBlock({ defaultNext: e.target.value })}
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
              </Field>
            </div>
          )}
        </div>
      </div>
    );
  };

  /* ----------------------------------- render ----------------------------------- */

  return (
    <aside
      ref={panelRef}
      className={styles.asidePanel}
      data-stop-hotkeys="true"
      onKeyDownCapture={handleKeyDownCapture}
    >
      {/* Header */}
      <div className={styles.panelHeader}>
        <div className={styles.titleWrap}>
          <h3 className={styles.panelTitle}>
            {selectedNode.data.type === "human"
              ? "atendimento humano"
              : (selectedNode.data.label || "Novo Bloco")}
          </h3>

          <div className={styles.blockName}>
            <label>Nome do bloco</label>
            {selectedNode.data.nodeType === "start" ? (
              <div className={styles.startNote}>
                Bloco inicial fixo – redireciona automaticamente ao próximo configurado.
              </div>
            ) : selectedNode.data.type === "human" ? (
              <input type="text" value="atendimento humano" disabled className={styles.input} />
            ) : (
              <input
                type="text"
                className={styles.input}
                value={selectedNode.data.label}
                onChange={(e) =>
                  onChange({
                    ...selectedNode,
                    data: { ...selectedNode.data, label: e.target.value },
                  })
                }
                placeholder="Nomeie este bloco"
              />
            )}
          </div>
        </div>

        <button onClick={onClose} className={styles.closeButton} title="Fechar">
          <X size={20} />
        </button>
      </div>

      {/* tabs */}
      <div className={styles.tabsBar}>
        {selectedNode.data.nodeType === "start" ? (
          <button className={`${styles.tab} ${styles.tabActive}`} disabled>
            Ações
          </button>
        ) : (
          <>
            <button
              className={`${styles.tab} ${tab === "visual" ? styles.tabActive : ""}`}
              onClick={() => setTab("visual")}
            >
              Visual
            </button>
            <button
              className={`${styles.tab} ${tab === "acoes" ? styles.tabActive : ""}`}
              onClick={() => setTab("acoes")}
            >
              Ações
            </button>
          </>
        )}
      </div>

      {/* body */}
      {selectedNode.data.nodeType === "start" ? (
        <ActionsTab />
      ) : tab === "visual" ? (
        <div className={styles.tabBody}>
          <VisualEditor />
        </div>
      ) : (
        <ActionsTab />
      )}
    </aside>
  );
}
