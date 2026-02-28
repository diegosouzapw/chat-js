import type { UseChatHelpers } from "@ai-sdk/react";
import type { AppModelId } from "@/lib/ai/app-model-id";
import type { Attachment, ChatMessage, UiToolName } from "@/lib/ai/types";
import { generateUUID } from "@/lib/utils";

const PROJECT_ROUTE_REGEX = /^\/project\/([^/]+)$/;

export type SubmissionState =
  | { enabled: false; message: string }
  | { enabled: true };

export function attemptSubmitWithValidation({
  onBlocked,
  submission,
  submit,
}: {
  onBlocked: (message: string) => void;
  submission: SubmissionState;
  submit: () => void;
}): boolean {
  if (!submission.enabled) {
    if (submission.message) {
      onBlocked(submission.message);
    }
    return false;
  }
  submit();
  return true;
}

export function handleEnterSubmitWithValidation({
  event,
  isMobile,
  onBlocked,
  submission,
  submit,
}: {
  event: { ctrlKey: boolean; shiftKey: boolean };
  isMobile: boolean;
  onBlocked: (message: string) => void;
  submission: SubmissionState;
  submit: () => void;
}): boolean {
  const shouldSubmit = isMobile ? event.ctrlKey : !event.shiftKey;

  if (!shouldSubmit) {
    return false;
  }

  return attemptSubmitWithValidation({
    onBlocked,
    submission,
    submit,
  });
}

export function resolveSubmissionState({
  isEmpty,
  isModelDisallowedForAnonymous,
  status,
  uploadQueueLength,
}: {
  isEmpty: boolean;
  isModelDisallowedForAnonymous: boolean;
  status: UseChatHelpers<ChatMessage>["status"];
  uploadQueueLength: number;
}): SubmissionState {
  if (isModelDisallowedForAnonymous) {
    return { enabled: false, message: "Log in to use this model" };
  }
  if (status !== "ready" && status !== "error") {
    return {
      enabled: false,
      message: "Please wait for the model to finish its response!",
    };
  }
  if (uploadQueueLength > 0) {
    return {
      enabled: false,
      message: "Please wait for files to finish uploading!",
    };
  }
  if (isEmpty) {
    return {
      enabled: false,
      message: "Please enter a message before sending!",
    };
  }
  return { enabled: true };
}

export function updateChatUrlForSubmit({
  chatId,
  isAuthenticated,
}: {
  chatId: string;
  isAuthenticated: boolean;
}) {
  if (!isAuthenticated || typeof window === "undefined") {
    return;
  }

  const currentPath = window.location.pathname;
  if (currentPath === "/") {
    window.history.pushState({}, "", `/chat/${chatId}`);
    return;
  }

  const projectMatch = currentPath.match(PROJECT_ROUTE_REGEX);
  if (projectMatch) {
    const [, projectId] = projectMatch;
    window.history.pushState({}, "", `/project/${projectId}/chat/${chatId}`);
  }
}

export function trimMessagesForEditMode({
  artifactIsVisible,
  artifactMessageId,
  closeArtifact,
  getMessages,
  parentId,
  setMessages,
}: {
  artifactIsVisible: boolean;
  artifactMessageId: string | null;
  closeArtifact: () => void;
  getMessages: () => ChatMessage[];
  parentId: string | null;
  setMessages: (messages: ChatMessage[]) => void;
}) {
  if (parentId === null) {
    setMessages([]);
    if (artifactIsVisible) {
      closeArtifact();
    }
    return;
  }

  const throttledMessages = getMessages();
  const parentIndex = throttledMessages.findIndex((message) => message.id === parentId);
  if (parentIndex === -1) {
    return;
  }

  const messagesUpToParent = throttledMessages.slice(0, parentIndex + 1);
  if (
    artifactIsVisible &&
    artifactMessageId &&
    !messagesUpToParent.some((message) => message.id === artifactMessageId)
  ) {
    closeArtifact();
  }
  setMessages(messagesUpToParent);
}

export function buildUserMessage({
  attachments,
  input,
  parentMessageId,
  selectedComputeLevel,
  selectedModelId,
  selectedMode,
  selectedOutputLanguage,
  selectedTool,
}: {
  attachments: Attachment[];
  input: string;
  parentMessageId: string | null;
  selectedComputeLevel: 3 | 5 | 7 | null;
  selectedModelId: AppModelId;
  selectedMode: string;
  selectedOutputLanguage: string;
  selectedTool: UiToolName | null;
}): ChatMessage {
  return {
    id: generateUUID(),
    parts: [
      ...attachments.map((attachment) => ({
        mediaType: attachment.contentType,
        name: attachment.name,
        type: "file" as const,
        url: attachment.url,
      })),
      {
        text: input,
        type: "text" as const,
      },
    ],
    metadata: {
      activeStreamId: null,
      computeLevel: selectedComputeLevel ?? undefined,
      createdAt: new Date(),
      mode: selectedMode,
      outputLanguage: selectedOutputLanguage || undefined,
      parentMessageId,
      selectedModel: selectedModelId,
      selectedTool: selectedTool || undefined,
    },
    role: "user",
  };
}

export function executeMessageSubmit({
  addMessageToTree,
  artifactIsVisible,
  artifactMessageId,
  attachments,
  chatId,
  closeArtifact,
  getInputValue,
  getMessages,
  isEditMode,
  isMobile,
  isUserAuthenticated,
  onSendMessage,
  parentMessageId,
  refocusEditor,
  saveChatMessage,
  selectedComputeLevel,
  selectedModelId,
  selectedMode,
  selectedOutputLanguage,
  selectedTool,
  sendMessage,
  setMessages,
}: {
  addMessageToTree: (message: ChatMessage) => void;
  artifactIsVisible: boolean;
  artifactMessageId: string | null;
  attachments: Attachment[];
  chatId: string;
  closeArtifact: () => void;
  getInputValue: () => string;
  getMessages: () => ChatMessage[];
  isEditMode: boolean;
  isMobile: boolean;
  isUserAuthenticated: boolean;
  onSendMessage?: (message: ChatMessage) => void | Promise<void>;
  parentMessageId: string | null;
  refocusEditor: () => void;
  saveChatMessage: (params: { chatId: string; message: ChatMessage }) => void;
  selectedComputeLevel: 3 | 5 | 7 | null;
  selectedModelId: AppModelId;
  selectedMode: string;
  selectedOutputLanguage: string;
  selectedTool: UiToolName | null;
  sendMessage: (message: ChatMessage) => void;
  setMessages: (messages: ChatMessage[]) => void;
}) {
  const input = getInputValue();

  updateChatUrlForSubmit({ chatId, isAuthenticated: isUserAuthenticated });

  if (isEditMode) {
    trimMessagesForEditMode({
      artifactIsVisible,
      artifactMessageId,
      closeArtifact,
      getMessages,
      parentId: parentMessageId,
      setMessages,
    });
  }

  const message = buildUserMessage({
    attachments,
    input,
    parentMessageId,
    selectedComputeLevel,
    selectedModelId,
    selectedMode,
    selectedOutputLanguage,
    selectedTool,
  });

  onSendMessage?.(message);

  addMessageToTree(message);
  saveChatMessage({ message, chatId });
  sendMessage(message);

  if (!isMobile) {
    refocusEditor();
  }
}
