/**
 * API Route: /api/omnichat/mode-configs
 * Proxies mode-configs CRUD to OmniChatAgent backend.
 */

import { NextResponse } from "next/server";
import {
  createModeConfig,
  getModeConfigs,
  reloadModeConfigs,
} from "@/lib/omnichat";
import { requireAdminSession } from "@/lib/omnichat/route-auth";

export async function GET(request: Request) {
  const authz = await requireAdminSession(request);
  if (authz instanceof NextResponse) {
    return authz;
  }

  const url = new URL(request.url);
  const mode = url.searchParams.get("mode") || undefined;
  const enabled = url.searchParams.has("enabled")
    ? url.searchParams.get("enabled") === "true"
    : undefined;

  try {
    const configs = await getModeConfigs({ mode, enabled });
    return NextResponse.json(configs);
  } catch (error) {
    return NextResponse.json(
      { error: "Failed to fetch mode configs", detail: String(error) },
      { status: 502 }
    );
  }
}

export async function POST(request: Request) {
  const authz = await requireAdminSession(request);
  if (authz instanceof NextResponse) {
    return authz;
  }

  try {
    const url = new URL(request.url);
    const action = url.searchParams.get("action");

    if (action === "reload") {
      const result = await reloadModeConfigs();
      return NextResponse.json(result);
    }

    const body = await request.json();
    const config = await createModeConfig(body);
    return NextResponse.json(config, { status: 201 });
  } catch (error) {
    return NextResponse.json(
      { error: "Failed to create mode config", detail: String(error) },
      { status: 502 }
    );
  }
}
