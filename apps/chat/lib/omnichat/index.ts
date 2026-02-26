/**
 * OmniChatAgent Integration — Barrel exports
 */
export {
  getModes, getHealth, getModelConfigs, executeRun, streamRun,
  getAdminStats, reloadModelRegistry,
  // Model configs CRUD
  createModelConfig, updateModelConfig, deleteModelConfig, syncOmniRouteModels, testModelConfig,
  // Mode configs CRUD
  getModeConfigs, createModeConfig, updateModeConfig, deleteModeConfig, reloadModeConfigs,
  // Prompts CRUD
  getPrompts, createPrompt, activatePromptVersion, reloadPrompts,
} from "./api-client";
export type {
  OmniChatMode,
  OmniChatModelConfig,
  OmniChatRunRequest,
  OmniChatRunResponse,
  OmniChatSSEEvent,
  OmniChatHealthResponse,
  OmniChatWorkerResponse,
  OmniChatModeConfig,
  OmniChatPrompt,
} from "./api-client";
export { translateEventToAnnotation, formatOrchestrationAsMarkdown } from "./sse-translator";
export type { OmniChatEventType } from "./sse-translator";
