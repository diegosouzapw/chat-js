/**
 * Shared server-side helper for proxying requests to OmniChatAgent backend.
 *
 * Ensures consistent base URL resolution and authentication headers
 * across all BFF proxy routes.
 */

function getBaseUrl(): string {
  return (
    process.env.OMNICHAT_API_URL ||
    process.env.OPENAI_COMPATIBLE_BASE_URL?.replace("/v1", "") ||
    "http://localhost:8000"
  );
}

function getHeaders(): Record<string, string> {
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
  };
  const apiKey =
    process.env.OMNICHAT_API_KEY || process.env.OPENAI_COMPATIBLE_API_KEY;
  if (apiKey) {
    headers["X-API-Key"] = apiKey;
  }
  return headers;
}

/**
 * Fetch from OmniChatAgent backend with correct URL and auth headers.
 * @param path - API path (e.g. "/sessions", "/admin/stats")
 * @param init - Additional fetch options
 * @returns Parsed JSON response
 */
export async function backendFetch<T>(
  path: string,
  init?: RequestInit
): Promise<Response> {
  const url = `${getBaseUrl()}/v1${path}`;
  return fetch(url, {
    ...init,
    headers: {
      ...getHeaders(),
      ...(init?.headers as Record<string, string> || {}),
    },
    cache: "no-store",
  });
}
