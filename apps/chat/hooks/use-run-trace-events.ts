"use client";

import { useEffect, useRef, useState } from "react";

const TRACE_EVENT_TYPES = [
  "run_started",
  "router_decided",
  "worker_started",
  "worker_delta",
  "worker_completed",
  "verification_started",
  "verification_completed",
  "judge_started",
  "judge_completed",
  "step_completed",
  "run_completed",
  "run_failed",
  "error",
] as const;

const TERMINAL_EVENTS = new Set(["run_completed", "run_failed", "error"]);

export interface RunTraceEvent {
  event: string;
  id: number;
  receivedAt: number;
  runId?: string;
  data: Record<string, unknown>;
}

export function useRunTraceEvents(runId: string | null) {
  const [connected, setConnected] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [events, setEvents] = useState<RunTraceEvent[]>([]);
  const sequenceRef = useRef(0);

  useEffect(() => {
    setEvents([]);
    setError(null);
    setConnected(false);

    if (!runId) {
      return;
    }

    const source = new EventSource(`/api/omnichat/runs/${runId}/events?since=0`);

    const appendEvent = (eventName: string, raw: string) => {
      let payload: Record<string, unknown> = {};
      try {
        const parsed = JSON.parse(raw);
        if (parsed && typeof parsed === "object") {
          payload = parsed as Record<string, unknown>;
        }
      } catch {
        payload = { raw };
      }

      sequenceRef.current += 1;
      const traceEvent: RunTraceEvent = {
        event: eventName,
        id: sequenceRef.current,
        receivedAt: Date.now(),
        runId:
          typeof payload.run_id === "string"
            ? payload.run_id
            : runId,
        data: payload,
      };

      setEvents((previous) => {
        const next = [...previous, traceEvent];
        return next.length > 400 ? next.slice(next.length - 400) : next;
      });

      if (TERMINAL_EVENTS.has(eventName)) {
        setConnected(false);
        source.close();
      }
    };

    source.onopen = () => {
      setConnected(true);
      setError(null);
    };

    source.onerror = () => {
      setConnected(false);
      setError("Trace stream disconnected.");
    };

    const listeners = TRACE_EVENT_TYPES.map((eventName) => {
      const handler = (message: Event) => {
        const msg = message as MessageEvent<string>;
        appendEvent(eventName, msg.data);
      };
      source.addEventListener(eventName, handler);
      return { eventName, handler };
    });

    return () => {
      for (const { eventName, handler } of listeners) {
        source.removeEventListener(eventName, handler);
      }
      source.close();
    };
  }, [runId]);

  return { connected, error, events };
}
