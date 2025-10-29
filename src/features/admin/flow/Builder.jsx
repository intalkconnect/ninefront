import React, {
  useCallback,
  useEffect,
  useState,
  useRef,
  useMemo,
} from "react";
import { useParams, useLocation, useNavigate } from "react-router-dom";
import ReactFlow, {
  Controls,
  Background,
  addEdge,
  applyNodeChanges,
  applyEdgeChanges,
} from "reactflow";
import "reactflow/dist/style.css";
import { toast } from "react-toastify";
import { apiGet, apiPost, apiPut } from "../../../shared/apiClient";

import { nodeTemplates } from "./studio/components/NodeTemplates";
import VersionHistoryModal from "./studio/components/VersionControlModal";
import MacDock from "./studio/components/MacDock";
import { useConfirm } from "../../../app/provider/ConfirmProvider.jsx";

import ScriptEditor from "./studio/components/editor/scriptEditor";
import NodeQuadrado from "./studio/components/NodeQuadrado";
import NodeConfigPanel from "./studio/components/NodeConfigPanel";
import {
  Zap,
  MessageCircle,
  Code,
  Globe,
  Image,
  MapPin,
  Headset,
  MousePointerClick,
  ArrowLeft,
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

// compacta o estado relevante para detectar duplicatas de snapshot
const makeSnapKey = (s) => {
  const n = (s.nodes || [])
    .map((x) => ({
      id: x.id,
      p: x.position,
      l: x.data?.label,
      t: x.data?.type,
      b: x.data?.block,
    }))
    .sort((a, b) => a.id.localeCompare(b.id));

  const e = (s.edges || [])
    .map((x) => ({ s: x.source, t: x.target }))
    .sort((a, b) => (a.s + a.t).localeCompare(b.s + b.t));

  return JSON.stringify({ n, e });
};

/* =========================
 * Icon map e nodeTypes
 * ========================= */
const iconMap = {
  Zap: <Zap size={16} />,
  MessageCircle: <MessageCircle size={16} />,
  Code: <Code size={16} />,
  Globe: <Globe size={16} />,
  Image: <Image size={16} />,
  MapPin: <MapPin size={16} />,
  Headset: <Headset size={16} />,
  Pointer: <MousePointerClick size={16} />,
};

const nodeTypes = { quadrado: NodeQuadrado };

/* =========================
 * Tema/estilos base
 * ========================= */
const nodeStyle = {
  border: "2px solid",
  borderRadius: "8px",
  boxShadow: "0 4px 6px rgba(0, 0, 0, 0.08)",
  background: "#fff",
};

const selectedNodeStyle = {
  boxShadow: "0 0 0 2px rgba(16,185,129,0.65), 0 6px 12px rgba(0, 0, 0, 0.08)",
};

const THEME = {
  bg: "#f9fafb",
  panelBg: "#ffffff",
  text: "#0f172a",
  textMuted: "#334155",
  border: "#e2e8f0",
  borderHover: "#cbd5e1",
  subtle: "#f8fafc",
  subtle2: "#f1f5f9",
  icon: "#334155",
  iconMuted: "#64748b",
  shadow: "0 6px 20px rgba(15, 23, 42, 0.08)",
  ring: "0 0 0 3px rgba(99, 102, 241, 0.08)",
};

/* =========================
 * Componente
 * ========================= */
export default function Builder() {
  const { flowId } = useParams();
  const location = useLocation();
  const navigate = useNavigate();
  // meta opcional se veio do FlowHub via navigate(..., { state })
  const externalMeta = location.state?.meta || null;

  // meta do fluxo (nome, channelKey, versão ativa etc.)
  const [meta, setMeta] = useState(() => ({
    flowId: flowId || externalMeta?.flowId || null,
    name: externalMeta?.name || null,
    channelKey: externalMeta?.channelKey || null, // <<<<<<<<<<<<<<<<<<<<<< HERE
    activeVersionId: null,
  }));
  const [loadingFlow, setLoadingFlow] = useState(true);

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
          type: "error",
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
  const confirm = useConfirm();

  const [edges, setEdges] = useState([]);
  const [selectedNode, setSelectedNode] = useState(null);
  const [selectedEdgeId, setSelectedEdgeId] = useState(null);
  const [highlightedNodeId, setHighlightedNodeId] = useState(null);

  const [itor, setitor] = useState(false);
  const [scriptCode, setScriptCode] = useState("");
  const [showHistory, setShowHistory] = useState(false);
  const [flowHistory, setFlowHistory] = useState([]);
  const [isPublishing, setIsPublishing] = useState(false);

  /* ---------- Undo / Redo ---------- */
  const [history, setHistory] = useState({ past: [], future: [] });
  const nodesRef = useRef(nodes);
  const edgesRef = useRef(edges);
  const lastSnapKeyRef = useRef(null);

  const pushIfChanged = useCallback((prevSnap, nextSnap) => {
    const prevKey = makeSnapKey(prevSnap);
    const nextKey = makeSnapKey(nextSnap);

    if (prevKey !== nextKey) {
      if (lastSnapKeyRef.current !== prevKey) {
        setHistory((h) => ({
          past: [...h.past, deepClone(prevSnap)],
          future: [],
        }));
        lastSnapKeyRef.current = prevKey;
      }
    }
  }, []);

  const setNodesWithHistory = useCallback(
    (updater) => {
      setNodes((prevNodes) => {
        const prevSnap = { nodes: prevNodes, edges: edgesRef.current };
        const nextNodes =
          typeof updater === "function" ? updater(prevNodes) : updater;
        const nextSnap = { nodes: nextNodes, edges: edgesRef.current };
        pushIfChanged(prevSnap, nextSnap);
        return nextNodes;
      });
    },
    [pushIfChanged]
  );

  const setEdgesWithHistory = useCallback(
    (updater) => {
      setEdges((prevEdges) => {
        const prevSnap = { nodes: nodesRef.current, edges: prevEdges };
        const nextEdges =
          typeof updater === "function" ? updater(prevEdges) : updater;
        const nextSnap = { nodes: nodesRef.current, edges: nextEdges };
        pushIfChanged(prevSnap, nextSnap);
        return nextEdges;
      });
    },
    [pushIfChanged]
  );

  useEffect(() => {
    nodesRef.current = nodes;
  }, [nodes]);
  useEffect(() => {
    edgesRef.current = edges;
  }, [edges]);

  const canUndo = history.past.length > 0;
  const canRedo = history.future.length > 0;

  const snapshot = useCallback(
    () => ({
      nodes: deepClone(nodesRef.current),
      edges: deepClone(edgesRef.current),
    }),
    []
  );

  const undo = useCallback(() => {
    setHistory((h) => {
      if (h.past.length === 0) return h;
      const prev = h.past[h.past.length - 1];
      const current = snapshot();
      setNodes(prev.nodes);
      setEdges(prev.edges);
      setSelectedEdgeId(null);
      setSelectedNode(null);
      lastSnapKeyRef.current = null;
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
      lastSnapKeyRef.current = null;
      return { past: [...h.past, current], future: h.future.slice(0, -1) };
    });
  }, [snapshot]);

  /* ---------- handlers básicos ---------- */
  const onNodesChange = useCallback(
    (changes) => {
      const meaningful = changes.some((ch) => {
        if (ch.type === "select") return false; // ignora seleção
        if (ch.type === "position") return !ch.dragging; // só no drop
        return true; // add/remove/etc
      });

      if (meaningful) {
        setNodesWithHistory((nds) => applyNodeChanges(changes, nds));
      } else {
        setNodes((nds) => applyNodeChanges(changes, nds));
      }
    },
    [setNodesWithHistory]
  );

  const onEdgesChange = useCallback(
    (changes) => {
      const meaningful = changes.some((c) => c.type !== "select");

      if (meaningful) {
        setEdgesWithHistory((eds) => applyEdgeChanges(changes, eds));
      } else {
        setEdges((eds) => applyEdgeChanges(changes, eds));
      }

      const removedIds = new Set(
        changes.filter((c) => c.type === "remove").map((c) => c.id)
      );
      if (removedIds.size) {
        const removedEdges = edgesRef.current.filter((e) =>
          removedIds.has(e.id)
        );
        if (removedEdges.length) {
          setNodesWithHistory((nds) =>
            nds.map((node) => {
              const block = node.data.block || {};
              const before = block.actions || [];
              const after = before.filter(
                (a) =>
                  !removedEdges.some(
                    (re) => re.source === node.id && re.target === a.next
                  )
              );
              if (after.length === before.length) return node;
              return {
                ...node,
                data: { ...node.data, block: { ...block, actions: after } },
              };
            })
          );
        }
        setSelectedEdgeId((cur) => (cur && removedIds.has(cur) ? null : cur));
      }
    },
    [setEdgesWithHistory, setNodesWithHistory]
  );

  const handleOpenEditor = (node) => {
    const freshNode = nodes.find((n) => n.id === node.id);
    setSelectedNode(freshNode);
    setScriptCode(
      freshNode?.data?.block?.code ||
        `// Escreva seu código aqui
// Use "context" para acessar dados da conversa
function run(context) {
  return { resultado: "valor de saída" };
}`
    );
    setitor(true);
  };

  const handleUpdateCode = useCallback(
    (newCode) => {
      setScriptCode(newCode);
      if (selectedNode && selectedNode.data?.block?.type === "script") {
        const id = selectedNode.id;
        setNodesWithHistory((nds) =>
          nds.map((n) =>
            n.id === id
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
        setSelectedNode((prev) =>
          prev
            ? {
                ...prev,
                data: {
                  ...prev.data,
                  block: { ...prev.data.block, code: newCode },
                },
              }
            : null
        );
      }
    },
    [selectedNode, setNodesWithHistory]
  );

  const onConnect = useCallback(
    (params) => {
      const { source, target } = params;
      const sourceNode = nodesRef.current.find((n) => n.id === source);
      const actions = sourceNode?.data?.block?.actions || [];
      const already = actions.some((a) => a.next === target);

      setEdgesWithHistory((eds) => {
        const exists = eds.some(
          (e) => e.source === params.source && e.target === params.target
        );
        return exists ? eds : addEdge({ ...params, id: genEdgeId() }, eds);
      });

      if (!already) {
        setNodesWithHistory((nds) =>
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
                }
          )
        );
      }
    },
    [setEdgesWithHistory, setNodesWithHistory]
  );

  const onNodeDoubleClick = (_, node) => setSelectedNode(node);

  const updateSelectedNode = (updated) => {
    if (!updated) {
      setSelectedNode(null);
      return;
    }

    setNodesWithHistory((prevNodes) =>
      prevNodes.map((n) => (n.id === updated.id ? updated : n))
    );

    const desiredTargets = new Set(
      (updated.data?.block?.actions || []).map((a) => a?.next).filter(Boolean)
    );
    const prevEdges = edgesRef.current;

    const removedEdges = prevEdges.filter(
      (e) => e.source === updated.id && !desiredTargets.has(e.target)
    );
    const removedEdgeIds = new Set(removedEdges.map((e) => e.id));

    const keptEdges = prevEdges.filter(
      (e) => !(e.source === updated.id && removedEdgeIds.has(e.id))
    );

    const keptPairs = new Set(keptEdges.map((e) => `${e.source}-${e.target}`));
    const additions = [];
    desiredTargets.forEach((t) => {
      const key = `${updated.id}-${t}`;
      if (!keptPairs.has(key))
        additions.push({ id: genEdgeId(), source: updated.id, target: t });
    });

    const nextEdges = keptEdges.concat(additions);
    setEdgesWithHistory(nextEdges);

    if (removedEdgeIds.size) {
      setSelectedEdgeId((cur) => (cur && removedEdgeIds.has(cur) ? null : cur));
    }

    setSelectedNode(updated);
  };

  const deleteNodeAndCleanup = (deletedId) => {
    // nodes
    setNodesWithHistory((nds) =>
      nds
        .filter((n) => n.id !== deletedId)
        .map((n) => {
          const block = n.data.block || {};
          const cleanedActions = (block.actions || []).filter(
            (a) => a.next !== deletedId
          );
          const cleanedDefaultNext =
            block.defaultNext === deletedId ? undefined : block.defaultNext;
          return {
            ...n,
            data: {
              ...n.data,
              block: {
                ...block,
                actions: cleanedActions,
                defaultNext: cleanedDefaultNext,
              },
            },
          };
        })
    );
    // edges
    setEdgesWithHistory((eds) =>
      eds.filter((e) => e.source !== deletedId && e.target !== deletedId)
    );
    setSelectedEdgeId((cur) => (cur ? null : cur));
  };

  const handleDelete = useCallback(() => {
    if (
      !selectedNode ||
      selectedNode.data.nodeType === "start" ||
      selectedNode.data.label?.toLowerCase()?.includes("onerror")
    )
      return;
    deleteNodeAndCleanup(selectedNode.id);
    setSelectedNode(null);
  }, [selectedNode]);

  /* ---------- Hotkeys (undo/redo, esc, delete edge ou node) ---------- */
  useEffect(() => {
    const handleKeyDown = (event) => {
      const el = event.target;
      const tag = el?.tagName?.toUpperCase?.();
      const isEditableTag =
        tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT";
      const isContentEditable = el?.isContentEditable;
      if (isEditableTag || isContentEditable) return;

      if (el instanceof HTMLElement && el.closest?.("[data-stop-hotkeys='true']")) {
        return;
      }

      const key = event.key;

      // Undo / Redo
      if ((event.ctrlKey || event.metaKey) && key.toLowerCase() === "z") {
        event.preventDefault();
        if (event.shiftKey) redo();
        else undo();
        return;
      }
      if ((event.ctrlKey || event.metaKey) && key.toLowerCase() === "y") {
        event.preventDefault();
        redo();
        return;
      }

      // ESC: limpa seleção
      if (key === "Escape") {
        setSelectedNode(null);
        setSelectedEdgeId(null);
        setHighlightedNodeId(null);
        return;
      }

      // Delete / Backspace
      if (key === "Delete" || key === "Backspace") {
        const nodeDeletavel =
          selectedNode &&
          selectedNode.data.nodeType !== "start" &&
          !selectedNode.data.label?.toLowerCase()?.includes("onerror");

        // 1) aresta selecionada
        if (selectedEdgeId) {
          event.preventDefault();
          event.stopPropagation?.();

          const edgeToRemove = edgesRef.current.find(
            (e) => e.id === selectedEdgeId
          );

          setEdgesWithHistory((eds) =>
            eds.filter((e) => e.id !== selectedEdgeId)
          );

          if (edgeToRemove) {
            setNodesWithHistory((nds) =>
              nds.map((node) => {
                if (node.id !== edgeToRemove.source) return node;
                const before = node.data.block?.actions || [];
                const after = before.filter(
                  (a) => a.next !== edgeToRemove.target
                );
                if (after.length === before.length) return node;
                return {
                  ...node,
                  data: {
                    ...node.data,
                    block: { ...node.data.block, actions: after },
                  },
                };
              })
            );
          }

          setSelectedEdgeId(null);
          return;
        }

        // 2) remove nó (se deletável)
        if (nodeDeletavel) {
          event.preventDefault();
          event.stopPropagation?.();
          deleteNodeAndCleanup(selectedNode.id);
          setSelectedNode(null);
        }
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [selectedEdgeId, selectedNode, undo, redo, setEdgesWithHistory, setNodesWithHistory]);

  /* ---------- carregar flow (pelo :flowId) ---------- */
  useEffect(() => {
    let alive = true;
    const load = async () => {
      if (!flowId) return;
      try {
        setLoadingFlow(true);

        // Nome/descrição do flow (não quebra se 404)
        try {
          const info = await apiGet(`/flows/${flowId}`);
          if (alive && info?.name) {
            setMeta((m) => ({ ...(m || {}), name: info.name }));
          }
        } catch {}

        // tenta inferir channelKey a partir do último deployment ativo desse flow
        try {
          const deps = await apiGet(`/flows/deployments?flow_id=${encodeURIComponent(flowId)}`);
          if (alive && Array.isArray(deps) && deps.length) {
            setMeta((m) => ({
              ...(m || {}),
              channelKey: m?.channelKey || deps[0]?.channel || null, // <<<<<<<< HERE
              activeVersionId: deps[0]?.version_id || null,
            }));
          }
        } catch {
          // ignora
        }

        // carrega versões e abre a base: último draft; senão último published; senão nada
        const versions = await apiGet(`/flows/${flowId}/versions`);
        const drafts = (versions || [])
          .filter((v) => v.status === "draft")
          .sort((a, b) => b.version - a.version);
        const pubs = (versions || [])
          .filter((v) => v.status === "published")
          .sort((a, b) => b.version - a.version);

        const base = drafts[0] || pubs[0] || null;

        if (base) {
          const data = await apiGet(`/flows/data-by-version/${base.id}`);
          if (!alive) return;
          hydrateCanvasFromFlow(data);
          setMeta((m) => ({
            ...(m || {}),
            activeVersionId: m?.activeVersionId || pubs[0]?.id || null,
          }));
        }
      } catch (err) {
        console.error("Erro ao carregar fluxo:", err);
      } finally {
        if (alive) setLoadingFlow(false);
      }
    };

    load();
    return () => {
      alive = false;
    };
  }, [flowId]);

  // normaliza JSON do flow -> nodes/edges
  const hydrateCanvasFromFlow = (flowData) => {
    const blocksObj = flowData?.blocks || {};
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
        if (b.defaultNext && keyToId[b.defaultNext])
          b.defaultNext = keyToId[b.defaultNext];
        if (Array.isArray(b.actions)) {
          b.actions = b.actions.map((a) => ({
            ...a,
            next: keyToId[a.next] || a.next,
          }));
        }
      });
    }

    const blocks = isOldFormat
      ? normalized
      : Object.fromEntries(entries.map(([id, b]) => [id, { ...b, id }]));

    // desembrulha legado
    Object.values(blocks).forEach((b) => {
      if (b?.type === "interactive" && b?.content?.interactive) {
        b.content = b.content.interactive;
      }
    });

    const loadedNodes = Object.values(blocks).map((b) => ({
      id: b.id,
      type: "quadrado",
      position: b.position || { x: 100, y: 100 },
      data: {
        label: b.label || "Sem Nome",
        type: b.type,
        nodeType:
          b.type === "start" || (b.label || "").toLowerCase() === "início"
            ? "start"
            : undefined,
        color: b.color || "#607D8B",
        block: b,
      },
      style: { ...nodeStyle, borderColor: b.color || "#607D8B" },
    }));

    const loadedEdges = [];
    Object.values(blocks).forEach((b) => {
      (b.actions || []).forEach((a) => {
        if (a.next && blocks[a.next]) {
          loadedEdges.push({
            id: genEdgeId(),
            source: b.id,
            target: a.next,
          });
        }
      });
    });

    setNodes(loadedNodes);
    setEdges(loadedEdges);
    setHistory({ past: [], future: [] });
    setSelectedEdgeId(null);
    setSelectedNode(null);
  };

  /* ---------- Histórico (versões do flow) ---------- */
  useEffect(() => {
    if (!showHistory) return;
    (async () => {
      try {
        if (!meta?.flowId) {
          setFlowHistory([]);
          toast.info(
            "Abra o Builder a partir do Flow Hub para ver o histórico."
          );
          return;
        }
        const rows = await apiGet(`/flows/${meta.flowId}/versions`);
        setFlowHistory(rows || []);
      } catch (err) {
        console.error("Erro ao carregar histórico de versões:", err);
      }
    })();
  }, [showHistory, meta?.flowId]);

  /* ---------- Publicar (draft -> published -> deploy) ---------- */
  const handlePublish = async () => {
    try {
      if (!meta?.flowId) {
        toast.error("Este Builder precisa saber o flowId (abra via FlowHub).");
        return;
      }

      const totalNodes = nodes.length;
      const totalEdges = edges.length;

      const ok = await confirm({
        title: "Publicar fluxo?",
        description:
          `Isso criará uma nova versão, publicará e fará deploy no canal atual.\n\n` +
          `Resumo: ${totalNodes} blocos e ${totalEdges} conexões.`,
        confirmText: "Publicar",
        cancelText: "Cancelar",
        tone: "warning",
      });
      if (!ok) return;

      setIsPublishing(true);

      // compacta grafo
      const labelToId = {};
      nodes.forEach((n) => {
        if (labelToId[n.data.label])
          console.warn("Label duplicado:", n.data.label);
        labelToId[n.data.label] = n.id;
      });
      const nodeIds = new Set(nodes.map((n) => n.id));

      const blocks = {};
      nodes.forEach((node) => {
        const block = { ...node.data.block };
        if (block?.type === "interactive" && block?.content?.interactive) {
          block.content = block.content.interactive;
        }
        if (block.defaultNext)
          block.defaultNext = nodeIds.has(block.defaultNext)
            ? block.defaultNext
            : labelToId[block.defaultNext] || undefined;
        if (Array.isArray(block.actions)) {
          block.actions = block.actions.map((a) => ({
            ...a,
            next: nodeIds.has(a.next) ? a.next : labelToId[a.next] || a.next,
          }));
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

      // 1) cria draft
      const v1 = await apiPost(`/flows/${meta.flowId}/versions`, {
        data: flowData,
        status: "draft",
      });
      const newVersionNumber = v1?.version?.version;
      const newVersionId = v1?.version?.id;
      if (!newVersionNumber) throw new Error("Falha ao criar versão");

      // 2) publica
      await apiPut(
        `/flows/${meta.flowId}/versions/${newVersionNumber}/status`,
        { status: "published" }
      );

      // 3) deploy (usa channelKey conhecido; se nenhum, "whatsapp" para compat)
      const channelKey = meta.channelKey || "whatsapp";
      await apiPost(`/flows/${meta.flowId}/deploy`, {
        version: newVersionNumber,
        channel: channelKey,
      });

      toast.success(`Publicado v${newVersionNumber} (${channelKey})`);
      setMeta((m) => ({
        ...(m || {}),
        activeVersionId: newVersionId || m?.activeVersionId,
        channelKey,
      }));
    } catch (err) {
      toast.error(`Falha ao publicar: ${err?.message || "erro desconhecido"}`);
    } finally {
      setIsPublishing(false);
    }
  };

  /* ---------- download ---------- */
  const downloadFlow = () => {
    const labelToId = {};
    nodes.forEach((n) => {
      if (labelToId[n.data.label])
        console.warn("Label duplicado:", n.data.label);
      labelToId[n.data.label] = n.id;
    });
    const nodeIds = new Set(nodes.map((n) => n.id));

    const blocks = {};
    nodes.forEach((node) => {
      const originalBlock = node.data.block || {};
      const clonedBlock = { ...originalBlock };
      if (
        clonedBlock?.type === "interactive" &&
        clonedBlock?.content?.interactive
      ) {
        clonedBlock.content = clonedBlock.content.interactive;
      }
      if (clonedBlock.defaultNext)
        clonedBlock.defaultNext = nodeIds.has(clonedBlock.defaultNext)
          ? clonedBlock.defaultNext
          : labelToId[clonedBlock.defaultNext] || undefined;
      if (Array.isArray(clonedBlock.actions)) {
        clonedBlock.actions = clonedBlock.actions.map((a) => ({
          ...a,
          next: nodeIds.has(a.next) ? a.next : labelToId[a.next] || a.next,
        }));
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

    const flowData = {
      start:
        nodes.find((n) => n.data.nodeType === "start")?.id ?? nodes[0]?.id,
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

  /* ---------- add node ---------- */
  const addNodeTemplate = (template) => {
    const onErrorNode = nodesRef.current.find(
      (n) => n.data.label?.toLowerCase() === "onerror"
    );
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
    setNodesWithHistory((nds) => nds.concat(newNode));
  };

  /* ---------- destaque de arestas ---------- */
  const sourceColorById = useMemo(() => {
    const map = new Map();
    nodes.forEach((n) =>
      map.set(n.id, n.style?.borderColor || n.data?.color || "#888")
    );
    return map;
  }, [nodes]);

  const activeEdges = useMemo(() => {
    if (selectedEdgeId) return new Set([selectedEdgeId]);
    if (selectedNode) {
      return new Set(
        edges.filter((e) => e.source === selectedNode.id).map((e) => e.id)
      );
    }
    return new Set();
  }, [edges, selectedNode, selectedEdgeId]);

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

  const styledEdges = edges.map((edge) => {
    const isActive = activeEdges.has(edge.id);
    const baseStroke = "#94a3b8";
    const srcColor = sourceColorById.get(edge.source) || "#64748b";

    const common = {
      markerEnd: {
        type: "arrowclosed",
        color: isActive ? srcColor : baseStroke,
        width: 16,
        height: 16,
      },
      style: {
        stroke: isActive ? srcColor : baseStroke,
        strokeWidth: isActive ? 2.75 : 1.5,
        opacity: selectedEdgeId || selectedNode ? (isActive ? 1 : 0.35) : 0.9,
        transition: "stroke 120ms ease, opacity 120ms ease, stroke-width 120ms",
      },
    };
    return { ...edge, ...common };
  });

  const edgeOptions = {
    type: "smoothstep",
    animated: false,
    style: { stroke: "#94a3b8", strokeWidth: 2 },
    markerEnd: { type: "arrowclosed", color: "#94a3b8", width: 12, height: 12 },
  };

  return (
    <div
      style={{
        width: "100%",
        height: "100vh",
        position: "relative",
        backgroundColor: THEME.bg,
        display: "flex",
        flexDirection: "column",
      }}
    >
      {/* Header contextual + Voltar */}
      <div
        style={{
          padding: "8px 12px",
          display: "flex",
          gap: 12,
          alignItems: "center",
          borderBottom: `1px solid ${THEME.border}`,
          background: THEME.panelBg,
        }}
      >
        <button
          onClick={() => navigate(-1)}
          title="Voltar ao FlowHub"
          style={{
            border: `1px solid ${THEME.border}`,
            background: "#fff",
            borderRadius: 8,
            padding: "6px 8px",
            cursor: "pointer",
            display: "inline-flex",
            alignItems: "center",
            gap: 6,
          }}
        >
          <ArrowLeft size={16} /> Voltar
        </button>

        <strong>Chatbot Studio</strong>
        {meta?.flowId && (
          <div
            style={{
              marginLeft: "auto",
              fontSize: 12,
              display: "flex",
              gap: 12,
            }}
          >
            <span>
              Flow: <b>{meta.name || meta.flowId}</b>
            </span>
            {meta.channelKey && (
              <span>
                Canal: <b>{meta.channelKey}</b>
              </span>
            )}
            {meta.activeVersionId && (
              <span>
                Versão ativa: <b>{meta.activeVersionId.slice(0, 8)}</b>
              </span>
            )}
          </div>
        )}
      </div>

      {/* Conteúdo principal */}
      <div style={{ display: "flex", flex: 1, overflow: "hidden" }}>
        <div style={{ position: "relative", flex: 1 }}>
          {itor && (
            <ScriptEditor
              code={scriptCode}
              onChange={handleUpdateCode}
              onClose={() => setitor(false)}
            />
          )}

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
              setHighlightedNodeId(null);
            }}
            onPaneClick={(event) => {
              if (
                !event.target.closest(".react-flow__node") &&
                !event.target.closest(".react-flow__edge")
              ) {
                setSelectedNode(null);
                setSelectedEdgeId(null);
                setHighlightedNodeId(null);
              }
            }}
            fitViewOptions={{ padding: 0.5 }}
            proOptions={{ hideAttribution: true }}
          >
            <Background color="#cbd5e1" gap={32} variant="dots" />
            <Controls
              position="bottom-left"
              showInteractive={false}
              style={{
                position: "fixed",
                left: 18,
                bottom: "calc(env(safe-area-inset-bottom, 0px) + 18px)",
                top: "auto",
                right: "auto",
                zIndex: 9999,

                backgroundColor: THEME.panelBg,
                border: `1px solid ${THEME.border}`,
                borderRadius: "10px",
                boxShadow: THEME.shadow,
                overflow: "hidden",
              }}
            />

            {/* Dock estilo Mac */}
            <MacDock
              templates={nodeTemplates}
              iconMap={iconMap}
              onAdd={addNodeTemplate}
              onUndo={canUndo ? undo : undefined}
              onRedo={canRedo ? redo : undefined}
              canUndo={canUndo}
              canRedo={canRedo}
              onPublish={handlePublish}
              onDownload={downloadFlow}
              onHistory={() => setShowHistory(true)}
              isPublishing={isPublishing}
              disabled={loadingFlow}
            />

            <VersionHistoryModal
              visible={showHistory}
              onClose={() => setShowHistory(false)}
              versions={flowHistory}
              activeId={meta?.activeVersionId || undefined}
              onRestore={async (versionId) => {
                try {
                  if (!meta?.flowId) {
                    toast.error("Sem flowId para restaurar.");
                    return;
                  }
                  const row = (flowHistory || []).find((x) => x.id === versionId);
                  if (!row?.version) {
                    toast.error("Versão inválida.");
                    return;
                  }
                  const channel = meta.channelKey || "whatsapp"; // <<<<<<<< HERE
                  await apiPost(`/flows/${meta.flowId}/deploy`, {
                    version: row.version,
                    channel,
                  });
                  toast.success(`Ativado v${row.version} (${channel})`);
                  setMeta((m) => ({ ...(m || {}), activeVersionId: versionId }));
                  setShowHistory(false);
                } catch {
                  toast.error("Falha ao restaurar a versão");
                }
              }}
              onOpenVersion={async (versionId) => {
                try {
                  const data = await apiGet(`/flows/data-by-version/${versionId}`);
                  hydrateCanvasFromFlow(data);
                  setMeta((m) => ({ ...(m || {}), activeVersionId: versionId }));
                } catch {
                  toast.error("Falha ao abrir versão");
                }
              }}
            />
          </ReactFlow>
        </div>

        {/* Painel lateral */}
        {selectedNode && (
          <NodeConfigPanel
            selectedNode={selectedNode}
            onChange={updateSelectedNode}
            onClose={() => setSelectedNode(null)}
            allNodes={nodes}
            onConnectNodes={({ source, target }) => {
              const src = nodesRef.current.find((n) => n.id === source);
              const actions = src?.data?.block?.actions || [];
              const already = actions.some((a) => a.next === target);

              // cria a aresta com histórico
              setEdgesWithHistory((eds) => {
                const exists = eds.some(
                  (e) => e.source === source && e.target === target
                );
                return exists ? eds : [...eds, { id: genEdgeId(), source, target }];
              });

              // se não havia action correspondente, grava
              if (!already) {
                setNodesWithHistory((nds) =>
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
