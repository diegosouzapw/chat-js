import { NextResponse } from "next/server";

const BACKEND_URL = process.env.OMNICHAT_API_URL || "http://localhost:8000";

export async function GET() {
  try {
    const res = await fetch(`${BACKEND_URL}/v1/sessions`, {
      cache: "no-store",
    });
    if (!res.ok) return NextResponse.json([], { status: res.status });
    const data = await res.json();
    return NextResponse.json(data);
  } catch (error) {
    return NextResponse.json(
      { error: "Failed to fetch sessions", detail: String(error) },
      { status: 502 }
    );
  }
}
