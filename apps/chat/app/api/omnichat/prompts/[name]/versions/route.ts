/**
 * API Route: /api/omnichat/prompts/[name]/versions
 * Lists versions and creates new prompt versions via backend.
 * GET: /v1/prompts/{name}/versions
 * POST: /v1/prompts (backend creates version via POST /v1/prompts with name in body)
 */

import { NextRequest, NextResponse } from "next/server";
import { backendFetch } from "@/lib/omnichat/backend-fetch";

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ name: string }> }
) {
  const { name } = await params;
  try {
    const res = await backendFetch(`/prompts/${name}/versions`);
    if (!res.ok) return NextResponse.json([], { status: res.status });
    const data = await res.json();
    return NextResponse.json(data);
  } catch (error) {
    return NextResponse.json(
      { error: "Failed to fetch versions", detail: String(error) },
      { status: 502 }
    );
  }
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ name: string }> }
) {
  const { name } = await params;
  try {
    const body = await request.json();
    // Backend expects POST /v1/prompts with { name, content, ... }
    const res = await backendFetch("/prompts", {
      method: "POST",
      body: JSON.stringify({ name, ...body }),
    });
    const data = await res.json();
    return NextResponse.json(data, { status: res.status });
  } catch (error) {
    return NextResponse.json(
      { error: "Failed to create version", detail: String(error) },
      { status: 502 }
    );
  }
}
