"use client";

import { useEffect, useMemo, useRef, useState } from "react";

export interface FlowSpanData {
  id: string;
  run_id: string;
  parent_span_id: string | null;
  operation: string;
  status: "pending" | "running" | "completed" | "failed";
  model: string;
  started_at: string;
  finished_at: string | null;
  duration_ms: number;
  tokens_in: number;
  tokens_out: number;
  cost_usd: number;
  metadata: Record<string, unknown>;
  error_message?: string;
}

interface TraceWsMessage {
  data: FlowSpanData | FlowSpanData[];
  type: "backfill" | "span";
}

function buildSpanIndexMap(spans: FlowSpanData[]): Map<string, number> {
  const index = new Map<string, number>();
  spans.forEach((span, position) => {
    index.set(span.id, position);
  });
  return index;
}

function buildWebSocketBaseUrl(): string {
  const explicit = process.env.NEXT_PUBLIC_OMNICHAT_WS_BASE_URL;
  if (typeof explicit === "string" && explicit.trim().length > 0) {
    return explicit.trim().replace(/\/+$/, "");
  }

  if (typeof window === "undefined") {
    return "";
  }

  const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
  const host = window.location.hostname;
  const port = window.location.port;

  // Local default: chatjs on 4739 and backend on 4738.
  if (port === "4739") {
    return `${protocol}//${host}:4738`;
  }

  return `${protocol}//${window.location.host}`;
}

function resolveToken(): string | null {
  if (typeof window === "undefined") {
    return null;
  }
  try {
    const bearer = localStorage.getItem("omni_bearer_token");
    if (bearer && bearer.trim().length > 0) {
      return bearer.trim();
    }
    const apiKey = localStorage.getItem("omni_api_key");
    if (apiKey && apiKey.trim().length > 0) {
      return apiKey.trim();
    }
  } catch {
    return null;
  }
  return null;
}

export function useRunFlowWebSocket(runId: string | null, enabled = true) {
  const [connected, setConnected] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [spans, setSpans] = useState<FlowSpanData[]>([]);
  const spanIndexRef = useRef<Map<string, number>>(new Map());

  const wsUrl = useMemo(() => {
    if (!runId || !enabled) {
      return null;
    }
    const baseUrl = buildWebSocketBaseUrl();
    if (!baseUrl) {
      return null;
    }
    const token = resolveToken();
    const query = token ? `?token=${encodeURIComponent(token)}` : "";
    return `${baseUrl}/v1/ws/runs/${encodeURIComponent(runId)}/trace${query}`;
  }, [enabled, runId]);

  useEffect(() => {
    setSpans([]);
    spanIndexRef.current = new Map();
    setError(null);
    setConnected(false);
    if (!wsUrl) {
      return;
    }

    const ws = new WebSocket(wsUrl);
    ws.onopen = () => {
      setConnected(true);
      setError(null);
    };
    ws.onclose = () => {
      setConnected(false);
    };
    ws.onerror = () => {
      setConnected(false);
      setError("Flow trace websocket disconnected.");
    };
    ws.onmessage = (event) => {
      try {
        const parsed = JSON.parse(event.data) as TraceWsMessage;
        if (parsed.type === "backfill" && Array.isArray(parsed.data)) {
          spanIndexRef.current = buildSpanIndexMap(parsed.data);
          setSpans(parsed.data);
          return;
        }
        if (parsed.type === "span" && !Array.isArray(parsed.data)) {
          const nextSpan = parsed.data;
          setSpans((previous) => {
            const mappedIndex = spanIndexRef.current.get(nextSpan.id);

            if (
              mappedIndex !== undefined &&
              mappedIndex >= 0 &&
              mappedIndex < previous.length &&
              previous[mappedIndex]?.id === nextSpan.id
            ) {
              const next = [...previous];
              next[mappedIndex] = nextSpan;
              return next;
            }

            const fallbackIndex = previous.findIndex(
              (span) => span.id === nextSpan.id
            );
            if (fallbackIndex === -1) {
              spanIndexRef.current.set(nextSpan.id, previous.length);
              return [...previous, nextSpan];
            }

            spanIndexRef.current.set(nextSpan.id, fallbackIndex);
            const next = [...previous];
            next[fallbackIndex] = nextSpan;
            return next;
          });
        }
      } catch {
        // Ignore malformed payloads and keep stream alive.
      }
    };

    return () => {
      ws.close();
    };
  }, [wsUrl]);

  return { connected, error, spans };
}
