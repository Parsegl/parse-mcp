import type { Env } from "./types";

export class ParseApiError extends Error {
  constructor(
    message: string,
    readonly status: number,
    readonly body: string,
  ) {
    super(message);
    this.name = "ParseApiError";
  }
}

export class ParseApiTimeoutError extends Error {
  constructor(readonly timeoutMs: number) {
    super(`Parse upstream request timed out after ${timeoutMs}ms`);
    this.name = "ParseApiTimeoutError";
  }
}

function buildUrl(env: Env, path: string, params?: Record<string, unknown>) {
  const url = new URL(path, env.PARSE_API_BASE_URL);

  for (const [key, value] of Object.entries(params ?? {})) {
    if (value === undefined || value === null) {
      continue;
    }

    if (Array.isArray(value)) {
      if (value.length > 0) {
        url.searchParams.set(key, value.join(","));
      }
      continue;
    }

    url.searchParams.set(key, String(value));
  }

  return url;
}

export async function parseFetch<T>(
  env: Env,
  path: string,
  params?: Record<string, unknown>,
  options: { timeoutMs?: number } = {},
): Promise<T | null> {
  if (!path.startsWith("/api/public/") && !path.startsWith("/api/og/mcp/")) {
    throw new Error(`Unsupported Parse API path: ${path}`);
  }

  const headers: Record<string, string> = {
    Accept: "application/json",
    "User-Agent": env.MCP_USER_AGENT,
  };

  if (env.VERCEL_AUTOMATION_BYPASS_SECRET) {
    headers["x-vercel-protection-bypass"] = env.VERCEL_AUTOMATION_BYPASS_SECRET;
  }

  if (env.CF_ORIGIN_VERIFY_SECRET) {
    headers["x-parse-origin-verify"] = env.CF_ORIGIN_VERIFY_SECRET;
  }

  const controller = new AbortController();
  const timeout =
    options.timeoutMs && options.timeoutMs > 0
      ? setTimeout(() => controller.abort(), options.timeoutMs)
      : null;

  let response: Response;
  try {
    response = await fetch(buildUrl(env, path, params), {
      headers,
      signal: controller.signal,
    });
  } catch (error) {
    if (error instanceof Error && error.name === "AbortError") {
      throw new ParseApiTimeoutError(options.timeoutMs ?? 0);
    }
    throw error;
  } finally {
    if (timeout) {
      clearTimeout(timeout);
    }
  }

  if (response.status === 404) {
    return null;
  }

  if (!response.ok) {
    const body = await response.text();
    throw new ParseApiError(
      "Parse upstream request failed",
      response.status,
      body,
    );
  }

  return (await response.json()) as T;
}
