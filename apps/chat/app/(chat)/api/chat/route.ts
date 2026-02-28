import {
  convertToModelMessages,
  createUIMessageStream,
  JsonToSseTransformStream,
  UI_MESSAGE_STREAM_HEADERS,
} from "ai";
import { headers } from "next/headers";
import type { NextRequest } from "next/server";
import { after } from "next/server";
import { createClient } from "redis";
import {
  createResumableStreamContext,
  type ResumableStreamContext,
} from "resumable-stream";
import throttle from "throttleit";
import {
  type AppModelDefinition,
  type AppModelId,
  getAppModelDefinition,
} from "@/lib/ai/app-models";
import { createCoreChatAgent } from "@/lib/ai/core-chat-agent";
import { determineExplicitlyRequestedTools } from "@/lib/ai/determine-explicitly-requested-tools";
import { ChatSDKError } from "@/lib/ai/errors";
import {
  generateFollowupSuggestions,
  streamFollowupSuggestions,
} from "@/lib/ai/followup-suggestions";
import { systemPrompt } from "@/lib/ai/prompts";
import { calculateMessagesTokens } from "@/lib/ai/token-utils";
import { allTools } from "@/lib/ai/tools/tools-definitions";
import type { ChatMessage, ToolName } from "@/lib/ai/types";
import {
  getAnonymousSession,
  setAnonymousSession,
} from "@/lib/anonymous-session-server";
import { auth } from "@/lib/auth";
import { config } from "@/lib/config";
import { createAnonymousSession } from "@/lib/create-anonymous-session";
import { CostAccumulator } from "@/lib/credits/cost-accumulator";
import { canSpend, deductCredits } from "@/lib/db/credits";
import { getMcpConnectorsByUserId } from "@/lib/db/mcp-queries";
import {
  getChatById,
  getMessageById,
  getMessageCanceledAt,
  getProjectById,
  getUserById,
  saveChat,
  saveMessage,
  updateMessage,
  updateMessageActiveStreamId,
} from "@/lib/db/queries";
import type { McpConnector } from "@/lib/db/schema";
import { env } from "@/lib/env";
import { MAX_INPUT_TOKENS } from "@/lib/limits/tokens";
import { createModuleLogger } from "@/lib/logger";
import {
  executeRun,
  streamRun,
  translateEventToAnnotation,
  type OmniChatRunRequest,
  type OmniChatSSEEvent,
} from "@/lib/omnichat";
import type { AnonymousSession } from "@/lib/types/anonymous";
import { ANONYMOUS_LIMITS } from "@/lib/types/anonymous";
import { generateUUID } from "@/lib/utils";
import { checkAnonymousRateLimit, getClientIP } from "@/lib/utils/rate-limit";
import { generateTitleFromUserMessage } from "../../actions";
import { getThreadUpToMessageId } from "./get-thread-up-to-message-id";

// Shared Redis clients for resumable stream
let redisPublisher: ReturnType<typeof createClient> | null = null;
let redisSubscriber: ReturnType<typeof createClient> | null = null;

const isBuildTime = process.env.NEXT_PHASE === "phase-production-build";

if (env.REDIS_URL && !isBuildTime) {
  redisPublisher = createClient({ url: env.REDIS_URL });
  redisSubscriber = createClient({ url: env.REDIS_URL });
  await Promise.all([redisPublisher.connect(), redisSubscriber.connect()]);
}

let globalStreamContext: ResumableStreamContext | null = null;

export function getStreamContext(): ResumableStreamContext | null {
  if (globalStreamContext) {
    return globalStreamContext;
  }

  // Resumable streams require Redis - return null if not configured
  if (!(redisPublisher && redisSubscriber)) {
    return null;
  }

  globalStreamContext = createResumableStreamContext({
    waitUntil: after,
    keyPrefix: `${config.appPrefix}:resumable-stream`,
    publisher: redisPublisher,
    subscriber: redisSubscriber,
  });

  return globalStreamContext;
}

const CHAT_MODE_FALLBACK = "auto";
const OUTPUT_LANGUAGE_FALLBACK = "pt-BR";
const ALLOWED_CHAT_MODES = new Set([
  "auto",
  "direct",
  "council",
  "council_peer_review",
  "debate",
  "self_refine",
  "heavy",
  "tree_of_thought",
  "chain_of_agents",
]);
const OMNICHAT_MAIN_FLOW_ENABLED =
  process.env.OMNICHAT_MAIN_FLOW_ENABLED !== "false";
const OMNICHAT_LOCAL_PIPELINE_FALLBACK_ENABLED =
  process.env.OMNICHAT_LOCAL_PIPELINE_FALLBACK !== "false";
const OMNICHAT_MAIN_FLOW_STREAM =
  process.env.OMNICHAT_MAIN_FLOW_STREAM !== "false";

function resolveChatMode(rawMode: unknown): string {
  if (typeof rawMode !== "string") {
    return CHAT_MODE_FALLBACK;
  }

  const normalized = rawMode.trim();
  if (!normalized) {
    return CHAT_MODE_FALLBACK;
  }

  return ALLOWED_CHAT_MODES.has(normalized)
    ? normalized
    : CHAT_MODE_FALLBACK;
}

function resolveComputeLevel(rawLevel: unknown): 3 | 5 | 7 | undefined {
  if (rawLevel === 3 || rawLevel === 5 || rawLevel === 7) {
    return rawLevel;
  }

  if (typeof rawLevel === "string") {
    const parsed = Number.parseInt(rawLevel, 10);
    if (parsed === 3 || parsed === 5 || parsed === 7) {
      return parsed;
    }
  }

  return undefined;
}

function resolveOutputLanguage(rawLanguage: unknown): string {
  if (typeof rawLanguage !== "string") {
    return OUTPUT_LANGUAGE_FALLBACK;
  }

  const normalized = rawLanguage.trim();
  return normalized.length > 0
    ? normalized.slice(0, 16)
    : OUTPUT_LANGUAGE_FALLBACK;
}

function extractUserTextQuery(message: ChatMessage): string {
  const text = message.parts
    .filter(
      (part): part is Extract<ChatMessage["parts"][number], { type: "text" }> =>
        part.type === "text"
    )
    .map((part) => part.text)
    .join("\n")
    .trim();
  return text;
}

function getOmniEventData(event: OmniChatSSEEvent): Record<string, unknown> {
  if (event.data && typeof event.data === "object") {
    return event.data;
  }
  return event as unknown as Record<string, unknown>;
}

function toNonNegativeNumber(value: unknown): number {
  if (typeof value === "number" && Number.isFinite(value) && value >= 0) {
    return value;
  }
  if (typeof value === "string") {
    const parsed = Number.parseFloat(value);
    if (Number.isFinite(parsed) && parsed >= 0) {
      return parsed;
    }
  }
  return 0;
}

function toStringArray(value: unknown): string[] | undefined {
  if (!Array.isArray(value)) {
    return undefined;
  }
  const result = value.filter((item): item is string => typeof item === "string");
  return result.length > 0 ? result : undefined;
}

export async function executeOmniChatRequest({
  chatId,
  userMessage,
  selectedModelId,
  selectedMode,
  selectedComputeLevel,
  selectedOutputLanguage,
  userId,
  isAnonymous,
  isNewChat,
}: {
  chatId: string;
  userMessage: ChatMessage;
  selectedModelId: AppModelId;
  selectedMode: string;
  selectedComputeLevel: 3 | 5 | 7 | undefined;
  selectedOutputLanguage: string;
  userId: string | null;
  isAnonymous: boolean;
  isNewChat: boolean;
}): Promise<Response> {
  const log = createModuleLogger("api:chat:omnichat-main-flow");
  const query = extractUserTextQuery(userMessage);
  if (!query) {
    throw new Error("Cannot execute OmniChat run without text query");
  }

  const runRequest: OmniChatRunRequest = {
    query,
    mode: selectedMode,
    compute_level: selectedComputeLevel,
    output_language: selectedOutputLanguage,
  };

  const assistantMessageId = generateUUID();

  const stream = createUIMessageStream<ChatMessage>({
    execute: async ({ writer }) => {
      let finalAnswer = "";
      let runCostUsd = 0;
      let runIdFromExecution: string | undefined;

      if (isNewChat) {
        writer.write({
          id: generateUUID(),
          type: "data-chatConfirmed",
          data: { chatId },
          transient: true,
        });
      }

      if (OMNICHAT_MAIN_FLOW_STREAM) {
        try {
          for await (const event of streamRun(runRequest)) {
            const annotation = translateEventToAnnotation(event);
            if (annotation?.type === "orchestration") {
              const annotationData = annotation.data as Record<string, unknown>;
              if (typeof annotationData.run_id === "string") {
                runIdFromExecution = annotationData.run_id;
              } else if (typeof event.run_id === "string") {
                runIdFromExecution = event.run_id;
              }
              writer.write({
                id: generateUUID(),
                type: "data-orchestration",
                data: {
                  ...annotationData,
                  step:
                    typeof annotationData.step === "string"
                      ? annotationData.step
                      : event.event,
                  run_id:
                    (annotationData.run_id as string | undefined) ?? event.run_id,
                  event: event.event,
                  timestamp: Date.now(),
                },
                transient: true,
              });
            }

            const eventData = getOmniEventData(event);
            if (event.event === "run_completed") {
              finalAnswer = String(eventData.final_answer || "").trim();
              runCostUsd = toNonNegativeNumber(eventData.cost_usd);
              const eventRunId = eventData.run_id;
              if (typeof eventRunId === "string" && eventRunId.trim()) {
                runIdFromExecution = eventRunId;
              } else if (
                typeof event.run_id === "string" &&
                event.run_id.trim()
              ) {
                runIdFromExecution = event.run_id;
              }
            }
            if (event.event === "run_failed" || event.event === "error") {
              const message =
                String(eventData.error || eventData.message || "").trim() ||
                "OmniChat run failed";
              throw new Error(message);
            }
          }
        } catch (error) {
          log.warn(
            {
              err:
                error instanceof Error
                  ? { message: error.message, stack: error.stack }
                  : error,
            },
            "OmniChat streaming run failed; retrying with sync run"
          );
        }
      }

      if (!finalAnswer) {
        const runResponse = await executeRun(runRequest);
        finalAnswer = String(runResponse.final_answer || "").trim();
        runCostUsd = toNonNegativeNumber(runResponse.cost_usd);
        if (typeof runResponse.run_id === "string" && runResponse.run_id.trim()) {
          runIdFromExecution = runResponse.run_id;
        }
        writer.write({
          id: generateUUID(),
          type: "data-orchestration",
          data: {
            step: "run_completed",
            message: "🏁 Run completed",
            mode: runResponse.mode,
            run_id: runResponse.run_id,
            latency_ms: runResponse.latency_ms,
            cost_usd: runResponse.cost_usd,
            models_used: toStringArray(runResponse.models_used),
            timestamp: Date.now(),
            event: "run_completed",
          },
          transient: true,
        });
      }

      const assistantMessage: ChatMessage = {
        id: assistantMessageId,
        role: "assistant",
        parts: [{ type: "text", text: finalAnswer }],
        metadata: {
          createdAt: new Date(),
          parentMessageId: userMessage.id,
          selectedModel: selectedModelId,
          runId: runIdFromExecution,
          mode: selectedMode,
          computeLevel: selectedComputeLevel,
          outputLanguage: selectedOutputLanguage,
          activeStreamId: null,
          selectedTool: undefined,
        },
      };

      if (!isAnonymous) {
        await saveMessage({
          id: assistantMessage.id,
          chatId,
          message: assistantMessage,
        });
      }

      if (userId && !isAnonymous && runCostUsd > 0) {
        await deductCredits(userId, runCostUsd);
      }

      writer.write({
        id: generateUUID(),
        type: "data-appendMessage",
        data: JSON.stringify(assistantMessage),
        transient: true,
      });
    },
    generateId: () => assistantMessageId,
  });

  return new Response(
    stream
      .pipeThrough(new JsonToSseTransformStream())
      .pipeThrough(new TextEncoderStream()),
    { headers: UI_MESSAGE_STREAM_HEADERS }
  );
}

type AnonymousSessionResult =
  | { success: true; session: AnonymousSession }
  | { success: false; error: Response };

async function handleAnonymousSession({
  request,
  redis,
  selectedModelId,
}: {
  request: NextRequest;
  redis: ReturnType<typeof import("redis").createClient> | null;
  selectedModelId: AppModelId;
}): Promise<AnonymousSessionResult> {
  const log = createModuleLogger("api:chat:anonymous");

  const clientIP = getClientIP(request);
  const rateLimitResult = await checkAnonymousRateLimit(clientIP, redis);

  if (!rateLimitResult.success) {
    log.warn({ clientIP }, "Rate limit exceeded");
    return {
      success: false,
      error: Response.json(
        { error: rateLimitResult.error, type: "RATE_LIMIT_EXCEEDED" },
        { status: 429, headers: rateLimitResult.headers || {} }
      ),
    };
  }

  const session =
    (await getAnonymousSession()) ?? (await createAnonymousSession());

  if (session.remainingCredits <= 0) {
    log.info("Anonymous credit limit reached");
    return {
      success: false,
      error: Response.json(
        {
          error: "You've used your free credits. Sign up to continue chatting!",
          type: "ANONYMOUS_LIMIT_EXCEEDED",
          suggestion:
            "Create an account to get more credits and access to more AI models",
        },
        { status: 402, headers: rateLimitResult.headers || {} }
      ),
    };
  }

  if (
    !(ANONYMOUS_LIMITS.AVAILABLE_MODELS as readonly AppModelId[]).includes(
      selectedModelId
    )
  ) {
    log.warn("Model not available for anonymous users");
    return {
      success: false,
      error: Response.json(
        {
          error: "Model not available for anonymous users",
          availableModels: ANONYMOUS_LIMITS.AVAILABLE_MODELS,
        },
        { status: 403, headers: rateLimitResult.headers || {} }
      ),
    };
  }

  return { success: true, session };
}

async function handleChatValidation({
  chatId,
  userId,
  userMessage,
  projectId,
}: {
  chatId: string;
  userId: string;
  userMessage: ChatMessage;
  projectId?: string;
}): Promise<{ error: Response | null; isNewChat: boolean }> {
  const log = createModuleLogger("api:chat:validation");

  const chat = await getChatById({ id: chatId });
  let isNewChat = false;

  if (chat) {
    if (chat.userId !== userId) {
      log.warn("Unauthorized - chat ownership mismatch");
      return {
        error: new Response("Unauthorized", { status: 401 }),
        isNewChat,
      };
    }
  } else {
    isNewChat = true;
    const title = await generateTitleFromUserMessage({
      message: userMessage,
    });

    await saveChat({ id: chatId, userId, title, projectId });
  }

  const [existentMessage] = await getMessageById({ id: userMessage.id });

  if (existentMessage && existentMessage.chatId !== chatId) {
    log.warn("Unauthorized - message chatId mismatch");
    return { error: new Response("Unauthorized", { status: 401 }), isNewChat };
  }

  if (!existentMessage) {
    // If the message does not exist, save it
    await saveMessage({
      id: userMessage.id,
      chatId,
      message: userMessage,
    });
  }

  return { error: null, isNewChat };
}

async function checkUserCanSpend(userId: string): Promise<Response | null> {
  const userCanSpend = await canSpend(userId);
  if (!userCanSpend) {
    return new Response("Insufficient credits", { status: 402 });
  }
  return null;
}

async function handleUserValidationAndCredits({
  chatId,
  userId,
  userMessage,
  projectId,
}: {
  chatId: string;
  userId: string;
  userMessage: ChatMessage;
  projectId?: string;
}): Promise<{ error: Response } | { isNewChat: boolean }> {
  const validationResult = await handleChatValidation({
    chatId,
    userId,
    userMessage,
    projectId,
  });
  if (validationResult.error) {
    return { error: validationResult.error };
  }

  const creditError = await checkUserCanSpend(userId);
  if (creditError) {
    return { error: creditError };
  }

  return { isNewChat: validationResult.isNewChat };
}

/**
 * Determines which built-in tools are allowed based on model capabilities.
 * MCP tools are handled separately in core-chat-agent.
 */
function determineAllowedTools({
  isAnonymous,
  modelDefinition,
  explicitlyRequestedTools,
}: {
  isAnonymous: boolean;
  modelDefinition: AppModelDefinition;
  explicitlyRequestedTools: ToolName[] | null;
}): ToolName[] {
  // Start with all tools or anonymous-limited tools
  const allowedTools: ToolName[] = isAnonymous
    ? [...ANONYMOUS_LIMITS.AVAILABLE_TOOLS]
    : [...allTools];

  // Disable all tools for models with unspecified features
  if (!modelDefinition?.input) {
    return [];
  }

  // If specific tools were requested, filter them against allowed tools
  if (explicitlyRequestedTools && explicitlyRequestedTools.length > 0) {
    return explicitlyRequestedTools.filter((tool) =>
      allowedTools.includes(tool)
    );
  }

  return allowedTools;
}

async function getSystemPrompt({
  isAnonymous,
  chatId,
  selectedMode,
  selectedComputeLevel,
  outputLanguage,
}: {
  isAnonymous: boolean;
  chatId: string;
  selectedMode: string;
  selectedComputeLevel: 3 | 5 | 7 | undefined;
  outputLanguage: string;
}): Promise<string> {
  let system = systemPrompt();
  if (!isAnonymous) {
    const currentChat = await getChatById({ id: chatId });
    if (currentChat?.projectId) {
      const project = await getProjectById({ id: currentChat.projectId });
      if (project?.instructions) {
        system = `${system}\n\nProject instructions:\n${project.instructions}`;
      }
    }
  }

  system = `${system}\n\nResponse language: ${outputLanguage}.`;

  if (selectedMode !== CHAT_MODE_FALLBACK) {
    system = `${system}\nOrchestration preference: ${selectedMode}.`;
  }
  if (selectedComputeLevel) {
    system = `${system}\nCompute level preference: ${selectedComputeLevel}.`;
  }

  return system;
}

async function createChatStream({
  messageId,
  chatId,
  userMessage,
  previousMessages,
  selectedModelId,
  explicitlyRequestedTools,
  userId,
  allowedTools,
  abortController,
  isAnonymous,
  isNewChat,
  timeoutId,
  mcpConnectors,
  streamId,
  selectedMode,
  selectedComputeLevel,
  selectedOutputLanguage,
  onChunk,
}: {
  messageId: string;
  chatId: string;
  userMessage: ChatMessage;
  previousMessages: ChatMessage[];
  selectedModelId: AppModelId;
  explicitlyRequestedTools: ToolName[] | null;
  userId: string | null;
  allowedTools: ToolName[];
  abortController: AbortController;
  isAnonymous: boolean;
  isNewChat: boolean;
  timeoutId: NodeJS.Timeout;
  mcpConnectors: McpConnector[];
  streamId: string;
  selectedMode: string;
  selectedComputeLevel: 3 | 5 | 7 | undefined;
  selectedOutputLanguage: string;
  onChunk?: () => void;
}) {
  const log = createModuleLogger("api:chat:stream");
  const system = await getSystemPrompt({
    isAnonymous,
    chatId,
    selectedMode,
    selectedComputeLevel,
    outputLanguage: selectedOutputLanguage,
  });

  // Create cost accumulator to track all LLM and API costs
  const costAccumulator = new CostAccumulator();

  // Build the data stream that will emit tokens
  const stream = createUIMessageStream<ChatMessage>({
    execute: async ({ writer: dataStream }) => {
      // Confirm chat persistence on first message (chat + user message are persisted before streaming begins)
      if (isNewChat) {
        dataStream.write({
          id: generateUUID(),
          type: "data-chatConfirmed",
          data: { chatId },
          transient: true,
        });
      }

      const { result, contextForLLM } = await createCoreChatAgent({
        system,
        userMessage,
        previousMessages,
        selectedModelId,
        explicitlyRequestedTools,
        userId,
        budgetAllowedTools: allowedTools,
        abortSignal: abortController.signal,
        messageId,
        dataStream,
        onError: (error) => {
          log.error({ error }, "streamText error");
        },
        onChunk,
        mcpConnectors,
        costAccumulator,
      });

      const initialMetadata: ChatMessage["metadata"] = {
        createdAt: new Date(),
        parentMessageId: userMessage.id,
        selectedModel: selectedModelId,
        mode: selectedMode,
        computeLevel: selectedComputeLevel,
        outputLanguage: selectedOutputLanguage,
        activeStreamId: isAnonymous ? null : streamId,
      };

      dataStream.merge(
        result.toUIMessageStream({
          sendReasoning: true,
          messageMetadata: ({ part }) => {
            // send custom information to the client on start:
            if (part.type === "start") {
              return initialMetadata;
            }

            // when the message is finished, send additional information:
            if (part.type === "finish") {
              // Add main stream LLM usage to accumulator
              if (part.totalUsage) {
                costAccumulator.addLLMCost(
                  selectedModelId,
                  part.totalUsage,
                  "main-chat"
                );
              }
              return {
                ...initialMetadata,
                usage: part.totalUsage,
                activeStreamId: null,
              };
            }
          },
        })
      );
      await result.consumeStream();

      const response = await result.response;
      const responseMessages = response.messages;

      // Generate and stream follow-up suggestions
      if (config.ai.tools.followupSuggestions.enabled) {
        const followupSuggestionsResult = generateFollowupSuggestions([
          ...contextForLLM,
          ...responseMessages,
        ]);
        await streamFollowupSuggestions({
          followupSuggestionsResult,
          writer: dataStream,
        });
      }
    },
    generateId: () => messageId,
    onFinish: async ({ messages }) => {
      clearTimeout(timeoutId);
      await finalizeMessageAndCredits({
        messages,
        userId,
        isAnonymous,
        chatId,
        costAccumulator,
      });
    },
    onError: (error) => {
      clearTimeout(timeoutId);
      // If the stream fails, ensure the placeholder assistant message is no longer marked resumable.
      // Otherwise the client will try to resume a stream that no longer exists and we end up with a
      // stuck partial placeholder on reload.
      if (!isAnonymous) {
        after(() =>
          Promise.resolve(
            updateMessageActiveStreamId({ id: messageId, activeStreamId: null })
          ).catch((dbError) => {
            log.error(
              { error: dbError },
              "Failed to clear activeStreamId on stream error"
            );
          })
        );
      }

      log.error({ error }, "onError");
      return "Oops, an error occured!";
    },
  });

  return stream;
}

async function executeChatRequest({
  chatId,
  userMessage,
  previousMessages,
  selectedModelId,
  explicitlyRequestedTools,
  userId,
  isAnonymous,
  isNewChat,
  allowedTools,
  abortController,
  timeoutId,
  mcpConnectors,
  selectedMode,
  selectedComputeLevel,
  selectedOutputLanguage,
}: {
  chatId: string;
  userMessage: ChatMessage;
  previousMessages: ChatMessage[];
  selectedModelId: AppModelId;
  explicitlyRequestedTools: ToolName[] | null;
  userId: string | null;
  isAnonymous: boolean;
  isNewChat: boolean;
  allowedTools: ToolName[];
  abortController: AbortController;
  timeoutId: NodeJS.Timeout;
  mcpConnectors: McpConnector[];
  selectedMode: string;
  selectedComputeLevel: 3 | 5 | 7 | undefined;
  selectedOutputLanguage: string;
}): Promise<Response> {
  const log = createModuleLogger("api:chat:execute");
  const messageId = generateUUID();
  const streamId = generateUUID();

  if (!isAnonymous) {
    // Save placeholder assistant message immediately (needed for document creation)
    await saveMessage({
      id: messageId,
      chatId,
      message: {
        id: messageId,
        role: "assistant",
        parts: [],
        metadata: {
          createdAt: new Date(),
          parentMessageId: userMessage.id,
          selectedModel: selectedModelId,
          mode: selectedMode,
          computeLevel: selectedComputeLevel,
          outputLanguage: selectedOutputLanguage,
          selectedTool: undefined,
          activeStreamId: streamId,
        },
      },
    });
  }

  // Create throttled cancel check (max once per second) for authenticated users
  const onChunk =
    !isAnonymous && userId
      ? throttle(async () => {
          const canceledAt = await getMessageCanceledAt({ messageId });
          if (canceledAt) {
            abortController.abort();
          }
        }, 1000)
      : undefined;

  // Build the data stream that will emit tokens
  const stream = await createChatStream({
    messageId,
    chatId,
    userMessage,
    previousMessages,
    selectedModelId,
    explicitlyRequestedTools,
    userId,
    allowedTools,
    abortController,
    isAnonymous,
    isNewChat,
    timeoutId,
    mcpConnectors,
    streamId,
    selectedMode,
    selectedComputeLevel,
    selectedOutputLanguage,
    onChunk,
  });

  const publisher = redisPublisher;
  if (publisher) {
    after(async () => {
      try {
        const keyPattern = `${config.appPrefix}:resumable-stream:rs:sentinel:${streamId}*`;
        const keys = await publisher.keys(keyPattern);
        if (keys.length > 0) {
          await Promise.all(
            keys.map((key: string) => publisher.expire(key, 300))
          );
        }
      } catch (error) {
        log.error({ error }, "Failed to set TTL on stream keys");
      }
    });
  }

  const sseHeaders = {
    "Content-Type": "text/event-stream",
    "Cache-Control": "no-cache",
    Connection: "keep-alive",
  } as const;

  const streamContext = getStreamContext();
  const sseStream = () => stream.pipeThrough(new JsonToSseTransformStream());

  if (streamContext) {
    log.debug("Returning resumable stream");
    return new Response(
      await streamContext.resumableStream(streamId, sseStream),
      { headers: sseHeaders }
    );
  }

  return new Response(sseStream(), { headers: sseHeaders });
}

type SessionSetupResult =
  | { success: false; error: Response }
  | {
      success: true;
      userId: string | null;
      isAnonymous: boolean;
      anonymousSession: AnonymousSession | null;
      modelDefinition: AppModelDefinition;
    };

async function validateAndSetupSession({
  request,
  selectedModelId,
}: {
  request: NextRequest;
  selectedModelId: AppModelId;
}): Promise<SessionSetupResult> {
  const log = createModuleLogger("api:chat:setup");

  const session = await auth.api.getSession({ headers: await headers() });
  const userId = session?.user?.id ?? null;
  const isAnonymous = userId === null;

  let anonymousSession: AnonymousSession | null = null;

  if (userId) {
    const user = await getUserById({ userId });
    if (!user) {
      log.warn("User not found");
      return {
        success: false,
        error: new Response("User not found", { status: 404 }),
      };
    }
  } else {
    const result = await handleAnonymousSession({
      request,
      redis: redisPublisher,
      selectedModelId,
    });

    if (!result.success) {
      return result;
    }
    anonymousSession = result.session;
  }

  let modelDefinition: AppModelDefinition;
  try {
    modelDefinition = await getAppModelDefinition(selectedModelId);
  } catch {
    log.warn("Model not found");
    return {
      success: false,
      error: new Response("Model not found", { status: 404 }),
    };
  }

  return {
    success: true,
    userId,
    isAnonymous,
    anonymousSession,
    modelDefinition,
  };
}

async function prepareRequestContext({
  userMessage,
  chatId,
  isAnonymous,
  anonymousPreviousMessages,
  modelDefinition,
  explicitlyRequestedTools,
}: {
  userMessage: ChatMessage;
  chatId: string;
  isAnonymous: boolean;
  anonymousPreviousMessages: ChatMessage[];
  modelDefinition: AppModelDefinition;
  explicitlyRequestedTools: ToolName[] | null;
}): Promise<{
  previousMessages: ChatMessage[];
  allowedTools: ToolName[];
  error: Response | null;
}> {
  const log = createModuleLogger("api:chat:prepare");

  const allowedTools = determineAllowedTools({
    isAnonymous,
    modelDefinition,
    explicitlyRequestedTools,
  });

  // Validate input token limit (50k tokens for user message)
  const totalTokens = calculateMessagesTokens(
    await convertToModelMessages([userMessage])
  );

  if (totalTokens > MAX_INPUT_TOKENS) {
    log.warn({ totalTokens, MAX_INPUT_TOKENS }, "Token limit exceeded");
    const error = new ChatSDKError(
      "input_too_long:chat",
      `Message too long: ${totalTokens} tokens (max: ${MAX_INPUT_TOKENS})`
    );
    return {
      previousMessages: [],
      allowedTools: [],
      error: error.toResponse(),
    };
  }

  const messageThreadToParent = isAnonymous
    ? anonymousPreviousMessages
    : await getThreadUpToMessageId(
        chatId,
        userMessage.metadata.parentMessageId
      );

  const previousMessages = messageThreadToParent.slice(-5);
  log.debug({ allowedTools }, "allowed tools");

  return { previousMessages, allowedTools, error: null };
}

async function finalizeMessageAndCredits({
  messages,
  userId,
  isAnonymous,
  chatId,
  costAccumulator,
}: {
  messages: ChatMessage[];
  userId: string | null;
  isAnonymous: boolean;
  chatId: string;
  costAccumulator: CostAccumulator;
}): Promise<void> {
  const log = createModuleLogger("api:chat:finalize");

  try {
    const assistantMessage = messages.at(-1);

    if (!assistantMessage) {
      throw new Error("No assistant message found!");
    }

    if (!isAnonymous) {
      await updateMessage({
        id: assistantMessage.id,
        chatId,
        message: {
          ...assistantMessage,
          metadata: {
            ...assistantMessage.metadata,
            activeStreamId: null,
          },
        },
      });
    }

    // Get total cost from accumulator (includes all LLM calls + external API costs)
    const totalCost = await costAccumulator.getTotalCost();
    const entries = costAccumulator.getEntries();

    log.info({ entries }, "Cost accumulator entries");
    log.info({ totalCost }, "Cost accumulator total cost");

    // Deduct credits for authenticated users
    if (userId && !isAnonymous) {
      await deductCredits(userId, totalCost);
    }

    // Note: Anonymous credits are pre-deducted before streaming starts (cookies can't be set after response begins)
  } catch (error) {
    log.error({ error }, "Failed to save chat or finalize credits");
  }
}

export async function POST(request: NextRequest) {
  const log = createModuleLogger("api:chat");
  try {
    const {
      id: chatId,
      message: userMessage,
      prevMessages: anonymousPreviousMessages,
      projectId,
    }: {
      id: string;
      message: ChatMessage;
      prevMessages: ChatMessage[];
      projectId?: string;
    } = await request.json();

    if (!userMessage) {
      log.warn("No user message found");
      return new ChatSDKError("bad_request:api").toResponse();
    }

    // Extract selectedModel from user message metadata
    const selectedModelId = userMessage.metadata?.selectedModel as AppModelId;

    if (!selectedModelId) {
      log.warn("No selectedModel in user message metadata");
      return new ChatSDKError("bad_request:api").toResponse();
    }
    const selectedMode = resolveChatMode(userMessage.metadata?.mode);
    const selectedComputeLevel = resolveComputeLevel(
      userMessage.metadata?.computeLevel
    );
    const selectedOutputLanguage = resolveOutputLanguage(
      userMessage.metadata?.outputLanguage
    );
    const normalizedUserMessage: ChatMessage = {
      ...userMessage,
      metadata: {
        ...userMessage.metadata,
        mode: selectedMode,
        computeLevel: selectedComputeLevel,
        outputLanguage: selectedOutputLanguage,
      },
    };

    const sessionSetup = await validateAndSetupSession({
      request,
      selectedModelId,
    });

    if (!sessionSetup.success) {
      return sessionSetup.error;
    }

    const { userId, isAnonymous, anonymousSession, modelDefinition } =
      sessionSetup;

    const selectedTool = normalizedUserMessage.metadata.selectedTool ?? null;
    let isNewChat = false;

    // Handle authenticated user validation and credit check
    if (userId) {
      const result = await handleUserValidationAndCredits({
        chatId,
        userId,
        userMessage: normalizedUserMessage,
        projectId,
      });
      if ("error" in result) {
        return result.error;
      }
      isNewChat = result.isNewChat;
    } else if (anonymousSession) {
      // Pre-deduct credits for anonymous users (cookies must be set before streaming)
      await setAnonymousSession({
        ...anonymousSession,
        remainingCredits: anonymousSession.remainingCredits - 1,
      });
    }

    if (!OMNICHAT_MAIN_FLOW_ENABLED) {
      log.warn(
        "OmniChat main flow disabled by env; using local pipeline only"
      );
    } else {
      try {
        return await executeOmniChatRequest({
          chatId,
          userMessage: normalizedUserMessage,
          selectedModelId,
          selectedMode,
          selectedComputeLevel,
          selectedOutputLanguage,
          userId,
          isAnonymous,
          isNewChat,
        });
      } catch (error) {
        if (!OMNICHAT_LOCAL_PIPELINE_FALLBACK_ENABLED) {
          log.error(
            {
              err:
                error instanceof Error
                  ? { message: error.message, stack: error.stack }
                  : error,
            },
            "OmniChat main flow failed and local fallback is disabled"
          );
          return new Response(
            "OmniChat main flow failed and fallback is disabled",
            { status: 502 }
          );
        }

        log.warn(
          {
            err:
              error instanceof Error
                ? { message: error.message, stack: error.stack }
                : error,
          },
          "OmniChat main flow failed, falling back to local pipeline"
        );
      }
    }

    const explicitlyRequestedTools =
      determineExplicitlyRequestedTools(selectedTool);

    const [contextResult, mcpConnectors] = await Promise.all([
      prepareRequestContext({
        userMessage: normalizedUserMessage,
        chatId,
        isAnonymous,
        anonymousPreviousMessages,
        modelDefinition,
        explicitlyRequestedTools,
      }),
      config.ai.tools.mcp.enabled && userId && !isAnonymous
        ? getMcpConnectorsByUserId({ userId })
        : Promise.resolve([]),
    ]);

    if (contextResult.error) {
      return contextResult.error;
    }

    const { previousMessages, allowedTools } = contextResult;

    // Create AbortController with timeout
    const abortController = new AbortController();
    const timeoutId = setTimeout(() => {
      abortController.abort();
    }, 290_000); // 290 seconds

    return await executeChatRequest({
      chatId,
      userMessage: normalizedUserMessage,
      previousMessages,
      selectedModelId,
      explicitlyRequestedTools,
      userId,
      isAnonymous,
      isNewChat,
      allowedTools,
      abortController,
      timeoutId,
      mcpConnectors,
      selectedMode,
      selectedComputeLevel,
      selectedOutputLanguage,
    });
  } catch (error) {
    log.error(
      {
        err:
          error instanceof Error
            ? { message: error.message, stack: error.stack }
            : error,
      },
      "RESPONSE > POST /api/chat error"
    );
    return new Response("Internal Server Error", {
      status: 500,
    });
  }
}
