"use client";

import { useMemo, useState } from "react";
import { ChevronDown, ChevronRight, Radio } from "lucide-react";
import {
  type FlowSpanData,
  useRunFlowWebSocket,
} from "@/hooks/use-run-flow-websocket";
import { cn } from "@/lib/utils";

function formatDuration(durationMs: number): string {
  if (!Number.isFinite(durationMs) || durationMs <= 0) {
    return "—";
  }
  if (durationMs < 1000) {
    return `${durationMs}ms`;
  }
  return `${(durationMs / 1000).toFixed(1)}s`;
}

function formatShortRunId(runId: string): string {
  if (runId.length <= 12) {
    return runId;
  }
  return `${runId.slice(0, 8)}…${runId.slice(-4)}`;
}

function sortByStartAsc(spans: FlowSpanData[]): FlowSpanData[] {
  return [...spans].sort((a, b) => {
    const timeA = new Date(a.started_at).getTime();
    const timeB = new Date(b.started_at).getTime();
    if (!Number.isFinite(timeA) && !Number.isFinite(timeB)) {
      return a.operation.localeCompare(b.operation);
    }
    if (!Number.isFinite(timeA)) {
      return 1;
    }
    if (!Number.isFinite(timeB)) {
      return -1;
    }
    return timeA - timeB;
  });
}

export function InlineRunFlowPanel({
  isRunning,
  runId,
}: {
  isRunning: boolean;
  runId: string;
}) {
  const [expanded, setExpanded] = useState(isRunning);
  const { connected, error, spans } = useRunFlowWebSocket(
    runId,
    expanded || isRunning
  );

  const orderedSpans = useMemo(() => sortByStartAsc(spans), [spans]);
  const activeCount = orderedSpans.filter((span) => span.status === "running").length;
  const completedCount = orderedSpans.filter(
    (span) => span.status === "completed"
  ).length;
  const failedCount = orderedSpans.filter((span) => span.status === "failed").length;
  const totalCost = orderedSpans.reduce((sum, span) => sum + (span.cost_usd || 0), 0);

  return (
    <div className="mt-2 overflow-hidden rounded-lg border border-border/70 bg-muted/20">
      <button
        className="flex w-full items-center justify-between gap-2 px-3 py-2 text-left"
        onClick={() => setExpanded((value) => !value)}
        type="button"
      >
        <div className="flex min-w-0 items-center gap-2">
          {expanded ? (
            <ChevronDown className="size-3.5 text-muted-foreground" />
          ) : (
            <ChevronRight className="size-3.5 text-muted-foreground" />
          )}
          <span className="font-medium text-xs">Live Flow Trace</span>
          <span className="truncate font-mono text-[10px] text-muted-foreground">
            {formatShortRunId(runId)}
          </span>
          <span
            className={cn(
              "inline-flex items-center gap-1 rounded-md border px-1.5 py-0.5 text-[10px]",
              connected ? "border-emerald-500/40 text-emerald-600" : "text-muted-foreground"
            )}
          >
            <Radio className="size-3" />
            {connected ? "WS" : "Offline"}
          </span>
        </div>
        <div className="flex items-center gap-2 font-mono text-[10px] text-muted-foreground">
          <span>{orderedSpans.length} spans</span>
          <span>${totalCost.toFixed(4)}</span>
        </div>
      </button>

      {expanded ? (
        <div className="space-y-2 border-t px-3 py-2">
          {error ? (
            <p className="text-[11px] text-destructive">{error}</p>
          ) : null}

          <div className="flex flex-wrap gap-2 text-[11px] text-muted-foreground">
            <span>active: {activeCount}</span>
            <span>completed: {completedCount}</span>
            <span>failed: {failedCount}</span>
          </div>

          {orderedSpans.length === 0 ? (
            <p className="text-[11px] text-muted-foreground">
              Waiting for websocket spans for this run.
            </p>
          ) : (
            <div className="max-h-48 space-y-1.5 overflow-auto pr-1">
              {orderedSpans.map((span) => (
                <div
                  className={cn(
                    "rounded-md border px-2 py-1.5 text-[11px]",
                    span.status === "running" && "border-amber-500/40",
                    span.status === "completed" && "border-emerald-500/40",
                    span.status === "failed" && "border-red-500/40"
                  )}
                  key={span.id}
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-medium">{span.operation}</span>
                    <span className="font-mono text-muted-foreground">
                      {formatDuration(span.duration_ms)}
                    </span>
                  </div>
                  <div className="mt-0.5 flex items-center justify-between gap-2 text-muted-foreground">
                    <span className="truncate">
                      {span.model?.trim() ? span.model : "no-model"}
                    </span>
                    <span>{span.status}</span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      ) : null}
    </div>
  );
}
