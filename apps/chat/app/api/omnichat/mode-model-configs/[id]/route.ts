import { NextResponse } from "next/server";

const BACKEND_URL = process.env.OMNICHAT_API_URL || "http://localhost:8000";

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  try {
    const res = await fetch(`${BACKEND_URL}/v1/mode-model-configs/${id}`, {
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
