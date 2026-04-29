import type { ClientFamily, Env } from "./types";

function dayKey(now: Date) {
  return now.toISOString().slice(0, 10);
}

async function increment(env: Env, key: string, ttl?: number) {
  const raw = await env.MCP_USAGE.get(key);
  const current = Number.parseInt(raw ?? "0", 10);
  const next = Number.isFinite(current) ? current + 1 : 1;
  await env.MCP_USAGE.put(
    key,
    String(next),
    ttl ? { expirationTtl: ttl } : undefined,
  );
}

export async function recordCall(
  env: Env,
  ipHash: string,
  clientFamily: ClientFamily,
  toolName: string,
  now: Date = new Date(),
) {
  const day = dayKey(now);
  await Promise.all([
    increment(env, `mcp:tool:${toolName}`),
    increment(env, `mcp:tool:${toolName}:day:${day}`, 60 * 60 * 24 * 90),
    increment(env, `mcp:client:${clientFamily}:day:${day}`, 60 * 60 * 24 * 90),
    increment(env, `mcp:ip:${ipHash}:day:${day}`, 60 * 60 * 24 * 30),
  ]);
}

export async function usageSnapshot(env: Env) {
  const tools = [
    "parse_search",
    "parse_get_brand",
    "parse_get_prompt",
    "parse_get_stats",
    "search",
    "fetch",
  ];
  const byTool = await Promise.all(
    tools.map(async (name) => ({
      name,
      count: Number.parseInt(
        (await env.MCP_USAGE.get(`mcp:tool:${name}`)) ?? "0",
        10,
      ),
    })),
  );

  return {
    by_tool: byTool,
  };
}
