import { NextResponse } from "next/server";
import { backendFetch } from "@/lib/omnichat/backend-fetch";

export async function POST() {
  try {
    const res = await backendFetch("/app-settings/provider/reset", {
      method: "POST",
    });
    const data = await res.json();
    return NextResponse.json(data);
  } catch (error) {
    return NextResponse.json(
      { error: "Failed to reset provider config", detail: String(error) },
      { status: 502 }
    );
  }
}
