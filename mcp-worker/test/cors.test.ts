import { describe, expect, it } from "vitest";

import { isAllowedOrigin } from "../src/cors";

describe("MCP worker CORS", () => {
  it("allows missing origins and approved browser origins", () => {
    expect(isAllowedOrigin(null)).toBe(true);
    expect(isAllowedOrigin("https://claude.ai")).toBe(true);
    expect(isAllowedOrigin("https://chatgpt.com")).toBe(true);
    expect(isAllowedOrigin("https://platform.openai.com")).toBe(true);
    expect(isAllowedOrigin("https://app.cursor.com")).toBe(true);
    expect(isAllowedOrigin("http://localhost:6274")).toBe(true);
    expect(isAllowedOrigin("http://127.0.0.1:6274")).toBe(true);
  });

  it("rejects present non-allowlisted origins", () => {
    expect(isAllowedOrigin("https://evil.test")).toBe(false);
    expect(isAllowedOrigin("http://claude.ai")).toBe(false);
    expect(isAllowedOrigin("notaurl")).toBe(false);
  });
});
