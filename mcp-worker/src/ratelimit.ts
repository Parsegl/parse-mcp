import type { Env } from "./types";

const HOURLY_LIMIT = 25;
const WINDOW_SECONDS = 60 * 60;

function hourlyKey(ipHash: string, now: Date) {
  const hour = now.toISOString().slice(0, 13);
  return `mcp:ratelimit:${ipHash}:${hour}`;
}

export async function rateLimit(
  env: Env,
  ipHash: string,
  now: Date = new Date(),
): Promise<{ limited: false } | { limited: true; retryAfter: number }> {
  const key = hourlyKey(ipHash, now);
  const raw = await env.MCP_RATELIMIT.get(key);
  const count = Number.parseInt(raw ?? "0", 10);

  if (Number.isFinite(count) && count >= HOURLY_LIMIT) {
    return { limited: true, retryAfter: WINDOW_SECONDS };
  }

  const nextCount = Number.isFinite(count) ? count + 1 : 1;
  await env.MCP_RATELIMIT.put(key, String(nextCount), {
    expirationTtl: WINDOW_SECONDS * 2,
  });

  return { limited: false };
}

export function rateLimitResponse(
  _request: Request,
  retryAfter: number,
): Response {
  return new Response("Rate limit exceeded. Try again later.", {
    status: 429,
    headers: {
      "Content-Type": "text/plain; charset=utf-8",
      "Retry-After": String(retryAfter),
      "X-RateLimit-Limit": String(HOURLY_LIMIT),
      "X-RateLimit-Window": String(WINDOW_SECONDS),
      "X-RateLimit-Policy": "soft-hourly",
    },
  });
}

export const RATE_LIMITS = {
  hourlyLimit: HOURLY_LIMIT,
  windowSeconds: WINDOW_SECONDS,
} as const;
