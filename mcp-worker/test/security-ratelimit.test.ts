import { describe, expect, it } from "vitest";

import { rateLimit } from "../src/ratelimit";
import { detectClientFamily, hashIp } from "../src/security";
import { buildEnv, MemoryKV } from "./helpers";

describe("MCP worker security and rate limits", () => {
  it("hashes IPs before rate-limit storage", async () => {
    const hash = await hashIp("203.0.113.10", "salt");

    expect(hash).toHaveLength(64);
    expect(hash).not.toContain("203.0.113.10");
  });

  it("stores hourly rate-limit buckets by hash only", async () => {
    const ratelimit = new MemoryKV();
    const env = buildEnv({ ratelimit });
    const ipHash = await hashIp("203.0.113.10", env.WORKER_HASH_SALT);

    await expect(
      rateLimit(env, ipHash, new Date("2026-04-29T04:00:00.000Z")),
    ).resolves.toEqual({ limited: false });

    const key = [...ratelimit.values.keys()][0];
    expect(key).toContain(ipHash);
    expect(key).not.toContain("203.0.113.10");
  });

  it("canonicalizes user agents without retaining raw UA strings", () => {
    expect(detectClientFamily("Claude-Code/1.0")).toBe("claude-code");
    expect(detectClientFamily("Cursor/1.2")).toBe("cursor");
    expect(detectClientFamily("ChatGPT-User")).toBe("chatgpt");
    expect(detectClientFamily("Windsurf")).toBe("windsurf");
    expect(detectClientFamily("unknown client")).toBe("other");
  });
});
