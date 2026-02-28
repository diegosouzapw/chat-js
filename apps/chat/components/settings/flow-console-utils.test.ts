import { describe, expect, it } from "vitest";
import type { RunTraceEvent } from "@/hooks/use-run-trace-events";
import type { RunSummary } from "./flow-console-types";
import {
  buildRunIdHistoryPath,
  filterRunsBySearchAndStatus,
  formatCost,
  formatDate,
  formatLatency,
  formatSignedCost,
  formatSignedLatency,
  formatTraceEventName,
  getStatusVariant,
  isErrorEvent,
  isTerminalStatus,
  resolveNextSelection,
  selectGraphSpanSubset,
  summarizeTraceData,
  toSpansCsv,
} from "./flow-console-utils";

describe("flow-console-utils", () => {
  it("formats date safely", () => {
    expect(formatDate(null)).toBe("—");
    expect(formatDate("not-a-date")).toBe("—");
    expect(formatDate("2026-02-28T10:00:00Z")).not.toBe("—");
  });

  it("formats latency and cost", () => {
    expect(formatLatency(0)).toBe("—");
    expect(formatLatency(500)).toBe("500ms");
    expect(formatLatency(1500)).toBe("1.5s");

    expect(formatCost(0)).toBe("$0.0000");
    expect(formatCost(0.005)).toBe("$0.0050");
    expect(formatCost(1.234)).toBe("$1.23");
  });

  it("formats signed deltas", () => {
    expect(formatSignedLatency(0)).toBe("0ms");
    expect(formatSignedLatency(2200)).toBe("+2.2s");
    expect(formatSignedLatency(-250)).toBe("-250ms");

    expect(formatSignedCost(0)).toBe("$0.0000");
    expect(formatSignedCost(0.123)).toBe("+$0.12");
    expect(formatSignedCost(-0.0023)).toBe("-$0.0023");
  });

  it("formats trace names and summaries", () => {
    expect(formatTraceEventName("worker_completed")).toBe("worker completed");
    expect(summarizeTraceData({ message: "done" })).toBe("done");
    expect(summarizeTraceData({ error: "boom" })).toBe("Error: boom");
    expect(summarizeTraceData({ model: "gpt-x" })).toBe("model=gpt-x");
  });

  it("identifies terminal status and badge variants", () => {
    expect(isTerminalStatus("completed")).toBe(true);
    expect(isTerminalStatus("failed")).toBe(true);
    expect(isTerminalStatus("running")).toBe(false);

    expect(getStatusVariant("completed")).toBe("secondary");
    expect(getStatusVariant("failed")).toBe("destructive");
    expect(getStatusVariant("running")).toBe("outline");
  });

  it("resolves next run selection correctly", () => {
    const runs: RunSummary[] = [
      {
        completed_at: null,
        compute_level: 3,
        cost_usd: 0.01,
        created_at: "2026-02-28T10:00:00Z",
        latency_ms: 1000,
        mode: "auto",
        query_preview: "q1",
        run_id: "run-a",
        status: "completed",
      },
      {
        completed_at: null,
        compute_level: 5,
        cost_usd: 0.02,
        created_at: "2026-02-28T11:00:00Z",
        latency_ms: 1500,
        mode: "council",
        query_preview: "q2",
        run_id: "run-b",
        status: "running",
      },
    ];

    expect(resolveNextSelection([], null, true)).toBeNull();
    expect(resolveNextSelection(runs, null, false)).toBe("run-a");
    expect(resolveNextSelection(runs, "run-b", true)).toBe("run-b");
    expect(resolveNextSelection(runs, "missing", true)).toBe("run-a");
  });

  it("filters runs by status and search query", () => {
    const runs: RunSummary[] = [
      {
        completed_at: null,
        compute_level: 3,
        cost_usd: 0.01,
        created_at: "2026-02-28T10:00:00Z",
        latency_ms: 1000,
        mode: "auto",
        query_preview: "customer refund",
        run_id: "run-a",
        status: "completed",
      },
      {
        completed_at: null,
        compute_level: 5,
        cost_usd: 0.02,
        created_at: "2026-02-28T11:00:00Z",
        latency_ms: 1500,
        mode: "council",
        query_preview: "risk analysis",
        run_id: "run-b",
        status: "running",
      },
    ];

    expect(
      filterRunsBySearchAndStatus({
        runs,
        search: "",
        statusFilter: "all",
      }).map((run) => run.run_id)
    ).toEqual(["run-a", "run-b"]);

    expect(
      filterRunsBySearchAndStatus({
        runs,
        search: "refund",
        statusFilter: "all",
      }).map((run) => run.run_id)
    ).toEqual(["run-a"]);

    expect(
      filterRunsBySearchAndStatus({
        runs,
        search: "run-b",
        statusFilter: "running",
      }).map((run) => run.run_id)
    ).toEqual(["run-b"]);
  });

  it("builds history path by adding/updating/removing runId query param", () => {
    expect(
      buildRunIdHistoryPath({
        currentHref: "https://chat.local/settings/flow-console",
        selectedRunId: "run-10",
      })
    ).toBe("/settings/flow-console?runId=run-10");

    expect(
      buildRunIdHistoryPath({
        currentHref:
          "https://chat.local/settings/flow-console?status=failed#timeline",
        selectedRunId: "run-11",
      })
    ).toBe("/settings/flow-console?status=failed&runId=run-11#timeline");

    expect(
      buildRunIdHistoryPath({
        currentHref:
          "https://chat.local/settings/flow-console?runId=run-11&status=failed",
        selectedRunId: null,
      })
    ).toBe("/settings/flow-console?status=failed");

    expect(
      buildRunIdHistoryPath({
        currentHref: "https://chat.local/settings/flow-console?runId=run-11",
        selectedRunId: "run-11",
      })
    ).toBeNull();
  });

  it("selects a bounded graph subset while preserving recent parent context", () => {
    const spans = [
      { id: "a", parent_span_id: null, started_at: "2026-02-28T10:00:00Z" },
      { id: "b", parent_span_id: "a", started_at: "2026-02-28T10:01:00Z" },
      { id: "c", parent_span_id: "b", started_at: "2026-02-28T10:04:00Z" },
      { id: "d", parent_span_id: null, started_at: "2026-02-28T10:05:00Z" },
      { id: "e", parent_span_id: null, started_at: "2026-02-28T10:03:00Z" },
    ];

    const subset = selectGraphSpanSubset({
      maxSpans: 3,
      spans,
    });

    expect(subset.truncated).toBe(true);
    expect(subset.hiddenCount).toBe(2);
    expect(subset.spans.map((span) => span.id)).toContain("c");
    expect(subset.spans.map((span) => span.id)).toContain("b");
  });

  it("builds spans CSV with header and rows", () => {
    const csv = toSpansCsv([
      {
        cost_usd: 0.003,
        duration_ms: 1200,
        finished_at: "2026-02-28T10:00:02Z",
        id: "s1",
        metadata: {},
        model: "model-a",
        operation: "llm:worker",
        parent_span_id: null,
        run_id: "run-1",
        started_at: "2026-02-28T10:00:01Z",
        status: "completed",
        tokens_in: 10,
        tokens_out: 20,
      },
    ]);

    expect(csv).toContain('"id","parent_span_id","operation","status"');
    expect(csv).toContain('"s1"');
    expect(csv).toContain('"llm:worker"');
  });

  it("detects error events by name and payload", () => {
    const failedEvent: RunTraceEvent = {
      data: {},
      event: "run_failed",
      id: 1,
      receivedAt: Date.now(),
    };
    const payloadErrorEvent: RunTraceEvent = {
      data: { error: "network timeout" },
      event: "worker_completed",
      id: 2,
      receivedAt: Date.now(),
    };

    expect(isErrorEvent(failedEvent)).toBe(true);
    expect(isErrorEvent(payloadErrorEvent)).toBe(true);
  });
});
