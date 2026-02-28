"use client";

import type { UseChatHelpers } from "@ai-sdk/react";
import { CameraIcon, FileIcon, ImageIcon, PlusIcon } from "lucide-react";
import type React from "react";
import { memo, useCallback, useState } from "react";
import { toast } from "sonner";
import {
  PromptInputButton,
  PromptInputFooter,
  PromptInputSubmit,
  PromptInputTools,
} from "@/components/ai-elements/prompt-input";
import { ContextUsageFromParent } from "@/components/context-usage";
import { useIsMobile } from "@/hooks/use-mobile";
import type { AppModelId } from "@/lib/ai/app-model-id";
import type { ChatMessage, UiToolName } from "@/lib/ai/types";
import { useSession } from "@/providers/session-provider";
import { ConnectorsDropdown } from "./connectors-dropdown";
import { ModelSelector } from "./model-selector";
import { OutputLanguageSelector } from "./output-language-selector";
import { ResponsiveTools } from "./responsive-tools";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "./ui/dropdown-menu";
import { Popover, PopoverContent, PopoverTrigger } from "./ui/popover";
import { Tooltip, TooltipContent, TooltipTrigger } from "./ui/tooltip";
import { LoginPrompt } from "./upgrade-cta/login-prompt";
import { ModeSelector } from "./mode-selector";

function PureAttachmentsButton({
  fileInputRef,
  status,
  acceptAll,
  acceptImages,
  acceptFiles,
}: {
  fileInputRef: React.MutableRefObject<HTMLInputElement | null>;
  status: UseChatHelpers<ChatMessage>["status"];
  acceptAll: string;
  acceptImages: string;
  acceptFiles: string;
}) {
  const { data: session } = useSession();
  const isMobile = useIsMobile();
  const isAnonymous = !session?.user;
  const [showLoginPopover, setShowLoginPopover] = useState(false);

  const triggerFileInput = useCallback(
    (accept: string, capture?: "environment" | "user") => {
      const input = fileInputRef.current;
      if (!input) {
        return;
      }
      input.accept = accept;
      if (capture) {
        input.capture = capture;
      } else {
        input.removeAttribute("capture");
      }
      input.click();
    },
    [fileInputRef]
  );

  const handleDesktopClick = (event: React.MouseEvent<HTMLButtonElement>) => {
    event.preventDefault();
    if (isAnonymous) {
      setShowLoginPopover(true);
      return;
    }
    triggerFileInput(acceptAll);
  };

  if (isMobile) {
    if (isAnonymous) {
      return (
        <Popover onOpenChange={setShowLoginPopover} open={showLoginPopover}>
          <PopoverTrigger asChild>
            <PromptInputButton
              className="size-8"
              data-testid="attachments-button"
              disabled={status !== "ready"}
              onClick={() => setShowLoginPopover(true)}
              variant="ghost"
            >
              <PlusIcon className="size-4" />
            </PromptInputButton>
          </PopoverTrigger>
          <PopoverContent align="start" className="w-80 p-0">
            <LoginPrompt
              description="You can attach images and PDFs to your messages for the AI to analyze."
              title="Sign in to attach files"
            />
          </PopoverContent>
        </Popover>
      );
    }

    return (
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <PromptInputButton
            className="size-8"
            data-testid="attachments-button"
            disabled={status !== "ready"}
            variant="ghost"
          >
            <PlusIcon className="size-4" />
          </PromptInputButton>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="start">
          <DropdownMenuItem onClick={() => triggerFileInput(acceptImages)}>
            <ImageIcon />
            Add photos
          </DropdownMenuItem>
          <DropdownMenuItem
            onClick={() => triggerFileInput(acceptImages, "environment")}
          >
            <CameraIcon />
            Take photo
          </DropdownMenuItem>
          <DropdownMenuItem onClick={() => triggerFileInput(acceptFiles)}>
            <FileIcon />
            Add files
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    );
  }

  return (
    <Popover onOpenChange={setShowLoginPopover} open={showLoginPopover}>
      <Tooltip>
        <TooltipTrigger asChild>
          <PopoverTrigger asChild>
            <PromptInputButton
              className="@[500px]:size-10 size-8"
              data-testid="attachments-button"
              disabled={status !== "ready"}
              onClick={handleDesktopClick}
              variant="ghost"
            >
              <PlusIcon className="size-4" />
            </PromptInputButton>
          </PopoverTrigger>
        </TooltipTrigger>
        <TooltipContent>Add Files</TooltipContent>
      </Tooltip>
      <PopoverContent align="end" className="w-80 p-0">
        <LoginPrompt
          description="You can attach images and PDFs to your messages for the AI to analyze."
          title="Sign in to attach files"
        />
      </PopoverContent>
    </Popover>
  );
}

const AttachmentsButton = memo(PureAttachmentsButton);

interface ChatInputBottomControlsProps {
  selectedModelId: AppModelId;
  onModelChange: (modelId: AppModelId) => void;
  selectedMode: string;
  onModeChange: (mode: string) => void;
  selectedOutputLanguage: string;
  onOutputLanguageChange: (language: string) => void;
  selectedTool: UiToolName | null;
  setSelectedTool: React.Dispatch<React.SetStateAction<UiToolName | null>>;
  fileInputRef: React.MutableRefObject<HTMLInputElement | null>;
  status: UseChatHelpers<ChatMessage>["status"];
  submitForm: () => void;
  submission: { enabled: boolean; message?: string };
  parentMessageId: string | null;
  acceptAll: string;
  acceptImages: string;
  acceptFiles: string;
  attachmentsEnabled: boolean;
  onStop: () => void;
}

function PureChatInputBottomControls({
  selectedModelId,
  onModelChange,
  selectedMode,
  onModeChange,
  selectedOutputLanguage,
  onOutputLanguageChange,
  selectedTool,
  setSelectedTool,
  fileInputRef,
  status,
  submitForm,
  submission,
  parentMessageId,
  acceptAll,
  acceptImages,
  acceptFiles,
  attachmentsEnabled,
  onStop,
}: ChatInputBottomControlsProps) {
  return (
    <PromptInputFooter className="flex w-full min-w-0 flex-row items-center justify-between @[500px]:gap-2 gap-1 border-t px-1 py-1 group-has-[>input]/input-group:pb-1 [.border-t]:pt-1">
      <PromptInputTools className="flex min-w-0 items-center @[500px]:gap-2 gap-1">
        {attachmentsEnabled && (
          <AttachmentsButton
            acceptAll={acceptAll}
            acceptFiles={acceptFiles}
            acceptImages={acceptImages}
            fileInputRef={fileInputRef}
            status={status}
          />
        )}
        <ModelSelector
          className="@[500px]:h-10 h-8 w-fit max-w-none shrink justify-start truncate @[500px]:px-3 px-2 @[500px]:text-sm text-xs"
          onModelChangeAction={onModelChange}
          selectedModelId={selectedModelId}
        />
        <ModeSelector
          selectedMode={selectedMode}
          onModeChange={onModeChange}
          className="@[500px]:h-10 h-8"
        />
        <OutputLanguageSelector
          className="@[500px]:h-10 h-8"
          onLanguageChange={onOutputLanguageChange}
          selectedLanguage={selectedOutputLanguage}
        />
        <ConnectorsDropdown />
        <ResponsiveTools
          selectedModelId={selectedModelId}
          setTools={setSelectedTool}
          tools={selectedTool}
        />
      </PromptInputTools>
      <div className="flex items-center gap-1">
        <ContextUsageFromParent
          className="@[500px]:block hidden"
          iconOnly
          parentMessageId={parentMessageId}
          selectedModelId={selectedModelId}
        />
        <PromptInputSubmit
          className={"@[500px]:size-10 size-8 shrink-0"}
          disabled={status === "ready" && !submission.enabled}
          onClick={(e) => {
            e.preventDefault();
            if (status === "streaming" || status === "submitted") {
              onStop();
            } else if (status === "ready" || status === "error") {
              if (!submission.enabled) {
                if (submission.message) {
                  toast.error(submission.message);
                }
                return;
              }
              submitForm();
            }
          }}
          status={status}
        />
      </div>
    </PromptInputFooter>
  );
}

export const ChatInputBottomControls = memo(PureChatInputBottomControls);
