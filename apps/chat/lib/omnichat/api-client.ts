/**
 * OmniChatAgent API Client Adapter
 *
 * Server-side client that bridges Chat.js to the OmniChatAgent backend.
 * Provides typed access to orchestration modes, model configs, and run management.
 */

import { createModuleLogger } from "@/lib/logger";

const log = createModuleLogger("omnichat/api-client");

// ── Types ─────────────────────────────────────────────

export interface OmniChatMode {
  name: string;
  value: string;
  description: string;
  workers: string;
  family: string;
}

export interface OmniChatModelConfig {
  id: string;
  model_id: string;
  role: string;
  priority: number;
  enabled: boolean;
  display_name?: string;
  notes?: string;
}

export interface OmniChatRunRequest {
  query: string;
  mode?: string;
  compute_level?: number;
  use_search?: boolean;
  use_rag?: boolean;
  models?: string[];
}

export interface OmniChatWorkerResponse {
  model: string;
  text: string;
  latency_ms: number;
  cost_usd: number;
}

export interface OmniChatRunResponse {
  run_id: string;
  session_id: string;
  mode: string;
  compute_level: number;
  final_answer: string;
  consensus_points?: string[];
  divergence_points?: string[];
  worker_responses: OmniChatWorkerResponse[];
  evidence?: Array<{ title: string; url: string; content: string }>;
  cost_usd: number;
  latency_ms: number;
  models_used: string[];
}

export interface OmniChatSSEEvent {
  event: string;
  run_id: string;
  data?: Record<string, unknown>;
}

export interface OmniChatHealthResponse {
  status: string;
  components: Record<string, { status: string; latency_ms?: number }>;
}

// ── Client ─────────────────────────────────────────────

function getBaseUrl(): string {
  return (
    process.env.OMNICHAT_API_URL ||
    process.env.OPENAI_COMPATIBLE_BASE_URL?.replace("/v1", "") ||
    "http://localhost:8000"
  );
}

function getApiKey(): string | undefined {
  return (
    process.env.OMNICHAT_API_KEY ||
    process.env.OPENAI_COMPATIBLE_API_KEY
  );
}

function getHeaders(): Record<string, string> {
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
  };
  const apiKey = getApiKey();
  if (apiKey) {
    headers["X-API-Key"] = apiKey;
  }
  return headers;
}

async function fetchApi<T>(
  path: string,
  options: RequestInit = {}
): Promise<T> {
  const url = `${getBaseUrl()}/v1${path}`;
  log.debug({ url, method: options.method || "GET" }, "API request");

  const response = await fetch(url, {
    ...options,
    headers: {
      ...getHeaders(),
      ...(options.headers || {}),
    },
  });

  if (!response.ok) {
    const errorText = await response.text().catch(() => "Unknown error");
    log.error(
      { status: response.status, url, error: errorText },
      "API request failed"
    );
    throw new Error(`OmniChatAgent API error (${response.status}): ${errorText}`);
  }

  return response.json() as Promise<T>;
}

// ── Mode shape transformer ────────────────────────────

const MODE_FAMILIES: Record<string, string> = {
  auto: "Auto",
  direct: "Direct",
  council: "Council",
  council_peer_review: "Council",
  debate: "Debate",
  self_refine: "Research",
  heavy: "Research",
  tree_of_thought: "Research",
  chain_of_agents: "Research",
};

const MODE_WORKERS: Record<string, string> = {
  auto: "varies",
  direct: "1",
  council: "3/5/7",
  council_peer_review: "3/5/7",
  debate: "3",
  self_refine: "1+1+1",
  heavy: "up to 7",
  tree_of_thought: "3+1+1",
  chain_of_agents: "N+1",
};

const MODE_NAMES: Record<string, string> = {
  auto: "Auto",
  direct: "Direct",
  council: "Council",
  council_peer_review: "Council Review",
  debate: "Debate",
  self_refine: "Self-Refine",
  heavy: "Heavy",
  tree_of_thought: "Tree of Thought",
  chain_of_agents: "Chain of Agents",
};

interface BackendMode {
  mode: string;
  description: string;
  default?: boolean;
  params?: Record<string, unknown>;
}

function transformMode(backendMode: BackendMode): OmniChatMode {
  const value = backendMode.mode;
  return {
    name: MODE_NAMES[value] || value,
    value,
    description: backendMode.description,
    workers: MODE_WORKERS[value] || "?",
    family: MODE_FAMILIES[value] || "Other",
  };
}

// ── API Methods ───────────────────────────────────────

/**
 * Get available orchestration modes.
 * Backend returns { modes: [{mode, description, ...}] }
 * We unwrap and transform to OmniChatMode[].
 */
export async function getModes(): Promise<OmniChatMode[]> {
  const raw = await fetchApi<{ modes: BackendMode[] }>("/modes");
  return (raw.modes || []).map(transformMode);
}

/**
 * Get backend health status
 */
export async function getHealth(): Promise<OmniChatHealthResponse> {
  return fetchApi<OmniChatHealthResponse>("/health");
}

/**
 * Get model configurations from the registry
 */
export async function getModelConfigs(
  filters?: { role?: string; enabled?: boolean }
): Promise<OmniChatModelConfig[]> {
  const params = new URLSearchParams();
  if (filters?.role) params.set("role", filters.role);
  if (filters?.enabled !== undefined)
    params.set("enabled", String(filters.enabled));

  const query = params.toString();
  return fetchApi<OmniChatModelConfig[]>(
    `/model-configs${query ? `?${query}` : ""}`
  );
}

/**
 * Execute a multi-agent orchestration run (synchronous)
 */
export async function executeRun(
  request: OmniChatRunRequest
): Promise<OmniChatRunResponse> {
  return fetchApi<OmniChatRunResponse>("/chat/runs", {
    method: "POST",
    body: JSON.stringify(request),
  });
}

/**
 * Execute a run with SSE streaming — returns an async iterator of events
 */
export async function* streamRun(
  request: OmniChatRunRequest
): AsyncGenerator<OmniChatSSEEvent> {
  const url = `${getBaseUrl()}/v1/chat/runs/stream`;
  log.debug({ url }, "Starting SSE stream");

  const response = await fetch(url, {
    method: "POST",
    headers: getHeaders(),
    body: JSON.stringify(request),
  });

  if (!response.ok || !response.body) {
    throw new Error(`Stream request failed: ${response.status}`);
  }

  const reader = response.body
    .pipeThrough(new TextDecoderStream())
    .getReader();

  let buffer = "";

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;

    buffer += value;
    const lines = buffer.split("\n");
    buffer = lines.pop() || "";

    let currentEvent = "";
    let currentData = "";

    for (const line of lines) {
      if (line.startsWith("event:")) {
        currentEvent = line.slice(6).trim();
      } else if (line.startsWith("data:")) {
        currentData = line.slice(5).trim();
      } else if (line === "" && currentData) {
        // Empty line means end of event
        try {
          const parsed = JSON.parse(currentData) as OmniChatSSEEvent;
          parsed.event = parsed.event || currentEvent;
          yield parsed;
        } catch {
          log.warn({ data: currentData }, "Failed to parse SSE event");
        }
        currentEvent = "";
        currentData = "";
      }
    }
  }
}

/**
 * Get dashboard statistics
 */
export async function getAdminStats(): Promise<Record<string, unknown>> {
  return fetchApi<Record<string, unknown>>("/admin/stats");
}

/**
 * Reload model registry from database
 */
export async function reloadModelRegistry(): Promise<{ status: string }> {
  return fetchApi<{ status: string }>("/model-configs/reload", {
    method: "POST",
  });
}

// ── Model Configs CRUD ────────────────────────────────

export async function createModelConfig(
  data: Omit<OmniChatModelConfig, "id">
): Promise<OmniChatModelConfig> {
  return fetchApi<OmniChatModelConfig>("/model-configs", {
    method: "POST",
    body: JSON.stringify(data),
  });
}

export async function updateModelConfig(
  id: string,
  data: Partial<OmniChatModelConfig>
): Promise<OmniChatModelConfig> {
  return fetchApi<OmniChatModelConfig>(`/model-configs/${id}`, {
    method: "PUT",
    body: JSON.stringify(data),
  });
}

export async function deleteModelConfig(id: string): Promise<void> {
  await fetchApi<void>(`/model-configs/${id}`, { method: "DELETE" });
}

export async function syncOmniRouteModels(): Promise<{ synced: number }> {
  return fetchApi<{ synced: number }>("/model-configs/sync-omniroute", {
    method: "POST",
  });
}

export async function testModelConfig(
  data: { model_id: string; prompt?: string }
): Promise<{ response: string; latency_ms: number }> {
  return fetchApi<{ response: string; latency_ms: number }>("/model-configs/test", {
    method: "POST",
    body: JSON.stringify(data),
  });
}

// ── Mode Configs CRUD ─────────────────────────────────

export interface OmniChatModeConfig {
  id: string;
  mode: string;
  model_id: string;
  role: string;
  priority: number;
  enabled: boolean;
  compute_level?: number;
  notes?: string;
}

export async function getModeConfigs(
  filters?: { mode?: string; enabled?: boolean }
): Promise<OmniChatModeConfig[]> {
  const params = new URLSearchParams();
  if (filters?.mode) params.set("mode", filters.mode);
  if (filters?.enabled !== undefined)
    params.set("enabled", String(filters.enabled));
  const query = params.toString();
  return fetchApi<OmniChatModeConfig[]>(
    `/mode-configs${query ? `?${query}` : ""}`
  );
}

export async function createModeConfig(
  data: Omit<OmniChatModeConfig, "id">
): Promise<OmniChatModeConfig> {
  return fetchApi<OmniChatModeConfig>("/mode-configs", {
    method: "POST",
    body: JSON.stringify(data),
  });
}

export async function updateModeConfig(
  id: string,
  data: Partial<OmniChatModeConfig>
): Promise<OmniChatModeConfig> {
  return fetchApi<OmniChatModeConfig>(`/mode-configs/${id}`, {
    method: "PUT",
    body: JSON.stringify(data),
  });
}

export async function deleteModeConfig(id: string): Promise<void> {
  await fetchApi<void>(`/mode-configs/${id}`, { method: "DELETE" });
}

export async function reloadModeConfigs(): Promise<{ status: string }> {
  return fetchApi<{ status: string }>("/mode-configs/reload", {
    method: "POST",
  });
}

// ── Prompts CRUD ──────────────────────────────────────

export interface OmniChatPrompt {
  id: string;
  name: string;
  template: string;
  version: number;
  is_active: boolean;
  description?: string;
  created_at?: string;
}

export async function getPrompts(): Promise<OmniChatPrompt[]> {
  return fetchApi<OmniChatPrompt[]>("/prompts");
}

export async function createPrompt(
  data: { name: string; template: string; description?: string }
): Promise<OmniChatPrompt> {
  return fetchApi<OmniChatPrompt>("/prompts", {
    method: "POST",
    body: JSON.stringify(data),
  });
}

export async function activatePromptVersion(
  name: string,
  version: number
): Promise<OmniChatPrompt> {
  return fetchApi<OmniChatPrompt>(`/prompts/${name}/versions/${version}/activate`, {
    method: "POST",
  });
}

export async function reloadPrompts(): Promise<{ status: string }> {
  return fetchApi<{ status: string }>("/prompts/reload", {
    method: "POST",
  });
}
