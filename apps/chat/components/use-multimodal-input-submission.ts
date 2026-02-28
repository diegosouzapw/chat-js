"use client";

import type { UseChatHelpers } from "@ai-sdk/react";
import { useCallback, useMemo } from "react";
import type { ChatMessage } from "@/lib/ai/types";
import {
  attemptSubmitWithValidation,
  executeMessageSubmit,
  handleEnterSubmitWithValidation,
  resolveSubmissionState,
  type SubmissionState,
} from "./multimodal-input-submit";

type ExecuteMessageSubmitParams = Parameters<typeof executeMessageSubmit>[0];

interface UseMultimodalInputSubmissionParams {
  executeMessageSubmitParams: ExecuteMessageSubmitParams;
  handleSubmit: (submit: () => void, isEditMode: boolean) => void;
  isEditMode: boolean;
  isEmpty: boolean;
  isMobile: boolean;
  isModelDisallowedForAnonymous: boolean;
  onBlocked: (message: string) => void;
  onStop?: () => void;
  onStopStream?: () => void;
  status: UseChatHelpers<ChatMessage>["status"];
  uploadQueueLength: number;
}

interface UseMultimodalInputSubmissionResult {
  handleEnterSubmit: (event: { ctrlKey: boolean; shiftKey: boolean }) => boolean;
  handleStop: () => void;
  submission: SubmissionState;
  submitForm: () => void;
  submitWithValidation: () => boolean;
}

export function useMultimodalInputSubmission({
  executeMessageSubmitParams,
  handleSubmit,
  isEditMode,
  isEmpty,
  isMobile,
  isModelDisallowedForAnonymous,
  onBlocked,
  onStop,
  onStopStream,
  status,
  uploadQueueLength,
}: UseMultimodalInputSubmissionParams): UseMultimodalInputSubmissionResult {
  const submission = useMemo(
    () =>
      resolveSubmissionState({
        isEmpty,
        isModelDisallowedForAnonymous,
        status,
        uploadQueueLength,
      }),
    [isEmpty, isModelDisallowedForAnonymous, status, uploadQueueLength]
  );

  const coreSubmitLogic = useCallback(() => {
    executeMessageSubmit(executeMessageSubmitParams);
  }, [executeMessageSubmitParams]);

  const submitForm = useCallback(() => {
    handleSubmit(coreSubmitLogic, isEditMode);
  }, [handleSubmit, coreSubmitLogic, isEditMode]);

  const submitWithValidation = useCallback(() => {
    return attemptSubmitWithValidation({
      onBlocked,
      submission,
      submit: submitForm,
    });
  }, [onBlocked, submission, submitForm]);

  const handleEnterSubmit = useCallback(
    (event: { ctrlKey: boolean; shiftKey: boolean }) => {
      return handleEnterSubmitWithValidation({
        event,
        isMobile,
        onBlocked,
        submission,
        submit: submitForm,
      });
    },
    [isMobile, onBlocked, submission, submitForm]
  );

  const handleStop = useCallback(() => {
    onStopStream?.();
    onStop?.();
  }, [onStop, onStopStream]);

  return {
    handleEnterSubmit,
    handleStop,
    submission,
    submitForm,
    submitWithValidation,
  };
}
