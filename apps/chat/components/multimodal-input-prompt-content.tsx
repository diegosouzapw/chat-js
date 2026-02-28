"use client";

import type { UseChatHelpers } from "@ai-sdk/react";
import type React from "react";
import { ContextBar } from "@/components/context-bar";
import type { AppModelId } from "@/lib/ai/app-model-id";
import type { Attachment, ChatMessage, UiToolName } from "@/lib/ai/types";
import type { SubmissionState } from "./multimodal-input-submit";
import { LexicalChatInput } from "./lexical-chat-input";
import { ChatInputBottomControls } from "./multimodal-input-controls";
import { LimitDisplay } from "./upgrade-cta/limit-display";

interface MultimodalInputPromptContentProps {
  acceptAll: string;
  acceptFiles: string;
  acceptImages: string;
  attachments: Attachment[];
  attachmentsEnabled: boolean;
  autoFocus: boolean;
  fileInputRef: React.MutableRefObject<HTMLInputElement | null>;
  getInitialInput: () => string;
  handleEnterSubmit: (event: { ctrlKey: boolean; shiftKey: boolean }) => boolean;
  handleInputChange: (value: string) => void;
  handleModeChange: (mode: string) => void;
  handleModelChange: (modelId: AppModelId) => void;
  handleOutputLanguageChange: (language: string) => void;
  handlePaste: (event: React.ClipboardEvent<HTMLDivElement>) => void;
  handleStop: () => void;
  isDragActive: boolean;
  isEditMode: boolean;
  isMobile: boolean;
  parentMessageId: string | null;
  removeAttachment: (attachment: Attachment) => void;
  selectedModelId: AppModelId;
  selectedMode: string;
  selectedOutputLanguage: string;
  selectedTool: UiToolName | null;
  setSelectedTool: React.Dispatch<React.SetStateAction<UiToolName | null>>;
  status: UseChatHelpers<ChatMessage>["status"];
  submission: SubmissionState;
  submitForm: () => void;
  uploadQueue: string[];
  editorRef: React.RefObject<{
    clear: () => void;
    focus: () => void;
    getValue: () => string;
  } | null>;
  isModelDisallowedForAnonymous: boolean;
}

export function MultimodalInputPromptContent({
  acceptAll,
  acceptFiles,
  acceptImages,
  attachments,
  attachmentsEnabled,
  autoFocus,
  editorRef,
  fileInputRef,
  getInitialInput,
  handleEnterSubmit,
  handleInputChange,
  handleModeChange,
  handleModelChange,
  handleOutputLanguageChange,
  handlePaste,
  handleStop,
  isDragActive,
  isEditMode,
  isMobile,
  isModelDisallowedForAnonymous,
  parentMessageId,
  removeAttachment,
  selectedModelId,
  selectedMode,
  selectedOutputLanguage,
  selectedTool,
  setSelectedTool,
  status,
  submission,
  submitForm,
  uploadQueue,
}: MultimodalInputPromptContentProps) {
  return (
    <>
      {isDragActive && attachmentsEnabled && (
        <div className="absolute inset-0 z-10 flex items-center justify-center rounded-xl border-2 border-blue-500 border-dashed bg-blue-50/80 dark:bg-blue-950/40">
          <div className="font-medium text-blue-600 dark:text-blue-400">
            Drop images or PDFs here to attach
          </div>
        </div>
      )}

      {!isEditMode && (
        <LimitDisplay
          className="p-2"
          forceVariant={isModelDisallowedForAnonymous ? "model" : "credits"}
        />
      )}

      <ContextBar
        attachments={attachments}
        className="w-full"
        onRemoveAction={removeAttachment}
        uploadQueue={uploadQueue}
      />

      <LexicalChatInput
        autoFocus={autoFocus}
        className="max-h-[max(35svh,5rem)] min-h-[60px] overflow-y-scroll sm:min-h-[80px]"
        data-testid="multimodal-input"
        initialValue={getInitialInput()}
        onEnterSubmit={handleEnterSubmit}
        onInputChange={handleInputChange}
        onPaste={handlePaste}
        placeholder={
          isMobile
            ? "Send a message... (Ctrl+Enter to send)"
            : "Send a message..."
        }
        ref={editorRef}
      />

      <ChatInputBottomControls
        acceptAll={acceptAll}
        acceptFiles={acceptFiles}
        acceptImages={acceptImages}
        attachmentsEnabled={attachmentsEnabled}
        fileInputRef={fileInputRef}
        onModelChange={handleModelChange}
        onModeChange={handleModeChange}
        onOutputLanguageChange={handleOutputLanguageChange}
        onStop={handleStop}
        parentMessageId={parentMessageId}
        selectedModelId={selectedModelId}
        selectedMode={selectedMode}
        selectedOutputLanguage={selectedOutputLanguage}
        selectedTool={selectedTool}
        setSelectedTool={setSelectedTool}
        status={status}
        submission={submission}
        submitForm={submitForm}
      />
    </>
  );
}
