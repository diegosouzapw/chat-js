/**
 * API Route: /api/omnichat/prompts/[name]/activate/[version]
 * Activates a specific prompt version via backend.
 * Backend endpoint: POST /v1/prompts/{name}/versions/{version}/activate
 */

import { NextResponse } from "next/server";
import { backendFetch } from "@/lib/omnichat/backend-fetch";

export async function POST(
  _request: Request,
  { params }: { params: Promise<{ name: string; version: string }> }
) {
  const { name, version } = await params;
  try {
    // Backend path: POST /v1/prompts/{name}/versions/{version}/activate
    const res = await backendFetch(
      `/prompts/${name}/versions/${version}/activate`,
      { method: "POST" }
    );
    if (!res.ok)
      return NextResponse.json(
        { error: "Activation failed" },
        { status: res.status }
      );
    const data = await res.json();
    return NextResponse.json(data);
  } catch (error) {
    return NextResponse.json(
      { error: "Failed to activate version", detail: String(error) },
      { status: 502 }
    );
  }
}
