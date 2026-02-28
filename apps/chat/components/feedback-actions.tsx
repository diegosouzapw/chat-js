import { useMessageById } from "@ai-sdk-tools/store";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { ThumbsDown, ThumbsUp } from "lucide-react";
import { toast } from "sonner";
import type { ChatMessage } from "@/lib/ai/types";
import type { Vote } from "@/lib/db/schema";
import { useSession } from "@/providers/session-provider";
import { useTRPC } from "@/trpc/react";
import { MessageAction as Action } from "./ai-elements/message";
import { RetryButton } from "./retry-button";
import { Tag } from "./tag";

export function FeedbackActions({
  chatId,
  messageId,
  vote,
  isReadOnly,
}: {
  chatId: string;
  messageId: string;
  vote: Vote | undefined;
  isReadOnly: boolean;
}) {
  const trpc = useTRPC();
  const queryClient = useQueryClient();
  const { data: session } = useSession();
  const message = useMessageById<ChatMessage>(messageId);
  const runId = message?.metadata?.runId;

  const isAuthenticated = !!session?.user;

  const voteMessageMutation = useMutation(
    trpc.vote.voteMessage.mutationOptions({
      onSuccess: () => {
        queryClient.invalidateQueries({
          queryKey: trpc.vote.getVotes.queryKey({ chatId }),
        });
      },
    })
  );

  const runFeedbackMutation = useMutation({
    mutationFn: async ({
      runId,
      rating,
    }: {
      runId: string;
      rating: 1 | 5;
    }) => {
      const params = new URLSearchParams({ rating: String(rating) });
      const response = await fetch(
        `/api/omnichat/runs/${runId}/feedback?${params.toString()}`,
        {
          method: "POST",
        }
      );
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) {
        const detail =
          typeof payload?.error === "string"
            ? payload.error
            : `HTTP ${response.status}`;
        throw new Error(detail);
      }
      return payload;
    },
  });

  const submitVote = async ({
    type,
    rating,
  }: {
    type: "down" | "up";
    rating: 1 | 5;
  }) => {
    await voteMessageMutation.mutateAsync({
      chatId,
      messageId,
      type,
    });

    if (!runId) {
      return;
    }

    try {
      await runFeedbackMutation.mutateAsync({ runId, rating });
    } catch {
      toast.error("Vote saved, but failed to sync run feedback.");
    }
  };

  if (isReadOnly || !isAuthenticated) {
    return null;
  }

  return (
    <>
      <Action
        className="pointer-events-auto! h-7 w-7 p-0 text-muted-foreground hover:bg-accent hover:text-accent-foreground"
        data-testid="message-downvote"
        disabled={vote && !vote.isUpvoted}
        onClick={() => {
          toast.promise(
            submitVote({ type: "down", rating: 1 }),
            {
              loading: runId
                ? "Downvoting response and syncing run feedback..."
                : "Downvoting Response...",
              success: "Downvoted Response!",
              error: "Failed to downvote response.",
            }
          );
        }}
        tooltip="Downvote Response"
      >
        <ThumbsDown size={14} />
      </Action>

      <Action
        className="pointer-events-auto! h-7 w-7 p-0 text-muted-foreground hover:bg-accent hover:text-accent-foreground"
        data-testid="message-upvote"
        disabled={vote?.isUpvoted}
        onClick={() => {
          toast.promise(
            submitVote({ type: "up", rating: 5 }),
            {
              loading: runId
                ? "Upvoting response and syncing run feedback..."
                : "Upvoting Response...",
              success: "Upvoted Response!",
              error: "Failed to upvote response.",
            }
          );
        }}
        tooltip="Upvote Response"
      >
        <ThumbsUp size={14} />
      </Action>

      <RetryButton messageId={messageId} />
      <SelectedModelId messageId={messageId} />
    </>
  );
}

function SelectedModelId({ messageId }: { messageId: string }) {
  const message = useMessageById<ChatMessage>(messageId);
  return message?.metadata?.selectedModel ? (
    <div className="ml-2 flex items-center">
      <Tag>{message.metadata.selectedModel}</Tag>
    </div>
  ) : null;
}
