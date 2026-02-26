import { NextRequest, NextResponse } from "next/server";

const BACKEND_URL = process.env.OMNICHAT_API_URL || "http://localhost:8000";

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ name: string }> }
) {
  const { name } = await params;
  try {
    const res = await fetch(`${BACKEND_URL}/v1/prompts/${name}/versions`, {
      cache: "no-store",
    });
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
    const res = await fetch(`${BACKEND_URL}/v1/prompts/${name}/versions`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
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
