import type { FlowSpanData } from "@/hooks/use-run-flow-websocket";
import type { RunTraceEvent } from "@/hooks/use-run-trace-events";
import type { RunSummary } from "./flow-console-types";

export function formatDate(dateText?: string | null): string {
  if (!dateText) {
    return "—";
  }
  const date = new Date(dateText);
  if (Number.isNaN(date.getTime())) {
    return "—";
  }
  return date.toLocaleString();
}

export function formatLatency(latencyMs?: number | null): string {
  if (!latencyMs || latencyMs <= 0) {
    return "—";
  }
  return latencyMs < 1000
    ? `${latencyMs}ms`
    : `${(latencyMs / 1000).toFixed(1)}s`;
}

export function formatCost(costUsd?: number | null): string {
  if (costUsd === null || costUsd === undefined || costUsd <= 0) {
    return "$0.0000";
  }
  return costUsd < 0.01
    ? `$${costUsd.toFixed(4)}`
    : `$${costUsd.toFixed(2)}`;
}

export function formatSignedLatency(deltaMs: number): string {
  if (!Number.isFinite(deltaMs) || deltaMs === 0) {
    return "0ms";
  }
  const sign = deltaMs > 0 ? "+" : "-";
  const absolute = Math.abs(deltaMs);
  const value =
    absolute < 1000 ? `${absolute}ms` : `${(absolute / 1000).toFixed(1)}s`;
  return `${sign}${value}`;
}

export function formatSignedCost(deltaUsd: number): string {
  if (!Number.isFinite(deltaUsd) || deltaUsd === 0) {
    return "$0.0000";
  }
  const sign = deltaUsd > 0 ? "+" : "-";
  const absolute = Math.abs(deltaUsd);
  const value =
    absolute < 0.01 ? `$${absolute.toFixed(4)}` : `$${absolute.toFixed(2)}`;
  return `${sign}${value}`;
}

export function formatTraceEventName(eventName: string): string {
  return eventName.replaceAll("_", " ");
}

export function summarizeTraceData(data: Record<string, unknown>): string {
  if (typeof data.message === "string" && data.message.trim()) {
    return data.message;
  }
  if (typeof data.error === "string" && data.error.trim()) {
    return `Error: ${data.error}`;
  }
  if (typeof data.model === "string" && data.model.trim()) {
    return `model=${data.model}`;
  }
  return JSON.stringify(data);
}

export function isTerminalStatus(status: string): boolean {
  const normalized = status.trim().toLowerCase();
  return normalized === "completed" || normalized === "failed";
}

export function filterRunsBySearchAndStatus({
  runs,
  search,
  statusFilter,
}: {
  runs: RunSummary[];
  search: string;
  statusFilter: "all" | "running" | "completed" | "failed";
}): RunSummary[] {
  return runs.filter((run) => {
    if (statusFilter !== "all" && run.status !== statusFilter) {
      return false;
    }
    const query = search.trim().toLowerCase();
    if (!query) {
      return true;
    }
    const haystack = `${run.mode} ${run.query_preview || ""} ${run.run_id}`.toLowerCase();
    return haystack.includes(query);
  });
}

export function buildRunIdHistoryPath({
  currentHref,
  selectedRunId,
}: {
  currentHref: string;
  selectedRunId: string | null;
}): string | null {
  const current = new URL(currentHref);
  const existingRunId = current.searchParams.get("runId");

  if (selectedRunId) {
    if (existingRunId === selectedRunId) {
      return null;
    }
    current.searchParams.set("runId", selectedRunId);
  } else if (!existingRunId) {
    return null;
  } else {
    current.searchParams.delete("runId");
  }

  const query = current.searchParams.toString();
  return `${current.pathname}${query ? `?${query}` : ""}${current.hash}`;
}

interface SpanGraphSelectable {
  id: string;
  parent_span_id: string | null;
  started_at?: string;
}

export function selectGraphSpanSubset<T extends SpanGraphSelectable>({
  maxSpans = 260,
  spans,
}: {
  maxSpans?: number;
  spans: T[];
}): {
  hiddenCount: number;
  spans: T[];
  truncated: boolean;
} {
  const normalizedLimit = Number.isFinite(maxSpans)
    ? Math.max(1, Math.floor(maxSpans))
    : 260;

  if (spans.length <= normalizedLimit) {
    return {
      hiddenCount: 0,
      spans,
      truncated: false,
    };
  }

  const byId = new Map(spans.map((span) => [span.id, span]));
  const selectedIds = new Set<string>();
  const seedTarget = Math.max(1, Math.floor(normalizedLimit * 0.8));
  for (let index = spans.length - 1; index >= 0; index -= 1) {
    if (selectedIds.size >= seedTarget) {
      break;
    }
    const span = spans[index];
    if (!span) {
      continue;
    }
    selectedIds.add(span.id);
  }

  // Preserve parent context for recently selected spans when capacity allows.
  for (let index = spans.length - 1; index >= 0; index -= 1) {
    const span = spans[index];
    if (!span || !selectedIds.has(span.id)) {
      continue;
    }

    let parentId = span.parent_span_id;
    while (parentId && selectedIds.size < normalizedLimit) {
      if (selectedIds.has(parentId)) {
        break;
      }
      selectedIds.add(parentId);
      parentId = byId.get(parentId)?.parent_span_id ?? null;
    }

    if (selectedIds.size >= normalizedLimit) {
      break;
    }
  }

  if (selectedIds.size < normalizedLimit) {
    for (let index = spans.length - 1; index >= 0; index -= 1) {
      if (selectedIds.size >= normalizedLimit) {
        break;
      }
      const span = spans[index];
      if (!span) {
        continue;
      }
      selectedIds.add(span.id);
    }
  }

  const subset = spans.filter((span) => selectedIds.has(span.id));
  return {
    hiddenCount: Math.max(0, spans.length - subset.length),
    spans: subset,
    truncated: true,
  };
}

export function getStatusVariant(
  status: string
): "default" | "destructive" | "outline" | "secondary" {
  const normalized = status.trim().toLowerCase();
  if (normalized === "completed") {
    return "secondary";
  }
  if (normalized === "failed") {
    return "destructive";
  }
  return "outline";
}

export function resolveNextSelection(
  runs: RunSummary[],
  currentRunId: string | null,
  keepSelection: boolean
): string | null {
  if (runs.length === 0) {
    return null;
  }
  if (!keepSelection) {
    return runs[0]?.run_id ?? null;
  }
  if (currentRunId && runs.some((run) => run.run_id === currentRunId)) {
    return currentRunId;
  }
  return runs[0]?.run_id ?? null;
}

function toCsvSafe(value: unknown): string {
  const serialized =
    value === null || value === undefined ? "" : String(value).replaceAll('"', '""');
  return `"${serialized}"`;
}

export function toSpansCsv(spans: FlowSpanData[]): string {
  const header = [
    "id",
    "parent_span_id",
    "operation",
    "status",
    "model",
    "duration_ms",
    "cost_usd",
    "started_at",
    "finished_at",
  ];
  const rows = spans.map((span) =>
    [
      toCsvSafe(span.id),
      toCsvSafe(span.parent_span_id),
      toCsvSafe(span.operation),
      toCsvSafe(span.status),
      toCsvSafe(span.model),
      toCsvSafe(span.duration_ms),
      toCsvSafe(span.cost_usd),
      toCsvSafe(span.started_at),
      toCsvSafe(span.finished_at),
    ].join(",")
  );
  return [header.map(toCsvSafe).join(","), ...rows].join("\n");
}

export function downloadTextFile(filename: string, content: string): void {
  if (typeof window === "undefined") {
    return;
  }
  const blob = new Blob([content], { type: "text/plain;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  document.body.append(anchor);
  anchor.click();
  anchor.remove();
  URL.revokeObjectURL(url);
}

export function isErrorEvent(event: RunTraceEvent): boolean {
  const name = event.event.toLowerCase();
  if (name.includes("error") || name.includes("failed")) {
    return true;
  }
  const error = event.data.error;
  return typeof error === "string" && error.trim().length > 0;
}
