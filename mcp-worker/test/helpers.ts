import type {
  Env,
  ExecutionContextLike,
  KVNamespaceLike,
  RateLimitBindingLike,
} from "../src/types";

export class MemoryKV implements KVNamespaceLike {
  readonly values = new Map<string, string>();

  async get(key: string) {
    return this.values.get(key) ?? null;
  }

  async put(key: string, value: string) {
    this.values.set(key, value);
  }

  async list(options?: { prefix?: string; limit?: number; cursor?: string }) {
    const keys = [...this.values.keys()]
      .filter((name) => !options?.prefix || name.startsWith(options.prefix))
      .slice(0, options?.limit ?? 1000)
      .map((name) => ({ name }));

    return { keys, list_complete: true };
  }
}

export class MemoryRateLimit implements RateLimitBindingLike {
  readonly keys: string[] = [];

  constructor(private readonly success = true) {}

  async limit(input: { key: string }) {
    this.keys.push(input.key);
    return { success: this.success };
  }
}

export class MemoryExecutionContext implements ExecutionContextLike {
  readonly promises: Promise<unknown>[] = [];

  waitUntil(promise: Promise<unknown>) {
    this.promises.push(promise);
  }

  async flush() {
    await Promise.all(this.promises);
  }
}

export function buildEnv(input?: {
  burst?: RateLimitBindingLike;
  originVerifySecret?: string;
  ratelimit?: MemoryKV;
  usage?: MemoryKV;
  vercelBypassSecret?: string;
}): Env {
  return {
    MCP_USAGE: input?.usage ?? new MemoryKV(),
    MCP_RATELIMIT: input?.ratelimit ?? new MemoryKV(),
    MCP_BURST: input?.burst ?? new MemoryRateLimit(),
    MCP_VERSION: "1.0.0-test",
    MCP_USER_AGENT: "parse-mcp-worker/1.0-test (+https://parse.gl/mcp)",
    PARSE_API_BASE_URL: "https://parse.test",
    WORKER_HASH_SALT: "test-salt",
    MCP_INTERNAL_SECRET: "internal-secret",
    CF_ORIGIN_VERIFY_SECRET: input?.originVerifySecret,
    VERCEL_AUTOMATION_BYPASS_SECRET: input?.vercelBypassSecret,
  };
}

export function mcpRequest(body: unknown, headers?: HeadersInit) {
  return new Request("https://mcp.parse.test/mcp", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "cf-connecting-ip": "203.0.113.10",
      ...headers,
    },
    body: JSON.stringify(body),
  });
}
