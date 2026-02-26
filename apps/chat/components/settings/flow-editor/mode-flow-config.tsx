"use client";

import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
  ReactFlow,
  ReactFlowProvider,
  useNodesState,
  useEdgesState,
  type Node,
  type Edge,
  ConnectionLineType,
  MarkerType,
} from "@xyflow/react";
import "@xyflow/react/dist/style.css";

import AgentConfigNodeComponent, {
  type AgentConfigNodeData,
} from "./agent-config-node";
import {
  getModeTopology,
  type ModeTopology,
  type TopologyNode,
} from "@/lib/mode-topology";

const NODE_TYPES = { agentConfig: AgentConfigNodeComponent };

interface ModeModelConfig {
  id: string;
  mode: string;
  role: string;
  model_id: string;
  step_label?: string;
  compute_level?: number;
}

const API_BASE = "/api/omnichat";

/** BFS top-to-bottom layout */
function layoutNodes(
  topology: ModeTopology
): { nodes: Node[]; edges: Edge[] } {
  const { nodes: tNodes, edges: tEdges } = topology;

  const children = new Map<string, string[]>();
  const parents = new Map<string, string[]>();
  for (const e of tEdges) {
    children.set(e.source, [...(children.get(e.source) || []), e.target]);
    parents.set(e.target, [...(parents.get(e.target) || []), e.source]);
  }

  const levels = new Map<string, number>();
  const roots = tNodes.filter((n) => !parents.has(n.id));
  const queue = roots.map((r) => ({ id: r.id, level: 0 }));
  while (queue.length > 0) {
    const { id, level } = queue.shift()!;
    levels.set(id, Math.max(levels.get(id) || 0, level));
    for (const child of children.get(id) || []) {
      queue.push({ id: child, level: level + 1 });
    }
  }

  const byLevel = new Map<number, TopologyNode[]>();
  for (const node of tNodes) {
    const lvl = levels.get(node.id) || 0;
    byLevel.set(lvl, [...(byLevel.get(lvl) || []), node]);
  }

  const NODE_W = 220;
  const NODE_H = 110;
  const GAP_X = 40;
  const GAP_Y = 100;

  const positioned: Node[] = [];
  for (const [level, nodesAtLevel] of byLevel) {
    const totalWidth =
      nodesAtLevel.length * NODE_W + (nodesAtLevel.length - 1) * GAP_X;
    const startX = -totalWidth / 2;
    nodesAtLevel.forEach((tNode, idx) => {
      positioned.push({
        id: tNode.id,
        type: "agentConfig",
        position: {
          x: startX + idx * (NODE_W + GAP_X),
          y: level * (NODE_H + GAP_Y),
        },
        data: {} as AgentConfigNodeData,
      });
    });
  }

  const edges: Edge[] = tEdges.map((e) => ({
    id: `${e.source}-${e.target}`,
    source: e.source,
    target: e.target,
    type: "smoothstep",
    animated: true,
    style: { stroke: "#c93d4e", strokeWidth: 2, opacity: 0.5 },
    markerEnd: {
      type: MarkerType.ArrowClosed,
      color: "#c93d4e",
      width: 16,
      height: 16,
    },
  }));

  return { nodes: positioned, edges };
}

interface ModeFlowConfigProps {
  mode: string;
  availableModels: string[];
  globalDefaults: Record<string, string>;
  onConfigChanged?: () => void;
}

function ModeFlowConfigInner({
  mode,
  availableModels,
  globalDefaults,
  onConfigChanged,
}: ModeFlowConfigProps) {
  const topology = getModeTopology(mode);
  const [modeConfigs, setModeConfigs] = useState<ModeModelConfig[]>([]);
  const [saving, setSaving] = useState(false);
  const [saveMsg, setSaveMsg] = useState<{
    text: string;
    type: "success" | "error";
  } | null>(null);

  const loadConfigs = useCallback(async () => {
    try {
      const res = await fetch(`${API_BASE}/mode-model-configs`);
      if (!res.ok) return;
      const all: ModeModelConfig[] = await res.json();
      setModeConfigs(all.filter((c) => c.mode === mode));
    } catch {
      // silent
    }
  }, [mode]);

  useEffect(() => {
    loadConfigs();
  }, [loadConfigs]);

  const handleModelChange = useCallback(
    async (
      nodeId: string,
      modelId: string | null,
      existingConfigId?: string
    ) => {
      setSaving(true);
      setSaveMsg(null);
      try {
        if (!modelId && existingConfigId) {
          await fetch(`${API_BASE}/mode-model-configs/${existingConfigId}`, {
            method: "DELETE",
          });
        } else if (modelId) {
          const tNode = topology?.nodes.find((n) => n.id === nodeId);
          if (!tNode) return;

          if (existingConfigId) {
            await fetch(`${API_BASE}/mode-model-configs/${existingConfigId}`, {
              method: "DELETE",
            });
          }

          await fetch(`${API_BASE}/mode-model-configs`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              mode,
              role: tNode.role,
              model_id: modelId,
              step_label: nodeId,
            }),
          });
        }
        await loadConfigs();
        onConfigChanged?.();
        setSaveMsg({ text: "✓ Model saved", type: "success" });
        setTimeout(() => setSaveMsg(null), 3000);
      } catch (e) {
        const msg = e instanceof Error ? e.message : "Unknown error";
        setSaveMsg({ text: `✗ Save failed: ${msg}`, type: "error" });
        setTimeout(() => setSaveMsg(null), 6000);
      } finally {
        setSaving(false);
      }
    },
    [mode, topology, loadConfigs, onConfigChanged]
  );

  const { flowNodes, flowEdges } = useMemo(() => {
    if (!topology) return { flowNodes: [], flowEdges: [] };

    const { nodes: positioned, edges } = layoutNodes(topology);

    const enriched = positioned.map((node) => {
      const tNode = topology.nodes.find((n) => n.id === node.id)!;
      const config =
        modeConfigs.find((c) => c.step_label === node.id) ??
        modeConfigs.find((c) => c.role === tNode.role && !c.step_label);

      const data: AgentConfigNodeData = {
        label: tNode.label,
        icon: tNode.icon,
        role: tNode.role,
        description: tNode.description,
        stepLabel: tNode.stepLabel,
        currentModel: config?.model_id,
        configId: config?.id,
        availableModels,
        defaultModel: globalDefaults[tNode.role],
        onModelChange: handleModelChange,
        noModelSelector: tNode.noModelSelector,
      };

      return { ...node, data };
    });

    return { flowNodes: enriched, flowEdges: edges };
  }, [topology, modeConfigs, availableModels, globalDefaults, handleModelChange]);

  const [nodes, setNodes, onNodesChange] = useNodesState(flowNodes);
  const [edges, setEdges, onEdgesChange] = useEdgesState(flowEdges);

  useEffect(() => {
    setNodes(flowNodes);
    setEdges(flowEdges);
  }, [flowNodes, flowEdges, setNodes, setEdges]);

  if (!topology) {
    return (
      <div className="flex items-center justify-center py-12 text-sm text-muted-foreground">
        No topology defined for mode &quot;{mode}&quot;
      </div>
    );
  }

  return (
    <div style={{ width: "100%", height: "100%", position: "relative" }}>
      {(saving || saveMsg) && (
        <div
          style={{
            position: "absolute",
            top: 8,
            right: 8,
            zIndex: 10,
            background:
              saveMsg?.type === "error"
                ? "rgba(239, 68, 68, 0.2)"
                : "rgba(99, 102, 241, 0.2)",
            color: saveMsg?.type === "error" ? "#fca5a5" : "#a5b4fc",
            padding: "4px 12px",
            borderRadius: 6,
            fontSize: 11,
            border: `1px solid ${saveMsg?.type === "error" ? "rgba(239, 68, 68, 0.3)" : "rgba(99, 102, 241, 0.3)"}`,
          }}
        >
          {saving ? "💾 Saving..." : saveMsg?.text}
        </div>
      )}
      <ReactFlow
        nodes={nodes}
        edges={edges}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        nodeTypes={NODE_TYPES}
        connectionLineType={ConnectionLineType.SmoothStep}
        fitView
        fitViewOptions={{ padding: 0.3 }}
        proOptions={{ hideAttribution: true }}
        nodesDraggable={false}
        nodesConnectable={false}
        elementsSelectable={false}
        panOnDrag={false}
        panOnScroll={true}
        zoomOnScroll={true}
        zoomOnDoubleClick={false}
        selectionOnDrag={false}
        minZoom={0.4}
        maxZoom={1.5}
        style={{ background: "transparent" }}
      />
      <style>{`
        .react-flow__background { background: transparent !important; }
        .react-flow__pane { cursor: default !important; }
        .react-flow__minimap { display: none; }
        .react-flow__node { cursor: default !important; pointer-events: all !important; overflow: visible !important; }
        .react-flow__node select, .react-flow__node button, .react-flow__node input { pointer-events: all !important; cursor: pointer !important; }
      `}</style>
    </div>
  );
}

export default function ModeFlowConfig(props: ModeFlowConfigProps) {
  return (
    <ReactFlowProvider>
      <ModeFlowConfigInner {...props} />
    </ReactFlowProvider>
  );
}
