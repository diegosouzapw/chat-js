import { NextResponse } from "next/server";

const BACKEND_URL = process.env.OMNICHAT_API_URL || "http://localhost:8000";

export async function GET() {
  try {
    const res = await fetch(`${BACKEND_URL}/v1/admin/stats`, {
      cache: "no-store",
    });
    if (!res.ok)
      return NextResponse.json(
        { error: "Stats unavailable" },
        { status: res.status }
      );
    const data = await res.json();
    return NextResponse.json(data);
  } catch (error) {
    return NextResponse.json(
      { error: "Failed to fetch admin stats", detail: String(error) },
      { status: 502 }
    );
  }
}
