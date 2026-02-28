"use client";

import { RefreshCw } from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { useRunFlowWebSocket } from "@/hooks/use-run-flow-websocket";
import { useRunSpans } from "@/hooks/use-run-spans";
import { useRunTraceEvents } from "@/hooks/use-run-trace-events";
import { FlowConsoleMainPanels } from "./flow-console-main-panels";
import { FlowConsoleRunsSidebar } from "./flow-console-runs-sidebar";
import { FlowConsoleTraceTimeline } from "./flow-console-trace-timeline";
import type {
  FlowCompareSummary,
  RunSummary,
  SpanGroupSummary,
} from "./flow-console-types";
import {
  buildRunIdHistoryPath,
  downloadTextFile,
  filterRunsBySearchAndStatus,
  isTerminalStatus,
  resolveNextSelection,
  toSpansCsv,
} from "./flow-console-utils";
import {
  SettingsPage,
  SettingsPageContent,
  SettingsPageHeader,
  SettingsPageScrollArea,
} from "./settings-page";

const API_BASE = "/api/omnichat";

export function FlowConsoleSettings() {
  const searchParams = useSearchParams();
  const requestedRunId = searchParams.get("runId");
  const [runs, setRuns] = useState<RunSummary[]>([]);
  const [runsUpdatedAt, setRunsUpdatedAt] = useState<number | null>(null);
  const [selectedRunId, setSelectedRunId] = useState<string | null>(null);
  const [compareRunId, setCompareRunId] = useState<string>("none");
  const [loadingRuns, setLoadingRuns] = useState(true);
  const [runsError, setRunsError] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [shortcutMessage, setShortcutMessage] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState<
    "all" | "running" | "completed" | "failed"
  >("all");

  const selectedRun = useMemo(
    () => runs.find((run) => run.run_id === selectedRunId) ?? null,
    [runs, selectedRunId]
  );

  const {
    connected: traceConnected,
    error: traceError,
    events: traceEvents,
  } = useRunTraceEvents(selectedRunId);

  const { events: compareTraceEvents } = useRunTraceEvents(
    compareRunId === "none" ? null : compareRunId
  );

  const {
    connected: wsConnected,
    error: wsError,
    spans: wsSpans,
  } = useRunFlowWebSocket(selectedRunId, Boolean(selectedRunId));

  const {
    error: spansError,
    loading: spansLoading,
    spans,
    updatedAt: spansUpdatedAt,
  } = useRunSpans(selectedRunId, {
    pollIntervalMs: selectedRun && !isTerminalStatus(selectedRun.status) ? 2500 : 0,
  });

  const { spans: compareSpans } = useRunSpans(
    compareRunId === "none" ? null : compareRunId,
    { pollIntervalMs: 0 }
  );

  const loadRuns = useCallback(async (keepSelection = true) => {
    setLoadingRuns(true);
    setRunsError(null);

    try {
      const response = await fetch(`${API_BASE}/runs?limit=100`);
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }
      const payload = await response.json();
      const nextRuns: RunSummary[] = Array.isArray(payload?.runs)
        ? payload.runs
        : [];
      setRuns(nextRuns);
      setRunsUpdatedAt(Date.now());
      setSelectedRunId((current) =>
        resolveNextSelection(nextRuns, current, keepSelection)
      );
    } catch (error) {
      setRunsError(
        error instanceof Error ? error.message : "Failed to load runs"
      );
    } finally {
      setLoadingRuns(false);
    }
  }, []);

  useEffect(() => {
    loadRuns(false).catch(() => undefined);
  }, [loadRuns]);

  useEffect(() => {
    const timer = window.setInterval(() => {
      loadRuns(true).catch(() => undefined);
    }, 10_000);
    return () => {
      window.clearInterval(timer);
    };
  }, [loadRuns]);

  useEffect(() => {
    if (!requestedRunId) {
      return;
    }
    if (runs.some((run) => run.run_id === requestedRunId)) {
      setSelectedRunId(requestedRunId);
    }
  }, [requestedRunId, runs]);

  useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }
    const nextPath = buildRunIdHistoryPath({
      currentHref: window.location.href,
      selectedRunId,
    });
    if (!nextPath) {
      return;
    }
    window.history.replaceState({}, "", nextPath);
  }, [selectedRunId]);

  useEffect(() => {
    setShortcutMessage(null);
  }, [selectedRunId]);

  const filteredRuns = useMemo(() => {
    return filterRunsBySearchAndStatus({
      runs,
      search,
      statusFilter,
    });
  }, [runs, search, statusFilter]);

  const effectiveSpans = wsSpans.length > 0 ? wsSpans : spans;

  const spanGroups = useMemo<SpanGroupSummary[]>(() => {
    return Object.values(
      effectiveSpans.reduce<Record<string, SpanGroupSummary>>(
        (accumulator, span) => {
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
        },
        {}
      )
    ).sort((left, right) => right.total - left.total);
  }, [effectiveSpans]);

  const compareRun = useMemo(() => {
    if (compareRunId === "none") {
      return null;
    }
    return runs.find((run) => run.run_id === compareRunId) ?? null;
  }, [compareRunId, runs]);

  const compareSummary = useMemo<FlowCompareSummary | null>(() => {
    if (!selectedRun || !compareRun) {
      return null;
    }
    return {
      computeLevelDelta: selectedRun.compute_level - compareRun.compute_level,
      costDelta: selectedRun.cost_usd - compareRun.cost_usd,
      eventCountDelta: traceEvents.length - compareTraceEvents.length,
      latencyDelta: selectedRun.latency_ms - compareRun.latency_ms,
      runA: selectedRun,
      runB: compareRun,
      spanCountDelta: effectiveSpans.length - compareSpans.length,
      traceCountA: traceEvents.length,
      traceCountB: compareTraceEvents.length,
    };
  }, [
    compareRun,
    compareSpans.length,
    compareTraceEvents.length,
    effectiveSpans.length,
    selectedRun,
    traceEvents.length,
  ]);

  const handleCopyRunId = useCallback(async () => {
    if (!selectedRunId) {
      return;
    }
    try {
      await navigator.clipboard.writeText(selectedRunId);
      setShortcutMessage("Run ID copied to clipboard.");
    } catch {
      setShortcutMessage("Clipboard is unavailable in this browser.");
    }
  }, [selectedRunId]);

  const handleCopyFlowLink = useCallback(async () => {
    if (!selectedRunId || typeof window === "undefined") {
      return;
    }
    const base = `${window.location.origin}/settings/flow-console`;
    const link = `${base}?runId=${encodeURIComponent(selectedRunId)}`;
    try {
      await navigator.clipboard.writeText(link);
      setShortcutMessage("Flow console link copied.");
    } catch {
      setShortcutMessage("Unable to copy flow console link.");
    }
  }, [selectedRunId]);

  const handleOpenRunsSettings = useCallback(() => {
    if (!selectedRunId || typeof window === "undefined") {
      return;
    }
    const url = `/settings/runs?runId=${encodeURIComponent(selectedRunId)}`;
    window.open(url, "_blank", "noopener,noreferrer");
  }, [selectedRunId]);

  const handleExportTraceJson = useCallback(() => {
    if (!selectedRunId) {
      return;
    }
    const payload = {
      event_count: traceEvents.length,
      events: traceEvents,
      exported_at: new Date().toISOString(),
      run_id: selectedRunId,
    };
    downloadTextFile(
      `flow-trace-${selectedRunId}.json`,
      JSON.stringify(payload, null, 2)
    );
  }, [selectedRunId, traceEvents]);

  const handleExportSpansJson = useCallback(() => {
    if (!selectedRunId) {
      return;
    }
    const payload = {
      exported_at: new Date().toISOString(),
      run_id: selectedRunId,
      span_count: effectiveSpans.length,
      spans: effectiveSpans,
    };
    downloadTextFile(
      `flow-spans-${selectedRunId}.json`,
      JSON.stringify(payload, null, 2)
    );
  }, [effectiveSpans, selectedRunId]);

  const handleExportSpansCsv = useCallback(() => {
    if (!selectedRunId) {
      return;
    }
    downloadTextFile(`flow-spans-${selectedRunId}.csv`, toSpansCsv(effectiveSpans));
  }, [effectiveSpans, selectedRunId]);

  return (
    <SettingsPage>
      <SettingsPageHeader>
        <div className="flex items-center justify-between gap-3">
          <div>
            <h2 className="font-semibold text-lg">Flow Console</h2>
            <p className="text-muted-foreground text-sm">
              Dedicated orchestration diagnostics with run trace, websocket,
              and span graph.
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
        {runsUpdatedAt ? (
          <p className="mt-1 text-muted-foreground text-xs">
            Last refresh: {new Date(runsUpdatedAt).toLocaleTimeString()}
          </p>
        ) : null}
        {runsError ? (
          <div className="mt-3 flex items-center justify-between gap-3 rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2">
            <p className="text-destructive text-sm">
              Failed to refresh runs: {runsError}
            </p>
            <Button
              onClick={() => loadRuns(true)}
              size="sm"
              type="button"
              variant="outline"
            >
              Retry
            </Button>
          </div>
        ) : null}
      </SettingsPageHeader>

      <SettingsPageContent>
        <SettingsPageScrollArea>
          <div className="grid gap-4 px-1 md:grid-cols-[320px_1fr]">
            <FlowConsoleRunsSidebar
              compareRunId={compareRunId}
              filteredRuns={filteredRuns}
              loadingRuns={loadingRuns}
              onCompareRunChange={setCompareRunId}
              onSearchChange={setSearch}
              onSelectRun={setSelectedRunId}
              onStatusFilterChange={setStatusFilter}
              runs={runs}
              runsError={runsError}
              search={search}
              selectedRunId={selectedRunId}
              statusFilter={statusFilter}
            />

            <div className="space-y-4">
              <FlowConsoleMainPanels
                compareSpansCount={compareSpans.length}
                compareSummary={compareSummary}
                effectiveSpans={effectiveSpans}
                onCopyFlowLink={handleCopyFlowLink}
                onCopyRunId={handleCopyRunId}
                onExportSpansCsv={handleExportSpansCsv}
                onExportSpansJson={handleExportSpansJson}
                onExportTraceJson={handleExportTraceJson}
                onOpenRunsSettings={handleOpenRunsSettings}
                selectedRun={selectedRun}
                selectedRunId={selectedRunId}
                shortcutMessage={shortcutMessage}
                spanGroups={spanGroups}
                spansError={spansError}
                spansLoading={spansLoading}
                spansUpdatedAt={spansUpdatedAt}
                traceConnected={traceConnected}
                traceError={traceError}
                traceEventsCount={traceEvents.length}
                wsConnected={wsConnected}
                wsError={wsError}
              />

              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-sm">Trace Timeline</CardTitle>
                </CardHeader>
                <CardContent>
                  <FlowConsoleTraceTimeline events={traceEvents} />
                </CardContent>
              </Card>
            </div>
          </div>
        </SettingsPageScrollArea>
      </SettingsPageContent>
    </SettingsPage>
  );
}
