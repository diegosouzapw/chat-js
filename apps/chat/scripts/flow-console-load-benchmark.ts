import { performance } from "node:perf_hooks";
import type { RunTraceEvent } from "../hooks/use-run-trace-events";
import {
  filterTraceTimelineEvents,
  resolveVisibleTraceTimelineEvents,
} from "../components/settings/flow-console-trace-timeline";
import { selectGraphSpanSubset } from "../components/settings/flow-console-utils";

interface SpanSample {
  id: string;
  parent_span_id: string | null;
  started_at: string;
}

interface BenchmarkSample {
  avgMs: number;
  maxMs: number;
  p95Ms: number;
}

function summarize(samplesMs: number[]): BenchmarkSample {
  const sorted = [...samplesMs].sort((left, right) => left - right);
  const total = samplesMs.reduce((sum, value) => sum + value, 0);
  const p95Index = Math.max(0, Math.ceil(sorted.length * 0.95) - 1);
  return {
    avgMs: total / Math.max(1, samplesMs.length),
    maxMs: sorted[sorted.length - 1] ?? 0,
    p95Ms: sorted[p95Index] ?? 0,
  };
}

function measureBenchmark({
  iterations = 30,
  warmups = 4,
  work,
}: {
  iterations?: number;
  warmups?: number;
  work: () => void;
}): BenchmarkSample {
  for (let index = 0; index < warmups; index += 1) {
    work();
  }

  const samplesMs: number[] = [];
  for (let index = 0; index < iterations; index += 1) {
    const startedAt = performance.now();
    work();
    samplesMs.push(performance.now() - startedAt);
  }

  return summarize(samplesMs);
}

function buildTraceEvents(total: number): RunTraceEvent[] {
  const events: RunTraceEvent[] = [];
  const now = Date.now();
  const eventKinds = [
    "worker_delta",
    "worker_completed",
    "judge_started",
    "judge_completed",
    "run_failed",
    "run_completed",
  ];

  for (let index = 0; index < total; index += 1) {
    const kind = eventKinds[index % eventKinds.length] ?? "worker_delta";
    events.push({
      data:
        kind === "run_failed"
          ? { error: `failure-${index}`, message: "judge timeout", model: "gpt-4.1" }
          : { message: `event-${index}`, model: index % 2 === 0 ? "gpt-4.1" : "o4-mini" },
      event: kind,
      id: index + 1,
      receivedAt: now + index,
      runId: "bench-run",
    });
  }

  return events;
}

function buildSpanSamples(total: number): SpanSample[] {
  const spans: SpanSample[] = [];
  const baseTimestamp = Date.UTC(2026, 1, 28, 12, 0, 0);
  for (let index = 0; index < total; index += 1) {
    const parentIndex = index === 0 ? null : Math.floor((index - 1) / 2);
    spans.push({
      id: `span-${index + 1}`,
      parent_span_id: parentIndex === null ? null : `span-${parentIndex + 1}`,
      started_at: new Date(baseTimestamp + index * 75).toISOString(),
    });
  }
  return spans;
}

function printTimelineBenchmarks(): {
  recommendations: { limit: number; stats: BenchmarkSample }[];
} {
  const volumes = [400, 2000, 5000, 10000];
  const limits = [120, 160, 180, 220, 280];
  const recommendationCandidates: { limit: number; stats: BenchmarkSample }[] = [];

  console.log("=== Timeline Filter + Windowing ===");
  for (const volume of volumes) {
    const events = buildTraceEvents(volume);
    console.log(`\nvolume=${volume}`);
    for (const limit of limits) {
      const stats = measureBenchmark({
        work: () => {
          const filtered = filterTraceTimelineEvents({
            events,
            filter: "all",
            query: "worker",
          });
          resolveVisibleTraceTimelineEvents({
            filteredEvents: filtered,
            limit,
            showAll: false,
          });
        },
      });
      console.log(
        `  limit=${String(limit).padEnd(3)} avg=${stats.avgMs.toFixed(3)}ms p95=${stats.p95Ms.toFixed(3)}ms max=${stats.maxMs.toFixed(3)}ms`
      );

      if (volume === 10000) {
        recommendationCandidates.push({ limit, stats });
      }
    }
  }

  return { recommendations: recommendationCandidates };
}

function printGraphSubsetBenchmarks(): {
  recommendations: { limit: number; stats: BenchmarkSample }[];
} {
  const volumes = [600, 1200, 2500, 5000];
  const limits = [200, 240, 260, 280, 320];
  const recommendationCandidates: { limit: number; stats: BenchmarkSample }[] = [];

  console.log("\n=== Graph Subset Selection ===");
  for (const volume of volumes) {
    const spans = buildSpanSamples(volume);
    console.log(`\nvolume=${volume}`);
    for (const limit of limits) {
      const stats = measureBenchmark({
        work: () => {
          selectGraphSpanSubset({
            maxSpans: limit,
            spans,
          });
        },
      });
      console.log(
        `  limit=${String(limit).padEnd(3)} avg=${stats.avgMs.toFixed(3)}ms p95=${stats.p95Ms.toFixed(3)}ms max=${stats.maxMs.toFixed(3)}ms`
      );

      if (volume === 5000) {
        recommendationCandidates.push({ limit, stats });
      }
    }
  }

  return { recommendations: recommendationCandidates };
}

function pickRecommendedLimit({
  candidates,
  p95ThresholdMs,
}: {
  candidates: { limit: number; stats: BenchmarkSample }[];
  p95ThresholdMs: number;
}): number {
  const passing = candidates
    .filter((candidate) => candidate.stats.p95Ms <= p95ThresholdMs)
    .sort((left, right) => right.limit - left.limit);
  if (passing.length > 0) {
    return passing[0]?.limit ?? candidates[0]?.limit ?? 0;
  }

  // If none pass the threshold, choose the limit with the smallest p95.
  const fallback = [...candidates].sort(
    (left, right) => left.stats.p95Ms - right.stats.p95Ms
  );
  return fallback[0]?.limit ?? candidates[0]?.limit ?? 0;
}

function main() {
  const timeline = printTimelineBenchmarks();
  const graph = printGraphSubsetBenchmarks();

  const recommendedTimelineLimit = pickRecommendedLimit({
    candidates: timeline.recommendations,
    p95ThresholdMs: 8,
  });
  const recommendedGraphLimit = pickRecommendedLimit({
    candidates: graph.recommendations,
    p95ThresholdMs: 1.2,
  });

  console.log("\n=== Recommendation ===");
  console.log(`timeline_limit=${recommendedTimelineLimit}`);
  console.log(`graph_span_limit=${recommendedGraphLimit}`);
}

main();
