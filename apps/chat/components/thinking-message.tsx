"use client";

import { useChatStatus } from "@ai-sdk-tools/store";
import { motion } from "motion/react";
import { useMemo } from "react";
import type { OrchestrationUpdate } from "@/lib/ai/types";
import { useDataStream } from "./data-stream-provider";
import { InlineRunFlowPanel } from "./inline-run-flow-panel";
import {
  OrchestrationProgress,
  type OrchestrationStep,
} from "./orchestration-progress";

export const ThinkingMessage = () => {
  const role = "assistant";
  const status = useChatStatus();
  const { dataStream } = useDataStream();

  const orchestrationEvents = useMemo<OrchestrationUpdate[]>(() => {
    if (!dataStream || dataStream.length === 0) {
      return [];
    }

    const lastAppendMessageIdx = dataStream.findLastIndex(
      (part) => part.type === "data-appendMessage"
    );

    return dataStream
      .slice(lastAppendMessageIdx + 1)
      .filter((part) => part.type === "data-orchestration")
      .map((part) => part.data);
  }, [dataStream]);

  const steps = useMemo<OrchestrationStep[]>(() => {
    return orchestrationEvents.map((event) => ({
      step: event.step,
      model: event.model,
      latency_ms: event.latency_ms,
      cost_usd: event.cost_usd,
      timestamp: event.timestamp,
      message:
        event.message ||
        (typeof event.event === "string" ? event.event : event.step),
    }));
  }, [orchestrationEvents]);

  const isComplete =
    steps.length > 0 && steps[steps.length - 1]?.step === "run_completed";
  const latestMetricsEvent =
    orchestrationEvents.findLast(
      (event) =>
        typeof event.cost_usd === "number" ||
        typeof event.latency_ms === "number" ||
        (event.models_used && event.models_used.length > 0)
    ) ?? null;
  const mode =
    orchestrationEvents.findLast((event) => typeof event.mode === "string")
      ?.mode ?? undefined;
  const activeRunId =
    orchestrationEvents.findLast(
      (event) => typeof event.run_id === "string" && event.run_id.trim().length > 0
    )?.run_id ?? null;

  const shouldRenderOrchestration = steps.length > 0;

  if (status === "streaming" && !shouldRenderOrchestration) {
    return null;
  }

  return (
    <motion.div
      animate={{ y: 0, opacity: 1, transition: { delay: 1 } }}
      className="group/message mx-auto w-full max-w-3xl px-4"
      data-role={role}
      data-testid="message-assistant-loading"
      initial={{ y: 5, opacity: 0 }}
    >
      {shouldRenderOrchestration ? (
        <div className="space-y-2">
          <OrchestrationProgress
            isComplete={isComplete}
            mode={mode}
            modelsUsed={latestMetricsEvent?.models_used}
            steps={steps}
            totalCost={latestMetricsEvent?.cost_usd}
            totalLatency={latestMetricsEvent?.latency_ms}
          />
          {activeRunId ? (
            <InlineRunFlowPanel isRunning={!isComplete} runId={activeRunId} />
          ) : null}
        </div>
      ) : (
        <div className="m-1.5 size-3 animate-[pulse-dot_2s_ease-in-out_infinite] rounded-full bg-muted-foreground">
          <span className="sr-only">Loading</span>
        </div>
      )}
    </motion.div>
  );
};
