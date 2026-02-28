import { NextResponse } from "next/server";
import { backendFetch } from "@/lib/omnichat/backend-fetch";
import { requireAdminSession } from "@/lib/omnichat/route-auth";

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const authz = await requireAdminSession(request);
  if (authz instanceof NextResponse) {
    return authz;
  }

  const { id } = await params;

  try {
    const response = await backendFetch(`/runs/${id}/spans`);
    const payload = await response.json().catch(() => ({
      run_id: id,
      span_count: 0,
      spans: [],
    }));

    if (!response.ok) {
      return NextResponse.json(payload, { status: response.status });
    }

    const spans = Array.isArray(payload?.spans) ? payload.spans : [];
    return NextResponse.json({
      run_id: typeof payload?.run_id === "string" ? payload.run_id : id,
      span_count:
        typeof payload?.span_count === "number" ? payload.span_count : spans.length,
      spans,
    });
  } catch (error) {
    return NextResponse.json(
      { error: "Failed to fetch run spans", detail: String(error) },
      { status: 502 }
    );
  }
}
