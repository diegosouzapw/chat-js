import { NextResponse } from "next/server";
import { backendFetch } from "@/lib/omnichat/backend-fetch";
import { requireAdminSession } from "@/lib/omnichat/route-auth";

export async function GET(request: Request) {
  const authz = await requireAdminSession(request);
  if (authz instanceof NextResponse) {
    return authz;
  }

  try {
    const res = await backendFetch("/sessions");
    if (!res.ok) {
      return NextResponse.json([], { status: res.status });
    }
    const data = await res.json();
    // Backend returns { sessions: [...] } — unwrap for frontend
    const sessions = Array.isArray(data) ? data : (data?.sessions ?? []);
    return NextResponse.json(sessions);
  } catch (error) {
    return NextResponse.json(
      { error: "Failed to fetch sessions", detail: String(error) },
      { status: 502 }
    );
  }
}
