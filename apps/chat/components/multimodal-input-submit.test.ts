import { beforeEach, describe, expect, it, vi } from "vitest";
import type { AppModelId } from "@/lib/ai/app-model-id";
import type { Attachment, UiToolName } from "@/lib/ai/types";

vi.mock("@/lib/utils", () => ({
  generateUUID: vi.fn(() => "test-uuid"),
}));

import {
  attemptSubmitWithValidation,
  buildUserMessage,
  executeMessageSubmit,
  handleEnterSubmitWithValidation,
  resolveSubmissionState,
  updateChatUrlForSubmit,
} from "./multimodal-input-submit";

describe("multimodal-input-submit", () => {
  describe("attemptSubmitWithValidation", () => {
    it("submits when state is enabled", () => {
      const submit = vi.fn();
      const onBlocked = vi.fn();

      const result = attemptSubmitWithValidation({
        onBlocked,
        submission: { enabled: true },
        submit,
      });

      expect(result).toBe(true);
      expect(submit).toHaveBeenCalledTimes(1);
      expect(onBlocked).not.toHaveBeenCalled();
    });

    it("blocks and emits message when state is disabled", () => {
      const submit = vi.fn();
      const onBlocked = vi.fn();

      const result = attemptSubmitWithValidation({
        onBlocked,
        submission: { enabled: false, message: "Cannot submit" },
        submit,
      });

      expect(result).toBe(false);
      expect(submit).not.toHaveBeenCalled();
      expect(onBlocked).toHaveBeenCalledWith("Cannot submit");
    });
  });

  describe("handleEnterSubmitWithValidation", () => {
    it("submits on desktop when shift is not pressed", () => {
      const submit = vi.fn();
      const result = handleEnterSubmitWithValidation({
        event: { ctrlKey: false, shiftKey: false },
        isMobile: false,
        onBlocked: vi.fn(),
        submission: { enabled: true },
        submit,
      });

      expect(result).toBe(true);
      expect(submit).toHaveBeenCalledTimes(1);
    });

    it("does not submit on desktop when shift is pressed", () => {
      const submit = vi.fn();
      const result = handleEnterSubmitWithValidation({
        event: { ctrlKey: false, shiftKey: true },
        isMobile: false,
        onBlocked: vi.fn(),
        submission: { enabled: true },
        submit,
      });

      expect(result).toBe(false);
      expect(submit).not.toHaveBeenCalled();
    });

    it("submits on mobile only with ctrl+enter", () => {
      const submit = vi.fn();

      const ignored = handleEnterSubmitWithValidation({
        event: { ctrlKey: false, shiftKey: false },
        isMobile: true,
        onBlocked: vi.fn(),
        submission: { enabled: true },
        submit,
      });
      const accepted = handleEnterSubmitWithValidation({
        event: { ctrlKey: true, shiftKey: false },
        isMobile: true,
        onBlocked: vi.fn(),
        submission: { enabled: true },
        submit,
      });

      expect(ignored).toBe(false);
      expect(accepted).toBe(true);
      expect(submit).toHaveBeenCalledTimes(1);
    });
  });

  describe("resolveSubmissionState", () => {
    it("returns disabled for anonymous disallowed model", () => {
      const result = resolveSubmissionState({
        isEmpty: false,
        isModelDisallowedForAnonymous: true,
        status: "ready" as any,
        uploadQueueLength: 0,
      });

      expect(result).toEqual({
        enabled: false,
        message: "Log in to use this model",
      });
    });

    it("returns enabled when all checks pass", () => {
      const result = resolveSubmissionState({
        isEmpty: false,
        isModelDisallowedForAnonymous: false,
        status: "ready" as any,
        uploadQueueLength: 0,
      });

      expect(result).toEqual({ enabled: true });
    });
  });

  describe("updateChatUrlForSubmit", () => {
    beforeEach(() => {
      vi.unstubAllGlobals();
    });

    it("pushes /chat/{id} when currently on root", () => {
      const pushState = vi.fn();
      vi.stubGlobal("window", {
        history: { pushState },
        location: { pathname: "/" },
      });

      updateChatUrlForSubmit({
        chatId: "chat-1",
        isAuthenticated: true,
      });

      expect(pushState).toHaveBeenCalledWith({}, "", "/chat/chat-1");
    });

    it("pushes /project/{id}/chat/{chatId} on project root", () => {
      const pushState = vi.fn();
      vi.stubGlobal("window", {
        history: { pushState },
        location: { pathname: "/project/p1" },
      });

      updateChatUrlForSubmit({
        chatId: "chat-9",
        isAuthenticated: true,
      });

      expect(pushState).toHaveBeenCalledWith({}, "", "/project/p1/chat/chat-9");
    });
  });

  describe("buildUserMessage", () => {
    it("builds expected metadata and parts", () => {
      const attachments: Attachment[] = [
        {
          contentType: "application/pdf",
          name: "spec.pdf",
          url: "https://example.com/spec.pdf",
        },
      ];
      const message = buildUserMessage({
        attachments,
        input: "Explain this",
        parentMessageId: "parent-1",
        selectedComputeLevel: 5,
        selectedModelId: "test-model" as AppModelId,
        selectedMode: "council",
        selectedOutputLanguage: "pt-BR",
        selectedTool: "webSearch" as UiToolName,
      });

      expect(message.id).toBe("test-uuid");
      expect(message.role).toBe("user");
      expect(message.parts).toHaveLength(2);
      expect(message.metadata.mode).toBe("council");
      expect(message.metadata.computeLevel).toBe(5);
      expect(message.metadata.outputLanguage).toBe("pt-BR");
      expect(message.metadata.parentMessageId).toBe("parent-1");
      expect(message.metadata.selectedTool).toBe("webSearch");
    });
  });

  describe("executeMessageSubmit", () => {
    it("sends message and refocuses editor in non-edit desktop flow", () => {
      const addMessageToTree = vi.fn();
      const closeArtifact = vi.fn();
      const onSendMessage = vi.fn();
      const saveChatMessage = vi.fn();
      const sendMessage = vi.fn();
      const setMessages = vi.fn();
      const refocusEditor = vi.fn();

      executeMessageSubmit({
        addMessageToTree,
        artifactIsVisible: false,
        artifactMessageId: null,
        attachments: [],
        chatId: "chat-main",
        closeArtifact,
        getInputValue: () => "hello world",
        getMessages: () => [],
        isEditMode: false,
        isMobile: false,
        isUserAuthenticated: false,
        onSendMessage,
        parentMessageId: "parent-1",
        refocusEditor,
        saveChatMessage,
        selectedComputeLevel: 3,
        selectedModelId: "test-model" as AppModelId,
        selectedMode: "direct",
        selectedOutputLanguage: "pt-BR",
        selectedTool: null,
        sendMessage,
        setMessages,
      });

      expect(setMessages).not.toHaveBeenCalled();
      expect(closeArtifact).not.toHaveBeenCalled();
      expect(onSendMessage).toHaveBeenCalledTimes(1);
      expect(addMessageToTree).toHaveBeenCalledTimes(1);
      expect(saveChatMessage).toHaveBeenCalledTimes(1);
      expect(sendMessage).toHaveBeenCalledTimes(1);
      expect(refocusEditor).toHaveBeenCalledTimes(1);

      const sentMessage = sendMessage.mock.calls[0]?.[0];
      expect(sentMessage?.metadata?.parentMessageId).toBe("parent-1");
      expect(sentMessage?.metadata?.selectedModel).toBe("test-model");
    });

    it("trims edit-mode messages and skips refocus on mobile", () => {
      const messageList = [
        {
          id: "m1",
          metadata: {},
          parts: [],
          role: "user",
        },
        {
          id: "m2",
          metadata: {},
          parts: [],
          role: "assistant",
        },
      ] as any;

      const setMessages = vi.fn();
      const closeArtifact = vi.fn();
      const refocusEditor = vi.fn();

      executeMessageSubmit({
        addMessageToTree: vi.fn(),
        artifactIsVisible: true,
        artifactMessageId: "artifact-outdated",
        attachments: [],
        chatId: "chat-main",
        closeArtifact,
        getInputValue: () => "edit message",
        getMessages: () => messageList,
        isEditMode: true,
        isMobile: true,
        isUserAuthenticated: false,
        onSendMessage: vi.fn(),
        parentMessageId: null,
        refocusEditor,
        saveChatMessage: vi.fn(),
        selectedComputeLevel: null,
        selectedModelId: "test-model" as AppModelId,
        selectedMode: "auto",
        selectedOutputLanguage: "",
        selectedTool: null,
        sendMessage: vi.fn(),
        setMessages,
      });

      expect(setMessages).toHaveBeenCalledWith([]);
      expect(closeArtifact).toHaveBeenCalledTimes(1);
      expect(refocusEditor).not.toHaveBeenCalled();
    });
  });
});
