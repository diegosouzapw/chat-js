"use client";

import {
  Activity,
  Copy,
  Download,
  ExternalLink,
  Loader2,
  Radio,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { cn } from "@/lib/utils";
import type { FlowSpanData } from "@/hooks/use-run-flow-websocket";
import type { RunSpanData } from "@/hooks/use-run-spans";
import { RunSpanFlow } from "./run-span-flow";
import type {
  FlowCompareSummary,
  RunSummary,
  SpanGroupSummary,
} from "./flow-console-types";
import {
  formatCost,
  formatDate,
  formatLatency,
  formatSignedCost,
  formatSignedLatency,
  getStatusVariant,
} from "./flow-console-utils";

type FlowSpanLike = FlowSpanData | RunSpanData;

export function getToolkitDisabledState({
  selectedRunId,
  spansCount,
  traceEventsCount,
}: {
  selectedRunId: string | null;
  spansCount: number;
  traceEventsCount: number;
}) {
  const missingSelection = !selectedRunId;
  return {
    copyFlowLink: missingSelection,
    copyRunId: missingSelection,
    exportSpansCsv: missingSelection || spansCount === 0,
    exportSpansJson: missingSelection || spansCount === 0,
    exportTraceJson: missingSelection || traceEventsCount === 0,
    openRunsSettings: missingSelection,
  };
}

export function FlowConsoleMainPanels({
  compareSpansCount,
  compareSummary,
  effectiveSpans,
  onCopyFlowLink,
  onCopyRunId,
  onExportSpansCsv,
  onExportSpansJson,
  onExportTraceJson,
  onOpenRunsSettings,
  selectedRun,
  selectedRunId,
  shortcutMessage,
  spanGroups,
  spansError,
  spansLoading,
  spansUpdatedAt,
  traceConnected,
  traceError,
  traceEventsCount,
  wsConnected,
  wsError,
}: {
  compareSpansCount: number;
  compareSummary: FlowCompareSummary | null;
  effectiveSpans: FlowSpanLike[];
  onCopyFlowLink: () => void;
  onCopyRunId: () => void;
  onExportSpansCsv: () => void;
  onExportSpansJson: () => void;
  onExportTraceJson: () => void;
  onOpenRunsSettings: () => void;
  selectedRun: RunSummary | null;
  selectedRunId: string | null;
  shortcutMessage: string | null;
  spanGroups: SpanGroupSummary[];
  spansError: string | null;
  spansLoading: boolean;
  spansUpdatedAt: number | null;
  traceConnected: boolean;
  traceError: string | null;
  traceEventsCount: number;
  wsConnected: boolean;
  wsError: string | null;
}) {
  const toolkitDisabled = getToolkitDisabledState({
    selectedRunId,
    spansCount: effectiveSpans.length,
    traceEventsCount,
  });

  return (
    <>
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm">Realtime Health</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {selectedRun ? (
            <div className="flex flex-wrap items-center gap-2 text-xs">
              <Badge variant="outline">{selectedRun.mode}</Badge>
              <Badge variant={getStatusVariant(selectedRun.status)}>
                {selectedRun.status}
              </Badge>
              <Badge variant="outline">L{selectedRun.compute_level}</Badge>
              <Badge variant="outline">{formatLatency(selectedRun.latency_ms)}</Badge>
              <Badge variant="outline">{formatCost(selectedRun.cost_usd)}</Badge>
            </div>
          ) : (
            <p className="text-muted-foreground text-sm">
              Select a run to inspect telemetry.
            </p>
          )}
          <div className="flex flex-wrap gap-2 text-xs">
            <Badge
              className={cn(
                "gap-1",
                traceConnected && "border-emerald-500/40 text-emerald-600"
              )}
              variant="outline"
            >
              <Radio className="size-3.5" />
              Trace {traceConnected ? "live" : "offline"}
            </Badge>
            <Badge
              className={cn(
                "gap-1",
                wsConnected && "border-emerald-500/40 text-emerald-600"
              )}
              variant="outline"
            >
              <Activity className="size-3.5" />
              WS {wsConnected ? "live" : "offline"}
            </Badge>
            {spansUpdatedAt ? (
              <Badge variant="outline">
                spans refresh {formatDate(new Date(spansUpdatedAt).toISOString())}
              </Badge>
            ) : null}
          </div>
          {traceError ? (
            <p className="text-destructive text-xs">{traceError}</p>
          ) : null}
          {wsError ? <p className="text-destructive text-xs">{wsError}</p> : null}
          {spansError ? (
            <p className="text-destructive text-xs">{spansError}</p>
          ) : null}
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm">Investigation Toolkit</CardTitle>
          <CardDescription className="text-xs">
            Quick shortcuts for triage and exporting trace evidence.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="grid gap-2 sm:grid-cols-2">
            <Button
              disabled={toolkitDisabled.copyRunId}
              onClick={onCopyRunId}
              size="sm"
              type="button"
              variant="outline"
            >
              <Copy className="mr-2 size-4" />
              Copy run ID
            </Button>
            <Button
              disabled={toolkitDisabled.copyFlowLink}
              onClick={onCopyFlowLink}
              size="sm"
              type="button"
              variant="outline"
            >
              <ExternalLink className="mr-2 size-4" />
              Copy flow link
            </Button>
            <Button
              disabled={toolkitDisabled.openRunsSettings}
              onClick={onOpenRunsSettings}
              size="sm"
              type="button"
              variant="outline"
            >
              <ExternalLink className="mr-2 size-4" />
              Open runs page
            </Button>
            <Button
              disabled={toolkitDisabled.exportTraceJson}
              onClick={onExportTraceJson}
              size="sm"
              type="button"
              variant="outline"
            >
              <Download className="mr-2 size-4" />
              Export trace JSON
            </Button>
            <Button
              disabled={toolkitDisabled.exportSpansJson}
              onClick={onExportSpansJson}
              size="sm"
              type="button"
              variant="outline"
            >
              <Download className="mr-2 size-4" />
              Export spans JSON
            </Button>
            <Button
              disabled={toolkitDisabled.exportSpansCsv}
              onClick={onExportSpansCsv}
              size="sm"
              type="button"
              variant="outline"
            >
              <Download className="mr-2 size-4" />
              Export spans CSV
            </Button>
          </div>
          {shortcutMessage ? (
            <p className="text-muted-foreground text-xs">{shortcutMessage}</p>
          ) : null}
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm">Run Comparison</CardTitle>
          <CardDescription className="text-xs">
            Delta overview between active run and comparison run.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {!compareSummary ? (
            <p className="text-muted-foreground text-sm">
              Select a comparison run to compute diagnostics delta.
            </p>
          ) : (
            <div className="grid gap-2 text-xs md:grid-cols-2">
              <div className="rounded-md border p-2">
                <p className="font-medium">Primary</p>
                <p className="text-muted-foreground">{compareSummary.runA.run_id}</p>
                <p className="mt-1 text-muted-foreground">
                  {compareSummary.runA.mode} • {compareSummary.runA.status}
                </p>
              </div>
              <div className="rounded-md border p-2">
                <p className="font-medium">Comparison</p>
                <p className="text-muted-foreground">{compareSummary.runB.run_id}</p>
                <p className="mt-1 text-muted-foreground">
                  {compareSummary.runB.mode} • {compareSummary.runB.status}
                </p>
              </div>
              <div className="rounded-md border p-2">
                <p className="font-medium">Latency delta</p>
                <p className="text-muted-foreground">
                  {formatSignedLatency(compareSummary.latencyDelta)}
                </p>
              </div>
              <div className="rounded-md border p-2">
                <p className="font-medium">Cost delta</p>
                <p className="text-muted-foreground">
                  {formatSignedCost(compareSummary.costDelta)}
                </p>
              </div>
              <div className="rounded-md border p-2">
                <p className="font-medium">Compute delta</p>
                <p className="text-muted-foreground">
                  {compareSummary.computeLevelDelta > 0 ? "+" : ""}
                  {compareSummary.computeLevelDelta}
                </p>
              </div>
              <div className="rounded-md border p-2">
                <p className="font-medium">Trace events delta</p>
                <p className="text-muted-foreground">
                  {compareSummary.eventCountDelta > 0 ? "+" : ""}
                  {compareSummary.eventCountDelta} (current{" "}
                  {compareSummary.traceCountA} vs compare{" "}
                  {compareSummary.traceCountB})
                </p>
              </div>
              <div className="rounded-md border p-2 md:col-span-2">
                <p className="font-medium">Span count delta</p>
                <p className="text-muted-foreground">
                  {compareSummary.spanCountDelta > 0 ? "+" : ""}
                  {compareSummary.spanCountDelta} (current {effectiveSpans.length}
                  {" "}vs compare {compareSpansCount})
                </p>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm">Operation Groups</CardTitle>
          <CardDescription className="text-xs">
            Span aggregation by operation name.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {spanGroups.length === 0 ? (
            <p className="text-muted-foreground text-sm">
              No spans captured yet for this run.
            </p>
          ) : (
            <div className="grid gap-2 md:grid-cols-2">
              {spanGroups.map((group) => (
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
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm">Span Graph</CardTitle>
          <CardDescription className="text-xs">
            Real-time graph (prefers websocket spans when available).
          </CardDescription>
        </CardHeader>
        <CardContent>
          {spansLoading && effectiveSpans.length === 0 ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="size-5 animate-spin text-muted-foreground" />
            </div>
          ) : effectiveSpans.length === 0 ? (
            <p className="text-muted-foreground text-sm">
              No spans available yet.
            </p>
          ) : (
            <RunSpanFlow spans={effectiveSpans} />
          )}
        </CardContent>
      </Card>
    </>
  );
}
