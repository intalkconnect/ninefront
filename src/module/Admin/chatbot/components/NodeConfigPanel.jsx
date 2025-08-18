import React, { useState, useEffect } from "react";
import { Trash2, ChevronDown, ChevronUp, Plus, X } from "lucide-react";
import styles from './styles/NodeConfigPanel.module.css';

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
    awaitTimeInSeconds,
    sendDelayInSeconds,
    actions = [],
  } = block;

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
    onChange(updatedNode);
  };

  const updateContent = (field, value) => {
    updateBlock({
      content: {
        ...content,
        [field]: value,
      },
    });
  };

  const handleUpdateRows = (rows) => {
    const updatedSections = [
      {
        ...content.action?.sections?.[0],
        title: content.action?.sections?.[0]?.title || "",
        rows,
      },
    ];
    updateContent("action", { ...content.action, sections: updatedSections });
  };

  const updateActions = (newActions) => {
    updateBlock({ actions: newActions });
  };

  const renderActionsTab = () => (
    <div className={styles.tabContent}>
      <div className={styles.sectionContainer}>
        <div className={styles.sectionHeader} onClick={() => toggleSection("actions")}>
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
                        const updated = [...actions];
                        updated.splice(actionIdx, 1);
                        updateActions(updated);
                      }}
                    />
                  </div>

                  {(action.conditions || []).map((cond, condIdx) => (
                    <div key={condIdx} className={styles.conditionRow}>
                      <div className={styles.inputGroup}>
                        <label className={styles.inputLabel}>Variável</label>
                        <select
                          value={
                            cond.variable === "lastUserMessage"
                              ? "lastUserMessage"
                              : "custom"
                          }
                          onChange={(e) => {
                            const updated = [...actions];
                            updated[actionIdx].conditions[condIdx].variable =
                              e.target.value === "lastUserMessage"
                                ? "lastUserMessage"
                                : "";
                            updateActions(updated);
                          }}
                          className={styles.selectStyle}
                        >
                          <option value="lastUserMessage">
                            Resposta do usuário
                          </option>
                          <option value="custom">Variável personalizada</option>
                        </select>
                      </div>

                      {cond.variable !== "lastUserMessage" && (
                        <div className={styles.inputGroup}>
                          <label className={styles.inputLabel}>Nome da variável</label>
                          <input
                            type="text"
                            placeholder="Nome da variável"
                            value={cond.variable}
                            onChange={(e) => {
                              const updated = [...actions];
                              updated[actionIdx].conditions[condIdx].variable =
                                e.target.value;
                              updateActions(updated);
                            }}
                            className={styles.inputStyle}
                          />
                        </div>
                      )}

                      <div className={styles.inputGroup}>
                        <label className={styles.inputLabel}>Tipo de condição</label>
                        <select
                          value={cond.type}
                          onChange={(e) => {
                            const updated = [...actions];
                            updated[actionIdx].conditions[condIdx].type =
                              e.target.value;
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
                        </select>
                      </div>

                      {cond.type !== "exists" && (
                        <div className={styles.inputGroup}>
                          <label className={styles.inputLabel}>Valor</label>
                          <input
                            type="text"
                            placeholder="Valor para comparação"
                            value={cond.value}
                            onChange={(e) => {
                              const updated = [...actions];
                              updated[actionIdx].conditions[condIdx].value =
                                e.target.value;
                              updateActions(updated);
                            }}
                            className={styles.inputStyle}
                          />
                        </div>
                      )}

                      <div className={styles.buttonGroup}>
                        <button
                          className={styles.deleteButtonSmall}
                          onClick={() => {
                            const updated = [...actions];
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
                        const updated = [...actions];
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

                  <div className={styles.inputGroup}>
                    <label className={styles.inputLabel}>Próximo Bloco</label>
                    <select
                      value={action.next}
                      onChange={(e) => {
                        const targetId = e.target.value;
                        const updated = [...actions];
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
                      {
                        variable: "lastUserMessage",
                        type: "exists",
                        value: "",
                      },
                    ],
                  };
                  updateActions([...actions, newAction]);
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
        <div className={styles.sectionHeader} onClick={() => toggleSection("default")}>
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
              value={awaitResponse}
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
              value={sendDelayInSeconds}
              onChange={(e) =>
                updateBlock({ sendDelayInSeconds: parseInt(e.target.value) })
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
              value={awaitResponse}
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
              value={sendDelayInSeconds}
              onChange={(e) =>
                updateBlock({ sendDelayInSeconds: parseInt(e.target.value) })
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

      const handleAddButton = () => {
        const current = content.action?.buttons || [];
        if (current.length >= 3) return alert("Máximo de 3 botões atingido.");
        const updated = [
          ...current,
          {
            type: "reply",
            reply: {
              id: "",
              title: "",
            },
          },
        ];
        updateContent("action", { ...content.action, buttons: updated });
      };

      const handleRemoveButton = (index) => {
        const updated = [...content.action.buttons];
        updated.splice(index, 1);
        updateContent("action", { ...content.action, buttons: updated });
      };

      const handleAddListItem = () => {
        const rows = content.action?.sections?.[0]?.rows || [];
        if (rows.length >= 10) return alert("Máximo de 10 itens atingido.");
        const newItem = {
          id: `item_${rows.length + 1}`,
          title: "",
          description: "",
        };
        const updatedSections = [
          {
            ...(content.action?.sections?.[0] || {}),
            title: content.action?.sections?.[0]?.title || "",
            rows: [...rows, newItem],
          },
        ];
        updateContent("action", {
          ...content.action,
          sections: updatedSections,
        });
      };

      const handleRemoveListItem = (index) => {
        const rows = [...(content.action?.sections?.[0]?.rows || [])];
        rows.splice(index, 1);
        const updatedSections = [
          {
            ...content.action.sections[0],
            rows,
          },
        ];
        updateContent("action", {
          ...content.action,
          sections: updatedSections,
        });
      };

      const handleUpdateRows = (rows) => {
        updateContent("action", {
          ...content.action,
          sections: [
            {
              ...content.action.sections?.[0],
              rows,
            },
          ],
        });
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
                    content: {
                      type: "list",
                      body: { text: "Escolha um item da lista:" },
                      footer: { text: "Toque para selecionar" },
                      header: { text: "🎯 Menu de Opções", type: "text" },
                      action: {
                        button: "Abrir lista",
                        sections: [
                          {
                            title: "Seção 1",
                            rows: [
                              {
                                id: "item_1",
                                title: "Item 1",
                                description: "Descrição do item 1",
                              },
                            ],
                          },
                        ],
                      },
                    },
                  });
                } else {
                  updateBlock({
                    content: {
                      type: "button",
                      body: { text: "Deseja continuar?" },
                      footer: { text: "Selecione uma opção" },
                      action: {
                        buttons: [
                          {
                            type: "reply",
                            reply: {
                              id: "sim",
                              title: "👍 Sim",
                            },
                          },
                          {
                            type: "reply",
                            reply: {
                              id: "nao",
                              title: "👎 Não",
                            },
                          },
                        ],
                      },
                    },
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
                  ...content.body,
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
                  ...content.footer,
                  text: e.target.value,
                })
              }
              className={styles.inputStyle}
            />
          </div>

          <div className={styles.inputGroup}>
            <label className={styles.inputLabel}>Aguardar resposta?</label>
            <select
              value={awaitResponse}
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
              value={sendDelayInSeconds}
              onChange={(e) =>
                updateBlock({ sendDelayInSeconds: parseInt(e.target.value) })
              }
              className={styles.inputStyle}
            />
          </div>

          {isList && (
            <>
              <div className={styles.inputGroup}>
                <label className={styles.inputLabel}>Título da seção</label>
                <input
                  type="text"
                  value={content.action?.sections?.[0]?.title || ""}
                  onChange={(e) =>
                    updateContent("action", {
                      ...content.action,
                      sections: [
                        {
                          ...content.action?.sections?.[0],
                          title: e.target.value,
                          rows: content.action?.sections?.[0]?.rows || [],
                        },
                      ],
                    })
                  }
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
                      const updated = [...content.action.sections[0].rows];
                      updated[idx].title = e.target.value.slice(0, 24);
                      handleUpdateRows(updated);
                    }}
                    className={styles.inputStyle}
                  />
                  <input
                    type="text"
                    value={item.description}
                    placeholder="Descrição"
                    onChange={(e) => {
                      const updated = [...content.action.sections[0].rows];
                      updated[idx].description = e.target.value;
                      handleUpdateRows(updated);
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
                      const value = e.target.value.slice(0, 20);
                      const updated = [...content.action.buttons];
                      updated[idx] = {
                        ...btn,
                        reply: {
                          ...btn.reply,
                          title: value,
                          id: value,
                        },
                      };
                      updateContent("action", {
                        ...content.action,
                        buttons: updated,
                      });
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
              value={awaitResponse}
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
              value={sendDelayInSeconds}
              onChange={(e) =>
                updateBlock({ sendDelayInSeconds: parseInt(e.target.value) })
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
        <h3 className={styles.panelTitle}>{selectedNode.data.label || "Novo Bloco"}</h3>
        <button onClick={() => onClose()} className={styles.closeButton} title="Fechar">
          <X size={20} />
        </button>
      </div>

      <div className={styles.tabContent}>
        <div className={styles.inputLabel}>
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
                    data: {
                      ...selectedNode.data,
                      label: e.target.value,
                    },
                  })
                }
                className={styles.inputStyle}
                placeholder="Nomeie este bloco"
              />
            )}
          </div>
        </div>

        {/* Botões de aba: mostrar apenas "Ações" para o nó de início */}
        {selectedNode.data.nodeType === "start" ? (
          <div className={styles.tabButtons}>
            <button className={`${styles.tabButton} ${styles.tabButtonActive}`} disabled>
              Ações
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
              Ações
            </button>
          </div>
        )}

        {/* Conteúdo das abas: só renderiza "Conteúdo" se não for o início */}
        {selectedNode.data.nodeType === "start"
          ? renderActionsTab()
          : tab === "conteudo"
          ? renderContentTab()
          : renderActionsTab()}

      </div>
    </aside>
  );
}


