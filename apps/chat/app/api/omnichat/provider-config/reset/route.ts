import { NextResponse } from "next/server";
import { backendFetch } from "@/lib/omnichat/backend-fetch";
import { requireAdminSession } from "@/lib/omnichat/route-auth";

export async function POST(request: Request) {
  const authz = await requireAdminSession(request);
  if (authz instanceof NextResponse) {
    return authz;
  }

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
