import { NextResponse } from "next/server";
import { backendFetch } from "@/lib/omnichat/backend-fetch";
import { requireAdminSession } from "@/lib/omnichat/route-auth";

export const dynamic = "force-dynamic";

function parseSince(url: string): number {
  const raw = new URL(url).searchParams.get("since");
  const parsed = Number.parseInt(raw ?? "0", 10);
  if (!Number.isFinite(parsed) || parsed < 0) {
    return 0;
  }
  return parsed;
}

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const authz = await requireAdminSession(request);
  if (authz instanceof NextResponse) {
    return authz;
  }

  const { id } = await params;
  const since = parseSince(request.url);

  try {
    const response = await backendFetch(`/chat/runs/${id}/events?since=${since}`, {
      headers: {
        Accept: "text/event-stream",
      },
    });

    if (!response.ok) {
      const payload = await response.text().catch(() => "Failed to fetch run events");
      return NextResponse.json(
        { error: payload || "Failed to fetch run events" },
        { status: response.status }
      );
    }

    if (!response.body) {
      return NextResponse.json(
        { error: "Backend run events stream is empty" },
        { status: 502 }
      );
    }

    return new Response(response.body, {
      status: response.status,
      headers: {
        "Cache-Control": "no-cache, no-transform",
        Connection: "keep-alive",
        "Content-Type":
          response.headers.get("content-type") ?? "text/event-stream; charset=utf-8",
        "X-Accel-Buffering": "no",
      },
    });
  } catch (error) {
    return NextResponse.json(
      { error: "Failed to stream run events", detail: String(error) },
      { status: 502 }
    );
  }
}
