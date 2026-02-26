import { NextResponse } from "next/server";

const BACKEND_URL = process.env.OMNICHAT_API_URL || "http://localhost:8000";

export async function POST(
  _request: Request,
  { params }: { params: Promise<{ name: string; version: string }> }
) {
  const { name, version } = await params;
  try {
    const res = await fetch(
      `${BACKEND_URL}/v1/prompts/${name}/activate/${version}`,
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
