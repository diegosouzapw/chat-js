"use client";

import {
  BrainCircuitIcon,
  CheckCircle2Icon,
  Loader2Icon,
  SparklesIcon,
  UsersIcon,
  ZapIcon,
  AlertCircleIcon,
} from "lucide-react";
import { memo, useState } from "react";

import { Badge } from "@/components/ui/badge";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { cn } from "@/lib/utils";

// ── Types ─────────────────────────────────────────────

export interface OrchestrationStep {
  step: string;
  model?: string;
  latency_ms?: number;
  cost_usd?: number;
  message: string;
  timestamp?: number;
}

export interface OrchestrationProgressProps {
  steps: OrchestrationStep[];
  mode?: string;
  totalCost?: number;
  totalLatency?: number;
  modelsUsed?: string[];
  isComplete?: boolean;
  className?: string;
}

// ── Step icon mapping ─────────────────────────────────

function StepIcon({ step }: { step: string }) {
  switch (step) {
    case "run_started":
      return <SparklesIcon className="size-3.5 text-purple-500" />;
    case "router_decided":
      return <BrainCircuitIcon className="size-3.5 text-blue-500" />;
    case "worker_started":
    case "worker_completed":
      return <UsersIcon className="size-3.5 text-green-500" />;
    case "judge_started":
    case "judge_completed":
      return <ZapIcon className="size-3.5 text-amber-500" />;
    case "run_completed":
      return <CheckCircle2Icon className="size-3.5 text-green-500" />;
    case "error":
      return <AlertCircleIcon className="size-3.5 text-red-500" />;
    default:
      return <Loader2Icon className="size-3.5 animate-spin text-muted-foreground" />;
  }
}

// ── Component ─────────────────────────────────────────

function PureOrchestrationProgress({
  steps,
  mode,
  totalCost,
  totalLatency,
  modelsUsed,
  isComplete = false,
  className,
}: OrchestrationProgressProps) {
  const [isOpen, setIsOpen] = useState(false);

  if (steps.length === 0) return null;

  // Filter out worker_delta (too noisy) and keep meaningful steps
  const displaySteps = steps.filter((s) => s.step !== "worker_delta");

  return (
    <Collapsible open={isOpen} onOpenChange={setIsOpen}>
      <div
        className={cn(
          "rounded-lg border bg-muted/30 px-3 py-2 text-sm",
          className
        )}
      >
        {/* Summary bar */}
        <CollapsibleTrigger className="flex w-full items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            {isComplete ? (
              <CheckCircle2Icon className="size-4 text-green-500" />
            ) : (
              <Loader2Icon className="size-4 animate-spin text-purple-500" />
            )}
            <span className="font-medium text-xs">
              {isComplete ? "Orchestration Complete" : "Processing..."}
            </span>
            {mode && (
              <Badge variant="outline" className="text-xs px-1.5 py-0">
                {mode}
              </Badge>
            )}
          </div>
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            {totalLatency && (
              <span>{(totalLatency / 1000).toFixed(1)}s</span>
            )}
            {totalCost !== undefined && totalCost > 0 && (
              <span>${totalCost.toFixed(4)}</span>
            )}
            {modelsUsed && modelsUsed.length > 0 && (
              <Badge variant="secondary" className="text-xs px-1.5 py-0">
                {modelsUsed.length} models
              </Badge>
            )}
            <span className="text-muted-foreground/60">
              {isOpen ? "▲" : "▼"}
            </span>
          </div>
        </CollapsibleTrigger>

        {/* Expanded steps */}
        <CollapsibleContent>
          <div className="mt-2 space-y-1 border-t pt-2">
            {displaySteps.map((step, i) => (
              <div
                key={`${step.step}-${i}`}
                className="flex items-start gap-2 text-xs"
              >
                <StepIcon step={step.step} />
                <span className="text-muted-foreground flex-1">
                  {step.message}
                </span>
                {step.latency_ms && (
                  <span className="text-muted-foreground/60 tabular-nums shrink-0">
                    {step.latency_ms}ms
                  </span>
                )}
              </div>
            ))}
          </div>
        </CollapsibleContent>
      </div>
    </Collapsible>
  );
}

export const OrchestrationProgress = memo(PureOrchestrationProgress);
