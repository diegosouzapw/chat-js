/**
 * API Route: /api/omnichat/mode-model-configs/[id]
 * Proxies mode-config delete/update to backend.
 * NOTE: Backend uses /v1/mode-configs/{id} (not /v1/mode-model-configs/{id})
 */

import { NextResponse } from "next/server";
import { backendFetch } from "@/lib/omnichat/backend-fetch";

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  try {
    const res = await backendFetch(`/mode-configs/${id}`, {
      method: "DELETE",
    });
    if (!res.ok)
      return NextResponse.json(
        { error: "Delete failed" },
        { status: res.status }
      );
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
  const { id } = await params;
  try {
    const body = await request.json();
    const res = await backendFetch(`/mode-configs/${id}`, {
      method: "PUT",
      body: JSON.stringify(body),
    });
    const data = await res.json();
    return NextResponse.json(data, { status: res.status });
  } catch (error) {
    return NextResponse.json(
      { error: "Failed to update mode-config", detail: String(error) },
      { status: 502 }
    );
  }
}
