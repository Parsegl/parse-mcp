import { PROMPTS, getPrompt } from "./prompts";
import { RESOURCES, readResource } from "./resources";
import { TOOLS, callTool } from "./tools";
import type { JsonRpcRequest, JsonRpcResponse, RequestContext } from "./types";

const PROTOCOL_VERSION = "2025-06-18";

function response(id: JsonRpcRequest["id"], result: unknown): JsonRpcResponse {
  return { jsonrpc: "2.0", id: id ?? null, result };
}

function errorResponse(
  id: JsonRpcRequest["id"],
  code: number,
  message: string,
  data?: unknown,
): JsonRpcResponse {
  return {
    jsonrpc: "2.0",
    id: id ?? null,
    error: data ? { code, message, data } : { code, message },
  };
}

function paramsRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

export async function dispatchRpc(
  request: JsonRpcRequest,
  context: RequestContext,
): Promise<JsonRpcResponse | null> {
  if (request.jsonrpc !== "2.0") {
    return errorResponse(request.id, -32600, "Invalid JSON-RPC request");
  }

  if (request.id === undefined) {
    return null;
  }

  try {
    if (request.method === "initialize") {
      return response(request.id, {
        protocolVersion: PROTOCOL_VERSION,
        capabilities: {
          tools: {},
          resources: {},
          prompts: {},
        },
        serverInfo: {
          name: "parse",
          version: context.env.MCP_VERSION,
        },
      });
    }

    if (request.method === "tools/list") {
      return response(request.id, { tools: TOOLS });
    }

    if (request.method === "tools/call") {
      const params = paramsRecord(request.params);
      const name = typeof params.name === "string" ? params.name : "";
      const result = await callTool(context, name, params.arguments);
      return response(request.id, result);
    }

    if (request.method === "resources/list") {
      return response(request.id, { resources: RESOURCES });
    }

    if (request.method === "resources/read") {
      const params = paramsRecord(request.params);
      const uri = typeof params.uri === "string" ? params.uri : "";
      return response(request.id, await readResource(context, uri));
    }

    if (request.method === "prompts/list") {
      return response(request.id, { prompts: PROMPTS });
    }

    if (request.method === "prompts/get") {
      const params = paramsRecord(request.params);
      const name = typeof params.name === "string" ? params.name : "";
      return response(
        request.id,
        getPrompt(name, paramsRecord(params.arguments)),
      );
    }

    return errorResponse(
      request.id,
      -32601,
      `Method not found: ${request.method}`,
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : "Internal error";
    return errorResponse(request.id, -32000, message);
  }
}

export async function parseJsonRpcRequest(request: Request) {
  try {
    return {
      success: true as const,
      request: (await request.json()) as JsonRpcRequest,
    };
  } catch (error) {
    return {
      success: false as const,
      error: error instanceof Error ? error.message : String(error),
    };
  }
}
