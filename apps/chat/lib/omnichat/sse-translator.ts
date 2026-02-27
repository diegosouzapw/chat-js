/**
 * OmniChatAgent SSE → AI SDK Stream Translator
 *
 * Translates OmniChatAgent's custom SSE events (run_started, worker_delta, etc.)
 * into the AI SDK's UIMessageStream format that Chat.js understands.
 *
 * This allows Chat.js to display orchestration progress from our multi-agent backend.
 */

import type { OmniChatSSEEvent } from "./api-client";

/**
 * Event types that our orchestration emits
 */
export type OmniChatEventType =
  | "run_started"
  | "router_decided"
  | "worker_started"
  | "worker_delta"
  | "worker_completed"
  | "verification_started"
  | "verification_completed"
  | "judge_started"
  | "judge_completed"
  | "run_completed"
  | "run_failed"
  | "step_completed"
  | "error";

/**
 * Translates an OmniChatAgent SSE event into markdown annotation text
 * that can be appended to the AI SDK stream as a data part.
 */
export function translateEventToAnnotation(
  event: OmniChatSSEEvent
): { type: "orchestration"; data: Record<string, unknown> } | null {
  const eventType = event.event as OmniChatEventType;
  const data = event.data || {};

  switch (eventType) {
    case "run_started":
      return {
        type: "orchestration",
        data: {
          step: "run_started",
          mode: data.mode,
          run_id: event.run_id,
          message: `🚀 Run started in **${data.mode || "auto"}** mode`,
        },
      };

    case "router_decided":
      return {
        type: "orchestration",
        data: {
          step: "router_decided",
          mode: data.mode,
          compute_level: data.compute_level,
          message: `🧭 Router selected **${data.mode}** mode (compute level: ${data.compute_level || "auto"})`,
        },
      };

    case "worker_started":
      return {
        type: "orchestration",
        data: {
          step: "worker_started",
          model: data.model,
          worker_index: data.worker_index,
          message: `⚙️ Worker ${data.worker_index || ""} started (${data.model || "unknown"})`,
        },
      };

    case "worker_delta":
      // Worker text deltas — these are the actual streaming tokens
      return {
        type: "orchestration",
        data: {
          step: "worker_delta",
          model: data.model,
          delta: data.delta || data.text,
          worker_index: data.worker_index,
        },
      };

    case "worker_completed":
      return {
        type: "orchestration",
        data: {
          step: "worker_completed",
          model: data.model,
          latency_ms: data.latency_ms,
          cost_usd: data.cost_usd,
          message: `✅ Worker completed (${data.model}, ${data.latency_ms}ms, $${data.cost_usd || 0})`,
        },
      };

    case "judge_started":
      return {
        type: "orchestration",
        data: {
          step: "judge_started",
          message: "⚖️ Judge synthesizing consensus...",
        },
      };

    case "judge_completed":
      return {
        type: "orchestration",
        data: {
          step: "judge_completed",
          message: "✅ Judge synthesis complete",
        },
      };

    case "run_completed":
      return {
        type: "orchestration",
        data: {
          step: "run_completed",
          run_id: event.run_id,
          cost_usd: data.cost_usd,
          latency_ms: data.latency_ms,
          models_used: data.models_used,
          message: `🏁 Run completed (${data.latency_ms}ms, $${data.cost_usd || 0})`,
        },
      };

    case "run_failed":
    case "error":
      return {
        type: "orchestration",
        data: {
          step: "error",
          error: data.error || data.message,
          message: `❌ Error: ${data.error || data.message || "Unknown error"}`,
        },
      };

    case "verification_started":
      return {
        type: "orchestration",
        data: {
          step: "verification_started",
          message: "🔍 Verification started...",
        },
      };

    case "verification_completed":
      return {
        type: "orchestration",
        data: {
          step: "verification_completed",
          message: "✅ Verification completed",
        },
      };

    case "step_completed":
      return {
        type: "orchestration",
        data: {
          step: "step_completed",
          step_type: data.step_type,
          message: `✓ Step completed (${data.step_type || "unknown"})`,
        },
      };

    default:
      console.warn(`[SSE] Unknown event type: ${eventType}`);
      return null;
  }
}

/**
 * Escape HTML entities to prevent XSS in orchestration markdown.
 */
function escapeHtml(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

/**
 * Format orchestration events as markdown for display in the chat message.
 * This creates a collapsible details section showing all orchestration steps.
 */
export function formatOrchestrationAsMarkdown(
  events: Array<{ type: "orchestration"; data: Record<string, unknown> }>
): string {
  if (events.length === 0) return "";

  const lines = events
    .filter((e) => e.data.message)
    .map((e) => `- ${escapeHtml(String(e.data.message))}`);

  return `\n\n<details>\n<summary>🔍 Orchestration Steps (${lines.length})</summary>\n\n${lines.join("\n")}\n\n</details>\n`;
}
