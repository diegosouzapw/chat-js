export interface RunSummary {
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

export interface FlowCompareSummary {
  computeLevelDelta: number;
  costDelta: number;
  eventCountDelta: number;
  latencyDelta: number;
  runA: RunSummary;
  runB: RunSummary;
  spanCountDelta: number;
  traceCountA: number;
  traceCountB: number;
}

export interface SpanGroupSummary {
  completed: number;
  cost: number;
  failed: number;
  name: string;
  pending: number;
  running: number;
  total: number;
}
