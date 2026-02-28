import { describe, expect, it } from "vitest";
import { getToolkitDisabledState } from "./flow-console-main-panels";
import {
  buildCompareRunOptions,
  resolveRunsSidebarView,
} from "./flow-console-runs-sidebar";
import {
  eventMatchesTimelineFilter,
  filterTraceTimelineEvents,
  findFirstTraceTimelineError,
  resolveVisibleTraceTimelineEvents,
} from "./flow-console-trace-timeline";
import type { RunSummary } from "./flow-console-types";

function buildRun(id: string, status = "completed"): RunSummary {
  return {
    completed_at: "2026-02-28T12:00:00.000Z",
    compute_level: 3,
    cost_usd: 0.0024,
    created_at: "2026-02-28T11:59:00.000Z",
    latency_ms: 850,
    mode: "council",
    query_preview: `Query ${id}`,
    run_id: id,
    status,
  };
}

const TIMELINE_EVENTS = [
  {
    data: { message: "workers started" },
    event: "worker_started",
    id: 1,
    receivedAt: Date.now(),
  },
  {
    data: { error: "judge failed" },
    event: "judge_failed",
    id: 2,
    receivedAt: Date.now(),
  },
  {
    data: { message: "trace done" },
    event: "run_completed",
    id: 3,
    receivedAt: Date.now(),
  },
];

describe("flow-console component behavior helpers", () => {
  describe("trace timeline filters", () => {
    it("matches events by filter type", () => {
      expect(eventMatchesTimelineFilter(TIMELINE_EVENTS[0], "worker")).toBe(true);
      expect(eventMatchesTimelineFilter(TIMELINE_EVENTS[1], "judge")).toBe(true);
      expect(eventMatchesTimelineFilter(TIMELINE_EVENTS[2], "errors")).toBe(false);
      expect(eventMatchesTimelineFilter(TIMELINE_EVENTS[1], "errors")).toBe(true);
    });

    it("filters by query using event name and summarized payload", () => {
      const byName = filterTraceTimelineEvents({
        events: TIMELINE_EVENTS,
        filter: "all",
        query: "worker",
      });
      expect(byName.map((event) => event.id)).toEqual([1]);

      const byPayload = filterTraceTimelineEvents({
        events: TIMELINE_EVENTS,
        filter: "errors",
        query: "judge",
      });
      expect(byPayload.map((event) => event.id)).toEqual([2]);
    });

    it("finds the first error after filters are applied", () => {
      const filtered = filterTraceTimelineEvents({
        events: TIMELINE_EVENTS,
        filter: "all",
        query: "",
      });
      expect(findFirstTraceTimelineError(filtered)?.id).toBe(2);
    });

    it("renders latest timeline window when list exceeds the render limit", () => {
      const events = Array.from({ length: 8 }, (_, index) => ({
        data: { index },
        event: "worker_delta",
        id: index + 1,
        receivedAt: Date.now(),
      }));

      const latestWindow = resolveVisibleTraceTimelineEvents({
        filteredEvents: events,
        limit: 3,
        showAll: false,
      });

      expect(latestWindow.truncated).toBe(true);
      expect(latestWindow.hiddenCount).toBe(5);
      expect(latestWindow.visibleEvents.map((event) => event.id)).toEqual([6, 7, 8]);

      const fullWindow = resolveVisibleTraceTimelineEvents({
        filteredEvents: events,
        limit: 3,
        showAll: true,
      });

      expect(fullWindow.truncated).toBe(false);
      expect(fullWindow.hiddenCount).toBe(0);
      expect(fullWindow.visibleEvents).toHaveLength(8);
    });
  });

  describe("runs sidebar compare options", () => {
    it("excludes selected run and caps list to 60 entries", () => {
      const runs = Array.from({ length: 75 }, (_, index) =>
        buildRun(`run-${index + 1}`)
      );
      const compareRuns = buildCompareRunOptions({
        runs,
        selectedRunId: "run-4",
      });

      expect(compareRuns).toHaveLength(60);
      expect(compareRuns.some((run) => run.run_id === "run-4")).toBe(false);
      expect(compareRuns[0]?.run_id).toBe("run-1");
    });

    it("keeps cached list view when not loading and runs are available", () => {
      expect(
        resolveRunsSidebarView({
          filteredRunsLength: 3,
          loadingRuns: false,
        })
      ).toBe("list");

      expect(
        resolveRunsSidebarView({
          filteredRunsLength: 2,
          loadingRuns: true,
        })
      ).toBe("list");

      expect(
        resolveRunsSidebarView({
          filteredRunsLength: 0,
          loadingRuns: false,
        })
      ).toBe("empty");

      expect(
        resolveRunsSidebarView({
          filteredRunsLength: 0,
          loadingRuns: true,
        })
      ).toBe("loading");
    });
  });

  describe("main panel toolkit states", () => {
    it("disables every shortcut when no run is selected", () => {
      expect(
        getToolkitDisabledState({
          selectedRunId: null,
          spansCount: 4,
          traceEventsCount: 10,
        })
      ).toEqual({
        copyFlowLink: true,
        copyRunId: true,
        exportSpansCsv: true,
        exportSpansJson: true,
        exportTraceJson: true,
        openRunsSettings: true,
      });
    });

    it("keeps copy/open enabled while blocking empty exports", () => {
      expect(
        getToolkitDisabledState({
          selectedRunId: "run-1",
          spansCount: 0,
          traceEventsCount: 0,
        })
      ).toEqual({
        copyFlowLink: false,
        copyRunId: false,
        exportSpansCsv: true,
        exportSpansJson: true,
        exportTraceJson: true,
        openRunsSettings: false,
      });
    });
  });
});
