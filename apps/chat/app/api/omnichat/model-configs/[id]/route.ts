import { NextResponse } from "next/server";
import { backendFetch } from "@/lib/omnichat/backend-fetch";
import { requireAdminSession } from "@/lib/omnichat/route-auth";

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
    const response = await backendFetch(`/model-configs/${id}`, {
      body: JSON.stringify(body),
      method: "PUT",
    });
    const payload = await response.json().catch(() => ({}));
    return NextResponse.json(payload, { status: response.status });
  } catch (error) {
    return NextResponse.json(
      { error: "Failed to update model-config", detail: String(error) },
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
    const response = await backendFetch(`/model-configs/${id}`, {
      method: "DELETE",
    });
    if (!response.ok) {
      const payload = await response.json().catch(() => ({ error: "Delete failed" }));
      return NextResponse.json(payload, { status: response.status });
    }
    return new Response(null, { status: 204 });
  } catch (error) {
    return NextResponse.json(
      { error: "Failed to delete model-config", detail: String(error) },
      { status: 502 }
    );
  }
}
