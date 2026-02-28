import { NextResponse } from "next/server";
import { backendFetch } from "@/lib/omnichat/backend-fetch";
import { requireAdminSession } from "@/lib/omnichat/route-auth";

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const authz = await requireAdminSession(request);
  if (authz instanceof NextResponse) {
    return authz;
  }

  const { id } = await params;
  try {
    const res = await backendFetch(`/sessions/${id}`);
    const data = await res.json();
    return NextResponse.json(data, { status: res.status });
  } catch (error) {
    return NextResponse.json(
      { error: "Failed to fetch session", detail: String(error) },
      { status: 502 }
    );
  }
}

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const authz = await requireAdminSession(request);
  if (authz instanceof NextResponse) {
    return authz;
  }

  const { id } = await params;
  try {
    const res = await backendFetch(`/sessions/${id}`, {
      method: "DELETE",
    });
    if (!res.ok) {
      const data = await res.json().catch(() => ({ error: "Delete failed" }));
      return NextResponse.json(data, { status: res.status });
    }
    return NextResponse.json({ status: "deleted", session_id: id });
  } catch (error) {
    return NextResponse.json(
      { error: "Failed to delete session", detail: String(error) },
      { status: 502 }
    );
  }
}
