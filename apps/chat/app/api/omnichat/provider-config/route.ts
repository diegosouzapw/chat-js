import { NextResponse } from "next/server";

const BACKEND_URL = process.env.OMNICHAT_API_URL || "http://localhost:8000";

export async function GET() {
  try {
    const res = await fetch(
      `${BACKEND_URL}/v1/app-settings/provider/config`,
      { cache: "no-store" }
    );
    const data = await res.json();
    return NextResponse.json(data);
  } catch (error) {
    return NextResponse.json(
      { error: "Failed to fetch provider config", detail: String(error) },
      { status: 502 }
    );
  }
}

export async function PUT(request: Request) {
  try {
    const body = await request.json();
    const res = await fetch(
      `${BACKEND_URL}/v1/app-settings/provider/config`,
      {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      }
    );
    const data = await res.json();
    return NextResponse.json(data);
  } catch (error) {
    return NextResponse.json(
      { error: "Failed to save provider config", detail: String(error) },
      { status: 502 }
    );
  }
}
