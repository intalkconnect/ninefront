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
import { apiGet, apiPost } from "../../../shared/apiClient";

import { nodeTemplates } from "./components/NodeTemplates";
import VersionHistoryModal from "./components/VersionControlModal";

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
  Headset,
  ArrowDownCircle as ArrowDownCircleIcon,
  Undo2,
  Redo2,
} from "lucide-react";

/* =========================
 * Utils
 * ========================= */
const genId = () =>
  typeof crypto !== "undefined" && crypto.randomUUID
    ? crypto.randomUUID()
    : `n_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;

const genEdgeId = () =>
  typeof crypto !== "undefined" && crypto.randomUUID
    ? crypto.randomUUID()
    : `e_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;

const deepClone = (obj) => JSON.parse(JSON.stringify(obj));

/* =========================
 * Icon map e nodeTypes
 * ========================= */
const iconMap = {
  Zap: <Zap size={16} />,
  HelpCircle: <HelpCircle size={16} />,
  MessageCircle: <MessageCircle size={16} />,
  Code: <Code size={16} />,
  Globe: <Globe size={16} />,
  Image: <Image size={16} />,
  MapPin: <MapPin size={16} />,
  Headset: <Headset size={16} />,
  ListEnd: <ArrowDownCircleIcon size={16} />,
};

const nodeTypes = { quadrado: NodeQuadrado };

/* =========================
 * Estilos
 * ========================= */
const nodeStyle = {
  border: "2px solid",
  borderRadius: "8px",
  boxShadow: "0 4px 6px rgba(0, 0, 0, 0.1)",
};

const selectedNodeStyle = {
  boxShadow: "0 0 0 2px #00e676, 0 4px 6px rgba(0, 0, 0, 0.1)",
};

/* =========================
 * Componente
 * ========================= */
export default function Builder() {
  const reactFlowInstance = useReactFlow();

  /* ---------- estado base ---------- */
  const [nodes, setNodes] = useState(() => {
    const startId = genId();
    const fallbackId = genId();
    return [
      {
        id: startId,
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
            defaultNext: "",
          },
        },
        draggable: false,
        connectable: true,
        selectable: true,
        style: { ...nodeStyle, borderColor: "#546E7A" },
      },
      {
        id: fallbackId,
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
        style: { ...nodeStyle, borderColor: "#FF4500" },
      },
    ];
  });

  const [edges, setEdges] = useState([]);
  const [selectedNode, setSelectedNode] = useState(null);
  const [selectedEdgeId, setSelectedEdgeId] = useState(null);
  const [highlightedNodeId, setHighlightedNodeId] = useState(null);

  const [itor, setitor] = useState(false);
  const [scriptCode, setScriptCode] = useState("");
  const [showHistory, setShowHistory] = useState(false);
  const [flowHistory, setFlowHistory] = useState([]);
  const [showNodeMenu, setShowNodeMenu] = useState(false);
  const nodeMenuRef = useRef(null);
  const [isPublishing, setIsPublishing] = useState(false);

  /* ---------- Undo / Redo ---------- */
  const [history, setHistory] = useState({ past: [], future: [] });
  const nodesRef = useRef(nodes);
  const edgesRef = useRef(edges);
  useEffect(() => { nodesRef.current = nodes; }, [nodes]);
  useEffect(() => { edgesRef.current = edges; }, [edges]);

  const snapshot = useCallback(
    () => ({ nodes: deepClone(nodesRef.current), edges: deepClone(edgesRef.current) }),
    []
  );
  const pushHistory = useCallback((prev) => {
    setHistory((h) => ({ past: [...h.past, deepClone(prev)], future: [] }));
  }, []);
  const undo = useCallback(() => {
    setHistory((h) => {
      if (h.past.length === 0) return h;
      const prev = h.past[h.past.length - 1];
      const current = snapshot();
      setNodes(prev.nodes);
      setEdges(prev.edges);
      setSelectedEdgeId(null);
      setSelectedNode(null);
      return { past: h.past.slice(0, -1), future: [...h.future, current] };
    });
  }, [snapshot]);
  const redo = useCallback(() => {
    setHistory((h) => {
      if (h.future.length === 0) return h;
      const next = h.future[h.future.length - 1];
      const current = snapshot();
      setNodes(next.nodes);
      setEdges(next.edges);
      setSelectedEdgeId(null);
      setSelectedNode(null);
      return { past: [...h.past, current], future: h.future.slice(0, -1) };
    });
  }, [snapshot]);

  /* ---------- handlers básicos ---------- */
  const onNodesChange = useCallback(
    (changes) => {
      const shouldPush = !changes.some((ch) => ch.type === "position" && ch.dragging);
      setNodes((nds) => {
        if (shouldPush) pushHistory({ nodes: nds, edges: edgesRef.current });
        return applyNodeChanges(changes, nds);
      });
    },
    [pushHistory]
  );

  // sincroniza ações quando edges são removidos pelo ReactFlow + limpa seleção
  const onEdgesChange = useCallback(
    (changes) => {
      const removedIds = new Set(changes.filter((c) => c.type === "remove").map((c) => c.id));
      const removedEdges = edgesRef.current.filter((e) => removedIds.has(e.id));

      pushHistory({ nodes: nodesRef.current, edges: edgesRef.current });

      setEdges((eds) => applyEdgeChanges(changes, eds));

      if (removedEdges.length) {
        setNodes((nds) =>
          nds.map((node) => {
            const block = node.data.block || {};
            const before = block.actions || [];
            const after = before.filter(
              (a) => !removedEdges.some((re) => re.source === node.id && re.target === a.next)
            );
            if (after.length === before.length) return node;
            return { ...node, data: { ...node.data, block: { ...block, actions: after } } };
          })
        );
      }

      // garante deseleção se a edge removida estava ativa
      if (removedIds.size) {
        setSelectedEdgeId((cur) => (cur && removedIds.has(cur) ? null : cur));
      }
    },
    [pushHistory]
  );

  const handleOpenEditor = (node) => {
    const freshNode = nodes.find((n) => n.id === node.id);
    setSelectedNode(freshNode);
    setScriptCode(
      freshNode?.data?.block?.code ||
        `// Escreva seu código aqui
// Use "context" para acessar dados da conversa
function handler(context) {
  return { resultado: "valor de saída" };
}`
    );
    setitor(true);
  };

  const handleUpdateCode = useCallback(
    (newCode) => {
      setScriptCode(newCode);
      if (selectedNode && selectedNode.data?.block?.type === "script") {
        pushHistory(snapshot());
        setNodes((nds) =>
          nds.map((n) =>
            n.id === selectedNode.id
              ? { ...n, data: { ...n.data, block: { ...n.data.block, code: newCode } } }
              : n
          )
        );
        setSelectedNode((prev) =>
          prev ? { ...prev, data: { ...prev.data, block: { ...prev.data.block, code: newCode } } } : null
        );
      }
    },
    [selectedNode, snapshot, pushHistory]
  );

  const onConnect = useCallback(
    (params) => {
      const { source, target } = params;
      const sourceNode = nodesRef.current.find((n) => n.id === source);
      const actions = sourceNode?.data?.block?.actions || [];
      const already = actions.some((a) => a.next === target);

      pushHistory(snapshot());
      setEdges((eds) => addEdge({ ...params, id: genEdgeId() }, eds));

      if (!already) {
        setNodes((nds) =>
          nds.map((node) =>
            node.id !== source
              ? node
              : {
                  ...node,
                  data: {
                    ...node.data,
                    block: {
                      ...node.data.block,
                      actions: [
                        ...actions,
                        { next: target, conditions: [{ variable: "lastUserMessage", type: "exists", value: "" }] },
                      ],
                    },
                  },
                }
          )
        );
      }
    },
    [snapshot, pushHistory]
  );

  const onNodeDoubleClick = (_, node) => setSelectedNode(node);

  // atualização do nó vinda do painel: reconcilia edges com ações + limpa seleção de edge removida
  const updateSelectedNode = (updated) => {
    if (!updated) {
      setSelectedNode(null);
      return;
    }

    const prev = snapshot();
    pushHistory(prev);

    // 1) atualiza nó
    setNodes((prevNodes) => prevNodes.map((n) => (n.id === updated.id ? updated : n)));

    // 2) reconcilia edges
    const desiredTargets = new Set((updated.data?.block?.actions || []).map((a) => a?.next).filter(Boolean));
    const prevEdges = edgesRef.current;

    // edges removidas por falta de action correspondente
    const removedEdges = prevEdges.filter((e) => e.source === updated.id && !desiredTargets.has(e.target));
    const removedEdgeIds = new Set(removedEdges.map((e) => e.id));

    // mantém as demais
    const keptEdges = prevEdges.filter((e) => !(e.source === updated.id && removedEdgeIds.has(e.id)));

    // cria as que faltam
    const keptPairs = new Set(keptEdges.map((e) => `${e.source}-${e.target}`));
    const additions = [];
    desiredTargets.forEach((t) => {
      const key = `${updated.id}-${t}`;
      if (!keptPairs.has(key)) additions.push({ id: genEdgeId(), source: updated.id, target: t });
    });

    const nextEdges = keptEdges.concat(additions);
    setEdges(nextEdges);

    // limpa seleção caso a edge selecionada tenha sido removida nesta atualização
    if (removedEdgeIds.size) {
      setSelectedEdgeId((cur) => (cur && removedEdgeIds.has(cur) ? null : cur));
    }

    setSelectedNode(updated);
  };

  const handleConnectNodes = ({ source, target }) => {
    const src = nodesRef.current.find((n) => n.id === source);
    const actions = src?.data?.block?.actions || [];
    const already = actions.some((a) => a.next === target);

    pushHistory(snapshot());
    setEdges((eds) => [...eds, { id: genEdgeId(), source, target }]);

    if (!already) {
      setNodes((nds) =>
        nds.map((node) =>
          node.id !== source
            ? node
            : {
                ...node,
                data: {
                  ...node.data,
                  block: {
                    ...node.data.block,
                    actions: [
                      ...actions,
                      { next: target, conditions: [{ variable: "lastUserMessage", type: "exists", value: "" }] },
                    ],
                  },
                },
              }
        )
      );
    }
  };

  const deleteNodeAndCleanup = (deletedId) => {
    const prev = snapshot();
    pushHistory(prev);

    // ids das edges que sairão
    const toRemove = edgesRef.current.filter((e) => e.source === deletedId || e.target === deletedId);
    const removedIds = new Set(toRemove.map((e) => e.id));

    setNodes((nds) =>
      nds
        .filter((n) => n.id !== deletedId)
        .map((n) => {
          const block = n.data.block || {};
          const cleanedActions = (block.actions || []).filter((a) => a.next !== deletedId);
          const cleanedDefaultNext = block.defaultNext === deletedId ? undefined : block.defaultNext;
          return { ...n, data: { ...n.data, block: { ...block, actions: cleanedActions, defaultNext: cleanedDefaultNext } } };
        })
    );

    setEdges((eds) => eds.filter((e) => !removedIds.has(e.id)));

    // limpa seleção se a edge removida estava ativa
    if (removedIds.size) {
      setSelectedEdgeId((cur) => (cur && removedIds.has(cur) ? null : cur));
    }
  };

  const handleDelete = useCallback(() => {
    if (!selectedNode || selectedNode.data.nodeType === "start" || selectedNode.data.label?.toLowerCase()?.includes("onerror")) return;
    deleteNodeAndCleanup(selectedNode.id);
    setSelectedNode(null);
  }, [selectedNode]);

  /* ---------- efeitos auxiliares ---------- */
  useEffect(() => {
    if (!showHistory) return;
    (async () => {
      try {
        const data = await apiGet("/flow/history");
        setFlowHistory(data);
      } catch (err) {
        console.error("Erro ao carregar histórico de versões:", err);
      }
    })();
  }, [showHistory]);

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (nodeMenuRef.current && !nodeMenuRef.current.contains(event.target)) {
        setShowNodeMenu(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside, true);
    return () => document.removeEventListener("mousedown", handleClickOutside, true);
  }, []);

  // Keyboard global: ignora quando vindo do painel (data-stop-hotkeys), Undo/Redo, Delete selecionados
  useEffect(() => {
    const handleKeyDown = (event) => {
      // se veio do painel, ignora (o painel já cuida de hotkeys locais)
      if ((event.target instanceof HTMLElement) && event.target.closest?.("[data-stop-hotkeys='true']")) {
        return;
      }

      // Undo / Redo
      const isZ = event.key.toLowerCase() === "z";
      const isY = event.key.toLowerCase() === "y";
      if ((event.ctrlKey || event.metaKey) && isZ) {
        event.preventDefault();
        if (event.shiftKey) redo();
        else undo();
        return;
      }
      if ((event.ctrlKey || event.metaKey) && isY) {
        event.preventDefault();
        redo();
        return;
      }

      // Delete
      if (event.key === "Delete") {
        if (selectedEdgeId) {
          const edgeToRemove = edgesRef.current.find((e) => e.id === selectedEdgeId);
          pushHistory(snapshot());
          setEdges((eds) => eds.filter((e) => e.id !== selectedEdgeId));
          if (edgeToRemove) {
            setNodes((nds) =>
              nds.map((node) => {
                if (node.id !== edgeToRemove.source) return node;
                const updatedActions = (node.data.block.actions || []).filter((a) => a.next !== edgeToRemove.target);
                return { ...node, data: { ...node.data, block: { ...node.data.block, actions: updatedActions } } };
              })
            );
          }
          setSelectedEdgeId(null);
        } else if (selectedNode && selectedNode.data.nodeType !== "start" && !selectedNode.data.label?.toLowerCase()?.includes("onerror")) {
          deleteNodeAndCleanup(selectedNode.id);
          setSelectedNode(null);
        }
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [selectedEdgeId, selectedNode, undo, redo, pushHistory, snapshot]);

  /* ---------- carregar fluxo ativo ---------- */
  useEffect(() => {
    const loadLatestFlow = async () => {
      try {
        const latestData = await apiGet("/flow/latest");
        const latestFlowId = latestData[0]?.id;
        if (!latestFlowId) return;

        const flowData = await apiGet(`/flow/data/${latestFlowId}`);
        const blocksObj = flowData.blocks || {};
        const entries = Object.entries(blocksObj);

        const isOldFormat = entries.some(([_, b]) => !b?.id);
        const keyToId = {};
        const normalized = {};

        if (isOldFormat) {
          entries.forEach(([k, b]) => {
            const id = genId();
            keyToId[k] = id;
            normalized[id] = { ...b, id, label: b?.label || k };
          });
          Object.values(normalized).forEach((b) => {
            if (b.defaultNext && keyToId[b.defaultNext]) b.defaultNext = keyToId[b.defaultNext];
            if (Array.isArray(b.actions)) {
              b.actions = b.actions.map((a) => ({ ...a, next: keyToId[a.next] || a.next }));
            }
          });
        }

        const blocks = isOldFormat
          ? normalized
          : Object.fromEntries(entries.map(([id, b]) => [id, { ...b, id }]));

        const loadedNodes = Object.values(blocks).map((b) => ({
          id: b.id,
          type: "quadrado",
          position: b.position || { x: 100, y: 100 },
          data: {
            label: b.label || "Sem Nome",
            type: b.type,
            nodeType: b.type === "start" || (b.label || "").toLowerCase() === "início" ? "start" : undefined,
            color: b.color || "#607D8B",
            block: b,
          },
          style: { ...nodeStyle, borderColor: b.color || "#607D8B" },
        }));

        const loadedEdges = [];
        Object.values(blocks).forEach((b) => {
          (b.actions || []).forEach((a) => {
            if (a.next && blocks[a.next]) {
              loadedEdges.push({ id: genEdgeId(), source: b.id, target: a.next });
            }
          });
        });

        setNodes(loadedNodes);
        setEdges(loadedEdges);
        setHistory({ past: [], future: [] });
        setSelectedEdgeId(null);
        setSelectedNode(null);
      } catch (err) {
        console.error("Erro ao carregar fluxo ativo", err);
      }
    };

    loadLatestFlow();
  }, []);

  /* ---------- Publicar / Baixar ---------- */
  const handlePublish = async () => {
    setIsPublishing(true);
    try {
      const labelToId = {};
      nodes.forEach((n) => { if (labelToId[n.data.label]) console.warn("Label duplicado:", n.data.label); labelToId[n.data.label] = n.id; });
      const nodeIds = new Set(nodes.map((n) => n.id));

      const blocks = {};
      nodes.forEach((node) => {
        const block = { ...node.data.block };
        if (block.defaultNext) block.defaultNext = nodeIds.has(block.defaultNext) ? block.defaultNext : labelToId[block.defaultNext] || undefined;
        if (Array.isArray(block.actions)) {
          block.actions = block.actions.map((a) => ({ ...a, next: nodeIds.has(a.next) ? a.next : labelToId[a.next] || a.next }));
        }
        blocks[node.id] = {
          ...block,
          id: node.id,
          label: node.data.label,
          type: node.data.type,
          color: node.data.color,
          position: node.position,
        };
      });

      const startNode = nodes.find((n) => n.data.nodeType === "start");
      const flowData = { start: startNode?.id ?? nodes[0]?.id, blocks };
      await apiPost("/flow/publish", { data: flowData });
      alert("Fluxo publicado com sucesso!");
    } catch (err) {
      alert("Erro de conexão: " + err.message);
    } finally {
      setIsPublishing(false);
    }
  };

  const downloadFlow = () => {
    const labelToId = {};
    nodes.forEach((n) => { if (labelToId[n.data.label]) console.warn("Label duplicado:", n.data.label); labelToId[n.data.label] = n.id; });
    const nodeIds = new Set(nodes.map((n) => n.id));

    const blocks = {};
    nodes.forEach((node) => {
      const originalBlock = node.data.block || {};
      const clonedBlock = { ...originalBlock };
      if (clonedBlock.defaultNext) clonedBlock.defaultNext = nodeIds.has(clonedBlock.defaultNext) ? clonedBlock.defaultNext : labelToId[clonedBlock.defaultNext] || undefined;
      if (Array.isArray(clonedBlock.actions)) {
        clonedBlock.actions = clonedBlock.actions.map((a) => ({ ...a, next: nodeIds.has(a.next) ? a.next : labelToId[a.next] || a.next }));
      }
      blocks[node.id] = {
        ...clonedBlock,
        id: node.id,
        label: node.data.label,
        type: node.data.type,
        position: node.position,
        color: node.data.color,
      };
    });

    const flowData = { start: nodes.find((n) => n.data.nodeType === "start")?.id ?? nodes[0]?.id, blocks };
    const blob = new Blob([JSON.stringify(flowData, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = "fluxo-chatbot.json";
    link.click();
    URL.revokeObjectURL(url);
  };

  /* ---------- add node ---------- */
  const addNodeTemplate = (template) => {
    const onErrorNode = nodesRef.current.find((n) => n.data.label?.toLowerCase() === "onerror");
    pushHistory(snapshot());
    const newNode = {
      id: genId(),
      type: "quadrado",
      position: { x: Math.random() * 250 + 100, y: Math.random() * 250 + 100 },
      data: {
        label: template.label,
        type: template.type,
        color: template.color,
        block: { ...template.block, defaultNext: onErrorNode?.id },
      },
      style: { ...nodeStyle, borderColor: template.color },
    };
    setNodes((nds) => nds.concat(newNode));
  };

  /* ---------- render ---------- */
  const styledNodes = nodes.map((node) => ({
    ...node,
    selected: selectedNode?.id === node.id,
    data: { ...node.data, isHighlighted: node.id === highlightedNodeId },
    style: {
      ...node.style,
      ...(selectedNode?.id === node.id ? selectedNodeStyle : {}),
      opacity: highlightedNodeId && highlightedNodeId !== node.id ? 0.6 : 1,
    },
  }));

  const styledEdges = edges.map((edge) => ({
    ...edge,
    markerEnd: { type: "arrowclosed", color: "#888", width: 16, height: 16 },
    style: { stroke: "#888", strokeWidth: edge.id === selectedEdgeId ? 2.5 : 1.5 },
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
  };

  const edgeOptions = {
    type: "smoothstep",
    animated: false,
    style: { stroke: "#888", strokeWidth: 2 },
    markerEnd: { type: "arrowclosed", color: "#888", width: 12, height: 12 },
  };

  return (
    <div style={{ width: "100%", height: "100vh", position: "relative", backgroundColor: "#f9f9f9", display: "flex", flexDirection: "column" }}>

      {/* Conteúdo principal */}
      <div style={{ display: "flex", flex: 1, overflow: "hidden" }}>
        <div style={{ position: "relative", flex: 1 }}>
          {itor && <ScriptEditor code={scriptCode} onChange={handleUpdateCode} onClose={() => setitor(false)} />}

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
              event.stopPropagation();
              setSelectedNode(node);
              setSelectedEdgeId(null);
              setHighlightedNodeId(node.id);
            }}
            onEdgeClick={(event, edge) => {
              event.stopPropagation();
              setSelectedEdgeId(edge.id);
              setSelectedNode(null);
            }}
            onPaneClick={(event) => {
              if (!event.target.closest(".react-flow__node") && !event.target.closest(".react-flow__edge")) {
                setSelectedNode(null);
                setSelectedEdgeId(null);
                setHighlightedNodeId(null);
              }
            }}
            fitViewOptions={{ padding: 0.5 }}
            proOptions={{ hideAttribution: true }}
          >
            <Background color="#555" gap={32} variant="dots" />
            <Controls style={{ backgroundColor: "white", border: "1px solid #e2e8f0", borderRadius: "6px", boxShadow: "0 2px 6px rgba(0, 0, 0, 0.1)" }} />

            <VersionHistoryModal
              visible={showHistory}
              onClose={() => setShowHistory(false)}
              versions={flowHistory}
              onRestore={async (id) => {
                await apiPost("/flow/activate", { id });
                window.location.reload();
              }}
            />
          </ReactFlow>

          {/* Menu flutuante */}
          <div
            ref={nodeMenuRef}
            style={{
              position: "absolute",
              top: "120px",
              left: 10,
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
            <button onClick={() => setShowNodeMenu((p) => !p)} title="Adicionar Blocos" style={{ ...iconButtonStyle, backgroundColor: showNodeMenu ? "#555" : "#333" }}>
              ➕
            </button>

            {showNodeMenu && (
              <div
                style={{
                  position: "absolute",
                  left: "60px",
                  top: "0px",
                  backgroundColor: "#2c2c2c",
                  borderRadius: "6px",
                  padding: "0.5rem",
                  boxShadow: "0 2px 10px rgba(0,0,0,0.5)",
                  display: "flex",
                  flexDirection: "column",
                  gap: "0.5rem",
                  zIndex: 30,
                }}
              >
                {nodeTemplates.map((template) => (
                  <button
                    key={template.type + template.label}
                    onClick={() => {
                      addNodeTemplate(template);
                      setShowNodeMenu(false);
                    }}
                    style={{ ...iconButtonStyle, backgroundColor: template.color, width: "36px", height: "36px" }}
                    title={template.label}
                  >
                    {iconMap[template.iconName] || <Zap size={16} />}
                  </button>
                ))}
              </div>
            )}

            <div style={{ width: "80%", height: "1px", backgroundColor: "#555", margin: "4px 0" }} />

            {/* Undo / Redo */}
            <button onClick={undo} title="Desfazer (Ctrl/Cmd+Z)" style={iconButtonStyle}>
              <Undo2 size={18} />
            </button>
            <button onClick={redo} title="Refazer (Ctrl+Shift+Z ou Ctrl/Cmd+Y)" style={iconButtonStyle}>
              <Redo2 size={18} />
            </button>

            {/* Publicar / Baixar / Histórico */}
            <button onClick={handlePublish} title="Publicar" style={{ ...iconButtonStyle, opacity: isPublishing ? 0.5 : 1, pointerEvents: isPublishing ? "none" : "auto" }}>
              {isPublishing ? "⏳" : <Rocket size={18} />}
            </button>
            <button onClick={downloadFlow} title="Baixar JSON" style={iconButtonStyle}>
              <Download size={18} />
            </button>
            <button onClick={() => setShowHistory(true)} title="Histórico de Versões" style={iconButtonStyle}>
              🕘
            </button>
          </div>
        </div>

        {/* Painel lateral */}
        {selectedNode && (
          <NodeConfigPanel
            selectedNode={selectedNode}
            onChange={updateSelectedNode}
            onClose={() => setSelectedNode(null)}
            allNodes={nodes}
            onConnectNodes={({ source, target }) => {
              // conecta via painel (mesma lógica do handleConnectNodes)
              const src = nodesRef.current.find((n) => n.id === source);
              const actions = src?.data?.block?.actions || [];
              const already = actions.some((a) => a.next === target);
              pushHistory(snapshot());
              setEdges((eds) => [...eds, { id: genEdgeId(), source, target }]);
              if (!already) {
                setNodes((nds) =>
                  nds.map((node) =>
                    node.id !== source
                      ? node
                      : {
                          ...node,
                          data: {
                            ...node.data,
                            block: {
                              ...node.data.block,
                              actions: [
                                ...actions,
                                { next: target, conditions: [{ variable: "lastUserMessage", type: "exists", value: "" }] },
                              ],
                            },
                          },
                        }
                  )
                );
              }
            }}
            setShowScriptEditor={setitor}
            setScriptCode={setScriptCode}
          />
        )}
      </div>
    </div>
  );
}
