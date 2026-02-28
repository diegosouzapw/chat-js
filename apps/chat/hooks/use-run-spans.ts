"use client";

import { useCallback, useEffect, useMemo, useState } from "react";

export interface RunSpanData {
  id: string;
  run_id: string;
  parent_span_id: string | null;
  operation: string;
  status: "pending" | "running" | "completed" | "failed";
  input_preview?: string;
  output_preview?: string;
  error_message?: string;
  model: string;
  started_at: string;
  finished_at: string | null;
  duration_ms: number;
  tokens_in: number;
  tokens_out: number;
  cost_usd: number;
  metadata: Record<string, unknown>;
}

interface RunSpansResponse {
  run_id?: string;
  span_count?: number;
  spans?: RunSpanData[];
}

interface UseRunSpansOptions {
  pollIntervalMs?: number;
}

function normalizeSpans(payload: RunSpansResponse): RunSpanData[] {
  if (!Array.isArray(payload.spans)) {
    return [];
  }
  return payload.spans.filter((span): span is RunSpanData => {
    return (
      typeof span?.id === "string" &&
      typeof span?.run_id === "string" &&
      typeof span?.operation === "string"
    );
  });
}

export function useRunSpans(
  runId: string | null,
  options?: UseRunSpansOptions
) {
  const pollIntervalMs = useMemo(() => {
    const value = options?.pollIntervalMs;
    if (typeof value !== "number" || !Number.isFinite(value)) {
      return 3000;
    }
    return Math.max(0, Math.floor(value));
  }, [options?.pollIntervalMs]);

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [spans, setSpans] = useState<RunSpanData[]>([]);
  const [updatedAt, setUpdatedAt] = useState<number | null>(null);

  const load = useCallback(
    async (silent = false) => {
      if (!runId) {
        return;
      }

      if (!silent) {
        setLoading(true);
      }
      setError(null);

      try {
        const response = await fetch(`/api/omnichat/runs/${runId}/spans`, {
          cache: "no-store",
        });
        if (!response.ok) {
          throw new Error(`HTTP ${response.status}`);
        }
        const payload = (await response.json()) as RunSpansResponse;
        setSpans(normalizeSpans(payload));
        setUpdatedAt(Date.now());
      } catch (requestError) {
        setError(
          requestError instanceof Error
            ? requestError.message
            : "Failed to load run spans"
        );
      } finally {
        if (!silent) {
          setLoading(false);
        }
      }
    },
    [runId]
  );

  useEffect(() => {
    setSpans([]);
    setUpdatedAt(null);
    setError(null);
    if (!runId) {
      setLoading(false);
      return;
    }

    load(false).catch(() => undefined);
  }, [load, runId]);

  useEffect(() => {
    if (!runId || pollIntervalMs <= 0) {
      return;
    }

    const timer = window.setInterval(() => {
      load(true).catch(() => undefined);
    }, pollIntervalMs);

    return () => {
      window.clearInterval(timer);
    };
  }, [load, pollIntervalMs, runId]);

  return { error, loading, spans, updatedAt };
}
