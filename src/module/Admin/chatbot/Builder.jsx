import React, { useCallback, useEffect, useState, useRef } from "react";
import ReactFlow, {
  Controls,
  Background,
  addEdge,
  applyNodeChanges,
  applyEdgeChanges,
  useReactFlow,
} from "reactflow";
import "reactflow/dist/style.css";

import { nodeTemplates } from "./components/NodeTemplates";

import ScriptEditor from "./components/editor/scriptEditor";
import NodeQuadrado from "./components/NodeQuadrado";
import NodeConfigPanel from "./components/NodeConfigPanel";
import {
  Zap,
  HelpCircle,
  MessageCircle,
  Code,
  Globe,
  Image,
  Rocket,
  Download,
  MapPin,
  Headphones as HeadphonesIcon,
  ArrowDownCircle as ArrowDownCircleIcon,
} from "lucide-react";

const iconMap = {
  Zap: <Zap size={16} />,
  HelpCircle: <HelpCircle size={16} />,
  MessageCircle: <MessageCircle size={16} />,
  Code: <Code size={16} />,
  Globe: <Globe size={16} />,
  Image: <Image size={16} />,
  MapPin: <MapPin size={16} />,
  Headset: <HeadphonesIcon size={16} />,
  ListEnd: <ArrowDownCircleIcon size={16} />,
};

const nodeTypes = {
  quadrado: NodeQuadrado,
};

// Estilo customizado para os nós
const nodeStyle = {
  border: "2px solid",
  borderRadius: "8px",
  boxShadow: "0 4px 6px rgba(0, 0, 0, 0.1)",
  transition: "all 0.2s ease",
};

const selectedNodeStyle = {
  boxShadow: "0 0 0 2px #00e676, 0 4px 6px rgba(0, 0, 0, 0.1)",
};

export default function Builder() {
  const reactFlowInstance = useReactFlow();
  const [nodes, setNodes] = useState([
    {
      id: "1",
      type: "quadrado",
      position: { x: 100, y: 100 },
      data: {
        label: "Início",
        type: "start",
        nodeType: "start",
        color: "#546E7A",
        block: {
          type: "text",
          content: "Olá!",
          awaitResponse: true,
          awaitTimeInSeconds: 0,
          sendDelayInSeconds: 1,
          actions: [],
          defaultNext: "onError",
        },
      },
      draggable: false,
      connectable: true,
      selectable: true, // Opcional: desativa seleção
      style: {
        ...nodeStyle,
        borderColor: "#546E7A",
      },
    },
    {
      id: "onError",
      type: "quadrado",
      position: { x: 300, y: 100 },
      data: {
        label: "onError",
        type: "text",
        color: "#FF4500",
        block: {
          type: "text",
          content: "⚠️ Algo deu errado. Tente novamente mais tarde.",
          awaitResponse: false,
          awaitTimeInSeconds: 0,
          sendDelayInSeconds: 1,
          actions: [],
        },
      },
      style: {
        ...nodeStyle,
        borderColor: "#FF4500",
      },
    },
  ]);

  const [edges, setEdges] = useState([]);
  const [selectedNode, setSelectedNode] = useState(null);
  const [itor, setitor] = useState(false);
  const [scriptCode, setScriptCode] = useState("");

  const [highlightedNodeId, setHighlightedNodeId] = useState(null);
  const [selectedEdgeId, setSelectedEdgeId] = useState(null);
  const [isPublishing, setIsPublishing] = useState(false);

  const onNodesChange = useCallback((changes) => {
    setNodes((nds) => {
      const newNodes = nds.map((node) => {
        const positionChange = changes.find(
          (c) => c.id === node.id && c.type === "position"
        );

        // Bloqueia movimento se for o nó de início ou se draggable for false
        if (
          positionChange &&
          node.draggable !== false &&
          node.data.nodeType !== "start"
        ) {
          return {
            ...node,
            position: positionChange.position || node.position,
          };
        }
        return node;
      });
      return applyNodeChanges(changes, newNodes);
    });
  }, []);

  const onEdgesChange = useCallback(
    (changes) => setEdges((eds) => applyEdgeChanges(changes, eds)),
    []
  );
  
const handleOpenEditor = (node) => {
  setSelectedNode(node);
  setScriptCode(
    node?.data?.block?.code ||
`// Escreva seu código aqui
// Use "context" para acessar dados da conversa
function handler(context) {
  // exemplo: acessar mensagem do usuário
  // const mensagem = context.lastUserMessage;

  // seu código aqui

  return { resultado: "valor de saída" };
}
`
  );
  setitor(true);
};


const handleUpdateCode = (newCode) => {
  setScriptCode(newCode);
  if (selectedNode && selectedNode.data?.block) {
    // Atualiza node na lista global
    setNodes((nds) =>
      nds.map((n) =>
        n.id === selectedNode.id
          ? {
              ...n,
              data: {
                ...n.data,
                block: { ...n.data.block, code: newCode },
              },
            }
          : n
      )
    );
    // E sincroniza objeto selecionado
    setSelectedNode((prev) =>
      prev
        ? {
            ...prev,
            data: {
              ...prev.data,
              block: { ...prev.data.block, code: newCode },
            },
          }
        : prev
    );
  }
};

  
  const onConnect = useCallback((params) => {
    const { source, target } = params;

    setEdges((eds) => addEdge(params, eds));

    setNodes((nodes) =>
      nodes.map((node) => {
        if (node.id === source) {
          return {
            ...node,
            data: {
              ...node.data,
              block: {
                ...node.data.block,
                actions: [
                  ...(node.data.block.actions || []),
                  {
                    next: target,
                    conditions: [
                      {
                        variable: "lastUserMessage",
                        type: "exists",
                        value: "",
                      },
                    ],
                  },
                ],
              },
            },
          };
        }
        return node;
      })
    );
  }, []);

  const onNodeDoubleClick = (_, node) => {
    setSelectedNode(node);
  };

  const updateSelectedNode = (updated) => {
    if (!updated) {
      setSelectedNode(null);
      return;
    }

    setNodes((nds) => nds.map((n) => (n.id === updated.id ? updated : n)));
    setSelectedNode(updated);
  };

  const handleConnectNodes = ({ source, target }) => {
    setEdges((eds) => [...eds, { id: `${source}-${target}`, source, target }]);

    setNodes((nds) =>
      nds.map((node) => {
        if (node.id === source) {
          const existingActions = node.data.block.actions || [];
          return {
            ...node,
            data: {
              ...node.data,
              block: {
                ...node.data.block,
                actions: [
                  ...existingActions,
                  {
                    next: target,
                    conditions: [
                      {
                        variable: "lastUserMessage",
                        type: "exists",
                        value: "",
                      },
                    ],
                  },
                ],
              },
            },
          };
        }
        return node;
      })
    );
  };

  const handleDelete = useCallback(() => {
    if (
      !selectedNode ||
      selectedNode.data.label === "Boas-vindas" ||
      selectedNode.data.label.toLowerCase().includes("onerror")
    )
      return;

    setNodes((nds) => nds.filter((n) => n.id !== selectedNode.id));
    setEdges((eds) =>
      eds.filter(
        (e) => e.source !== selectedNode.id && e.target !== selectedNode.id
      )
    );
    setSelectedNode(null);
  }, [selectedNode]);

  useEffect(() => {
    const handleKeyDown = (event) => {
      if (event.key === "Delete") {
        if (selectedEdgeId) {
          setEdges((eds) => eds.filter((e) => e.id !== selectedEdgeId));
          setSelectedEdgeId(null);

          setNodes((nds) =>
            nds.map((node) => {
              const updatedActions = (node.data.block.actions || []).filter(
                (a) =>
                  a.next !== edges.find((e) => e.id === selectedEdgeId)?.target
              );
              return {
                ...node,
                data: {
                  ...node.data,
                  block: {
                    ...node.data.block,
                    actions: updatedActions,
                  },
                },
              };
            })
          );
        } else if (
          selectedNode &&
          selectedNode.data.label !== "Boas-vindas" &&
          !selectedNode.data.label.toLowerCase().includes("onerror")
        ) {
          setNodes((nds) => nds.filter((n) => n.id !== selectedNode.id));
          setEdges((eds) =>
            eds.filter(
              (e) =>
                e.source !== selectedNode.id && e.target !== selectedNode.id
            )
          );
          setSelectedNode(null);
        }
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [selectedEdgeId, selectedNode, edges]);

  useEffect(() => {
    const loadLatestFlow = async () => {
      try {
        const latestRes = await fetch(
          "https://ia-srv-meta.9j9goo.easypanel.host/api/v1/flow/latest"
        );
        const latestData = await latestRes.json();
        const latestFlowId = latestData[0]?.id;

        if (!latestFlowId) return;

        const flowRes = await fetch(
          `https://ia-srv-meta.9j9goo.easypanel.host/api/v1/flow/data/${latestFlowId}`
        );
        const flowData = await flowRes.json();

        const loadedNodes = [];
        const loadedEdges = [];

        Object.entries(flowData.blocks).forEach(([label, block]) => {
          loadedNodes.push({
            id: label,
            type: "quadrado",
            position: block.position || { x: 100, y: 100 },
            data: {
              label,
              type: block.type,
              nodeType:
                block.type === "start" || label.toLowerCase() === "início"
                  ? "start"
                  : undefined,
              color: block.color || "#607D8B",
              block,
            },
            style: {
              ...nodeStyle,
              borderColor: block.color || "#607D8B",
            },
          });

          (block.actions || []).forEach((action) => {
            loadedEdges.push({
              id: `${label}-${action.next}`,
              source: label,
              target: action.next,
            });
          });
        });

        setNodes(loadedNodes);
        setEdges(loadedEdges);
      } catch (err) {
        console.error("Erro ao carregar fluxo ativo", err);
      }
    };

    loadLatestFlow();
  }, []);

  const handlePublish = async () => {
    setIsPublishing(true);

    const nodeIdMap = Object.fromEntries(
      nodes.map((n) => [n.id, n.data.label.replace(/\s+/g, "_").toLowerCase()])
    );

    const blocks = {};
    nodes.forEach((node) => {
      const id = nodeIdMap[node.id];
      const originalBlock = node.data.block;

      const clonedBlock = {
        ...originalBlock,
        defaultNext: originalBlock.defaultNext
          ? nodeIdMap[originalBlock.defaultNext] || originalBlock.defaultNext
          : undefined,
      };

      if (originalBlock.actions && originalBlock.actions.length > 0) {
        clonedBlock.actions = originalBlock.actions.map((action) => ({
          next: nodeIdMap[action.next] || action.next,
          conditions: action.conditions || [],
        }));
      }

      blocks[id] = {
        ...clonedBlock,
        position: node.position,
        color: node.data.color,
      };
    });

    const startNode = nodes.find((n) => n.data.nodeType === "start");

    const flowData = {
      data: {
        start: startNode ? nodeIdMap[startNode.id] : nodeIdMap[nodes[0]?.id],
        blocks,
      },
    };

    try {
      const response = await fetch(
        "https://ia-srv-meta.9j9goo.easypanel.host/api/v1/flow/publish",
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(flowData, null, 2),
        }
      );

      if (response.ok) {
        alert("Fluxo publicado com sucesso!");
      } else {
        const error = await response.text();
        alert("Erro ao publicar fluxo: " + error);
      }
    } catch (err) {
      alert("Erro de conexão: " + err.message);
    } finally {
      setIsPublishing(false);
    }
  };

  const addNodeTemplate = (template) => {
    const newNode = {
      id: (nodes.length + 1).toString(),
      type: "quadrado",
      position: {
        x: Math.random() * 250 + 100,
        y: Math.random() * 250 + 100,
      },
      data: {
        label: template.label,
        type: template.type,
        color: template.color,
        block: {
          ...template.block,
          defaultNext: "onError",
        },
      },
      style: {
        ...nodeStyle,
        borderColor: template.color,
      },
    };
    setNodes((nds) => nds.concat(newNode));
  };

  const downloadFlow = () => {
    const nodeIdMap = Object.fromEntries(
      nodes.map((n) => [n.id, n.data.label.replace(/\s+/g, "_").toLowerCase()])
    );

    const blocks = {};
    nodes.forEach((node) => {
      const id = nodeIdMap[node.id];
      const originalBlock = node.data.block;

      const clonedBlock = {
        ...originalBlock,
        defaultNext: originalBlock.defaultNext
          ? nodeIdMap[originalBlock.defaultNext] || originalBlock.defaultNext
          : undefined,
      };

      if (originalBlock.actions && originalBlock.actions.length > 0) {
        clonedBlock.actions = originalBlock.actions.map((action) => ({
          next: nodeIdMap[action.next] || action.next,
          conditions: action.conditions || [],
        }));
      }

      blocks[id] = {
        ...clonedBlock,
        position: node.position,
        color: node.data.color,
      };
    });

    const flowData = {
      start: nodeIdMap[nodes[0]?.id],
      blocks,
    };

    const blob = new Blob([JSON.stringify(flowData, null, 2)], {
      type: "application/json",
    });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = "fluxo-chatbot.json";
    link.click();
    URL.revokeObjectURL(url);
  };

  const styledNodes = nodes.map((node) => ({
    ...node,
    id: node.id,
    selected: selectedNode?.id === node.id,
    data: {
      ...node.data,
      isHighlighted: node.id === highlightedNodeId,
    },
    style: {
      ...node.style,
      ...(selectedNode?.id === node.id ? selectedNodeStyle : {}),
      opacity: highlightedNodeId && highlightedNodeId !== node.id ? 0.6 : 1,
    },
  }));

  const styledEdges = edges.map((edge) => ({
    ...edge,
    markerEnd: {
      type: "arrowclosed",
      color: "#888",
      width: 16,
      height: 16,
    },
    style: {
      stroke: edge.id === selectedEdgeId ? "#888" : "#888",
      strokeWidth: edge.id === selectedEdgeId ? 2.5 : 1.5,
    },
  }));

  const iconButtonStyle = {
    background: "#333",
    color: "#fff",
    border: "1px solid #555",
    borderRadius: "50%",
    padding: "6px",
    width: "32px",
    height: "32px",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    cursor: "pointer",
    transition: "all 0.2s ease",
    ":hover": {
      background: "#444",
      transform: "scale(1.05)",
    },
  };

  const edgeOptions = {
    type: "smoothstep",
    animated: false,
    style: {
      stroke: "#888",
      strokeWidth: 2,
    },
    markerEnd: {
      type: "arrowclosed",
      color: "#888",
      width: 12,
      height: 12,
    },
  };

  return (
  <div
    style={{
      width: "100%",
      height: "100%",
      position: "relative",
      backgroundColor: "#1a1a1a",
    }}
  >
    {/* Menu lateral fixo */}
    <div
      style={{
        position: "fixed",
        top: "50%",
        left: 10,
        transform: "translateY(-50%)",
        background: "#1e1e1e",
        border: "1px solid #444",
        borderRadius: "8px",
        padding: "0.5rem",
        zIndex: 20,
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        gap: "10px",
        boxShadow: "0 2px 10px rgba(0, 0, 0, 0.3)",
      }}
    >
      <button
        onClick={handlePublish}
        title="Publicar"
        style={{
          ...iconButtonStyle,
          opacity: isPublishing ? 0.5 : 1,
          pointerEvents: isPublishing ? "none" : "auto",
        }}
      >
        {isPublishing ? "⏳" : <Rocket size={18} />}
      </button>
      <button
        onClick={downloadFlow}
        title="Baixar JSON"
        style={iconButtonStyle}
      >
        <Download size={18} />
      </button>
      <div
        style={{
          width: "80%",
          height: "1px",
          backgroundColor: "#555",
          margin: "4px 0",
        }}
      />
      {nodeTemplates.map((template) => (
        <button
          key={template.type + template.label}
          onClick={() => addNodeTemplate(template)}
          style={{
            ...iconButtonStyle,
            backgroundColor: template.color,
            width: "40px",
            height: "40px",
          }}
          title={template.label}
        >
          {iconMap[template.iconName] || <Zap size={16} />}
        </button>
      ))}
    </div>

    {/* Container principal */}
    <div
      style={{
        display: "flex",
        height: "calc(100vh - 56px)",
        marginTop: "56px",
      }}
    >
      {/* ESQUERDA: builder + editor sobreposto */}
<div style={{ position: "relative", flex: 1, height: "100%" }}>
  {/* Painel de Editor flutuando sobre o ReactFlow, mas NÃO cobrindo o NodeConfigPanel */}
  {itor && (
    <div
      style={{
        position: "absolute",
        top: 0,
        bottom: 0,
        left: 0,
        right: "375px", // 👈 Define o limite para não invadir o NodeConfigPanel
        zIndex: 100,
        backgroundColor: "#1e1e1e",
        borderRight: "1px solid #333",
        display: "flex",
        flexDirection: "column",
        boxShadow: "2px 0 12px #000b",
      }}
    >
      <div
        style={{
          padding: "0.5rem 1rem",
          color: "#fff",
          background: "#2a2a2a",
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
        }}
      >
        <span>Editor de Script</span>
        <button
          onClick={() => setitor(false)}
          style={{
            background: "transparent",
            border: "none",
            color: "#fff",
            fontSize: "1.2rem",
            cursor: "pointer",
          }}
        >
          ✖
        </button>
      </div>
      <div style={{ flex: 1, overflow: "auto" }}>
        <ScriptEditor value={scriptCode} onChange={handleUpdateCode} />
      </div>
    </div>
  )}

  {/* ReactFlow abaixo do painel flutuante */}
  <ReactFlow
    nodes={styledNodes}
    edges={styledEdges}
    nodeTypes={nodeTypes}
    defaultEdgeOptions={edgeOptions}
    onNodesChange={onNodesChange}
    onEdgesChange={onEdgesChange}
    onConnect={onConnect}
    onNodeDoubleClick={onNodeDoubleClick}
    onNodeClick={(event, node) => {
      setSelectedNode(node);
      setSelectedEdgeId(null);
      setHighlightedNodeId(node.id);
    }}
    onEdgeClick={(event, edge) => {
      event.stopPropagation();
      setSelectedEdgeId(edge.id);
      setSelectedNode(null);
    }}
    onPaneClick={() => {
      setSelectedNode(null);
      setSelectedEdgeId(null);
      setHighlightedNodeId(null);
    }}
    fitViewOptions={{ padding: 0.5 }}
  >
    <Background color="#e2e8f0" gap={32} variant="dots" />
    <Controls
      style={{
        backgroundColor: "white",
        border: "1px solid #e2e8f0",
        borderRadius: "6px",
        boxShadow: "0 2px 6px rgba(0, 0, 0, 0.1)",
      }}
    />
  </ReactFlow>
</div>


      {/* DIREITA: NodeConfigPanel */}
      <NodeConfigPanel
        selectedNode={selectedNode}
        onChange={updateSelectedNode}
        onClose={() => setSelectedNode(null)}
        allNodes={nodes}
        onConnectNodes={handleConnectNodes}
        setShowScriptEditor={setitor}
        setScriptCode={setScriptCode}
      />
    </div>
  </div>
);
}
