import { NextResponse } from "next/server";

const BACKEND_URL = process.env.OMNICHAT_API_URL || "http://localhost:8000";

export async function POST() {
  try {
    const res = await fetch(
      `${BACKEND_URL}/v1/app-settings/provider/reset`,
      { method: "POST" }
    );
    const data = await res.json();
    return NextResponse.json(data);
  } catch (error) {
    return NextResponse.json(
      { error: "Failed to reset provider config", detail: String(error) },
      { status: 502 }
    );
  }
}
