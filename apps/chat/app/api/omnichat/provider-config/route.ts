import { NextResponse } from "next/server";
import { backendFetch } from "@/lib/omnichat/backend-fetch";

export async function GET() {
  try {
    const res = await backendFetch("/app-settings/provider/config");
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
    const res = await backendFetch("/app-settings/provider/config", {
      method: "PUT",
      body: JSON.stringify(body),
    });
    const data = await res.json();
    return NextResponse.json(data);
  } catch (error) {
    return NextResponse.json(
      { error: "Failed to save provider config", detail: String(error) },
      { status: 502 }
    );
  }
}
