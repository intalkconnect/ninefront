import React, { useState, useEffect } from "react";
import { Trash2, ChevronDown, ChevronUp, Plus, X } from "lucide-react";

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
  const [flowHistory, setFlowHistory] = useState([]);
  const [loadingHistory, setLoadingHistory] = useState(false);
  const [expandedSections, setExpandedSections] = useState({
    basic: true,
    content: true,
    actions: true,
    history: true,
  });

  useEffect(() => {
    fetchLatestFlows();
  }, []);

  const fetchLatestFlows = async () => {
    setLoadingHistory(true);
    try {
      const res = await fetch(
        "https://ia-srv-meta.9j9goo.easypanel.host/api/v1/flow/latest"
      );
      const data = await res.json();
      setFlowHistory(data.slice(0, 10));
    } catch (err) {
      console.error("Erro ao carregar histórico de fluxos", err);
    } finally {
      setLoadingHistory(false);
    }
  };

  const handleRestore = async (id) => {
    try {
      await fetch(
        "https://ia-srv-meta.9j9goo.easypanel.host/api/v1/flow/activate",
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ id }),
        }
      );
      window.location.reload();
    } catch (err) {
      alert("Erro ao restaurar fluxo");
    }
  };

  const toggleSection = (section) => {
    setExpandedSections((prev) => ({
      ...prev,
      [section]: !prev[section],
    }));
  };

  if (!selectedNode)
    return (
      <aside style={asideStyle}>
        <div style={panelHeader}>
          <h3 style={panelTitle}>Histórico de Fluxos</h3>
        </div>

        {loadingHistory ? (
          <div style={loadingStyle}>
            <div style={spinnerStyle}></div>
            <span>Carregando...</span>
          </div>
        ) : (
          <div style={historyContainer}>
            {flowHistory.map((flow) => (
              <div key={flow.id} style={historyItem}>
                <div style={historyItemHeader}>
                  <span style={historyId}>{flow.id.slice(0, 8)}...</span>
                  <span style={historyDate}>
                    {new Date(flow.created_at).toLocaleString()}
                  </span>
                </div>
                <button
                  onClick={() => handleRestore(flow.id)}
                  style={restoreButton}
                >
                  Restaurar Versão
                </button>
              </div>
            ))}
          </div>
        )}
      </aside>
    );

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
    <div style={tabContent}>
      <div style={sectionContainer}>
        <div style={sectionHeader} onClick={() => toggleSection("actions")}>
          <h4 style={sectionTitle}>
            Condições de Saída
            <span style={sectionCount}>({actions.length}/25)</span>
          </h4>
          {expandedSections.actions ? (
            <ChevronUp size={16} />
          ) : (
            <ChevronDown size={16} />
          )}
        </div>

        {expandedSections.actions && (
          <div style={sectionContent}>
            {actions.map((action, actionIdx) => (
              <React.Fragment key={actionIdx}>
                {actionIdx > 0 && (
                  <div style={dividerContainer}>
                    <div style={dividerLine}></div>
                    <span style={dividerText}>OU</span>
                  </div>
                )}

                <div style={actionBox}>
                  <div style={actionHeader}>
                    <strong style={actionTitle}>
                      Condição {actionIdx + 1}
                    </strong>
                    <Trash2
                      size={16}
                      color="#ff6b6b"
                      style={trashIconStyle}
                      onClick={() => {
                        const updated = [...actions];
                        updated.splice(actionIdx, 1);
                        updateActions(updated);
                      }}
                    />
                  </div>

                  {(action.conditions || []).map((cond, condIdx) => (
                    <div key={condIdx} style={conditionRow}>
                      <div style={inputGroup}>
                        <label style={inputLabel}>Variável</label>
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
                          style={inputStyle}
                        >
                          <option value="lastUserMessage">
                            Resposta do usuário
                          </option>
                          <option value="custom">Variável personalizada</option>
                        </select>
                      </div>

                      {cond.variable !== "lastUserMessage" && (
                        <div style={inputGroup}>
                          <label style={inputLabel}>Nome da variável</label>
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
                            style={inputStyle}
                          />
                        </div>
                      )}

                      <div style={inputGroup}>
                        <label style={inputLabel}>Tipo de condição</label>
                        <select
                          value={cond.type}
                          onChange={(e) => {
                            const updated = [...actions];
                            updated[actionIdx].conditions[condIdx].type =
                              e.target.value;
                            updateActions(updated);
                          }}
                          style={inputStyle}
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
                        <div style={inputGroup}>
                          <label style={inputLabel}>Valor</label>
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
                            style={inputStyle}
                          />
                        </div>
                      )}

                      <div style={buttonGroup}>
                        <button
                          style={deleteButtonSmall}
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

                  <div style={buttonGroup}>
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
                      style={addButtonSmall}
                    >
                      <Plus size={14} /> Adicionar Condição
                    </button>
                  </div>

                  <div style={inputGroup}>
                    <label style={inputLabel}>Próximo Bloco</label>
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
                      style={inputStyle}
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

            <div style={buttonGroup}>
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
                style={addButton}
              >
                <Plus size={16} /> Adicionar Ação
              </button>
            </div>
          </div>
        )}
      </div>

      <div style={sectionContainer}>
        <div style={sectionHeader} onClick={() => toggleSection("default")}>
          <h4 style={sectionTitle}>Saída Padrão</h4>
          {expandedSections.default ? (
            <ChevronUp size={16} />
          ) : (
            <ChevronDown size={16} />
          )}
        </div>

        {expandedSections.default && (
          <div style={sectionContent}>
            <div style={inputGroup}>
              <label style={inputLabel}>Próximo Bloco</label>
              <select
                value={block.defaultNext || ""}
                onChange={(e) => updateBlock({ defaultNext: e.target.value })}
                style={inputStyle}
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
        <>
          <label>Mensagem</label>
          <textarea
            rows={5}
            value={block.content || ""}
            onChange={(e) => updateBlock({ content: e.target.value })}
            style={inputStyle}
          />

          <label>Aguardar resposta?</label>
          <select
            value={awaitResponse}
            onChange={(e) =>
              updateBlock({ awaitResponse: e.target.value === "true" })
            }
            style={inputStyle}
          >
            <option value="true">Sim</option>
            <option value="false">Não</option>
          </select>
          <label>Atraso de envio (segundos)</label>
          <input
            type="number"
            value={sendDelayInSeconds}
            onChange={(e) =>
              updateBlock({ sendDelayInSeconds: parseInt(e.target.value) })
            }
            style={inputStyle}
          />
        </>
      );
    }

    if (type === "media") {
      return (
        <>
          <label>Tipo de mídia</label>
          <select
            value={content.mediaType || "image"}
            onChange={(e) => updateContent("mediaType", e.target.value)}
            style={inputStyle}
          >
            <option value="image">Imagem</option>
            <option value="document">Documento</option>
            <option value="audio">Áudio</option>
            <option value="video">Vídeo</option>
          </select>

          <label>URL</label>
          <input
            type="text"
            value={content.url || ""}
            onChange={(e) => updateContent("url", e.target.value)}
            style={inputStyle}
          />

          <label>Legenda</label>
          <input
            type="text"
            value={content.caption || ""}
            onChange={(e) => updateContent("caption", e.target.value)}
            style={inputStyle}
          />
          <label>Aguardar resposta?</label>
          <select
            value={awaitResponse}
            onChange={(e) =>
              updateBlock({ awaitResponse: e.target.value === "true" })
            }
            style={inputStyle}
          >
            <option value="true">Sim</option>
            <option value="false">Não</option>
          </select>
          <label>Atraso de envio (segundos)</label>
          <input
            type="number"
            value={sendDelayInSeconds}
            onChange={(e) =>
              updateBlock({ sendDelayInSeconds: parseInt(e.target.value) })
            }
            style={inputStyle}
          />
        </>
      );
    }
    if (type === "human") {
      return (
        <>
          <label>Nome da fila de atendimento</label>
          <input
            type="text"
            value={content.queueName || ""}
            onChange={(e) => updateContent("queueName", e.target.value)}
            style={inputStyle}
          />
        </>
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
        <>
          <label>Tipo de interativo</label>
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
            style={inputStyle}
          >
            <option value="button">Quick Reply</option>
            <option value="list">Menu List</option>
          </select>

          <label>Corpo</label>
          <input
            type="text"
            value={content.body?.text || ""}
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
                            {
                              id: "item_2",
                              title: "Item 2",
                              description: "Descrição do item 2",
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
            style={inputStyle}
          />

          <label>Rodapé</label>
          <input
            type="text"
            value={content.footer?.text || ""}
            onChange={(e) =>
              updateContent("footer", {
                ...content.footer,
                text: e.target.value,
              })
            }
            style={inputStyle}
          />

          <label>Aguardar resposta?</label>
          <select
            value={awaitResponse}
            onChange={(e) =>
              updateBlock({ awaitResponse: e.target.value === "true" })
            }
            style={inputStyle}
          >
            <option value="true">Sim</option>
            <option value="false">Não</option>
          </select>

          <label>Atraso de envio (segundos)</label>
          <input
            type="number"
            value={sendDelayInSeconds}
            onChange={(e) =>
              updateBlock({ sendDelayInSeconds: parseInt(e.target.value) })
            }
            style={inputStyle}
          />

          {isList && (
            <>
              <label>Título da seção</label>
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
                style={inputStyle}
              />

              {(content.action?.sections?.[0]?.rows || []).map((item, idx) => (
                <div key={idx} style={rowItemStyle}>
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
                    style={inputStyle}
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
                    style={inputStyle}
                  />
                  <Trash2
                    size={18}
                    color="#f55"
                    style={trashIconStyle}
                    onClick={() => handleRemoveListItem(idx)}
                    title="Remover item"
                  />
                </div>
              ))}

              <button onClick={handleAddListItem} style={inputStyle}>
                + Adicionar item
              </button>
            </>
          )}

          {isQuickReply && (
            <>
              {(content.action?.buttons || []).map((btn, idx) => (
                <div key={idx} style={rowItemStyle}>
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
                    style={inputStyle}
                  />
                  <Trash2
                    size={18}
                    color="#f55"
                    style={trashIconStyle}
                    onClick={() => handleRemoveButton(idx)}
                    title="Remover botão"
                  />
                </div>
              ))}

              <button onClick={handleAddButton} style={inputStyle}>
                + Adicionar botão
              </button>
            </>
          )}
        </>
      );
    }

    if (type === "location") {
      return (
        <>
          <label>Nome</label>
          <input
            type="text"
            value={content.name || ""}
            onChange={(e) => updateContent("name", e.target.value)}
            style={inputStyle}
          />
          <label>Endereço</label>
          <input
            type="text"
            value={content.address || ""}
            onChange={(e) => updateContent("address", e.target.value)}
            style={inputStyle}
          />
          <label>Latitude</label>
          <input
            type="text"
            value={content.latitude || ""}
            onChange={(e) => updateContent("latitude", e.target.value)}
            style={inputStyle}
          />
          <label>Longitude</label>
          <input
            type="text"
            value={content.longitude || ""}
            onChange={(e) => updateContent("longitude", e.target.value)}
            style={inputStyle}
          />
          <label>Aguardar resposta?</label>
          <select
            value={awaitResponse}
            onChange={(e) =>
              updateBlock({ awaitResponse: e.target.value === "true" })
            }
            style={inputStyle}
          >
            <option value="true">Sim</option>
            <option value="false">Não</option>
          </select>
          <label>Atraso de envio (segundos)</label>
          <input
            type="number"
            value={sendDelayInSeconds}
            onChange={(e) =>
              updateBlock({ sendDelayInSeconds: parseInt(e.target.value) })
            }
            style={inputStyle}
          />
        </>
      );
    }

    if (type === "code") {
      return (
        <>
<button
  onClick={() => {
    setScriptCode(selectedNode?.data?.block?.code || "");
    setShowScriptEditor(true);
  }}
  style={{
    padding: "8px",
    background: "#333",
    color: "#fff",
    border: "1px solid #444",
    borderRadius: "4px",
    marginBottom: "1rem",
  }}
>
  Abrir editor de código
</button>

          <label>Função</label>
          <input
            type="text"
            value={block.function || ""}
            onChange={(e) => updateBlock({ function: e.target.value })}
            style={inputStyle}
          />
          <label>Variável de saída</label>
          <input
            type="text"
            value={block.outputVar || ""}
            onChange={(e) => updateBlock({ outputVar: e.target.value })}
            style={inputStyle}
          />
        </>
      );
    }

    if (type === "http") {
      return (
        <>
          <label>Método</label>
          <select
            value={content.method || "GET"}
            onChange={(e) => updateContent("method", e.target.value)}
            style={inputStyle}
          >
            <option value="GET">GET</option>
            <option value="POST">POST</option>
            <option value="PUT">PUT</option>
            <option value="DELETE">DELETE</option>
          </select>

          <label>URL</label>
          <input
            type="text"
            value={content.url || ""}
            onChange={(e) => updateContent("url", e.target.value)}
            style={inputStyle}
          />

          <label>Headers (JSON)</label>
          <textarea
            rows={3}
            value={content.headers || ""}
            onChange={(e) => updateContent("headers", e.target.value)}
            style={inputStyle}
          />

          <label>Body (JSON)</label>
          <textarea
            rows={4}
            value={content.body || ""}
            onChange={(e) => updateContent("body", e.target.value)}
            style={inputStyle}
          />
        </>
      );
    }

    return null;
  };

  return (
    <aside style={asideStyle}>
      <div style={panelHeader}>
        <h3 style={panelTitle}>{selectedNode.data.label || "Novo Bloco"}</h3>
        <button onClick={() => onClose()} style={closeButton} title="Fechar">
          <X size={20} />
        </button>
      </div>

      <div style={tabContent}>
        <div style={sectionContainer}>
          <div style={inputGroup}>
            <label style={inputLabel}>Nome do Bloco</label>
            {selectedNode.data.nodeType === "start" ? (
              <div
                style={{
                  padding: "0.75rem",
                  backgroundColor: "#2f2f2f",
                  borderRadius: "6px",
                  color: "#ccc",
                }}
              >
                Este é o <strong>bloco inicial</strong> do fluxo. Ele é fixo,
                com redirecionamento automatico para o próximo bloco
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
                style={inputStyle}
                placeholder="Nomeie este bloco"
              />
            )}
          </div>
        </div>

        {/* Botões de aba: mostrar apenas "Ações" para o nó de início */}
        {selectedNode.data.nodeType === "start" ? (
          <div style={tabButtons}>
            <button style={tabButtonStyle(true)} disabled>
              Ações
            </button>
          </div>
        ) : (
          <div style={tabButtons}>
            <button
              style={tabButtonStyle(tab === "conteudo")}
              onClick={() => setTab("conteudo")}
            >
              Conteúdo
            </button>
            <button
              style={tabButtonStyle(tab === "acoes")}
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

// Updated Styles
const asideStyle = {
  position: "absolute",
  top: 0,
  right: 0,
  width: "380px",
  height: "100%",
  background: "#1e1e1e",
  color: "#fff",
  padding: "0",
  borderLeft: "1px solid #333",
  overflowY: "auto",
  zIndex: 1000,
  fontFamily: "'Segoe UI', Tahoma, Geneva, Verdana, sans-serif",
};

const panelHeader = {
  padding: "1rem",
  borderBottom: "1px solid #333",
  background: "#252525",
  display: "flex",
  justifyContent: "space-between",
  alignItems: "center",
};

const panelTitle = {
  margin: 0,
  fontSize: "1.1rem",
  fontWeight: "600",
  color: "#4FC3F7",
};

const closeButton = {
  background: "transparent",
  border: "none",
  color: "#ff6b6b",
  cursor: "pointer",
  padding: "0.25rem",
  borderRadius: "4px",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  transition: "all 0.2s",
  ":hover": {
    background: "#333",
  },
};

const tabContent = {
  padding: "1rem",
};

const tabButtons = {
  display: "flex",
  gap: "0.5rem",
  margin: "1rem 0",
};

const tabButtonStyle = (active) => ({
  flex: 1,
  padding: "0.75rem",
  background: active ? "#333" : "#252525",
  color: active ? "#fff" : "#aaa",
  border: "none",
  borderRadius: "6px",
  cursor: "pointer",
  fontWeight: "500",
  fontSize: "0.9rem",
  transition: "all 0.2s",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  ":hover": {
    background: active ? "#333" : "#2a2a2a",
  },
});

const sectionContainer = {
  marginBottom: "1.5rem",
  background: "#252525",
  borderRadius: "8px",
  overflow: "hidden",
};

const sectionHeader = {
  padding: "0.75rem 1rem",
  background: "#2a2a2a",
  display: "flex",
  justifyContent: "space-between",
  alignItems: "center",
  cursor: "pointer",
  userSelect: "none",
  ":hover": {
    background: "#2f2f2f",
  },
};

const sectionTitle = {
  margin: 0,
  fontSize: "0.95rem",
  fontWeight: "500",
  color: "#fff",
  display: "flex",
  alignItems: "center",
  gap: "0.5rem",
};

const sectionCount = {
  fontSize: "0.8rem",
  color: "#aaa",
  fontWeight: "normal",
  marginLeft: "0.5rem",
};

const sectionContent = {
  padding: "1rem",
};

const inputGroup = {
  marginBottom: "1rem",
};

const inputLabel = {
  display: "block",
  marginBottom: "0.5rem",
  fontSize: "0.85rem",
  color: "#ccc",
  fontWeight: "500",
};

const inputStyle = {
  width: "100%",
  padding: "0.75rem",
  borderRadius: "6px",
  border: "1px solid #444",
  background: "#2a2a2a",
  color: "#fff",
  fontSize: "0.9rem",
  transition: "all 0.2s",
  ":focus": {
    outline: "none",
    borderColor: "#4FC3F7",
    boxShadow: "0 0 0 2px rgba(79, 195, 247, 0.2)",
  },
};

const actionBox = {
  background: "#2a2a2a",
  border: "1px solid #444",
  borderRadius: "8px",
  padding: "1rem",
  marginBottom: "1rem",
};

const actionHeader = {
  display: "flex",
  justifyContent: "space-between",
  alignItems: "center",
  marginBottom: "1rem",
};

const actionTitle = {
  fontSize: "0.9rem",
  color: "#fff",
};

const conditionRow = {
  display: "flex",
  flexDirection: "column",
  gap: "1rem",
  marginBottom: "1rem",
  paddingBottom: "1rem",
  borderBottom: "1px solid #333",
  ":last-child": {
    borderBottom: "none",
    marginBottom: "0",
    paddingBottom: "0",
  },
};

const buttonGroup = {
  marginTop: "1rem",
  display: "flex",
  gap: "0.5rem",
};

const addButton = {
  backgroundColor: "#2e7d32",
  color: "#fff",
  border: "none",
  padding: "0.75rem 1rem",
  borderRadius: "6px",
  cursor: "pointer",
  fontSize: "0.9rem",
  fontWeight: "500",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  gap: "0.5rem",
  width: "100%",
  transition: "all 0.2s",
  ":hover": {
    backgroundColor: "#3d8b40",
  },
};

const addButtonSmall = {
  ...addButton,
  padding: "0.5rem 0.75rem",
  fontSize: "0.8rem",
  backgroundColor: "#333",
  ":hover": {
    backgroundColor: "#3d3d3d",
  },
};

const deleteButtonSmall = {
  ...addButtonSmall,
  backgroundColor: "#5c2a2a",
  color: "#ff6b6b",
  ":hover": {
    backgroundColor: "#6e3434",
  },
};

const dividerContainer = {
  position: "relative",
  textAlign: "center",
  margin: "1rem 0",
};

const dividerLine = {
  height: "1px",
  background: "#444",
  width: "100%",
  position: "absolute",
  top: "50%",
  left: 0,
  zIndex: 1,
};

const dividerText = {
  position: "relative",
  zIndex: 2,
  background: "#252525",
  padding: "0 0.75rem",
  color: "#888",
  fontSize: "0.75rem",
  fontWeight: "bold",
};

const trashIconStyle = {
  cursor: "pointer",
  opacity: 0.8,
  transition: "all 0.2s",
  ":hover": {
    opacity: 1,
  },
};

// History Panel Styles
const historyContainer = {
  display: "flex",
  flexDirection: "column",
  gap: "0.75rem",
};

const historyItem = {
  background: "#252525",
  borderRadius: "8px",
  padding: "1rem",
  border: "1px solid #333",
};

const historyItemHeader = {
  display: "flex",
  justifyContent: "space-between",
  marginBottom: "0.75rem",
};

const historyId = {
  fontSize: "0.85rem",
  color: "#4FC3F7",
  fontWeight: "500",
};

const historyDate = {
  fontSize: "0.8rem",
  color: "#aaa",
};

const restoreButton = {
  width: "100%",
  padding: "0.75rem",
  background: "#2e7d32",
  color: "#fff",
  border: "none",
  borderRadius: "6px",
  cursor: "pointer",
  fontSize: "0.9rem",
  fontWeight: "500",
  transition: "all 0.2s",
  ":hover": {
    background: "#3d8b40",
  },
};

const loadingStyle = {
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  gap: "0.75rem",
  padding: "2rem",
  color: "#aaa",
};

const spinnerStyle = {
  width: "20px",
  height: "20px",
  border: "3px solid rgba(255, 255, 255, 0.1)",
  borderTopColor: "#4FC3F7",
  borderRadius: "50%",
  animation: "spin 1s linear infinite",
};

const rowItemStyle = {
  display: "flex",
  gap: "0.5rem",
  alignItems: "center",
  marginBottom: "0.75rem",
};

// Add this to your global CSS
// @keyframes spin {
//   to { transform: rotate(360deg); }
// }








