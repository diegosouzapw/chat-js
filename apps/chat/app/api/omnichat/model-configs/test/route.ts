import { NextResponse } from "next/server";
import { testModelConfig } from "@/lib/omnichat";
import { requireAdminSession } from "@/lib/omnichat/route-auth";

export async function POST(request: Request) {
  const authz = await requireAdminSession(request);
  if (authz instanceof NextResponse) {
    return authz;
  }

  try {
    const body = (await request.json()) as {
      model_id?: string;
      prompt?: string;
    };

    const modelId = body.model_id?.trim();
    if (!modelId) {
      return NextResponse.json(
        { error: "model_id is required" },
        { status: 400 }
      );
    }

    const payload = await testModelConfig({
      model_id: modelId,
      prompt: body.prompt,
    });
    return NextResponse.json(payload);
  } catch (error) {
    return NextResponse.json(
      { error: "Failed to test model", detail: String(error) },
      { status: 502 }
    );
  }
}
