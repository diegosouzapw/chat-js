"use client";

import { AlertTriangle, Search } from "lucide-react";
import { useDeferredValue, useMemo, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type { RunTraceEvent } from "@/hooks/use-run-trace-events";
import {
  formatDate,
  formatTraceEventName,
  isErrorEvent,
  summarizeTraceData,
} from "./flow-console-utils";

export type TimelineFilter = "all" | "errors" | "judge" | "worker";
const DEFAULT_TRACE_TIMELINE_LIMIT = 220;

export function eventMatchesTimelineFilter(
  event: RunTraceEvent,
  filter: TimelineFilter
): boolean {
  if (filter === "all") {
    return true;
  }
  if (filter === "errors") {
    return isErrorEvent(event);
  }
  if (filter === "judge") {
    return event.event.includes("judge");
  }
  if (filter === "worker") {
    return event.event.includes("worker");
  }
  return true;
}

export function filterTraceTimelineEvents({
  events,
  filter,
  query,
}: {
  events: RunTraceEvent[];
  filter: TimelineFilter;
  query: string;
}): RunTraceEvent[] {
  const normalizedQuery = query.trim().toLowerCase();

  return events.filter((event) => {
    if (!eventMatchesTimelineFilter(event, filter)) {
      return false;
    }
    if (!normalizedQuery) {
      return true;
    }
    const summary = summarizeTraceData(event.data).toLowerCase();
    return (
      event.event.toLowerCase().includes(normalizedQuery) ||
      summary.includes(normalizedQuery)
    );
  });
}

export function findFirstTraceTimelineError(
  events: RunTraceEvent[]
): RunTraceEvent | null {
  return events.find((event) => isErrorEvent(event)) ?? null;
}

export function resolveVisibleTraceTimelineEvents({
  filteredEvents,
  limit = DEFAULT_TRACE_TIMELINE_LIMIT,
  showAll,
}: {
  filteredEvents: RunTraceEvent[];
  limit?: number;
  showAll: boolean;
}): {
  hiddenCount: number;
  truncated: boolean;
  visibleEvents: RunTraceEvent[];
} {
  const normalizedLimit = Number.isFinite(limit)
    ? Math.max(1, Math.floor(limit))
    : DEFAULT_TRACE_TIMELINE_LIMIT;

  if (showAll || filteredEvents.length <= normalizedLimit) {
    return {
      hiddenCount: 0,
      truncated: false,
      visibleEvents: filteredEvents,
    };
  }

  const hiddenCount = filteredEvents.length - normalizedLimit;
  return {
    hiddenCount,
    truncated: true,
    visibleEvents: filteredEvents.slice(hiddenCount),
  };
}

export function FlowConsoleTraceTimeline({
  events,
}: {
  events: RunTraceEvent[];
}) {
  const [filter, setFilter] = useState<TimelineFilter>("all");
  const [query, setQuery] = useState("");
  const [showAll, setShowAll] = useState(false);
  const deferredQuery = useDeferredValue(query);

  const filteredEvents = useMemo(() => {
    return filterTraceTimelineEvents({
      events,
      filter,
      query: deferredQuery,
    });
  }, [deferredQuery, events, filter]);

  const timelineWindow = useMemo(() => {
    return resolveVisibleTraceTimelineEvents({
      filteredEvents,
      showAll,
    });
  }, [filteredEvents, showAll]);

  const firstErrorEvent = useMemo(
    () => findFirstTraceTimelineError(timelineWindow.visibleEvents),
    [timelineWindow.visibleEvents]
  );

  if (events.length === 0) {
    return (
      <p className="text-muted-foreground text-sm">
        No trace events received yet for this run.
      </p>
    );
  }

  return (
    <div className="space-y-3">
      <div className="grid gap-2 md:grid-cols-[180px_1fr_auto]">
        <Select
          onValueChange={(value) => setFilter(value as TimelineFilter)}
          value={filter}
        >
          <SelectTrigger>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All events</SelectItem>
            <SelectItem value="errors">Errors only</SelectItem>
            <SelectItem value="worker">Worker events</SelectItem>
            <SelectItem value="judge">Judge events</SelectItem>
          </SelectContent>
        </Select>
        <div className="relative">
          <Search className="pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            className="pl-8"
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Search event payload"
            value={query}
          />
        </div>
        <Button
          disabled={!firstErrorEvent}
          onClick={() => {
            if (!firstErrorEvent || typeof document === "undefined") {
              return;
            }
            document
              .getElementById(`trace-event-${firstErrorEvent.id}`)
              ?.scrollIntoView({ behavior: "smooth", block: "center" });
          }}
          size="sm"
          type="button"
          variant="outline"
        >
          <AlertTriangle className="mr-2 size-4" />
          Jump to error
        </Button>
      </div>
      <div className="flex items-center justify-between gap-2">
        <p className="text-muted-foreground text-xs">
          Showing {timelineWindow.visibleEvents.length} of {filteredEvents.length}{" "}
          matching events.
        </p>
        {timelineWindow.truncated || showAll ? (
          <Button
            onClick={() => setShowAll((current) => !current)}
            size="sm"
            type="button"
            variant="ghost"
          >
            {showAll
              ? `Show latest ${DEFAULT_TRACE_TIMELINE_LIMIT}`
              : `Show all (${filteredEvents.length})`}
          </Button>
        ) : null}
      </div>

      {filteredEvents.length === 0 ? (
        <p className="text-muted-foreground text-sm">
          No events match current timeline filters.
        </p>
      ) : (
        <div className="max-h-80 space-y-2 overflow-auto pr-1">
          {timelineWindow.visibleEvents.map((event) => (
            <div
              className="rounded-md border p-3"
              id={`trace-event-${event.id}`}
              key={event.id}
            >
              <div className="mb-1 flex items-center justify-between gap-2">
                <Badge variant="outline">{formatTraceEventName(event.event)}</Badge>
                <span className="text-muted-foreground text-xs">
                  {formatDate(new Date(event.receivedAt).toISOString())}
                </span>
              </div>
              <p className="whitespace-pre-wrap text-muted-foreground text-xs">
                {summarizeTraceData(event.data)}
              </p>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
