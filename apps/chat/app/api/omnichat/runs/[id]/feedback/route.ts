import { NextResponse } from "next/server";
import { backendFetch } from "@/lib/omnichat/backend-fetch";
import { requireAuthenticatedSession } from "@/lib/omnichat/route-auth";

function parseFeedbackParams(url: string): {
  comment?: string;
  rating?: number;
} {
  const params = new URL(url).searchParams;
  const ratingRaw = params.get("rating");
  const commentRaw = params.get("comment");

  const rating = ratingRaw ? Number.parseInt(ratingRaw, 10) : undefined;
  const comment = typeof commentRaw === "string" ? commentRaw.trim() : "";

  return {
    rating:
      typeof rating === "number" && Number.isFinite(rating)
        ? Math.max(1, Math.min(5, rating))
        : undefined,
    comment: comment.length > 0 ? comment : undefined,
  };
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const authz = await requireAuthenticatedSession(request);
  if (authz instanceof NextResponse) {
    return authz;
  }

  const { id } = await params;
  const { rating, comment } = parseFeedbackParams(request.url);

  if (!rating) {
    return NextResponse.json(
      { error: "Missing required rating query parameter" },
      { status: 400 }
    );
  }

  const backendParams = new URLSearchParams({ rating: String(rating) });
  if (comment) {
    backendParams.set("comment", comment);
  }

  try {
    const response = await backendFetch(
      `/chat/runs/${id}/feedback?${backendParams.toString()}`,
      { method: "POST" }
    );
    const payload = await response.json().catch(() => ({}));
    return NextResponse.json(payload, { status: response.status });
  } catch (error) {
    return NextResponse.json(
      { error: "Failed to submit run feedback", detail: String(error) },
      { status: 502 }
    );
  }
}
