import type { ModelId } from "@/lib/ai/app-models";
import type { Chat, DBMessage } from "@/lib/db/schema";
import type { UIChat } from "@/lib/types/ui-chat";
import type { ChatMessage, UiToolName } from "./ai/types";

type MessageAnnotation = {
  type: string;
  run_id?: string;
};

const OMNICHAT_RUN_ANNOTATION_TYPE = "omnichat_run";

function toAnnotations(metadata: ChatMessage["metadata"]): MessageAnnotation[] {
  const runId = metadata.runId?.trim();
  if (!runId) {
    return [];
  }
  return [{ type: OMNICHAT_RUN_ANNOTATION_TYPE, run_id: runId }];
}

export function extractRunIdFromAnnotations(
  annotations: unknown
): string | undefined {
  if (!Array.isArray(annotations)) {
    return undefined;
  }

  const match = annotations.find((item) => {
    if (!item || typeof item !== "object") {
      return false;
    }
    const value = item as MessageAnnotation;
    return value.type === OMNICHAT_RUN_ANNOTATION_TYPE;
  });

  if (!match || typeof match !== "object") {
    return undefined;
  }

  const runId = (match as MessageAnnotation).run_id;
  return typeof runId === "string" && runId.trim().length > 0
    ? runId
    : undefined;
}

// Helper functions for type conversion
export function dbChatToUIChat(chat: Chat): UIChat {
  return {
    id: chat.id,
    createdAt: chat.createdAt,
    updatedAt: chat.updatedAt,
    title: chat.title,
    visibility: chat.visibility,
    userId: chat.userId,
    isPinned: chat.isPinned,
    projectId: chat.projectId ?? null,
  };
}

function _dbMessageToChatMessage(message: DBMessage): ChatMessage {
  // Note: This function should not be used directly for messages with parts
  // Use getAllMessagesByChatId which reconstructs parts from Part table
  // Parts are now stored in Part table, not in Message.parts
  return {
    id: message.id,
    parts: [], // Parts are stored in Part table - use getAllMessagesByChatId instead
    role: message.role as ChatMessage["role"],
    metadata: {
      createdAt: message.createdAt,
      activeStreamId: message.activeStreamId,
      parentMessageId: message.parentMessageId,
      selectedModel: (message.selectedModel as ModelId) || ("" as ModelId),
      runId: extractRunIdFromAnnotations(message.annotations),
      selectedTool: (message.selectedTool as UiToolName | null) || undefined,
      usage: message.lastContext as ChatMessage["metadata"]["usage"],
    },
  };
}

export function chatMessageToDbMessage(
  message: ChatMessage,
  chatId: string
): DBMessage {
  const parentMessageId = message.metadata.parentMessageId || null;
  const selectedModel = message.metadata.selectedModel;

  // Ensure createdAt is a Date object
  let createdAt: Date;
  if (message.metadata?.createdAt) {
    createdAt =
      message.metadata.createdAt instanceof Date
        ? message.metadata.createdAt
        : new Date(message.metadata.createdAt);
  } else {
    createdAt = new Date();
  }

  // Parts are stored in Part table, not in Message.parts
  return {
    id: message.id,
    chatId,
    role: message.role,
    attachments: [],
    lastContext: message.metadata?.usage || null,
    createdAt,
    annotations: toAnnotations(message.metadata),
    parentMessageId,
    selectedModel,
    selectedTool: message.metadata?.selectedTool || null,
    activeStreamId: message.metadata?.activeStreamId || null,
    canceledAt: null,
  };
}
