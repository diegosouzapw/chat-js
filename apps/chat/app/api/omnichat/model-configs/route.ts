/**
 * API Route: /api/omnichat/model-configs
 * Proxies model-configs CRUD to OmniChatAgent backend.
 */

import { NextResponse } from "next/server";
import {
  createModelConfig,
  getModelConfigs,
  reloadModelRegistry,
  syncOmniRouteModels,
} from "@/lib/omnichat";
import { requireAdminSession } from "@/lib/omnichat/route-auth";

export async function GET(request: Request) {
  const authz = await requireAdminSession(request);
  if (authz instanceof NextResponse) {
    return authz;
  }

  const url = new URL(request.url);
  const role = url.searchParams.get("role") || undefined;
  const enabled = url.searchParams.has("enabled")
    ? url.searchParams.get("enabled") === "true"
    : undefined;

  try {
    const configs = await getModelConfigs({ role, enabled });
    return NextResponse.json(configs);
  } catch (error) {
    return NextResponse.json(
      { error: "Failed to fetch model configs", detail: String(error) },
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
    const body = await request.json();

    // Special actions via ?action= param
    const url = new URL(request.url);
    const action = url.searchParams.get("action");

    if (action === "reload") {
      const result = await reloadModelRegistry();
      return NextResponse.json(result);
    }

    if (action === "sync") {
      const result = await syncOmniRouteModels();
      return NextResponse.json(result);
    }

    const config = await createModelConfig(body);
    return NextResponse.json(config, { status: 201 });
  } catch (error) {
    return NextResponse.json(
      { error: "Failed to create model config", detail: String(error) },
      { status: 502 }
    );
  }
}
