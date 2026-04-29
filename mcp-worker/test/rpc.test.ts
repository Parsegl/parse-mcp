import { beforeEach, describe, expect, it, vi } from "vitest";

import worker from "../src/index";
import { hashIp } from "../src/security";
import {
  buildEnv,
  mcpRequest,
  MemoryExecutionContext,
  MemoryKV,
  MemoryRateLimit,
} from "./helpers";

const fetchMock = vi.hoisted(() => vi.fn());

vi.stubGlobal("fetch", fetchMock);

describe("MCP worker JSON-RPC", () => {
  beforeEach(() => {
    fetchMock.mockReset();
  });

  it("rejects non-allowlisted browser origins before rate limiting", async () => {
    const burst = new MemoryRateLimit();
    const env = buildEnv({ burst });
    const response = await worker.fetch(
      mcpRequest(
        { jsonrpc: "2.0", id: 1, method: "initialize" },
        { Origin: "https://evil.test" },
      ),
      env,
      new MemoryExecutionContext(),
    );

    expect(response.status).toBe(403);
    expect(burst.keys).toEqual([]);
  });

  it("allows missing Origin and returns initialize metadata", async () => {
    const response = await worker.fetch(
      mcpRequest({ jsonrpc: "2.0", id: 1, method: "initialize" }),
      buildEnv(),
      new MemoryExecutionContext(),
    );

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toMatchObject({
      jsonrpc: "2.0",
      id: 1,
      result: {
        protocolVersion: "2025-06-18",
        serverInfo: { name: "parse", version: "1.0.0-test" },
      },
    });
  });

  it("lists all primary tools and compatibility aliases", async () => {
    const response = await worker.fetch(
      mcpRequest({ jsonrpc: "2.0", id: 2, method: "tools/list" }),
      buildEnv(),
      new MemoryExecutionContext(),
    );
    const body = (await response.json()) as {
      result: { tools: Array<{ name: string }> };
    };

    expect(body.result.tools.map((tool) => tool.name)).toEqual([
      "parse_search",
      "parse_get_brand",
      "parse_get_prompt",
      "parse_get_stats",
      "search",
      "fetch",
    ]);
  });

  it("calls only public Parse routes with the worker user agent", async () => {
    fetchMock.mockResolvedValueOnce(
      Response.json({
        brands: [
          {
            id: "brand-1",
            name: "Stripe",
            slug: "stripe",
            domainName: "stripe.com",
            fetchId: "brand:stripe",
            displayTitle: "Stripe",
            displayDomain: "stripe.com",
            rankScore: 500,
            relevance: 1,
            matchReason: "Brand match for stripe.com",
          },
        ],
        prompts: [],
        niches: [],
        sources: [],
        totalCount: 1,
      }),
    );
    const usage = new MemoryKV();
    const env = buildEnv({
      originVerifySecret: "origin-secret",
      usage,
      vercelBypassSecret: "vercel-bypass",
    });
    const ctx = new MemoryExecutionContext();

    const response = await worker.fetch(
      mcpRequest({
        jsonrpc: "2.0",
        id: 3,
        method: "tools/call",
        params: {
          name: "parse_search",
          arguments: { query: "stripe", types: ["brands"], limit: 5 },
        },
      }),
      env,
      ctx,
    );
    await ctx.flush();

    expect(response.status).toBe(200);
    const call = fetchMock.mock.calls[0];
    expect(String(call[0])).toContain("/api/public/search");
    expect(String(call[0])).not.toContain("/api/autocomplete");
    expect(call[1].headers["User-Agent"]).toBe(env.MCP_USER_AGENT);
    expect(call[1].headers["x-parse-origin-verify"]).toBe("origin-secret");
    expect(call[1].headers["x-vercel-protection-bypass"]).toBe("vercel-bypass");
    expect(String(call[0])).not.toContain("vercel-bypass");

    const body = (await response.json()) as {
      result: { content: Array<{ text: string }> };
    };
    expect(body.result.content[0]?.text).toContain("Stripe");
    expect(body.result.content[0]?.text).toContain("Why it matters");
    expect(body.result.content[0]?.text).toContain("Fetch ID: brand:stripe");
    expect(body.result.content[0]?.text).toContain("utm_source=mcp");
    expect([...usage.values.keys()].join("\n")).not.toContain("203.0.113.10");
  });

  it("renders clean source domains and returns partial broad search output", async () => {
    fetchMock
      .mockResolvedValueOnce(
        Response.json({
          brands: [],
          prompts: [],
          niches: [],
          sources: [],
          totalCount: 0,
        }),
      )
      .mockRejectedValueOnce(new Error("slow prompts"))
      .mockResolvedValueOnce(
        Response.json({
          brands: [],
          prompts: [],
          niches: [],
          sources: [],
          totalCount: 0,
        }),
      )
      .mockResolvedValueOnce(
        Response.json({
          brands: [],
          prompts: [],
          niches: [],
          sources: [
            {
              id: "source-1",
              domain: "stripe.com",
              slug: "stripe-com",
              sourceType: "reference",
              fetchId: "source:stripe-com",
              displayTitle: "stripe.com",
              displaySubtitle: "reference",
              displayDomain: "stripe.com",
              matchReason: "Citation source Parse sees in AI answers",
            },
          ],
          totalCount: 1,
        }),
      );

    const response = await worker.fetch(
      mcpRequest({
        jsonrpc: "2.0",
        id: 8,
        method: "tools/call",
        params: {
          name: "parse_search",
          arguments: { query: "stripe", limit: 2 },
        },
      }),
      buildEnv(),
      new MemoryExecutionContext(),
    );

    const body = (await response.json()) as {
      result: { content: Array<{ text: string }> };
    };
    const text = body.result.content[0]?.text ?? "";
    expect(fetchMock).toHaveBeenCalledTimes(4);
    expect(text).toContain("stripe.com");
    expect(text).not.toContain("stripe\\.com");
    expect(text).toContain("Fetch ID: source:stripe-com");
    expect(text).toContain(
      'Prompts were slow or unavailable. Rerun with types: ["prompts"]',
    );
  });

  it("frames category searches as market research before literal brand matches", async () => {
    fetchMock
      .mockResolvedValueOnce(
        Response.json({
          brands: [
            {
              id: "brand-1",
              name: "CRM Software Blog",
              slug: "crmsoftwareblog-com",
              domainName: "crmsoftwareblog.com",
            },
          ],
          prompts: [],
          niches: [],
          sources: [],
          totalCount: 1,
        }),
      )
      .mockResolvedValueOnce(
        Response.json({
          brands: [],
          prompts: [
            {
              id: "prompt-1",
              content: "What is the best CRM software?",
              slug: "what-is-the-best-crm-software--prompt-1",
            },
          ],
          niches: [],
          sources: [],
          totalCount: 1,
        }),
      )
      .mockResolvedValueOnce(
        Response.json({
          brands: [],
          prompts: [],
          niches: [
            {
              id: "niche-1",
              name: "CRM Software Platforms",
              slug: "crm-software-platforms",
              industrySlug: "crm",
            },
          ],
          sources: [],
          totalCount: 1,
        }),
      )
      .mockResolvedValueOnce(
        Response.json({
          brands: [],
          prompts: [],
          niches: [],
          sources: [],
          totalCount: 0,
        }),
      );

    const response = await worker.fetch(
      mcpRequest({
        jsonrpc: "2.0",
        id: 10,
        method: "tools/call",
        params: {
          name: "parse_search",
          arguments: { query: "crm software", limit: 2 },
        },
      }),
      buildEnv(),
      new MemoryExecutionContext(),
    );

    const body = (await response.json()) as {
      result: { content: Array<{ text: string }> };
    };
    const text = body.result.content[0]?.text ?? "";
    expect(text).toContain("Market research read");
    expect(text.indexOf("Niches")).toBeLessThan(text.indexOf("Brands"));
    expect(text).toContain("Literal brand matches may include publishers");
  });

  it("enforces the soft hourly cap by hashed IP", async () => {
    const ratelimit = new MemoryKV();
    const env = buildEnv({ ratelimit });
    const ipHash = await hashIp("203.0.113.10", env.WORKER_HASH_SALT);
    ratelimit.values.set(`mcp:ratelimit:${ipHash}:2026-04-29T04`, "25");

    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-04-29T04:12:00.000Z"));
    const response = await worker.fetch(
      mcpRequest({ jsonrpc: "2.0", id: 4, method: "tools/list" }),
      env,
      new MemoryExecutionContext(),
    );
    vi.useRealTimers();

    expect(response.status).toBe(429);
    expect(response.headers.get("X-RateLimit-Policy")).toBe("soft-hourly");
  });

  it("returns resources, prompts, and JSON-shaped fetch alias results", async () => {
    fetchMock.mockResolvedValueOnce(
      Response.json({
        id: "brand-1",
        slug: "stripe",
        name: "Stripe",
        domain: "stripe.com",
        latestMetricsDate: "2026-04-28",
        summary: {
          parseScore: 82,
          strengthScore: 91,
          reachScore: 73,
          authorityScore: 80,
          promptCount: 42,
          citationDomainCount: 12,
          citationGapCount: 3,
          topPromptsPreview: [
            {
              id: "prompt-1",
              content: "best developer-friendly payment processor",
              visibility: 0.8,
              mentionRate: 0.7,
              avgPosition: 2,
            },
          ],
          topSourcesPreview: [
            {
              domain: "stripe.com",
              citationCount: 18,
              citationSharePercent: 0.4,
              promptCount: 7,
            },
          ],
          portfolioBrandsPreview: [
            { name: "Stripe Billing", slug: "stripe-billing" },
          ],
        },
      }),
    );
    const env = buildEnv();
    const ctx = new MemoryExecutionContext();

    const resources = await worker.fetch(
      mcpRequest({ jsonrpc: "2.0", id: 5, method: "resources/list" }),
      env,
      ctx,
    );
    const resourcesBody = (await resources.json()) as {
      result: { resources: Array<{ uri: string }> };
    };
    expect(
      resourcesBody.result.resources.map((resource) => resource.uri),
    ).toContain("parse://showcase-brands");

    const prompts = await worker.fetch(
      mcpRequest({
        jsonrpc: "2.0",
        id: 6,
        method: "prompts/get",
        params: {
          name: "audit-my-brand",
          arguments: { brand: "Stripe" },
        },
      }),
      env,
      ctx,
    );
    await expect(prompts.json()).resolves.toMatchObject({
      result: {
        messages: [{ role: "user" }],
      },
    });

    const fetchAlias = await worker.fetch(
      mcpRequest({
        jsonrpc: "2.0",
        id: 7,
        method: "tools/call",
        params: {
          name: "fetch",
          arguments: { id: "brand:stripe" },
        },
      }),
      env,
      ctx,
    );
    const body = (await fetchAlias.json()) as {
      result: { content: Array<{ text: string }> };
    };
    const parsed = JSON.parse(body.result.content[0]?.text ?? "{}") as {
      id: string;
      title: string;
      text: string;
      url: string;
      metadata: Record<string, unknown>;
    };

    expect(parsed).toMatchObject({
      id: "brand:stripe",
      title: "Stripe",
      metadata: { source: "parse-public-index" },
    });
    expect(parsed.text).toContain("AI visibility summary");
    expect(parsed.text).toContain(
      "fetch prompt:best-developer-friendly-payment-processor--prompt-1",
    );
    expect(parsed.text).toContain("developer-friendly");
    expect(parsed.text).not.toContain("developer\\-friendly");
    expect(parsed.text).toContain("Stripe Billing");
    expect(parsed.text).toContain("Priority actions");
    expect(parsed.text).toContain("Strengths");
    expect(parsed.text).not.toContain('"summary"');
    expect(parsed.url).toContain("utm_source=mcp");
  });

  it("explains dataset scale in stats output", async () => {
    fetchMock.mockResolvedValueOnce(
      Response.json({
        totalBrands: 1234,
        totalPrompts: 567,
        totalCitations: 8901,
        lastUpdated: "2026-04-29T00:00:00.000Z",
      }),
    );

    const response = await worker.fetch(
      mcpRequest({
        jsonrpc: "2.0",
        id: 9,
        method: "tools/call",
        params: {
          name: "parse_get_stats",
          arguments: {},
        },
      }),
      buildEnv(),
      new MemoryExecutionContext(),
    );

    const body = (await response.json()) as {
      result: { content: Array<{ text: string }> };
    };
    const text = body.result.content[0]?.text ?? "";
    expect(text).toContain("Parse public AI visibility dataset");
    expect(text).toContain("Brands tracked: 1,234");
    expect(text).toContain("Citations are source/domain observations");
  });
});
