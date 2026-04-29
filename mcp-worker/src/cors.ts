const ALLOWED_SUFFIXES = [
  "claude.ai",
  "claude.com",
  "chatgpt.com",
  "chat.openai.com",
  "platform.openai.com",
  "cursor.com",
  "cursor.sh",
  "codeium.com",
  "zed.dev",
] as const;

const ALLOWED_HEADERS =
  "Content-Type, Accept, Authorization, Mcp-Session-Id, Last-Event-ID, MCP-Protocol-Version";
const EXPOSED_HEADERS = "Mcp-Session-Id, MCP-Protocol-Version";

function hostMatchesSuffix(hostname: string, suffix: string) {
  return hostname === suffix || hostname.endsWith(`.${suffix}`);
}

export function isAllowedOrigin(origin: string | null): boolean {
  if (!origin) {
    return true;
  }

  if (!URL.canParse(origin)) {
    return false;
  }

  const url = new URL(origin);

  if (
    (url.protocol === "http:" || url.protocol === "https:") &&
    (url.hostname === "localhost" || url.hostname === "127.0.0.1")
  ) {
    return true;
  }

  if (url.protocol !== "https:") {
    return false;
  }

  return ALLOWED_SUFFIXES.some((suffix) =>
    hostMatchesSuffix(url.hostname, suffix),
  );
}

export function corsHeaders(request: Request): Headers {
  const headers = new Headers();
  const origin = request.headers.get("Origin");

  if (origin && isAllowedOrigin(origin)) {
    headers.set("Access-Control-Allow-Origin", origin);
    headers.set("Vary", "Origin");
  }

  headers.set("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
  headers.set("Access-Control-Allow-Headers", ALLOWED_HEADERS);
  headers.set("Access-Control-Expose-Headers", EXPOSED_HEADERS);
  return headers;
}

export function applyCors(response: Response, request: Request): Response {
  const headers = new Headers(response.headers);
  corsHeaders(request).forEach((value, key) => {
    headers.set(key, value);
  });

  return new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers,
  });
}
