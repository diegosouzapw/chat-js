import { NextResponse } from "next/server";
import { backendFetch } from "@/lib/omnichat/backend-fetch";

export async function GET() {
  try {
    const res = await backendFetch("/admin/stats");
    if (!res.ok)
      return NextResponse.json(
        { error: "Stats unavailable" },
        { status: res.status }
      );
    const data = await res.json();
    // Map backend field names to what frontend components expect
    const mapped = {
      ...data,
      total_sessions: data.total_sessions ?? data.active_sessions ?? 0,
      models_active: data.models_active ?? data.recent_runs?.length ?? 0,
      modes_available: data.modes_available ?? 9,
      uptime_seconds: data.uptime_seconds ?? 0,
    };
    return NextResponse.json(mapped);
  } catch (error) {
    return NextResponse.json(
      { error: "Failed to fetch admin stats", detail: String(error) },
      { status: 502 }
    );
  }
}
