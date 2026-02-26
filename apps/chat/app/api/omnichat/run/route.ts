/**
 * API Route: POST /api/omnichat/run
 *
 * Proxies chat requests to the OmniChatAgent backend for multi-agent orchestration.
 * Translates the OmniChatAgent SSE stream into AI SDK-compatible annotations.
 */

import { NextResponse } from "next/server";
import { executeRun, streamRun } from "@/lib/omnichat";
import {
  translateEventToAnnotation,
  formatOrchestrationAsMarkdown,
} from "@/lib/omnichat";
import type { OmniChatRunRequest } from "@/lib/omnichat";

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as OmniChatRunRequest & {
      stream?: boolean;
    };

    if (body.stream) {
      // SSE streaming mode — translate events and forward
      const encoder = new TextEncoder();
      const readableStream = new ReadableStream({
        async start(controller) {
          try {
            const events: Array<{
              type: "orchestration";
              data: Record<string, unknown>;
            }> = [];

            for await (const event of streamRun(body)) {
              const annotation = translateEventToAnnotation(event);
              if (annotation) {
                events.push(annotation);

                // Emit event as SSE
                const sseData = JSON.stringify({
                  type: "orchestration",
                  ...annotation.data,
                });
                controller.enqueue(
                  encoder.encode(`event: orchestration\ndata: ${sseData}\n\n`)
                );
              }

              // If run completed, emit the final answer and markdown summary
              if (
                event.event === "run_completed" &&
                event.data?.final_answer
              ) {
                const markdown = formatOrchestrationAsMarkdown(events);
                const finalData = JSON.stringify({
                  type: "final",
                  answer: event.data.final_answer,
                  orchestration_summary: markdown,
                  cost_usd: event.data.cost_usd,
                  latency_ms: event.data.latency_ms,
                  models_used: event.data.models_used,
                });
                controller.enqueue(
                  encoder.encode(`event: final\ndata: ${finalData}\n\n`)
                );
              }
            }

            controller.close();
          } catch (error) {
            const errorMsg = JSON.stringify({
              type: "error",
              message:
                error instanceof Error ? error.message : "Unknown error",
            });
            controller.enqueue(
              encoder.encode(`event: error\ndata: ${errorMsg}\n\n`)
            );
            controller.close();
          }
        },
      });

      return new Response(readableStream, {
        headers: {
          "Content-Type": "text/event-stream",
          "Cache-Control": "no-cache",
          Connection: "keep-alive",
        },
      });
    }

    // Synchronous mode — execute and return full result
    const result = await executeRun(body);
    return NextResponse.json(result);
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error ? error.message : "Failed to execute run",
      },
      { status: 500 }
    );
  }
}
