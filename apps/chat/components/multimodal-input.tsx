"use client";
import type { UseChatHelpers } from "@ai-sdk/react";
import { useChatActions, useChatStoreApi } from "@ai-sdk-tools/store";
import { useMutation } from "@tanstack/react-query";
import {
  memo,
  useCallback,
  useMemo,
} from "react";
import { toast } from "sonner";
import { PromptInput } from "@/components/ai-elements/prompt-input";
import { useSaveMessageMutation } from "@/hooks/chat-sync-hooks";
import { useArtifact } from "@/hooks/use-artifact";
import { useIsMobile } from "@/hooks/use-mobile";
import type { AppModelId } from "@/lib/ai/app-model-id";
import type { ChatMessage } from "@/lib/ai/types";
import { useLastMessageId } from "@/lib/stores/hooks-base";
import { useAddMessageToTree } from "@/lib/stores/hooks-threads";
import { ANONYMOUS_LIMITS } from "@/lib/types/anonymous";
import { cn } from "@/lib/utils";
import { useChatId } from "@/providers/chat-id-provider";
import { useChatInput } from "@/providers/chat-input-provider";
import { useChatModels } from "@/providers/chat-models-provider";
import { useSession } from "@/providers/session-provider";
import { useTRPC } from "@/trpc/react";
import { useMultimodalInputAttachments } from "./use-multimodal-input-attachments";
import { MultimodalInputPromptContent } from "./multimodal-input-prompt-content";
import { useMultimodalInputSubmission } from "./use-multimodal-input-submission";

function PureMultimodalInput({
  chatId,
  status,
  className,
  autoFocus = false,
  isEditMode = false,
  parentMessageId,
  onSendMessage,
}: {
  chatId: string;
  status: UseChatHelpers<ChatMessage>["status"];
  className?: string;
  autoFocus?: boolean;
  isEditMode?: boolean;
  parentMessageId: string | null;
  onSendMessage?: (message: ChatMessage) => void | Promise<void>;
}) {
  const storeApi = useChatStoreApi<ChatMessage>();
  const { artifact, closeArtifact } = useArtifact();
  const { data: session } = useSession();
  const trpc = useTRPC();
  const isMobile = useIsMobile();
  const { mutate: saveChatMessage } = useSaveMessageMutation();
  const addMessageToTree = useAddMessageToTree();
  useChatId();
  const {
    setMessages,
    sendMessage,
    stop: stopHelper,
  } = useChatActions<ChatMessage>();
  const lastMessageId = useLastMessageId();
  const {
    editorRef,
    selectedTool,
    setSelectedTool,
    attachments,
    setAttachments,
    selectedModelId,
    selectedMode,
    handleModeChange,
    selectedComputeLevel,
    selectedOutputLanguage,
    handleOutputLanguageChange,
    handleModelChange,
    getInputValue,
    handleInputChange,
    getInitialInput,
    isEmpty,
    handleSubmit,
  } = useChatInput();

  const isAnonymous = !session?.user;
  const isModelDisallowedForAnonymous =
    isAnonymous &&
    !(ANONYMOUS_LIMITS.AVAILABLE_MODELS as readonly AppModelId[]).includes(
      selectedModelId
    );
  const { getModelById } = useChatModels();
  const stopStreamMutation = useMutation(
    trpc.chat.stopStream.mutationOptions()
  );

  const {
    acceptAll,
    acceptFiles,
    acceptImages,
    attachmentsEnabled,
    fileInputRef,
    getInputProps,
    getRootProps,
    handleFileChange,
    handlePaste,
    isDragActive,
    removeAttachment,
    uploadQueue,
  } = useMultimodalInputAttachments({
    getModelById,
    onModelChange: handleModelChange,
    selectedModelId,
    sessionUser: session?.user,
    setAttachments,
    status,
  });

  const executeMessageSubmitParams = useMemo(
    () => ({
      addMessageToTree,
      artifactIsVisible: artifact.isVisible,
      artifactMessageId: artifact.messageId,
      attachments,
      chatId,
      closeArtifact,
      getInputValue,
      getMessages: () => storeApi.getState().getThrottledMessages(),
      isEditMode,
      isMobile,
      isUserAuthenticated: !!session?.user,
      onSendMessage,
      parentMessageId: isEditMode ? parentMessageId : lastMessageId,
      refocusEditor: () => editorRef.current?.focus(),
      saveChatMessage: ({
        chatId: targetChatId,
        message,
      }: {
        chatId: string;
        message: ChatMessage;
      }) => saveChatMessage({ chatId: targetChatId, message }),
      selectedComputeLevel,
      selectedModelId,
      selectedMode,
      selectedOutputLanguage,
      selectedTool,
      sendMessage,
      setMessages,
    }),
    [
      addMessageToTree,
      artifact.isVisible,
      artifact.messageId,
      attachments,
      chatId,
      closeArtifact,
      getInputValue,
      storeApi,
      isEditMode,
      isMobile,
      session?.user,
      onSendMessage,
      parentMessageId,
      lastMessageId,
      editorRef,
      saveChatMessage,
      selectedComputeLevel,
      selectedModelId,
      selectedMode,
      selectedOutputLanguage,
      selectedTool,
      sendMessage,
      setMessages,
    ]
  );

  const stopStream = useCallback(() => {
    if (session?.user && lastMessageId) {
      stopStreamMutation.mutate({ messageId: lastMessageId });
    }
  }, [lastMessageId, session?.user, stopStreamMutation]);

  const {
    submission,
    submitForm,
    submitWithValidation,
    handleEnterSubmit,
    handleStop,
  } = useMultimodalInputSubmission({
    executeMessageSubmitParams,
    handleSubmit,
    isEditMode,
    isEmpty,
    isMobile,
    isModelDisallowedForAnonymous,
    onBlocked: (message) => toast.error(message),
    onStop: stopHelper,
    onStopStream: stopStream,
    status,
    uploadQueueLength: uploadQueue.length,
  });

  return (
    <div className="relative">
      {attachmentsEnabled && (
        <input
          accept={acceptAll}
          className="pointer-events-none fixed -top-4 -left-4 size-0.5 opacity-0"
          multiple
          onChange={handleFileChange}
          ref={fileInputRef}
          tabIndex={-1}
          type="file"
        />
      )}

      <div className="relative">
        <PromptInput
          className={cn(
            "@container relative transition-colors",
            isDragActive && "border-blue-500 bg-blue-50 dark:bg-blue-950/20",
            className
          )}
          inputGroupClassName="dark:bg-muted bg-muted"
          {...getRootProps({ onError: undefined, onSubmit: undefined })}
          onSubmit={(_message, event) => {
            event.preventDefault();
            submitWithValidation();
          }}
        >
          <input {...getInputProps()} />
          <MultimodalInputPromptContent
            acceptAll={acceptAll}
            acceptFiles={acceptFiles}
            acceptImages={acceptImages}
            attachments={attachments}
            attachmentsEnabled={attachmentsEnabled}
            autoFocus={autoFocus}
            editorRef={editorRef}
            fileInputRef={fileInputRef}
            getInitialInput={getInitialInput}
            handleEnterSubmit={handleEnterSubmit}
            handleInputChange={handleInputChange}
            handleStop={handleStop}
            handleModeChange={handleModeChange}
            handleModelChange={handleModelChange}
            handleOutputLanguageChange={handleOutputLanguageChange}
            handlePaste={handlePaste}
            isDragActive={isDragActive}
            isEditMode={isEditMode}
            isMobile={isMobile}
            isModelDisallowedForAnonymous={isModelDisallowedForAnonymous}
            parentMessageId={parentMessageId}
            removeAttachment={removeAttachment}
            selectedModelId={selectedModelId}
            selectedMode={selectedMode}
            selectedOutputLanguage={selectedOutputLanguage}
            selectedTool={selectedTool}
            setSelectedTool={setSelectedTool}
            status={status}
            submission={submission}
            submitForm={submitForm}
            uploadQueue={uploadQueue}
          />
        </PromptInput>
      </div>
    </div>
  );
}

export const MultimodalInput = memo(
  PureMultimodalInput,
  (prevProps, nextProps) => {
    if (prevProps.status !== nextProps.status) {
      return false;
    }
    if (prevProps.autoFocus !== nextProps.autoFocus) {
      return false;
    }
    if (prevProps.isEditMode !== nextProps.isEditMode) {
      return false;
    }
    if (prevProps.chatId !== nextProps.chatId) {
      return false;
    }
    if (prevProps.className !== nextProps.className) {
      return false;
    }
    if (prevProps.parentMessageId !== nextProps.parentMessageId) {
      return false;
    }
    if (prevProps.onSendMessage !== nextProps.onSendMessage) {
      return false;
    }
    return true;
  }
);
