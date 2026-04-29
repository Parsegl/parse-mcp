import { applyCors, corsHeaders, isAllowedOrigin } from "./cors";
import { rateLimit, rateLimitResponse } from "./ratelimit";
import { dispatchRpc, parseJsonRpcRequest } from "./rpc";
import { detectClientFamily, hashIp } from "./security";
import { usageSnapshot } from "./usage";
import type { Env, ExecutionContextLike, RequestContext } from "./types";

function jsonResponse(value: unknown, request: Request, status = 200) {
  return applyCors(
    Response.json(value, {
      status,
      headers: {
        "Content-Type": "application/json; charset=utf-8",
      },
    }),
    request,
  );
}

function forbidden() {
  return new Response(null, { status: 403 });
}

async function handleInternalUsage(request: Request, env: Env) {
  const expected = env.MCP_INTERNAL_SECRET;
  const authorization = request.headers.get("Authorization");
  if (!expected || authorization !== `Bearer ${expected}`) {
    return new Response("Forbidden", { status: 403 });
  }

  return Response.json(await usageSnapshot(env));
}

async function handleMcp(
  request: Request,
  env: Env,
  ctx: ExecutionContextLike,
) {
  const origin = request.headers.get("Origin");
  if (!isAllowedOrigin(origin)) {
    return forbidden();
  }

  if (request.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: corsHeaders(request) });
  }

  if (request.method === "GET") {
    return jsonResponse({ status: "ok", name: "parse-public-mcp" }, request);
  }

  if (request.method !== "POST") {
    return jsonResponse({ error: "method_not_allowed" }, request, 405);
  }

  const rawIp = request.headers.get("cf-connecting-ip") ?? "unknown";
  const ipHash = await hashIp(rawIp, env.WORKER_HASH_SALT);
  const clientFamily = detectClientFamily(request.headers.get("User-Agent"));

  const burst = await env.MCP_BURST.limit({ key: ipHash });
  if (!burst.success) {
    return applyCors(rateLimitResponse(request, 10), request);
  }

  const hourly = await rateLimit(env, ipHash);
  if (hourly.limited) {
    return applyCors(rateLimitResponse(request, hourly.retryAfter), request);
  }

  const parsedRpc = await parseJsonRpcRequest(request);
  if (!parsedRpc.success) {
    return jsonResponse(
      {
        jsonrpc: "2.0",
        id: null,
        error: {
          code: -32700,
          message: "Parse error",
          data: { reason: parsedRpc.error },
        },
      },
      request,
      400,
    );
  }

  const context: RequestContext = { env, ctx, ipHash, clientFamily };
  const rpcResponse = await dispatchRpc(parsedRpc.request, context);
  if (!rpcResponse) {
    return applyCors(new Response(null, { status: 202 }), request);
  }

  return jsonResponse(rpcResponse, request);
}

export default {
  async fetch(request: Request, env: Env, ctx: ExecutionContextLike) {
    const url = new URL(request.url);

    if (url.pathname === "/_internal/usage") {
      return handleInternalUsage(request, env);
    }

    if (url.pathname !== "/mcp") {
      return new Response("Not found", { status: 404 });
    }

    return handleMcp(request, env, ctx);
  },
};
