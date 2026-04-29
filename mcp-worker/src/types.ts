export type ClientFamily =
  | "claude-desktop"
  | "claude-code"
  | "claude-web"
  | "cursor"
  | "chatgpt"
  | "windsurf"
  | "zed"
  | "other";

export type KVNamespaceLike = {
  get(key: string): Promise<string | null>;
  put(
    key: string,
    value: string,
    options?: { expirationTtl?: number },
  ): Promise<void>;
  list?(options?: {
    prefix?: string;
    limit?: number;
    cursor?: string;
  }): Promise<{
    keys: Array<{ name: string }>;
    list_complete: boolean;
    cursor?: string;
  }>;
};

export type RateLimitBindingLike = {
  limit(input: { key: string }): Promise<{ success: boolean }>;
};

export type ExecutionContextLike = {
  waitUntil(promise: Promise<unknown>): void;
};

export type Env = {
  MCP_USAGE: KVNamespaceLike;
  MCP_RATELIMIT: KVNamespaceLike;
  MCP_BURST: RateLimitBindingLike;
  MCP_VERSION: string;
  MCP_USER_AGENT: string;
  PARSE_API_BASE_URL: string;
  WORKER_HASH_SALT: string;
  MCP_INTERNAL_SECRET?: string;
  CF_ORIGIN_VERIFY_SECRET?: string;
  VERCEL_AUTOMATION_BYPASS_SECRET?: string;
};

export type RequestContext = {
  env: Env;
  ctx: ExecutionContextLike;
  ipHash: string;
  clientFamily: ClientFamily;
};

export type JsonRpcRequest = {
  jsonrpc: "2.0";
  id?: string | number | null;
  method: string;
  params?: unknown;
};

export type JsonRpcResponse =
  | {
      jsonrpc: "2.0";
      id: string | number | null;
      result: unknown;
    }
  | {
      jsonrpc: "2.0";
      id: string | number | null;
      error: {
        code: number;
        message: string;
        data?: unknown;
      };
    };
