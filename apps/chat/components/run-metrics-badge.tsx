"use client";

import { ClockIcon, DollarSignIcon, CpuIcon } from "lucide-react";
import { memo } from "react";

import { Badge } from "@/components/ui/badge";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";

export interface RunMetrics {
  latency_ms?: number;
  cost_usd?: number;
  models_used?: string[];
  mode?: string;
}

function PureRunMetricsBadge({
  metrics,
  className,
}: {
  metrics: RunMetrics;
  className?: string;
}) {
  const { latency_ms, cost_usd, models_used, mode } = metrics;

  if (!latency_ms && !cost_usd && !models_used?.length) return null;

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <div
          className={cn(
            "inline-flex items-center gap-1.5 text-xs text-muted-foreground",
            className
          )}
        >
          {latency_ms && (
            <Badge variant="outline" className="gap-1 px-1.5 py-0 text-xs font-normal">
              <ClockIcon className="size-3" />
              {latency_ms < 1000
                ? `${latency_ms}ms`
                : `${(latency_ms / 1000).toFixed(1)}s`}
            </Badge>
          )}
          {cost_usd !== undefined && cost_usd > 0 && (
            <Badge variant="outline" className="gap-1 px-1.5 py-0 text-xs font-normal">
              <DollarSignIcon className="size-3" />
              {cost_usd < 0.01
                ? `$${cost_usd.toFixed(4)}`
                : `$${cost_usd.toFixed(2)}`}
            </Badge>
          )}
          {models_used && models_used.length > 0 && (
            <Badge variant="outline" className="gap-1 px-1.5 py-0 text-xs font-normal">
              <CpuIcon className="size-3" />
              {models_used.length}
            </Badge>
          )}
        </div>
      </TooltipTrigger>
      <TooltipContent className="max-w-xs">
        <div className="flex flex-col gap-1 text-xs">
          {mode && <span>Mode: <strong>{mode}</strong></span>}
          {latency_ms && <span>Latency: {latency_ms}ms</span>}
          {cost_usd !== undefined && <span>Cost: ${cost_usd.toFixed(4)}</span>}
          {models_used && models_used.length > 0 && (
            <span>Models: {models_used.join(", ")}</span>
          )}
        </div>
      </TooltipContent>
    </Tooltip>
  );
}

export const RunMetricsBadge = memo(PureRunMetricsBadge);
