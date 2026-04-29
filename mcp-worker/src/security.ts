import type { ClientFamily } from "./types";

function toHex(bytes: ArrayBuffer) {
  return [...new Uint8Array(bytes)]
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("");
}

export async function hashIp(rawIp: string, salt: string): Promise<string> {
  if (!salt) {
    throw new Error("WORKER_HASH_SALT is required");
  }

  const bytes = new TextEncoder().encode(`${rawIp}:${salt}`);
  const digest = await crypto.subtle.digest("SHA-256", bytes);
  return toHex(digest);
}

export function detectClientFamily(userAgent: string | null): ClientFamily {
  const value = userAgent ?? "";

  if (/claude-code/i.test(value)) {
    return "claude-code";
  }
  if (/claude-desktop/i.test(value)) {
    return "claude-desktop";
  }
  if (/claude/i.test(value)) {
    return "claude-web";
  }
  if (/cursor/i.test(value)) {
    return "cursor";
  }
  if (/chatgpt|openai/i.test(value)) {
    return "chatgpt";
  }
  if (/windsurf|codeium/i.test(value)) {
    return "windsurf";
  }
  if (/zed/i.test(value)) {
    return "zed";
  }

  return "other";
}
