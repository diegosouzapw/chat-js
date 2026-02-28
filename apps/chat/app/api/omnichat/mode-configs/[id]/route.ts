import { NextResponse } from "next/server";
import { backendFetch } from "@/lib/omnichat/backend-fetch";
import { requireAdminSession } from "@/lib/omnichat/route-auth";

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
    const response = await backendFetch(`/mode-configs/${id}`, {
      method: "DELETE",
    });
    if (!response.ok) {
      return NextResponse.json(
        { error: "Delete failed" },
        { status: response.status }
      );
    }
    return NextResponse.json({ ok: true });
  } catch (error) {
    return NextResponse.json(
      { error: "Failed to delete", detail: String(error) },
      { status: 502 }
    );
  }
}

export async function PUT(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const authz = await requireAdminSession(request);
  if (authz instanceof NextResponse) {
    return authz;
  }

  const { id } = await params;
  try {
    const body = await request.json();
    const response = await backendFetch(`/mode-configs/${id}`, {
      body: JSON.stringify(body),
      method: "PUT",
    });
    const payload = await response.json().catch(() => ({}));
    return NextResponse.json(payload, { status: response.status });
  } catch (error) {
    return NextResponse.json(
      { error: "Failed to update mode-config", detail: String(error) },
      { status: 502 }
    );
  }
}
