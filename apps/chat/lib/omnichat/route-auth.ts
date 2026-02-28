import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";

type AuthSession = Awaited<ReturnType<typeof auth.api.getSession>>;

function extractRole(session: AuthSession): string {
  const role = (session as { user?: { role?: unknown } } | null)?.user?.role;
  if (typeof role === "string" && role.trim().length > 0) {
    return role.trim().toLowerCase();
  }
  return "user";
}

function isAdminRole(role: string): boolean {
  return role === "admin" || role === "superadmin";
}

export async function requireAuthenticatedSession(
  request: Request
): Promise<AuthSession | NextResponse> {
  const session = await auth.api.getSession({ headers: request.headers });
  if (!session?.user) {
    return NextResponse.json(
      { error: "Authentication required" },
      { status: 401 }
    );
  }
  return session;
}

export async function requireAdminSession(
  request: Request
): Promise<AuthSession | NextResponse> {
  const session = await requireAuthenticatedSession(request);
  if (session instanceof NextResponse) {
    return session;
  }

  const role = extractRole(session);
  if (!isAdminRole(role)) {
    return NextResponse.json(
      { error: "Admin access required" },
      { status: 403 }
    );
  }

  return session;
}
