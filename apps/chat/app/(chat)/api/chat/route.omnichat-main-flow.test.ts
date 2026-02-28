import { beforeEach, describe, expect, it, vi } from "vitest";

const executeRunMock = vi.fn();
const streamRunMock = vi.fn();
const translateEventToAnnotationMock = vi.fn();
const saveMessageMock = vi.fn();
const deductCreditsMock = vi.fn();
const loggerWarnMock = vi.fn();

vi.mock("next/headers", () => ({
  headers: vi.fn(async () => new Headers()),
}));

vi.mock("next/server", () => ({
  after: vi.fn((cb?: () => unknown) => cb?.()),
}));

vi.mock("redis", () => ({
  createClient: vi.fn(() => ({
    connect: vi.fn(async () => {}),
    keys: vi.fn(async () => []),
    expire: vi.fn(async () => 1),
  })),
}));

vi.mock("resumable-stream", () => ({
  createResumableStreamContext: vi.fn(() => null),
}));

vi.mock("throttleit", () => ({
  default: (fn: (...args: unknown[]) => unknown) => fn,
}));

vi.mock("@/lib/env", () => ({
  env: {
    REDIS_URL: undefined,
  },
}));

vi.mock("@/lib/config", () => ({
  config: {
    appPrefix: "test",
    anonymous: {
      credits: 10,
      availableTools: [],
      rateLimit: {
        requestsPerMinute: 60,
        requestsPerMonth: 200,
      },
    },
    ai: {
      anonymousModels: ["openai/gpt-4o-mini"],
      tools: {
        followupSuggestions: { enabled: false },
        mcp: { enabled: false },
      },
    },
  },
}));

vi.mock("@/lib/ai/app-models", () => ({
  getAppModelDefinition: vi.fn(async () => ({
    id: "openai/gpt-4o-mini",
    input: { text: true },
    output: { text: true },
  })),
}));

vi.mock("@/lib/logger", () => ({
  createModuleLogger: vi.fn(() => ({
    debug: vi.fn(),
    info: vi.fn(),
    warn: loggerWarnMock,
    error: vi.fn(),
  })),
}));

vi.mock("@/lib/utils", () => ({
  generateUUID: vi.fn(() => "uuid-fixed"),
}));

vi.mock("@/lib/db/queries", () => ({
  getChatById: vi.fn(),
  getMessageById: vi.fn(async () => []),
  getMessageCanceledAt: vi.fn(),
  getProjectById: vi.fn(),
  getUserById: vi.fn(),
  saveChat: vi.fn(),
  saveMessage: saveMessageMock,
  updateMessage: vi.fn(),
  updateMessageActiveStreamId: vi.fn(),
}));

vi.mock("@/lib/db/credits", () => ({
  canSpend: vi.fn(async () => true),
  deductCredits: deductCreditsMock,
}));

vi.mock("@/lib/omnichat", () => ({
  executeRun: executeRunMock,
  streamRun: streamRunMock,
  translateEventToAnnotation: translateEventToAnnotationMock,
}));

vi.mock("@/lib/auth", () => ({
  auth: {
    api: {
      getSession: vi.fn(async () => null),
    },
  },
}));

vi.mock("@/lib/anonymous-session-server", () => ({
  getAnonymousSession: vi.fn(async () => null),
  setAnonymousSession: vi.fn(async () => {}),
}));

vi.mock("@/lib/create-anonymous-session", () => ({
  createAnonymousSession: vi.fn(async () => ({
    id: "anon-1",
    createdAt: new Date("2026-02-28T00:00:00.000Z"),
    remainingCredits: 10,
  })),
}));

vi.mock("@/lib/utils/rate-limit", () => ({
  checkAnonymousRateLimit: vi.fn(async () => ({ success: true })),
  getClientIP: vi.fn(() => "127.0.0.1"),
}));

async function importRouteWithEnv(mainFlowStream: "true" | "false") {
  vi.resetModules();
  process.env.OMNICHAT_MAIN_FLOW_STREAM = mainFlowStream;
  process.env.OMNICHAT_MAIN_FLOW_ENABLED = "true";
  return import("./route");
}

async function readSseBody(response: Response): Promise<string> {
  const reader = response.body?.getReader();
  if (!reader) {
    return "";
  }

  const decoder = new TextDecoder();
  let output = "";

  for (let i = 0; i < 30; i++) {
    const result = await Promise.race([
      reader.read(),
      new Promise<never>((_, reject) => {
        setTimeout(() => reject(new Error("Timed out reading SSE body")), 250);
      }),
    ]);

    if (result.done) {
      break;
    }

    if (result.value) {
      output += decoder.decode(result.value, { stream: true });
      if (output.includes("data-appendMessage") || output.includes("[DONE]")) {
        break;
      }
    }
  }

  await reader.cancel();
  return output;
}

function buildUserMessage(text: string) {
  return {
    id: "user-message-id",
    role: "user" as const,
    parts: [{ type: "text" as const, text }],
    metadata: {
      createdAt: new Date("2026-02-28T12:00:00.000Z"),
      parentMessageId: null,
      selectedModel: "openai/gpt-4o-mini",
      mode: "auto",
      activeStreamId: null,
    },
  };
}

describe("executeOmniChatRequest", () => {
  beforeEach(() => {
    executeRunMock.mockReset();
    streamRunMock.mockReset();
    translateEventToAnnotationMock.mockReset();
    saveMessageMock.mockReset();
    deductCreditsMock.mockReset();
    loggerWarnMock.mockReset();
  });

  it(
    "persists assistant message and deducts credits on successful sync execution",
    async () => {
    const { executeOmniChatRequest } = await importRouteWithEnv("false");

    executeRunMock.mockResolvedValue({
      run_id: "run-sync-1",
      session_id: "session-1",
      mode: "auto",
      compute_level: 5,
      final_answer: "Resposta final",
      worker_responses: [],
      cost_usd: 3.25,
      latency_ms: 1200,
      models_used: ["model-a"],
    });

    const response = await executeOmniChatRequest({
      chatId: "chat-1",
      userMessage: buildUserMessage("Oi") as any,
      selectedModelId: "openai/gpt-4o-mini" as any,
      selectedMode: "auto",
      selectedComputeLevel: 5,
      selectedOutputLanguage: "pt-BR",
      userId: "user-1",
      isAnonymous: false,
      isNewChat: true,
    });

    const body = await readSseBody(response);

    expect(body).toContain("data-orchestration");
    expect(body).toContain("data-appendMessage");
    expect(saveMessageMock).toHaveBeenCalledTimes(1);
    expect(saveMessageMock).toHaveBeenCalledWith(
      expect.objectContaining({
        message: expect.objectContaining({
          metadata: expect.objectContaining({
            runId: "run-sync-1",
          }),
        }),
      })
    );
    expect(deductCreditsMock).toHaveBeenCalledWith("user-1", 3.25);
    },
    15_000
  );

  it(
    "falls back to sync executeRun when stream fails",
    async () => {
    const { executeOmniChatRequest } = await importRouteWithEnv("true");

    streamRunMock.mockImplementation(async function* () {
      yield {
        event: "run_started",
        run_id: "run-stream-1",
        data: { mode: "council" },
      };
      throw new Error("stream-failed");
    });

    translateEventToAnnotationMock.mockImplementation((event: any) => {
      if (event.event === "run_started") {
        return {
          type: "orchestration",
          data: {
            step: "run_started",
            message: "run started",
            mode: "council",
          },
        };
      }
      return null;
    });

    executeRunMock.mockResolvedValue({
      run_id: "run-sync-after-stream",
      session_id: "session-2",
      mode: "council",
      compute_level: 5,
      final_answer: "Resposta via fallback sync",
      worker_responses: [],
      cost_usd: 1.1,
      latency_ms: 2100,
      models_used: ["model-b", "model-c"],
    });

    const response = await executeOmniChatRequest({
      chatId: "chat-2",
      userMessage: buildUserMessage("Pergunta complexa") as any,
      selectedModelId: "openai/gpt-4o-mini" as any,
      selectedMode: "council",
      selectedComputeLevel: 5,
      selectedOutputLanguage: "pt-BR",
      userId: "user-2",
      isAnonymous: false,
      isNewChat: false,
    });

    const body = await readSseBody(response);

    expect(streamRunMock).toHaveBeenCalled();
    expect(executeRunMock).toHaveBeenCalled();
    expect(loggerWarnMock).toHaveBeenCalled();
    expect(body).toContain("data-orchestration");
    expect(body).toContain("Resposta via fallback sync");
    expect(saveMessageMock).toHaveBeenCalledWith(
      expect.objectContaining({
        message: expect.objectContaining({
          metadata: expect.objectContaining({
            runId: "run-sync-after-stream",
          }),
        }),
      })
    );
    expect(deductCreditsMock).toHaveBeenCalledWith("user-2", 1.1);
    },
    15_000
  );

  it(
    "propagates stream failure when sync fallback also fails",
    async () => {
    const { executeOmniChatRequest } = await importRouteWithEnv("true");

    streamRunMock.mockImplementation(async function* () {
      throw new Error("stream-failed-hard");
    });

    executeRunMock.mockRejectedValue(new Error("sync-failed-hard"));

    const response = await executeOmniChatRequest({
      chatId: "chat-3",
      userMessage: buildUserMessage("falha") as any,
      selectedModelId: "openai/gpt-4o-mini" as any,
      selectedMode: "auto",
      selectedComputeLevel: undefined,
      selectedOutputLanguage: "pt-BR",
      userId: "user-3",
      isAnonymous: false,
      isNewChat: false,
    });

    const body = await readSseBody(response);
    expect(body).toContain("\"type\":\"error\"");
    expect(body).toContain("sync-failed-hard");
    expect(saveMessageMock).not.toHaveBeenCalled();
    expect(deductCreditsMock).not.toHaveBeenCalled();
    },
    15_000
  );
});
