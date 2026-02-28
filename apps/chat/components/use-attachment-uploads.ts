"use client";

import type { UseChatHelpers } from "@ai-sdk/react";
import type React from "react";
import { useCallback, useState } from "react";
import { useDropzone } from "react-dropzone";
import { toast } from "sonner";
import { processFilesForUpload } from "@/lib/files/upload-prep";
import type { AppModelId } from "@/lib/ai/app-model-id";
import type { Attachment, ChatMessage } from "@/lib/ai/types";

type ModelWithInput = {
  input?: {
    image?: boolean;
    pdf?: boolean;
  };
};

interface UseAttachmentUploadsArgs {
  acceptedTypes: Record<string, string[]>;
  attachmentsEnabled: boolean;
  getModelById: (modelId: AppModelId) => ModelWithInput | undefined;
  maxBytes: number;
  maxDimension: number;
  maxMB: number;
  selectedModelId: AppModelId;
  sessionUser: unknown;
  setAttachments: React.Dispatch<React.SetStateAction<Attachment[]>>;
  status: UseChatHelpers<ChatMessage>["status"];
  switchToImageCompatibleModel: () => ModelWithInput | undefined;
  switchToPdfCompatibleModel: () => ModelWithInput | undefined;
}

export function useAttachmentUploads({
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
}: UseAttachmentUploadsArgs) {
  const [uploadQueue, setUploadQueue] = useState<string[]>([]);

  const processFiles = useCallback(
    async (files: File[]): Promise<File[]> => {
      const { processedImages, pdfFiles, stillOversized, unsupportedFiles } =
        await processFilesForUpload(files, { maxBytes, maxDimension });

      if (stillOversized.length > 0) {
        toast.error(
          `${stillOversized.length} file(s) exceed ${maxMB}MB after compression`
        );
      }
      if (unsupportedFiles.length > 0) {
        toast.error(
          `${unsupportedFiles.length} unsupported file type(s). Only images and PDFs are allowed`
        );
      }

      if (pdfFiles.length > 0 || processedImages.length > 0) {
        let currentModelDef = getModelById(selectedModelId);

        if (pdfFiles.length > 0 && !currentModelDef?.input?.pdf) {
          currentModelDef = switchToPdfCompatibleModel();
        }
        if (processedImages.length > 0 && !currentModelDef?.input?.image) {
          currentModelDef = switchToImageCompatibleModel();
        }
      }

      return [...processedImages, ...pdfFiles];
    },
    [
      maxBytes,
      maxDimension,
      maxMB,
      selectedModelId,
      switchToPdfCompatibleModel,
      switchToImageCompatibleModel,
      getModelById,
    ]
  );

  const uploadFile = useCallback(
    async (
      file: File
    ): Promise<{ url: string; name: string; contentType: string } | undefined> => {
      const formData = new FormData();
      formData.append("file", file);

      try {
        const response = await fetch("/api/files/upload", {
          method: "POST",
          body: formData,
        });

        if (response.ok) {
          const data: { url: string; pathname: string; contentType: string } =
            await response.json();
          const { url, pathname, contentType } = data;

          return {
            url,
            name: pathname,
            contentType,
          };
        }
        const { error } = (await response.json()) as { error?: string };
        toast.error(error);
      } catch (_error) {
        toast.error("Failed to upload file, please try again!");
      }
    },
    []
  );

  const uploadAcceptedFiles = useCallback(
    async (files: File[], options?: { successToast?: (count: number) => string }) => {
      const validFiles = await processFiles(files);
      if (validFiles.length === 0) {
        return;
      }

      setUploadQueue(validFiles.map((file) => file.name));

      try {
        const uploadPromises = validFiles.map((file) => uploadFile(file));
        const uploadedAttachments = await Promise.all(uploadPromises);
        const successfullyUploadedAttachments = uploadedAttachments.filter(
          (attachment) => attachment !== undefined
        );

        setAttachments((currentAttachments) => [
          ...currentAttachments,
          ...successfullyUploadedAttachments,
        ]);

        if (options?.successToast) {
          toast.success(options.successToast(successfullyUploadedAttachments.length));
        }
      } catch (error) {
        console.error("Error uploading files!", error);
      } finally {
        setUploadQueue([]);
      }
    },
    [processFiles, setAttachments, uploadFile]
  );

  const handleFileChange = useCallback(
    async (event: React.ChangeEvent<HTMLInputElement>) => {
      const files = Array.from(event.target.files || []);
      await uploadAcceptedFiles(files);
    },
    [uploadAcceptedFiles]
  );

  const handlePaste = useCallback(
    async (event: React.ClipboardEvent) => {
      if (status !== "ready" || !attachmentsEnabled) {
        return;
      }

      const clipboardData = event.clipboardData;
      if (!clipboardData) {
        return;
      }

      const files = Array.from(clipboardData.files);
      if (files.length === 0) {
        return;
      }

      event.preventDefault();

      if (!sessionUser) {
        toast.error("Sign in to attach files from clipboard");
        return;
      }

      await uploadAcceptedFiles(files, {
        successToast: (count) => `${count} file(s) pasted from clipboard`,
      });
    },
    [attachmentsEnabled, sessionUser, status, uploadAcceptedFiles]
  );

  const removeAttachment = useCallback(
    (attachmentToRemove: Attachment) => {
      setAttachments((currentAttachments) =>
        currentAttachments.filter(
          (attachment) => attachment.url !== attachmentToRemove.url
        )
      );
    },
    [setAttachments]
  );

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop: async (acceptedFiles) => {
      if (acceptedFiles.length === 0) {
        return;
      }

      if (!sessionUser) {
        toast.error("Sign in to attach files");
        return;
      }

      await uploadAcceptedFiles(acceptedFiles);
    },
    noClick: true,
    disabled: status !== "ready" || !attachmentsEnabled,
    noDrag: !attachmentsEnabled,
    accept: acceptedTypes,
  });

  return {
    getInputProps,
    getRootProps,
    handleFileChange,
    handlePaste,
    isDragActive,
    removeAttachment,
    uploadQueue,
  };
}
