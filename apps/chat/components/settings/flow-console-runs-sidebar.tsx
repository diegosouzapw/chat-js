"use client";

import { Loader2, Search } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";
import type { RunSummary } from "./flow-console-types";
import {
  formatCost,
  formatDate,
  formatLatency,
  getStatusVariant,
} from "./flow-console-utils";

export function buildCompareRunOptions({
  runs,
  selectedRunId,
}: {
  runs: RunSummary[];
  selectedRunId: string | null;
}): RunSummary[] {
  return runs.filter((run) => run.run_id !== selectedRunId).slice(0, 60);
}

export function resolveRunsSidebarView({
  filteredRunsLength,
  loadingRuns,
}: {
  filteredRunsLength: number;
  loadingRuns: boolean;
}): "empty" | "list" | "loading" {
  if (loadingRuns && filteredRunsLength === 0) {
    return "loading";
  }
  if (filteredRunsLength === 0) {
    return "empty";
  }
  return "list";
}

function RunsSelector({
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
          className={cn(
            "cursor-pointer transition-colors hover:bg-muted/50",
            selectedRunId === run.run_id && "border-primary"
          )}
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
              {run.query_preview || "No query preview"}
            </CardDescription>
            <div className="flex flex-wrap gap-2 text-xs">
              <Badge variant="outline">L{run.compute_level}</Badge>
              <Badge variant="outline">{formatLatency(run.latency_ms)}</Badge>
              <Badge variant="outline">{formatCost(run.cost_usd)}</Badge>
            </div>
          </CardHeader>
        </Card>
      ))}
    </div>
  );
}

export function FlowConsoleRunsSidebar({
  compareRunId,
  filteredRuns,
  loadingRuns,
  onCompareRunChange,
  onSearchChange,
  onSelectRun,
  onStatusFilterChange,
  runs,
  runsError,
  search,
  selectedRunId,
  statusFilter,
}: {
  compareRunId: string;
  filteredRuns: RunSummary[];
  loadingRuns: boolean;
  onCompareRunChange: (runId: string) => void;
  onSearchChange: (value: string) => void;
  onSelectRun: (runId: string) => void;
  onStatusFilterChange: (
    value: "all" | "running" | "completed" | "failed"
  ) => void;
  runs: RunSummary[];
  runsError: string | null;
  search: string;
  selectedRunId: string | null;
  statusFilter: "all" | "running" | "completed" | "failed";
}) {
  const compareRuns = buildCompareRunOptions({ runs, selectedRunId });
  const view = resolveRunsSidebarView({
    filteredRunsLength: filteredRuns.length,
    loadingRuns,
  });

  return (
    <Card className="h-fit">
      <CardHeader className="pb-3">
        <CardTitle className="text-sm">Runs</CardTitle>
        <CardDescription className="text-xs">
          Select a run ID to inspect live flow telemetry.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="space-y-2">
          <div className="relative">
            <Search className="pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              className="pl-8"
              onChange={(event) => onSearchChange(event.target.value)}
              placeholder="Search by run/mode/query"
              value={search}
            />
          </div>
          <Select
            onValueChange={(value) =>
              onStatusFilterChange(
                value as "all" | "running" | "completed" | "failed"
              )
            }
            value={statusFilter}
          >
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All statuses</SelectItem>
              <SelectItem value="running">Running</SelectItem>
              <SelectItem value="completed">Completed</SelectItem>
              <SelectItem value="failed">Failed</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-2 rounded-md border p-2">
          <p className="text-muted-foreground text-xs">
            Compare selected run with another run.
          </p>
          <Select onValueChange={onCompareRunChange} value={compareRunId}>
            <SelectTrigger>
              <SelectValue placeholder="Choose run for comparison" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="none">No comparison</SelectItem>
              {compareRuns.map((run) => (
                <SelectItem key={run.run_id} value={run.run_id}>
                  {run.mode} • {run.status} • {run.run_id.slice(0, 8)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {runsError ? (
          <p className="text-destructive text-xs">
            Could not refresh latest runs. Showing cached list.
          </p>
        ) : null}

        {view === "loading" ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="size-5 animate-spin text-muted-foreground" />
          </div>
        ) : view === "empty" ? (
          <p className="text-muted-foreground text-sm">
            No runs match this filter.
          </p>
        ) : (
          <RunsSelector
            onSelect={onSelectRun}
            runs={filteredRuns}
            selectedRunId={selectedRunId}
          />
        )}
      </CardContent>
    </Card>
  );
}
