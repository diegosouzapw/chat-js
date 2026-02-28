"use client";

import { type ReactNode, useEffect, useMemo, useState } from "react";
import {
  Background,
  Controls,
  MiniMap,
  type Edge,
  MarkerType,
  ReactFlow,
  ReactFlowProvider,
  type Node,
} from "@xyflow/react";
import "@xyflow/react/dist/style.css";
import type { RunSpanData } from "@/hooks/use-run-spans";
import { Button } from "@/components/ui/button";
import { selectGraphSpanSubset } from "./flow-console-utils";

type SpanStatus = RunSpanData["status"];
const GRAPH_SPAN_RENDER_LIMIT = 260;

const STATUS_COLORS: Record<
  SpanStatus,
  { border: string; edge: string; background: string; text: string }
> = {
  pending: {
    border: "#64748b",
    edge: "#64748b",
    background: "rgba(71, 85, 105, 0.12)",
    text: "#cbd5e1",
  },
  running: {
    border: "#eab308",
    edge: "#eab308",
    background: "rgba(234, 179, 8, 0.15)",
    text: "#fde047",
  },
  completed: {
    border: "#22c55e",
    edge: "#22c55e",
    background: "rgba(34, 197, 94, 0.14)",
    text: "#86efac",
  },
  failed: {
    border: "#ef4444",
    edge: "#ef4444",
    background: "rgba(239, 68, 68, 0.15)",
    text: "#fca5a5",
  },
};

const OPERATION_ICONS: Record<string, string> = {
  "executor:run": "▶",
  "executor:direct": "⚡",
  "executor:debate": "🗣",
  "executor:tot": "🌳",
  "executor:chain": "🔗",
  "executor:self_refine": "🔁",
  "executor:heavy": "🔬",
  router: "🧭",
  "llm:worker": "🤖",
  "llm:judge": "⚖",
  "llm:verification": "✔",
};

interface SpanNodeData extends Record<string, unknown> {
  label: ReactNode;
  status: SpanStatus;
}

interface FlowModel {
  nodes: Node[];
  edges: Edge[];
  stats: {
    active: number;
    cost: number;
    spanCount: number;
  };
}

function toMillis(value: string | null | undefined): number {
  if (!value) {
    return Number.MAX_SAFE_INTEGER;
  }
  const parsed = new Date(value).getTime();
  return Number.isFinite(parsed) ? parsed : Number.MAX_SAFE_INTEGER;
}

function formatDuration(durationMs: number): string {
  if (!Number.isFinite(durationMs) || durationMs <= 0) {
    return "—";
  }
  if (durationMs < 1000) {
    return `${durationMs}ms`;
  }
  return `${(durationMs / 1000).toFixed(1)}s`;
}

function buildFlow(spans: RunSpanData[]): FlowModel {
  if (spans.length === 0) {
    return {
      nodes: [],
      edges: [],
      stats: { active: 0, cost: 0, spanCount: 0 },
    };
  }

  const sortedByStart = [...spans].sort((a, b) => toMillis(a.started_at) - toMillis(b.started_at));
  const byId = new Map(sortedByStart.map((span) => [span.id, span]));
  const childrenByParent = new Map<string, RunSpanData[]>();

  for (const span of sortedByStart) {
    if (!span.parent_span_id || !byId.has(span.parent_span_id)) {
      continue;
    }
    const children = childrenByParent.get(span.parent_span_id) ?? [];
    children.push(span);
    childrenByParent.set(span.parent_span_id, children);
  }
  for (const children of childrenByParent.values()) {
    children.sort((a, b) => toMillis(a.started_at) - toMillis(b.started_at));
  }

  const roots = sortedByStart.filter(
    (span) => !span.parent_span_id || !byId.has(span.parent_span_id)
  );

  const depthBySpanId = new Map<string, number>();
  const queue: Array<{ depth: number; id: string }> = (
    roots.length > 0 ? roots : [sortedByStart[0]]
  ).map((span) => ({
    depth: 0,
    id: span.id,
  }));

  for (let cursor = 0; cursor < queue.length; cursor += 1) {
    const next = queue[cursor];
    if (!next) {
      break;
    }

    if (depthBySpanId.has(next.id)) {
      continue;
    }
    depthBySpanId.set(next.id, next.depth);

    const children = childrenByParent.get(next.id) ?? [];
    for (const child of children) {
      if (!depthBySpanId.has(child.id)) {
        queue.push({ depth: next.depth + 1, id: child.id });
      }
    }
  }

  let fallbackDepth = Math.max(...Array.from(depthBySpanId.values(), (value) => value), 0) + 1;
  for (const span of sortedByStart) {
    if (!depthBySpanId.has(span.id)) {
      depthBySpanId.set(span.id, fallbackDepth);
      fallbackDepth += 1;
    }
  }

  const spansByDepth = new Map<number, RunSpanData[]>();
  for (const span of sortedByStart) {
    const depth = depthBySpanId.get(span.id) ?? 0;
    const levelSpans = spansByDepth.get(depth) ?? [];
    levelSpans.push(span);
    spansByDepth.set(depth, levelSpans);
  }

  const NODE_WIDTH = 280;
  const NODE_HEIGHT = 120;
  const LEVEL_GAP_X = 340;
  const LEVEL_GAP_Y = 44;

  const nodes: Node[] = [];
  for (const [depth, levelSpans] of spansByDepth) {
    const ordered = [...levelSpans].sort((a, b) => toMillis(a.started_at) - toMillis(b.started_at));
    const totalHeight = ordered.length * NODE_HEIGHT + (ordered.length - 1) * LEVEL_GAP_Y;
    const startY = -totalHeight / 2;

    for (const [index, span] of ordered.entries()) {
      const palette = STATUS_COLORS[span.status] ?? STATUS_COLORS.pending;
      const icon = OPERATION_ICONS[span.operation] ?? "•";
      const shortId = span.id.slice(0, 8);
      const modelText = span.model?.trim() ? span.model : "no-model";
      const tokenCount = (span.tokens_in || 0) + (span.tokens_out || 0);
      const durationLabel = formatDuration(span.duration_ms || 0);

      const nodeLabel = (
        <div className="space-y-1.5">
          <div className="flex items-center justify-between gap-2">
            <span className="font-medium text-xs uppercase tracking-wide">
              {icon} {span.operation}
            </span>
            <span
              className="rounded-md px-1.5 py-0.5 font-medium text-[10px] uppercase tracking-wide"
              style={{
                background: palette.background,
                color: palette.text,
              }}
            >
              {span.status}
            </span>
          </div>
          <div className="font-mono text-[11px] text-muted-foreground">
            {shortId}
          </div>
          <div className="grid grid-cols-2 gap-x-2 gap-y-1 text-[11px] text-muted-foreground">
            <span>Model</span>
            <span className="truncate text-right text-foreground">{modelText}</span>
            <span>Duration</span>
            <span className="text-right text-foreground">{durationLabel}</span>
            <span>Tokens</span>
            <span className="text-right text-foreground">{tokenCount.toLocaleString()}</span>
          </div>
          {span.error_message ? (
            <p className="line-clamp-2 text-[11px] text-red-300">
              {span.error_message}
            </p>
          ) : null}
        </div>
      );

      nodes.push({
        data: {
          label: nodeLabel,
          status: span.status,
        } as SpanNodeData,
        id: span.id,
        position: {
          x: depth * LEVEL_GAP_X,
          y: startY + index * (NODE_HEIGHT + LEVEL_GAP_Y),
        },
        style: {
          background: "rgba(15, 23, 42, 0.75)",
          border: `1px solid ${palette.border}`,
          borderRadius: 10,
          color: "#e2e8f0",
          padding: 12,
          width: NODE_WIDTH,
        },
      });
    }
  }

  const edges: Edge[] = [];
  for (const span of sortedByStart) {
    const parentId = span.parent_span_id;
    if (!parentId || !byId.has(parentId)) {
      continue;
    }
    const palette = STATUS_COLORS[span.status] ?? STATUS_COLORS.pending;
    edges.push({
      animated: span.status === "running",
      id: `edge-${parentId}-${span.id}`,
      markerEnd: {
        color: palette.edge,
        height: 12,
        type: MarkerType.ArrowClosed,
        width: 12,
      },
      source: parentId,
      style: {
        stroke: palette.edge,
        strokeWidth: 2.1,
      },
      target: span.id,
      type: "smoothstep",
    });
  }

  return {
    edges,
    nodes,
    stats: {
      active: sortedByStart.filter((span) => span.status === "running").length,
      cost: sortedByStart.reduce((sum, span) => sum + (span.cost_usd || 0), 0),
      spanCount: sortedByStart.length,
    },
  };
}

function RunSpanFlowInner({ spans }: { spans: RunSpanData[] }) {
  const [showAllSpans, setShowAllSpans] = useState(false);
  const activeRunId = spans[0]?.run_id ?? null;

  useEffect(() => {
    setShowAllSpans(false);
  }, [activeRunId]);

  const graphSubset = useMemo(() => {
    return selectGraphSpanSubset({
      maxSpans: GRAPH_SPAN_RENDER_LIMIT,
      spans,
    });
  }, [spans]);

  const graphSpans = showAllSpans ? spans : graphSubset.spans;
  const flow = useMemo(() => buildFlow(graphSpans), [graphSpans]);

  return (
    <div className="relative h-[420px] overflow-hidden rounded-lg border bg-muted/10">
      <div className="pointer-events-none absolute top-3 left-3 z-10 flex items-center gap-2">
        <div className="rounded-md border bg-background/90 px-2 py-1 text-[11px] text-muted-foreground">
          <strong className="mr-1 text-foreground">{flow.stats.spanCount}</strong>
          / {spans.length} spans
        </div>
        <div className="rounded-md border bg-background/90 px-2 py-1 text-[11px] text-muted-foreground">
          <strong className="mr-1 text-foreground">{flow.stats.active}</strong>
          active
        </div>
        <div className="rounded-md border bg-background/90 px-2 py-1 text-[11px] text-muted-foreground">
          <strong className="mr-1 text-foreground">
            ${flow.stats.cost.toFixed(4)}
          </strong>
          cost
        </div>
      </div>
      {graphSubset.truncated ? (
        <div className="absolute top-3 right-3 z-10">
          <Button
            onClick={() => setShowAllSpans((current) => !current)}
            size="sm"
            type="button"
            variant="secondary"
          >
            {showAllSpans
              ? `Show latest ${GRAPH_SPAN_RENDER_LIMIT}`
              : `Render all (${spans.length})`}
          </Button>
        </div>
      ) : null}

      <ReactFlow
        edges={flow.edges}
        fitView
        fitViewOptions={{ padding: 0.28 }}
        maxZoom={1.75}
        minZoom={0.2}
        nodes={flow.nodes}
        nodesConnectable={false}
        nodesDraggable={false}
        panOnDrag={true}
        proOptions={{ hideAttribution: true }}
      >
        <Background gap={22} size={1} />
        <MiniMap
          maskColor="rgba(0, 0, 0, 0.6)"
          nodeColor={(node) => {
            const rawStatus =
              typeof node.data?.status === "string" ? node.data.status : "pending";
            if (!(rawStatus in STATUS_COLORS)) {
              return STATUS_COLORS.pending.edge;
            }
            return STATUS_COLORS[rawStatus as SpanStatus].edge;
          }}
          pannable
          style={{ background: "rgba(2, 6, 23, 0.9)" }}
          zoomable
        />
        <Controls showInteractive={false} />
      </ReactFlow>
    </div>
  );
}

export function RunSpanFlow({ spans }: { spans: RunSpanData[] }) {
  return (
    <ReactFlowProvider>
      <RunSpanFlowInner spans={spans} />
    </ReactFlowProvider>
  );
}
