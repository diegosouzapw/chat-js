import { NextResponse } from "next/server";
import { backendFetch } from "@/lib/omnichat/backend-fetch";
import { requireAdminSession } from "@/lib/omnichat/route-auth";

function parseLimit(url: string): number {
  const params = new URL(url).searchParams;
  const raw = params.get("limit");
  const parsed = Number.parseInt(raw ?? "50", 10);
  if (!Number.isFinite(parsed)) {
    return 50;
  }
  return Math.max(1, Math.min(200, parsed));
}

export async function GET(request: Request) {
  const authz = await requireAdminSession(request);
  if (authz instanceof NextResponse) {
    return authz;
  }

  const limit = parseLimit(request.url);

  try {
    const response = await backendFetch(`/chat/runs?limit=${limit}`);
    const payload = await response.json().catch(() => ({ runs: [] }));
    if (!response.ok) {
      return NextResponse.json(payload, { status: response.status });
    }

    const runs = Array.isArray(payload?.runs) ? payload.runs : [];
    return NextResponse.json({ runs });
  } catch (error) {
    return NextResponse.json(
      { error: "Failed to fetch runs", detail: String(error) },
      { status: 502 }
    );
  }
}
