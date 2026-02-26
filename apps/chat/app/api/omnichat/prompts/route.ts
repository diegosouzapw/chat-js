/**
 * API Route: /api/omnichat/prompts
 * Proxies prompt template CRUD to OmniChatAgent backend.
 */

import { NextResponse } from "next/server";
import { getPrompts, createPrompt, reloadPrompts } from "@/lib/omnichat";

export async function GET() {
  try {
    const prompts = await getPrompts();
    return NextResponse.json(prompts);
  } catch (error) {
    return NextResponse.json(
      { error: "Failed to fetch prompts", detail: String(error) },
      { status: 502 }
    );
  }
}

export async function POST(request: Request) {
  try {
    const url = new URL(request.url);
    const action = url.searchParams.get("action");

    if (action === "reload") {
      const result = await reloadPrompts();
      return NextResponse.json(result);
    }

    const body = await request.json();
    const prompt = await createPrompt(body);
    return NextResponse.json(prompt, { status: 201 });
  } catch (error) {
    return NextResponse.json(
      { error: "Failed to create prompt", detail: String(error) },
      { status: 502 }
    );
  }
}
