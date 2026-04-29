import { ParseApiError, ParseApiTimeoutError, parseFetch } from "./api_client";
import { escapeMarkdown, jsonText, parseUrl, withFooter } from "./markdown";
import { recordCall } from "./usage";
import type { RequestContext } from "./types";

type ToolDefinition = {
  name: string;
  title: string;
  description: string;
  inputSchema: {
    type: "object";
    properties: Record<string, unknown>;
    required?: string[];
  };
};

const SEARCH_TYPES = ["brands", "prompts", "niches", "sources"] as const;
const BROAD_SEARCH_SECTION_TIMEOUT_MS = 3500;
const CATEGORY_QUERY_TERMS = [
  "agency",
  "agencies",
  "alternative",
  "alternatives",
  "app",
  "apps",
  "best",
  "category",
  "companies",
  "company",
  "crm",
  "industry",
  "platform",
  "platforms",
  "processor",
  "processors",
  "service",
  "services",
  "software",
  "solution",
  "solutions",
  "tool",
  "tools",
] as const;

type SearchType = (typeof SEARCH_TYPES)[number];

type PublicSearchEnrichment = {
  fetchId?: string;
  displayTitle?: string;
  displaySubtitle?: string | null;
  displayDomain?: string | null;
  rankScore?: number | null;
  relevance?: number | null;
  lastUpdated?: string | null;
  matchReason?: string;
};

type PublicSearchResult = {
  brands?: Array<
    {
      id: string;
      name: string | null;
      slug: string;
      domainName?: string | null;
    } & PublicSearchEnrichment
  >;
  prompts?: Array<
    {
      id: string;
      content: string;
      slug: string;
    } & PublicSearchEnrichment
  >;
  niches?: Array<
    {
      id: string;
      name: string;
      slug: string;
      industrySlug?: string | null;
    } & PublicSearchEnrichment
  >;
  sources?: Array<
    {
      id: string;
      domain: string;
      slug: string;
      sourceType?: string | null;
    } & PublicSearchEnrichment
  >;
  totalCount?: number;
  notes?: string[];
};

type BrandProfile = {
  id: string;
  slug: string;
  name: string | null;
  domain: string | null;
  latestMetricsDate: string | null;
  summary?: {
    snapshotRunDate?: string | null;
    latestMetricsDate?: string | null;
    parseScore?: number | null;
    strengthScore?: number | null;
    reachScore?: number | null;
    authorityScore?: number | null;
    promptCount?: number | null;
    citationDomainCount?: number | null;
    citationGapCount?: number | null;
    primaryIndustryName?: string | null;
    portfolioBrandsPreview?: Array<{ name: string; slug: string }>;
    parentBrandPreview?: { name: string; slug: string } | null;
    peerPreview?: Array<{
      name?: string | null;
      domainName?: string | null;
      slug?: string | null;
      parseScore?: number | null;
    }>;
    topPromptsPreview?: Array<{
      id?: string;
      content?: string;
      prompt?: string;
      visibility?: number | null;
      mentionRate?: number | null;
      avgPosition?: number | null;
    }>;
    topSourcesPreview?: Array<{
      domain?: string;
      citationCount?: number | null;
      citationSharePercent?: number | null;
      promptCount?: number | null;
    }>;
  };
};

type PublicPrompt = {
  id: string;
  slug: string;
  content: string;
  createdAt?: string;
};

type PublicStats = {
  totalBrands: number;
  totalPrompts: number;
  totalCitations: number;
  lastUpdated: string | null;
};

export const TOOLS: ToolDefinition[] = [
  {
    name: "parse_search",
    title: "Search Parse AI visibility data",
    description:
      "Find brands, organic AI prompts, citation sources, and market niches for marketer research. Use this first when the user names a brand, category, source, or AI visibility question.",
    inputSchema: {
      type: "object",
      properties: {
        query: { type: "string" },
        types: {
          type: "array",
          items: {
            type: "string",
            enum: ["brands", "prompts", "niches", "sources"],
          },
        },
        limit: { type: "number", minimum: 1, maximum: 10 },
      },
      required: ["query"],
    },
  },
  {
    name: "parse_get_brand",
    title: "Get brand AI visibility brief",
    description:
      "Fetch a concise public marketing brief for one brand, including Parse score, strengths, weak spots, top prompts, citation sources, related brands, and next research questions.",
    inputSchema: {
      type: "object",
      properties: { slug_or_id: { type: "string" } },
      required: ["slug_or_id"],
    },
  },
  {
    name: "parse_get_prompt",
    title: "Get AI prompt detail",
    description:
      "Fetch one public organic prompt by slug when the user wants to inspect the exact AI-search question behind a result.",
    inputSchema: {
      type: "object",
      properties: { slug: { type: "string" } },
      required: ["slug"],
    },
  },
  {
    name: "parse_get_stats",
    title: "Summarize Parse dataset scale",
    description:
      "Explain the public Parse index scale and freshness: tracked brands, organic prompts, and citation observations.",
    inputSchema: { type: "object", properties: {} },
  },
  {
    name: "search",
    title: "Search",
    description:
      "Compatibility alias for parse_search. Use for clients that expect a generic search tool.",
    inputSchema: {
      type: "object",
      properties: {
        query: { type: "string" },
        limit: { type: "number", minimum: 1, maximum: 10 },
      },
      required: ["query"],
    },
  },
  {
    name: "fetch",
    title: "Fetch",
    description:
      "Compatibility alias that resolves fetch IDs like brand:stripe or prompt:best-crm into JSON-text results with human-readable text.",
    inputSchema: {
      type: "object",
      properties: { id: { type: "string" } },
      required: ["id"],
    },
  },
];

function argsRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

function stringArg(args: Record<string, unknown>, key: string) {
  const value = args[key];
  return typeof value === "string" ? value.trim() : "";
}

function numberArg(
  args: Record<string, unknown>,
  key: string,
  fallback: number,
) {
  const value = args[key];
  const number = typeof value === "number" ? value : Number(value);
  return Number.isFinite(number) ? number : fallback;
}

function typeArgs(args: Record<string, unknown>) {
  const value = args.types;
  if (!Array.isArray(value)) {
    return undefined;
  }

  return value.filter(
    (entry): entry is SearchType =>
      typeof entry === "string" && isSearchType(entry),
  );
}

function textResult(text: string) {
  return {
    content: [{ type: "text", text }],
  };
}

function cleanDomain(value: string | null | undefined) {
  return value?.replace(/\\\./g, ".").trim() || null;
}

function compact(value: string | null | undefined, maxLength = 140) {
  const normalized = value?.replace(/\s+/g, " ").trim();
  if (!normalized) {
    return "";
  }

  return normalized.length > maxLength
    ? `${normalized.slice(0, maxLength - 1)}…`
    : normalized;
}

function slugify(value: string) {
  return value
    .toLowerCase()
    .replace(/[^\w\s-]/g, "")
    .replace(/[\s-]+/g, "-");
}

function buildPromptSlug(content: string | null | undefined, id: string) {
  return `${slugify(content ?? id)}--${id}`;
}

function formatNumber(value: number | null | undefined) {
  return typeof value === "number" && Number.isFinite(value)
    ? new Intl.NumberFormat("en-US").format(value)
    : "not available";
}

function formatScore(value: number | null | undefined) {
  return typeof value === "number" && Number.isFinite(value)
    ? `${Math.round(value)}/100`
    : "not available";
}

function formatPercent(value: number | null | undefined) {
  if (typeof value !== "number" || !Number.isFinite(value)) {
    return null;
  }

  const percent = value <= 1 ? value * 100 : value;
  return `${Math.round(percent)}%`;
}

function metricHint(result: PublicSearchEnrichment) {
  const hints: string[] = [];
  if (
    typeof result.rankScore === "number" &&
    Number.isFinite(result.rankScore)
  ) {
    hints.push(`rank score ${Math.round(result.rankScore)}`);
  }

  const relevance = formatPercent(result.relevance);
  if (relevance) {
    hints.push(`relevance ${relevance}`);
  }

  return hints.length > 0 ? hints.join(", ") : null;
}

function fetchIdForSearchResult(
  type: SearchType,
  result: PublicSearchEnrichment & { slug: string },
) {
  if (result.fetchId) {
    return result.fetchId;
  }

  const singular = type.endsWith("s") ? type.slice(0, -1) : type;
  return `${singular}:${result.slug}`;
}

function searchResultUrl(
  type: SearchType,
  slug: string,
  industrySlug?: string | null,
) {
  if (type === "brands") {
    return parseUrl(`/brands/${slug}`, "parse_search");
  }

  if (type === "prompts") {
    return parseUrl(`/prompts/p/${slug}`, "parse_search");
  }

  if (type === "niches") {
    return parseUrl(
      industrySlug ? `/rankings/${industrySlug}/${slug}` : "/rankings",
      "parse_search",
    );
  }

  return parseUrl(`/sources/${slug}`, "parse_search");
}

function searchCard(input: {
  type: SearchType;
  title: string;
  subtitle?: string | null;
  slug: string;
  industrySlug?: string | null;
  enrichment: PublicSearchEnrichment;
}) {
  const lines: string[] = [];
  const title = escapeMarkdown(compact(input.title, 120));
  const subtitle = cleanDomain(input.subtitle) ?? compact(input.subtitle, 100);
  lines.push(`- ${title}${subtitle ? ` — ${escapeMarkdown(subtitle)}` : ""}`);

  const matchReason =
    input.enrichment.matchReason ??
    (input.type === "brands"
      ? "Good starting point for an AI visibility brand audit"
      : input.type === "prompts"
        ? "A question where buyers may encounter this market"
        : input.type === "sources"
          ? "A citation domain that can shape AI answers"
          : "A market area worth mapping before competitor research");
  lines.push(`  Why it matters: ${escapeMarkdown(matchReason)}`);
  lines.push(
    `  Fetch ID: ${fetchIdForSearchResult(input.type, {
      slug: input.slug,
      ...input.enrichment,
    })}`,
  );

  const hint = metricHint(input.enrichment);
  if (hint) {
    lines.push(`  Metric hint: ${escapeMarkdown(hint)}`);
  }

  lines.push(
    `  Open: ${searchResultUrl(input.type, input.slug, input.industrySlug)}`,
  );
  return lines;
}

function isCategoryQuery(query: string, result: PublicSearchResult) {
  const normalized = query.toLowerCase();
  return (
    normalized
      .split(/\s+/)
      .some((term) =>
        CATEGORY_QUERY_TERMS.includes(
          term as (typeof CATEGORY_QUERY_TERMS)[number],
        ),
      ) ||
    (result.niches?.length ?? 0) > 0 ||
    (result.prompts?.length ?? 0) > (result.brands?.length ?? 0)
  );
}

function sectionOrder(result: PublicSearchResult, query: string) {
  const marketMode = isCategoryQuery(query, result);
  return marketMode
    ? (["niches", "prompts", "brands", "sources"] as const)
    : (["brands", "prompts", "niches", "sources"] as const);
}

function searchMarkdown(result: PublicSearchResult, query: string) {
  const lines: string[] = [
    `Parse research results for "${escapeMarkdown(query)}"`,
  ];
  const marketMode = isCategoryQuery(query, result);

  if (result.notes?.length) {
    lines.push("");
    for (const note of result.notes) {
      lines.push(`Note: ${note}`);
    }
  }

  const sectionMap = {
    brands: {
      title: "Brands",
      type: "brands" as const,
      items:
        result.brands?.map((brand) => ({
          title: brand.displayTitle ?? brand.name ?? brand.slug,
          subtitle: brand.displayDomain ?? brand.domainName,
          slug: brand.slug,
          enrichment: brand,
        })) ?? [],
    },
    prompts: {
      title: "Prompts",
      type: "prompts" as const,
      items:
        result.prompts?.map((prompt) => ({
          title: prompt.displayTitle ?? prompt.content,
          subtitle: prompt.displaySubtitle ?? "Organic AI-search prompt",
          slug: prompt.slug,
          enrichment: prompt,
        })) ?? [],
    },
    niches: {
      title: "Niches",
      type: "niches" as const,
      items:
        result.niches?.map((niche) => ({
          title: niche.displayTitle ?? niche.name,
          subtitle: niche.displaySubtitle ?? niche.industrySlug,
          slug: niche.slug,
          industrySlug: niche.industrySlug,
          enrichment: niche,
        })) ?? [],
    },
    sources: {
      title: "Sources",
      type: "sources" as const,
      items:
        result.sources?.map((source) => ({
          title:
            source.displayTitle ?? cleanDomain(source.domain) ?? source.domain,
          subtitle:
            source.displaySubtitle ?? source.sourceType ?? "Citation source",
          slug: source.slug,
          enrichment: source,
        })) ?? [],
    },
  };
  const sections = sectionOrder(result, query).map((type) => sectionMap[type]);

  if (marketMode) {
    lines.push(
      "",
      "Market research read",
      "- Treat niche and prompt matches as the market map. Literal brand matches may include publishers, blogs, or adjacent products rather than category leaders.",
      "- Fetch the niche or prompt first when you are mapping a category; fetch a brand first when you already know the company you want to audit.",
    );
  }

  for (const section of sections) {
    if (section.items.length === 0) {
      continue;
    }

    lines.push("", section.title);
    for (const item of section.items) {
      lines.push(...searchCard({ type: section.type, ...item }));
    }
  }

  const hasResults = sections.some((section) => section.items.length > 0);
  if (!hasResults) {
    lines.push("", "No public Parse results found.");
  }

  lines.push(
    "",
    "Next step: fetch the most relevant brand:* or prompt:* ID, or rerun search with types narrowed to brands, prompts, niches, or sources.",
  );

  return withFooter(lines.join("\n"), "parse_search");
}

function brandBriefLines(brand: BrandProfile) {
  const summary = brand.summary ?? {};
  const scoreRows: Array<[string, number | null | undefined]> = [
    ["Parse Score", summary.parseScore],
    ["Strength", summary.strengthScore],
    ["Reach", summary.reachScore],
    ["Authority", summary.authorityScore],
  ];
  const scoredRows = scoreRows.filter(
    (row): row is [string, number] =>
      typeof row[1] === "number" && Number.isFinite(row[1]),
  );
  const strongest = [...scoredRows].sort(
    (left, right) => right[1] - left[1],
  )[0];
  const weakest = [...scoredRows].sort((left, right) => left[1] - right[1])[0];
  const topPrompts = summary.topPromptsPreview ?? [];
  const topSources = summary.topSourcesPreview ?? [];
  const relatedBrands = [
    ...(summary.portfolioBrandsPreview ?? []),
    ...(summary.parentBrandPreview ? [summary.parentBrandPreview] : []),
  ];

  const lines = [
    `${brand.name ?? brand.slug}`,
    `URL: ${parseUrl(`/brands/${brand.slug}`, "parse_get_brand")}`,
    `Domain: ${cleanDomain(brand.domain) ?? "unknown"}`,
    `Latest data: ${
      brand.latestMetricsDate ??
      summary.latestMetricsDate ??
      summary.snapshotRunDate ??
      "unknown"
    }`,
    "",
    "AI visibility summary",
    `- Parse Score: ${formatScore(summary.parseScore)}`,
    `- Strength: ${formatScore(summary.strengthScore)}`,
    `- Reach: ${formatScore(summary.reachScore)}`,
    `- Authority: ${formatScore(summary.authorityScore)}`,
    `- Coverage: ${formatNumber(summary.promptCount)} prompts and ${formatNumber(
      summary.citationDomainCount,
    )} citation domains`,
  ];

  lines.push("", "Strengths");
  if (strongest) {
    lines.push(
      `- Strongest score is ${strongest[0]} at ${formatScore(strongest[1])}.`,
    );
  }
  if (topSources[0]?.domain) {
    lines.push(
      `- Top cited source: ${cleanDomain(topSources[0].domain) ?? topSources[0].domain}${
        typeof topSources[0].citationCount === "number"
          ? ` (${formatNumber(topSources[0].citationCount)} citations)`
          : ""
      }.`,
    );
  }
  if (!strongest && !topSources[0]?.domain) {
    lines.push(
      "- Not enough public summary data yet to name a strongest signal.",
    );
  }

  lines.push("", "Weak spots and data gaps");
  if (weakest && strongest && weakest[0] !== strongest[0]) {
    lines.push(
      `- Lowest score is ${weakest[0]} at ${formatScore(weakest[1])}.`,
    );
  }
  if ((summary.citationGapCount ?? 0) > 0) {
    lines.push(
      `- Parse flags ${formatNumber(summary.citationGapCount)} citation gaps worth inspecting.`,
    );
  }
  if (topPrompts.length === 0) {
    lines.push("- No top public prompts were available in this summary.");
  }

  lines.push("", "Priority actions");
  if (weakest) {
    lines.push(
      `- Improve ${weakest[0]} first; it is the lowest visible score in this public summary.`,
    );
  }
  if (topSources[1]?.domain) {
    lines.push(
      `- Inspect ${cleanDomain(topSources[1].domain) ?? topSources[1].domain}; non-owned sources near the top often reveal profile, listing, community, or content opportunities.`,
    );
  } else if (topSources[0]?.domain) {
    lines.push(
      `- Inspect ${cleanDomain(topSources[0].domain) ?? topSources[0].domain}; confirm whether it is owned, third-party, or editorial before planning outreach.`,
    );
  }
  if (topPrompts[0]?.content ?? topPrompts[0]?.prompt) {
    lines.push(
      "- Use the top prompt below as the first buyer-question test case for follow-up research.",
    );
  }
  if (!weakest && topSources.length === 0 && topPrompts.length === 0) {
    lines.push(
      "- Start with source and prompt discovery; this profile does not expose enough public summary data for a stronger recommendation.",
    );
  }

  if (topPrompts.length > 0) {
    lines.push("", "Top prompts to inspect");
    for (const prompt of topPrompts.slice(0, 3)) {
      const content = compact(prompt.content ?? prompt.prompt, 150);
      const visibility = formatPercent(prompt.visibility);
      const promptFetchId = prompt.id
        ? `prompt:${buildPromptSlug(prompt.content ?? prompt.prompt, prompt.id)}`
        : null;
      lines.push(
        `- ${escapeMarkdown(content)}${
          visibility ? ` — visibility ${visibility}` : ""
        }${promptFetchId ? ` (fetch ${promptFetchId})` : ""}`,
      );
    }
  }

  if (topSources.length > 0) {
    lines.push("", "Top citation sources");
    for (const source of topSources.slice(0, 3)) {
      const domain = cleanDomain(source.domain) ?? source.domain ?? "unknown";
      const share = formatPercent(source.citationSharePercent);
      lines.push(
        `- ${escapeMarkdown(domain)}${
          share ? ` — ${share} citation share` : ""
        }${
          typeof source.promptCount === "number"
            ? ` across ${formatNumber(source.promptCount)} prompts`
            : ""
        }`,
      );
    }
  }

  if (relatedBrands.length > 0) {
    lines.push("", "Related products to research next");
    for (const related of relatedBrands.slice(0, 4)) {
      const suffix =
        brand.name &&
        !related.name.toLowerCase().includes(brand.name.toLowerCase())
          ? ` by ${brand.name}`
          : "";
      lines.push(
        `- ${escapeMarkdown(related.name)}${suffix} (brand:${related.slug})`,
      );
    }
  }

  lines.push("", "Next research questions");
  lines.push(
    `- Which prompts make ${brand.name ?? brand.slug} visible or invisible to buyers?`,
  );
  lines.push(
    `- Which cited sources could a marketer influence with better profiles, listings, or content?`,
  );
  lines.push(
    `- Which peer brands show up in the same market and what sources do they win?`,
  );

  return lines;
}

function unescapeMarkdownText(text: string) {
  return text.replace(/\\([\\`*_{}[\]()#+!|>-])/g, "$1");
}

function brandMarkdown(brand: BrandProfile) {
  return withFooter(brandBriefLines(brand).join("\n"), "parse_get_brand");
}

function promptLines(prompt: PublicPrompt) {
  return [
    "Public AI-search prompt",
    compact(prompt.content, 300),
    `URL: ${parseUrl(`/prompts/p/${prompt.slug}`, "parse_get_prompt")}`,
    "",
    "How to use it",
    "- Search this prompt's topic for brands and sources.",
    "- Compare which brands have public profiles before making visibility claims.",
  ];
}

function promptMarkdown(prompt: PublicPrompt) {
  return withFooter(promptLines(prompt).join("\n"), "parse_get_prompt");
}

function statsMarkdown(stats: PublicStats) {
  return withFooter(
    [
      "Parse public AI visibility dataset",
      `- Brands tracked: ${formatNumber(stats.totalBrands)}`,
      `- Organic prompts: ${formatNumber(stats.totalPrompts)}`,
      `- Citation observations: ${formatNumber(stats.totalCitations)}`,
      `- Last updated: ${stats.lastUpdated ?? "unknown"}`,
      "",
      "What this means",
      "- Brands are public company/product profiles Parse can resolve from the public index.",
      "- Prompts are organic AI-search questions where buyers may discover or compare brands.",
      "- Citations are source/domain observations from AI answers, useful for finding source opportunities and content gaps.",
    ].join("\n"),
    "parse_get_stats",
  );
}

function isSearchType(value: string): value is SearchType {
  return SEARCH_TYPES.includes(value as SearchType);
}

function normalizeSearchTypes(types: string[] | undefined) {
  if (!types || types.length === 0) {
    return [...SEARCH_TYPES];
  }

  const selected = SEARCH_TYPES.filter((type) => types.includes(type));
  return selected.length > 0 ? selected : [...SEARCH_TYPES];
}

function searchTypeLabel(type: SearchType) {
  if (type === "brands") return "Brands";
  if (type === "prompts") return "Prompts";
  if (type === "niches") return "Niches";
  return "Sources";
}

function mergeSearchSection(
  result: PublicSearchResult,
  type: SearchType,
  section: PublicSearchResult | null,
) {
  if (!section) {
    return;
  }

  if (type === "brands") {
    result.brands = section.brands ?? [];
  } else if (type === "prompts") {
    result.prompts = section.prompts ?? [];
  } else if (type === "niches") {
    result.niches = section.niches ?? [];
  } else {
    result.sources = section.sources ?? [];
  }
}

function resultCount(result: PublicSearchResult) {
  return (
    (result.brands?.length ?? 0) +
    (result.prompts?.length ?? 0) +
    (result.niches?.length ?? 0) +
    (result.sources?.length ?? 0)
  );
}

async function runSearch(
  context: RequestContext,
  query: string,
  rawTypes: string[] | undefined,
  limit: number,
) {
  const types = normalizeSearchTypes(rawTypes);
  if (types.length <= 1) {
    return (
      (await parseFetch<PublicSearchResult>(context.env, "/api/public/search", {
        q: query,
        types,
        limit,
      })) ?? {}
    );
  }

  const result: PublicSearchResult = { totalCount: 0, notes: [] };
  const sections = await Promise.all(
    types.map(async (type) => ({
      type,
      section: await parseFetch<PublicSearchResult>(
        context.env,
        "/api/public/search",
        { q: query, types: [type], limit },
        { timeoutMs: BROAD_SEARCH_SECTION_TIMEOUT_MS },
      ).catch((error: unknown) => ({ error })),
    })),
  );

  for (const sectionResult of sections) {
    if (sectionResult.section && !("error" in sectionResult.section)) {
      mergeSearchSection(result, sectionResult.type, sectionResult.section);
      continue;
    }

    result.notes?.push(
      `${searchTypeLabel(sectionResult.type)} were slow or unavailable. Rerun with types: ["${sectionResult.type}"] for a deeper retry.`,
    );
  }

  result.totalCount = resultCount(result);
  if (result.notes && result.notes.length > 1) {
    result.notes = [...new Set(result.notes)];
  }

  return result;
}

function fetchResponse(input: {
  id: string;
  title: string;
  text: string;
  url: string;
  metadata: Record<string, unknown>;
}) {
  return jsonText({
    id: input.id,
    title: input.title,
    text: input.text,
    url: input.url,
    metadata: {
      source: "parse-public-index",
      ...input.metadata,
    },
  });
}

async function recordToolCall(context: RequestContext, name: string) {
  context.ctx.waitUntil(
    recordCall(context.env, context.ipHash, context.clientFamily, name),
  );
}

export async function callTool(
  context: RequestContext,
  name: string,
  rawArgs: unknown,
) {
  const args = argsRecord(rawArgs);

  try {
    if (name === "parse_search" || name === "search") {
      const query = stringArg(args, "query");
      const limit = numberArg(args, "limit", 5);
      const result = await runSearch(context, query, typeArgs(args), limit);
      await recordToolCall(context, name);
      return textResult(searchMarkdown(result, query));
    }

    if (name === "parse_get_brand") {
      const slug = stringArg(args, "slug_or_id");
      const brand = await parseFetch<BrandProfile>(
        context.env,
        `/api/public/brand/${encodeURIComponent(slug)}`,
      );
      await recordToolCall(context, name);
      if (!brand) {
        return textResult(
          `No brand found for "${slug}". Try parse_search first.`,
        );
      }
      return textResult(brandMarkdown(brand));
    }

    if (name === "parse_get_prompt") {
      const slug = stringArg(args, "slug");
      const prompt = await parseFetch<PublicPrompt>(
        context.env,
        `/api/public/prompt/${encodeURIComponent(slug)}`,
      );
      await recordToolCall(context, name);
      if (!prompt) {
        return textResult(
          `No public prompt found for "${slug}". Try parse_search first.`,
        );
      }
      return textResult(promptMarkdown(prompt));
    }

    if (name === "parse_get_stats") {
      const stats = await parseFetch<PublicStats>(
        context.env,
        "/api/public/stats",
      );
      await recordToolCall(context, name);
      return textResult(
        statsMarkdown(
          stats ?? {
            totalBrands: 0,
            totalPrompts: 0,
            totalCitations: 0,
            lastUpdated: null,
          },
        ),
      );
    }

    if (name === "fetch") {
      const id = stringArg(args, "id");
      const isPrompt = id.startsWith("prompt:") || id.includes("/prompts/");
      const key =
        id
          .replace(/^brand:|^prompt:/, "")
          .split("/")
          .pop() ?? id;
      const data = isPrompt
        ? await parseFetch<PublicPrompt>(
            context.env,
            `/api/public/prompt/${encodeURIComponent(key)}`,
          )
        : await parseFetch<BrandProfile>(
            context.env,
            `/api/public/brand/${encodeURIComponent(key)}`,
          );
      await recordToolCall(context, name);
      return textResult(
        fetchResponse({
          id,
          title:
            data && "content" in data
              ? data.content
              : data && "name" in data
                ? (data.name ?? id)
                : id,
          text: data
            ? "content" in data
              ? promptLines(data).join("\n")
              : unescapeMarkdownText(brandBriefLines(data).join("\n"))
            : "Not found",
          url: isPrompt
            ? parseUrl(`/prompts/p/${key}`, "fetch")
            : parseUrl(`/brands/${key}`, "fetch"),
          metadata: {
            type: isPrompt ? "prompt" : "brand",
            slug: key,
            latestMetricsDate:
              data && "latestMetricsDate" in data
                ? data.latestMetricsDate
                : undefined,
            domain: data && "domain" in data ? data.domain : undefined,
          },
        }),
      );
    }
  } catch (error) {
    if (error instanceof ParseApiTimeoutError) {
      throw new Error(
        "Parse upstream search was slow. Retry with a narrower types filter.",
      );
    }
    if (error instanceof ParseApiError) {
      throw new Error(
        `Parse upstream returned ${error.status}. Please retry shortly.`,
      );
    }
    throw error;
  }

  throw new Error(`Unknown tool: ${name}`);
}
