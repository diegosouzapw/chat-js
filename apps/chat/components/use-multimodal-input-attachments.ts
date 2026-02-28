"use client";

import type { UseChatHelpers } from "@ai-sdk/react";
import {
  type Dispatch,
  type SetStateAction,
  useCallback,
  useMemo,
  useRef,
} from "react";
import type { AppModelId } from "@/lib/ai/app-model-id";
import type { Attachment, ChatMessage } from "@/lib/ai/types";
import { config } from "@/lib/config";
import {
  getAcceptAll,
  getAcceptFiles,
  getAcceptImages,
} from "./multimodal-input-accept";
import { switchToCompatibleModel } from "./multimodal-input-model-switch";
import { useAttachmentUploads } from "./use-attachment-uploads";

type ModelDefinition = {
  input?: {
    image?: boolean;
    pdf?: boolean;
  };
  name?: string;
};

export function useMultimodalInputAttachments({
  getModelById,
  onModelChange,
  selectedModelId,
  sessionUser,
  setAttachments,
  status,
}: {
  getModelById: (modelId: AppModelId) => ModelDefinition | undefined;
  onModelChange: (modelId: AppModelId) => void;
  selectedModelId: AppModelId;
  sessionUser: unknown;
  setAttachments: Dispatch<SetStateAction<Attachment[]>>;
  status: UseChatHelpers<ChatMessage>["status"];
}) {
  const { maxBytes, maxDimension, acceptedTypes } = config.attachments;
  const attachmentsEnabled = config.features.attachments;
  const maxMB = Math.round(maxBytes / (1024 * 1024));

  const acceptImages = useMemo(
    () => getAcceptImages(acceptedTypes),
    [acceptedTypes]
  );
  const acceptFiles = useMemo(
    () => getAcceptFiles(acceptedTypes),
    [acceptedTypes]
  );
  const acceptAll = useMemo(() => getAcceptAll(acceptedTypes), [acceptedTypes]);

  const switchToPdfCompatibleModel = useCallback(() => {
    return switchToCompatibleModel({
      capability: "supports PDF",
      getModelById,
      modelId: config.ai.workflows.pdf,
      onModelChange,
    });
  }, [getModelById, onModelChange]);

  const switchToImageCompatibleModel = useCallback(() => {
    return switchToCompatibleModel({
      capability: "supports images",
      getModelById,
      modelId: config.ai.workflows.chatImageCompatible,
      onModelChange,
    });
  }, [getModelById, onModelChange]);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const attachmentUploads = useAttachmentUploads({
    acceptedTypes,
    attachmentsEnabled,
    getModelById,
    maxBytes,
    maxDimension,
    maxMB,
    selectedModelId,
    sessionUser,
    setAttachments,
    status,
    switchToImageCompatibleModel,
    switchToPdfCompatibleModel,
  });

  return {
    acceptAll,
    acceptFiles,
    acceptImages,
    attachmentsEnabled,
    fileInputRef,
    ...attachmentUploads,
  };
}
