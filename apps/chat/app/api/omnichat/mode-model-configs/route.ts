/**
 * API Route: /api/omnichat/mode-model-configs
 * Proxies mode-configs CRUD to OmniChatAgent backend.
 * NOTE: Backend uses /v1/mode-configs (not /v1/mode-model-configs)
 */

import { NextRequest, NextResponse } from "next/server";
import { backendFetch } from "@/lib/omnichat/backend-fetch";

export async function GET() {
  try {
    const res = await backendFetch("/mode-configs");
    if (!res.ok) return NextResponse.json([], { status: res.status });
    const data = await res.json();
    return NextResponse.json(data);
  } catch (error) {
    return NextResponse.json(
      { error: "Failed to fetch mode-configs", detail: String(error) },
      { status: 502 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const res = await backendFetch("/mode-configs", {
      method: "POST",
      body: JSON.stringify(body),
    });
    const data = await res.json();
    return NextResponse.json(data, { status: res.status });
  } catch (error) {
    return NextResponse.json(
      { error: "Failed to create mode-config", detail: String(error) },
      { status: 502 }
    );
  }
}
