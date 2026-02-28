"use client";

import {
  Activity,
  CheckCircle2,
  Clock,
  Loader2,
  MessageSquare,
  RefreshCw,
  ThumbsDown,
  ThumbsUp,
} from "lucide-react";
import type { ReactNode } from "react";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  SettingsPage,
  SettingsPageContent,
  SettingsPageHeader,
  SettingsPageScrollArea,
} from "./settings-page";
import { RunSpanFlow } from "./run-span-flow";
import { useRunFlowWebSocket } from "@/hooks/use-run-flow-websocket";
import { useRunSpans } from "@/hooks/use-run-spans";
import {
  type RunTraceEvent,
  useRunTraceEvents,
} from "@/hooks/use-run-trace-events";

const API_BASE = "/api/omnichat";

interface RunSummary {
  completed_at: string | null;
  compute_level: number;
  cost_usd: number;
  created_at: string;
  latency_ms: number;
  mode: string;
  query_preview: string;
  run_id: string;
  status: string;
}

interface RunStep {
  cost_usd: number | null;
  latency_ms: number | null;
  model_name: string | null;
  status: string;
  step_type: string;
}

interface RunEvidence {
  content: string;
  source: string;
  title: string;
  url: string;
}

interface RunDetail {
  completed_at: string | null;
  compute_level: number;
  consensus_points: string[];
  cost_usd: number | null;
  created_at: string;
  divergence_points: string[];
  evidence: RunEvidence[];
  final_answer: string;
  latency_ms: number | null;
  mode: string;
  query: string;
  run_id: string;
  session_id: string;
  status: string;
  steps: RunStep[];
}

interface FeedbackResult {
  rating: number;
  submittedAt: number;
}

function truncateText(value: string, max = 220): string {
  const normalized = value.trim();
  if (normalized.length <= max) {
    return normalized;
  }
  return `${normalized.slice(0, max)}…`;
}

function summarizeTraceData(data: Record<string, unknown>): string {
  const message = data.message;
  if (typeof message === "string" && message.trim()) {
    return truncateText(message);
  }

  const error = data.error ?? data.error_message;
  if (typeof error === "string" && error.trim()) {
    return `Error: ${truncateText(error)}`;
  }

  const summaryParts: string[] = [];
  const mode = data.mode;
  const model = data.model;
  const worker = data.worker_index;
  const stepType = data.step_type;

  if (typeof mode === "string" && mode.trim()) {
    summaryParts.push(`mode=${mode}`);
  }
  if (typeof model === "string" && model.trim()) {
    summaryParts.push(`model=${model}`);
  }
  if (typeof worker === "number" && Number.isFinite(worker)) {
    summaryParts.push(`worker=${worker}`);
  }
  if (typeof stepType === "string" && stepType.trim()) {
    summaryParts.push(`step=${stepType}`);
  }

  if (summaryParts.length > 0) {
    return summaryParts.join(" • ");
  }

  return truncateText(JSON.stringify(data));
}

function formatTraceEventName(eventName: string): string {
  return eventName.replaceAll("_", " ");
}

function formatDate(dateText?: string | null): string {
  if (!dateText) {
    return "—";
  }
  const date = new Date(dateText);
  if (Number.isNaN(date.getTime())) {
    return "—";
  }
  return date.toLocaleString();
}

function formatLatency(latencyMs?: number | null): string {
  if (!latencyMs || latencyMs <= 0) {
    return "—";
  }
  return latencyMs < 1000
    ? `${latencyMs}ms`
    : `${(latencyMs / 1000).toFixed(1)}s`;
}

function formatCost(costUsd?: number | null): string {
  if (costUsd === null || costUsd === undefined || costUsd <= 0) {
    return "$0.0000";
  }
  return costUsd < 0.01
    ? `$${costUsd.toFixed(4)}`
    : `$${costUsd.toFixed(2)}`;
}

function formatDuration(durationMs?: number | null): string {
  if (!durationMs || durationMs <= 0) {
    return "—";
  }
  return durationMs < 1000
    ? `${durationMs}ms`
    : `${(durationMs / 1000).toFixed(1)}s`;
}

function resolveNextSelection(
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

function getStatusVariant(
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

function RunsList({
  onSelect,
  runs,
  selectedRunId,
}: {
  onSelect: (runId: string) => void;
  runs: RunSummary[];
  selectedRunId: string | null;
}) {
  return (
    <div className="space-y-2">
      {runs.map((run) => (
        <Card
          className={`cursor-pointer transition-colors hover:bg-muted/50 ${
            run.run_id === selectedRunId ? "border-primary" : ""
          }`}
          key={run.run_id}
          onClick={() => onSelect(run.run_id)}
        >
          <CardHeader className="space-y-2 p-3">
            <div className="flex items-center justify-between gap-2">
              <Badge variant={getStatusVariant(run.status)}>{run.status}</Badge>
              <span className="text-muted-foreground text-xs">
                {formatDate(run.created_at)}
              </span>
            </div>
            <CardTitle className="text-sm">{run.mode}</CardTitle>
            <CardDescription className="line-clamp-2 text-xs">
              {run.query_preview || "No query preview available"}
            </CardDescription>
            <div className="flex items-center justify-between gap-2">
              <Badge variant="outline">L{run.compute_level}</Badge>
              <span className="text-muted-foreground text-xs">
                {formatLatency(run.latency_ms)}
              </span>
              <span className="text-muted-foreground text-xs">
                {formatCost(run.cost_usd)}
              </span>
            </div>
          </CardHeader>
        </Card>
      ))}
    </div>
  );
}

function RunDetailPanel({
  detail,
  feedbackComment,
  feedbackRating,
  feedbackResult,
  loading,
  onCommentChange,
  onFeedbackRatingChange,
  onSubmitFeedback,
  selectedRunId,
  submittingFeedback,
  traceConnected,
  traceError,
  traceEvents,
  spans,
  spansError,
  spansLoading,
  spansUpdatedAt,
  wsConnected,
  wsError,
  wsSpans,
}: {
  detail: RunDetail | null;
  feedbackComment: string;
  feedbackRating: 1 | 5 | null;
  feedbackResult: FeedbackResult | undefined;
  loading: boolean;
  onCommentChange: (value: string) => void;
  onFeedbackRatingChange: (rating: 1 | 5) => void;
  onSubmitFeedback: () => void;
  selectedRunId: string | null;
  submittingFeedback: boolean;
  traceConnected: boolean;
  traceError: string | null;
  traceEvents: RunTraceEvent[];
  spans: ReturnType<typeof useRunSpans>["spans"];
  spansError: string | null;
  spansLoading: boolean;
  spansUpdatedAt: number | null;
  wsConnected: boolean;
  wsError: string | null;
  wsSpans: ReturnType<typeof useRunFlowWebSocket>["spans"];
}) {
  const [wsQuery, setWsQuery] = useState("");
  const [wsStatusFilter, setWsStatusFilter] = useState<
    "all" | "running" | "completed" | "failed" | "pending"
  >("all");

  useEffect(() => {
    setWsQuery("");
    setWsStatusFilter("all");
  }, [selectedRunId]);

  if (!selectedRunId) {
    return (
      <Card>
        <CardContent className="py-12 text-center text-muted-foreground text-sm">
          Select a run to inspect details and submit feedback.
        </CardContent>
      </Card>
    );
  }

  if (loading) {
    return (
      <Card>
        <CardContent className="flex items-center justify-center py-12">
          <Loader2 className="size-6 animate-spin text-muted-foreground" />
        </CardContent>
      </Card>
    );
  }

  if (!detail) {
    return null;
  }

  const orderedWsSpans = [...wsSpans].sort((left, right) => {
    const leftTime = new Date(left.started_at).getTime();
    const rightTime = new Date(right.started_at).getTime();
    if (!Number.isFinite(leftTime) && !Number.isFinite(rightTime)) {
      return left.operation.localeCompare(right.operation);
    }
    if (!Number.isFinite(leftTime)) {
      return 1;
    }
    if (!Number.isFinite(rightTime)) {
      return -1;
    }
    return leftTime - rightTime;
  });
  const filteredWsSpans = orderedWsSpans.filter((span) => {
    if (wsStatusFilter !== "all" && span.status !== wsStatusFilter) {
      return false;
    }

    const query = wsQuery.trim().toLowerCase();
    if (!query) {
      return true;
    }

    const haystack = `${span.operation} ${span.model || ""} ${
      span.error_message || ""
    }`.toLowerCase();
    return haystack.includes(query);
  });

  const wsRunning = filteredWsSpans.filter(
    (span) => span.status === "running"
  ).length;
  const wsCompleted = filteredWsSpans.filter(
    (span) => span.status === "completed"
  ).length;
  const wsFailed = filteredWsSpans.filter((span) => span.status === "failed").length;
  const wsTotalCost = filteredWsSpans.reduce(
    (accumulator, span) => accumulator + (span.cost_usd || 0),
    0
  );

  const wsGroupsByOperation = Object.values(
    filteredWsSpans.reduce<
      Record<
        string,
        {
          completed: number;
          cost: number;
          failed: number;
          name: string;
          pending: number;
          running: number;
          total: number;
        }
      >
    >((accumulator, span) => {
      const key = span.operation || "unknown";
      const current = accumulator[key] ?? {
        completed: 0,
        cost: 0,
        failed: 0,
        name: key,
        pending: 0,
        running: 0,
        total: 0,
      };

      current.total += 1;
      current.cost += span.cost_usd || 0;
      if (span.status === "running") {
        current.running += 1;
      } else if (span.status === "completed") {
        current.completed += 1;
      } else if (span.status === "failed") {
        current.failed += 1;
      } else {
        current.pending += 1;
      }

      accumulator[key] = current;
      return accumulator;
    }, {})
  ).sort((left, right) => right.total - left.total);

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader className="space-y-3 pb-3">
          <div className="flex items-start justify-between gap-3">
            <div className="space-y-1">
              <CardTitle className="text-sm">{detail.mode}</CardTitle>
              <CardDescription className="font-mono text-xs">
                {detail.run_id}
              </CardDescription>
            </div>
            <Badge variant={getStatusVariant(detail.status)}>{detail.status}</Badge>
          </div>
          <div className="flex flex-wrap items-center gap-2 text-xs">
            <Badge variant="outline">Compute L{detail.compute_level}</Badge>
            <Badge variant="outline">Latency {formatLatency(detail.latency_ms)}</Badge>
            <Badge variant="outline">Cost {formatCost(detail.cost_usd)}</Badge>
            <Badge variant="outline">Session {detail.session_id || "—"}</Badge>
          </div>
          <div className="flex flex-wrap items-center gap-3 text-muted-foreground text-xs">
            <span className="flex items-center gap-1">
              <Clock className="size-3" />
              Created: {formatDate(detail.created_at)}
            </span>
            <span>Completed: {formatDate(detail.completed_at)}</span>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <h4 className="font-medium text-sm">Query</h4>
            <p className="rounded-md border bg-muted/20 p-3 text-muted-foreground text-sm">
              {detail.query || "—"}
            </p>
          </div>

          <div className="space-y-2">
            <h4 className="font-medium text-sm">Final Answer</h4>
            <p className="whitespace-pre-wrap rounded-md border bg-muted/20 p-3 text-sm">
              {detail.final_answer || "—"}
            </p>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm">Execution Steps</CardTitle>
          <CardDescription className="text-xs">
            Timeline of workers and orchestration steps for this run.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {detail.steps.length === 0 ? (
            <p className="text-muted-foreground text-sm">No step details available.</p>
          ) : (
            <div className="space-y-2">
              {detail.steps.map((step, index) => (
                <div className="rounded-md border p-3" key={`${step.step_type}-${index}`}>
                  <div className="mb-1 flex items-center justify-between gap-2">
                    <span className="font-medium text-sm">{step.step_type}</span>
                    <Badge variant={getStatusVariant(step.status)}>{step.status}</Badge>
                  </div>
                  <div className="flex flex-wrap items-center gap-3 text-muted-foreground text-xs">
                    <span>Model: {step.model_name || "—"}</span>
                    <span>Latency: {formatLatency(step.latency_ms)}</span>
                    <span>Cost: {formatCost(step.cost_usd)}</span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between gap-2">
            <CardTitle className="text-sm">Live Trace</CardTitle>
            <Badge variant={traceConnected ? "secondary" : "outline"}>
              {traceConnected ? "Live" : "Offline"}
            </Badge>
          </div>
          <CardDescription className="text-xs">
            Real-time orchestration events streamed for this run ID.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {traceError ? (
            <p className="mb-3 text-destructive text-sm">{traceError}</p>
          ) : null}
          {traceEvents.length === 0 ? (
            <p className="text-muted-foreground text-sm">
              No trace events received for this run yet.
            </p>
          ) : (
            <div className="max-h-80 space-y-2 overflow-auto pr-1">
              {traceEvents.map((traceEvent) => (
                <div className="rounded-md border p-3" key={traceEvent.id}>
                  <div className="mb-1 flex items-center justify-between gap-2">
                    <Badge variant="outline">
                      {formatTraceEventName(traceEvent.event)}
                    </Badge>
                    <span className="text-muted-foreground text-xs">
                      {formatDate(new Date(traceEvent.receivedAt).toISOString())}
                    </span>
                  </div>
                  <p className="whitespace-pre-wrap text-muted-foreground text-xs">
                    {summarizeTraceData(traceEvent.data)}
                  </p>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between gap-2">
            <CardTitle className="text-sm">Span Graph</CardTitle>
            <Badge variant="outline">
              {spans.length} span{spans.length === 1 ? "" : "s"}
            </Badge>
          </div>
          <CardDescription className="text-xs">
            Structural flow graph grouped by parent/child span topology.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          {spansError ? (
            <p className="text-destructive text-sm">
              Failed to load span graph: {spansError}
            </p>
          ) : null}
          {spansUpdatedAt ? (
            <p className="text-muted-foreground text-xs">
              Last refresh: {formatDate(new Date(spansUpdatedAt).toISOString())}
            </p>
          ) : null}
          {spansLoading && spans.length === 0 ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="size-5 animate-spin text-muted-foreground" />
            </div>
          ) : spans.length === 0 ? (
            <p className="text-muted-foreground text-sm">
              No spans available yet for this run.
            </p>
          ) : (
            <RunSpanFlow spans={spans} />
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between gap-2">
            <CardTitle className="text-sm">Live WS Flow Console</CardTitle>
            <Badge variant={wsConnected ? "secondary" : "outline"}>
              {wsConnected ? "WS Live" : "WS Offline"}
            </Badge>
          </div>
          <CardDescription className="text-xs">
            Dedicated websocket trace console for low-latency span updates by
            run ID.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          {wsError ? (
            <p className="text-destructive text-sm">{wsError}</p>
          ) : null}
          <div className="grid gap-2 md:grid-cols-[1fr_180px]">
            <Input
              onChange={(event) => setWsQuery(event.target.value)}
              placeholder="Filter by operation, model, or error"
              value={wsQuery}
            />
            <Select
              onValueChange={(value) =>
                setWsStatusFilter(
                  value as "all" | "running" | "completed" | "failed" | "pending"
                )
              }
              value={wsStatusFilter}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All statuses</SelectItem>
                <SelectItem value="running">Running</SelectItem>
                <SelectItem value="completed">Completed</SelectItem>
                <SelectItem value="failed">Failed</SelectItem>
                <SelectItem value="pending">Pending</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="flex flex-wrap gap-2 text-xs">
            <Badge variant="outline">{filteredWsSpans.length} spans</Badge>
            <Badge variant="outline">running {wsRunning}</Badge>
            <Badge variant="outline">completed {wsCompleted}</Badge>
            <Badge variant="outline">failed {wsFailed}</Badge>
            <Badge variant="outline">cost {formatCost(wsTotalCost)}</Badge>
          </div>
          {wsGroupsByOperation.length > 0 ? (
            <div className="grid gap-2 md:grid-cols-2">
              {wsGroupsByOperation.map((group) => (
                <div
                  className="rounded-md border px-2 py-1.5 text-xs"
                  key={group.name}
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-medium">{group.name}</span>
                    <span className="text-muted-foreground">
                      {group.total} span{group.total === 1 ? "" : "s"}
                    </span>
                  </div>
                  <div className="mt-1 flex flex-wrap gap-2 text-muted-foreground">
                    <span>run {group.running}</span>
                    <span>done {group.completed}</span>
                    <span>fail {group.failed}</span>
                    <span>cost {formatCost(group.cost)}</span>
                  </div>
                </div>
              ))}
            </div>
          ) : null}
          {filteredWsSpans.length === 0 ? (
            <p className="text-muted-foreground text-sm">
              No websocket spans match the current filter.
            </p>
          ) : (
            <div className="max-h-80 space-y-2 overflow-auto pr-1">
              {filteredWsSpans.map((span) => (
                <div className="rounded-md border p-3" key={span.id}>
                  <div className="flex items-center justify-between gap-2">
                    <p className="font-medium text-sm">{span.operation}</p>
                    <Badge variant={getStatusVariant(span.status)}>
                      {span.status}
                    </Badge>
                  </div>
                  <div className="mt-1 flex flex-wrap items-center gap-3 text-muted-foreground text-xs">
                    <span>Model: {span.model || "—"}</span>
                    <span>Duration: {formatDuration(span.duration_ms)}</span>
                    <span>Cost: {formatCost(span.cost_usd)}</span>
                    <span>
                      Tokens: {span.tokens_in || 0} in / {span.tokens_out || 0} out
                    </span>
                  </div>
                  {span.error_message ? (
                    <p className="mt-2 text-destructive text-xs">
                      {span.error_message}
                    </p>
                  ) : null}
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm">Evidence</CardTitle>
          <CardDescription className="text-xs">
            Sources collected during orchestration.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {detail.evidence.length === 0 ? (
            <p className="text-muted-foreground text-sm">No evidence captured.</p>
          ) : (
            <div className="space-y-3">
              {detail.evidence.map((evidence, index) => (
                <div className="rounded-md border p-3" key={`${evidence.url}-${index}`}>
                  <div className="mb-1 flex items-center justify-between gap-2">
                    <span className="font-medium text-sm">
                      {evidence.title || "Untitled evidence"}
                    </span>
                    <Badge variant="outline">{evidence.source || "web"}</Badge>
                  </div>
                  {evidence.url ? (
                    <a
                      className="break-all text-primary text-xs underline"
                      href={evidence.url}
                      rel="noreferrer"
                      target="_blank"
                    >
                      {evidence.url}
                    </a>
                  ) : null}
                  <p className="mt-2 line-clamp-4 text-muted-foreground text-xs">
                    {evidence.content || "—"}
                  </p>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm">Run Feedback</CardTitle>
          <CardDescription className="text-xs">
            Send quality feedback directly to OmniChat run telemetry.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex items-center gap-2">
            <Button
              className={feedbackRating === 5 ? "border-primary" : ""}
              onClick={() => onFeedbackRatingChange(5)}
              size="sm"
              type="button"
              variant="outline"
            >
              <ThumbsUp className="mr-1 size-4" />
              Positive
            </Button>
            <Button
              className={feedbackRating === 1 ? "border-primary" : ""}
              onClick={() => onFeedbackRatingChange(1)}
              size="sm"
              type="button"
              variant="outline"
            >
              <ThumbsDown className="mr-1 size-4" />
              Negative
            </Button>
            {feedbackResult ? (
              <span className="inline-flex items-center gap-1 text-green-600 text-xs">
                <CheckCircle2 className="size-3.5" />
                Sent at {formatDate(new Date(feedbackResult.submittedAt).toISOString())}
              </span>
            ) : null}
          </div>
          <Textarea
            onChange={(event) => onCommentChange(event.target.value)}
            placeholder="Optional comment for this run feedback"
            rows={4}
            value={feedbackComment}
          />
          <Button
            disabled={!feedbackRating || submittingFeedback}
            onClick={onSubmitFeedback}
            size="sm"
            type="button"
          >
            {submittingFeedback ? (
              <Loader2 className="mr-2 size-4 animate-spin" />
            ) : (
              <Activity className="mr-2 size-4" />
            )}
            Submit Feedback
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}

export function RunsSettings() {
  const searchParams = useSearchParams();
  const requestedRunId = searchParams.get("runId");
  const [error, setError] = useState<string | null>(null);
  const [feedbackComment, setFeedbackComment] = useState("");
  const [feedbackRating, setFeedbackRating] = useState<1 | 5 | null>(null);
  const [feedbackResultsByRun, setFeedbackResultsByRun] = useState<
    Record<string, FeedbackResult>
  >({});
  const [loadingDetail, setLoadingDetail] = useState(false);
  const [loadingRuns, setLoadingRuns] = useState(true);
  const [runs, setRuns] = useState<RunSummary[]>([]);
  const [selectedRun, setSelectedRun] = useState<RunDetail | null>(null);
  const [selectedRunId, setSelectedRunId] = useState<string | null>(null);
  const [submittingFeedback, setSubmittingFeedback] = useState(false);
  const {
    connected: traceConnected,
    error: traceError,
    events: traceEvents,
  } = useRunTraceEvents(selectedRunId);
  const isTerminalRunStatus =
    selectedRun?.status === "completed" || selectedRun?.status === "failed";
  const {
    error: spansError,
    loading: spansLoading,
    spans,
    updatedAt: spansUpdatedAt,
  } = useRunSpans(selectedRunId, {
    pollIntervalMs: isTerminalRunStatus ? 0 : 2500,
  });
  const {
    connected: wsConnected,
    error: wsError,
    spans: wsSpans,
  } = useRunFlowWebSocket(selectedRunId, Boolean(selectedRunId));

  const loadRuns = useCallback(
    async (keepSelection = true) => {
      setLoadingRuns(true);
      setError(null);

      try {
        const response = await fetch(`${API_BASE}/runs?limit=100`);
        if (!response.ok) {
          throw new Error(`HTTP ${response.status}`);
        }
        const payload = await response.json();
        const nextRuns: RunSummary[] = Array.isArray(payload?.runs)
          ? payload.runs
          : [];
        const requestedSelection =
          requestedRunId &&
          nextRuns.some((run) => run.run_id === requestedRunId)
            ? requestedRunId
            : null;
        const nextSelection =
          requestedSelection ??
          resolveNextSelection(
            nextRuns,
            selectedRunId,
            keepSelection
          );

        setRuns(nextRuns);
        setSelectedRunId(nextSelection);
        if (!nextSelection) {
          setSelectedRun(null);
        }
      } catch (requestError) {
        setError(
          requestError instanceof Error
            ? requestError.message
            : "Failed to load runs"
        );
        setRuns([]);
        setSelectedRunId(null);
        setSelectedRun(null);
      } finally {
        setLoadingRuns(false);
      }
    },
    [requestedRunId, selectedRunId]
  );

  const loadRunDetail = useCallback(async (runId: string) => {
    setLoadingDetail(true);
    setError(null);
    try {
      const response = await fetch(`${API_BASE}/runs/${runId}`);
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }
      const payload = (await response.json()) as RunDetail;
      setSelectedRun(payload);
    } catch (requestError) {
      setError(
        requestError instanceof Error
          ? requestError.message
          : "Failed to load run detail"
      );
      setSelectedRun(null);
    } finally {
      setLoadingDetail(false);
    }
  }, []);

  const submitFeedback = useCallback(async () => {
    if (!selectedRunId || !feedbackRating) {
      return;
    }

    setSubmittingFeedback(true);
    setError(null);

    const params = new URLSearchParams({ rating: String(feedbackRating) });
    const comment = feedbackComment.trim();
    if (comment) {
      params.set("comment", comment);
    }

    try {
      const response = await fetch(
        `${API_BASE}/runs/${selectedRunId}/feedback?${params.toString()}`,
        {
          method: "POST",
        }
      );
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }
      setFeedbackResultsByRun((prev) => ({
        ...prev,
        [selectedRunId]: {
          rating: feedbackRating,
          submittedAt: Date.now(),
        },
      }));
      setFeedbackComment("");
    } catch (requestError) {
      setError(
        requestError instanceof Error
          ? requestError.message
          : "Failed to submit feedback"
      );
    } finally {
      setSubmittingFeedback(false);
    }
  }, [feedbackComment, feedbackRating, selectedRunId]);

  useEffect(() => {
    loadRuns(false).catch(() => undefined);
  }, [loadRuns]);

  useEffect(() => {
    if (!selectedRunId) {
      setSelectedRun(null);
      setFeedbackRating(null);
      setFeedbackComment("");
      return;
    }
    const existingFeedback = feedbackResultsByRun[selectedRunId];
    setFeedbackRating(existingFeedback?.rating === 5 ? 5 : existingFeedback?.rating === 1 ? 1 : null);
    setFeedbackComment("");
    loadRunDetail(selectedRunId).catch(() => undefined);
  }, [feedbackResultsByRun, loadRunDetail, selectedRunId]);

  const feedbackResult = useMemo(() => {
    if (!selectedRunId) {
      return undefined;
    }
    return feedbackResultsByRun[selectedRunId];
  }, [feedbackResultsByRun, selectedRunId]);

  let content: ReactNode;
  if (loadingRuns) {
    content = (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="size-6 animate-spin text-muted-foreground" />
      </div>
    );
  } else if (error && runs.length === 0) {
    content = (
      <Card>
        <CardContent className="py-6 text-center text-destructive text-sm">
          ⚠️ {error}
        </CardContent>
      </Card>
    );
  } else if (runs.length === 0) {
    content = (
      <Card>
        <CardContent className="py-12 text-center">
          <MessageSquare className="mx-auto mb-3 size-8 text-muted-foreground" />
          <p className="text-muted-foreground text-sm">No runs found.</p>
        </CardContent>
      </Card>
    );
  } else {
    content = (
      <SettingsPageScrollArea>
        <div className="grid gap-4 px-1 md:grid-cols-[320px_1fr]">
          <RunsList
            onSelect={setSelectedRunId}
            runs={runs}
            selectedRunId={selectedRunId}
          />
          <RunDetailPanel
            detail={selectedRun}
            feedbackComment={feedbackComment}
            feedbackRating={feedbackRating}
            feedbackResult={feedbackResult}
            loading={loadingDetail}
            onCommentChange={setFeedbackComment}
            onFeedbackRatingChange={setFeedbackRating}
            onSubmitFeedback={submitFeedback}
            selectedRunId={selectedRunId}
            submittingFeedback={submittingFeedback}
            traceConnected={traceConnected}
            traceError={traceError}
            traceEvents={traceEvents}
            spans={spans}
            spansError={spansError}
            spansLoading={spansLoading}
            spansUpdatedAt={spansUpdatedAt}
            wsConnected={wsConnected}
            wsError={wsError}
            wsSpans={wsSpans}
          />
        </div>
      </SettingsPageScrollArea>
    );
  }

  return (
    <SettingsPage>
      <SettingsPageHeader>
        <div className="flex items-center justify-between gap-3">
          <div>
            <h2 className="font-semibold text-lg">Runs</h2>
            <p className="text-muted-foreground text-sm">
              Inspect recent orchestration runs by run ID and submit quality
              feedback.
            </p>
          </div>
          <Button
            onClick={() => loadRuns(true)}
            size="sm"
            type="button"
            variant="outline"
          >
            <RefreshCw className="mr-2 size-4" />
            Reload
          </Button>
        </div>
        {error && runs.length > 0 ? (
          <p className="mt-2 text-destructive text-xs">{error}</p>
        ) : null}
      </SettingsPageHeader>

      <SettingsPageContent>{content}</SettingsPageContent>
    </SettingsPage>
  );
}
