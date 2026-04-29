export const PROMPTS = [
  {
    name: "compare-brands",
    description: "Compare two brands using public Parse AI visibility signals.",
    arguments: [
      { name: "brand_a", required: true },
      { name: "brand_b", required: true },
    ],
  },
  {
    name: "audit-my-brand",
    description:
      "Audit one brand's AI visibility and turn the findings into marketer actions.",
    arguments: [{ name: "brand", required: true }],
  },
  {
    name: "industry-leaders",
    description:
      "Find likely leaders in a niche and explain what evidence supports them.",
    arguments: [{ name: "niche", required: true }],
  },
  {
    name: "source-opportunities",
    description:
      "Find citation sources a marketer should inspect for profile, listing, or content opportunities.",
    arguments: [{ name: "topic_or_brand", required: true }],
  },
  {
    name: "prompt-set-planner",
    description:
      "Build a practical AI visibility prompt set for a brand, market, or buying journey.",
    arguments: [{ name: "market", required: true }],
  },
  {
    name: "ai-visibility-30-day-plan",
    description:
      "Create a 30-day AI visibility research and execution plan grounded in Parse public data.",
    arguments: [{ name: "brand", required: true }],
  },
] as const;

function stringArg(args: Record<string, unknown>, key: string) {
  const value = args[key];
  return typeof value === "string" ? value : "";
}

export function getPrompt(name: string, args: Record<string, unknown>) {
  if (name === "compare-brands") {
    const brandA = stringArg(args, "brand_a");
    const brandB = stringArg(args, "brand_b");
    return promptResponse(
      name,
      `Use the Parse MCP to compare ${brandA} and ${brandB}.

1. Call parse_search for each brand with types ["brands"].
2. Call parse_get_brand for the best matching brand:* ID for each brand.
3. Compare Parse Score, strength, reach, authority, top prompts, top sources, and peer context.
4. Turn the comparison into a marketer-readable brief: where each brand is stronger, where evidence is thin, what sources and prompts deserve follow-up.
5. State only what the returned data supports. Do not claim a trend or competitor gain unless the data explicitly shows it.`,
    );
  }

  if (name === "audit-my-brand") {
    const brand = stringArg(args, "brand");
    return promptResponse(
      name,
      `Use the Parse MCP to audit ${brand}.

1. Call parse_search with the brand name and types ["brands"].
2. Call parse_get_brand for the best matching brand:* ID.
3. Summarize AI visibility: Parse Score, strength, reach, authority, top prompts, top sources, related products, and data gaps.
4. Convert the findings into actions a marketer can take: source/profile checks, content opportunities, prompt set additions, and competitor follow-ups.
5. Keep claims grounded in returned Parse data and label unknowns as unknown.`,
    );
  }

  if (name === "industry-leaders") {
    const niche = stringArg(args, "niche");
    return promptResponse(
      name,
      `Use the Parse MCP to find industry leaders for ${niche}.

1. Call parse_search for ${niche} with types ["niches", "brands"].
2. Fetch the most relevant brand:* results that appear to represent the market.
3. Rank likely leaders by visible Parse signals and explain the evidence.
4. Add a short "what to verify next" section for prompts, sources, and direct competitors.
5. Do not invent missing metrics or claim market leadership beyond the returned public evidence.`,
    );
  }

  if (name === "source-opportunities") {
    const topicOrBrand = stringArg(args, "topic_or_brand");
    return promptResponse(
      name,
      `Use the Parse MCP to find source opportunities for ${topicOrBrand}.

1. Call parse_search with types ["sources", "brands", "prompts"].
2. Group sources into likely profiles/listings, editorial content, communities, and unknowns based only on returned labels/domains.
3. For each useful source, explain why it may matter for AI visibility and what a marketer should inspect manually.
4. Separate owned-profile work, third-party listing work, and content/PR work.
5. Do not say the brand has a controllable page unless the returned data supports that.`,
    );
  }

  if (name === "prompt-set-planner") {
    const market = stringArg(args, "market");
    return promptResponse(
      name,
      `Use the Parse MCP to plan an AI visibility prompt set for ${market}.

1. Call parse_search with types ["prompts", "brands", "niches"].
2. Pull the most useful organic prompt examples and cluster them by buyer intent.
3. Identify where brand, category, competitor, alternative, and source-discovery prompts are missing.
4. Produce a practical prompt set a marketer can reuse for weekly AI visibility checks.
5. Keep generated prompt ideas clearly labeled as proposed additions, not Parse-observed prompts.`,
    );
  }

  if (name === "ai-visibility-30-day-plan") {
    const brand = stringArg(args, "brand");
    return promptResponse(
      name,
      `Use the Parse MCP to create a 30-day AI visibility plan for ${brand}.

1. Call parse_search with types ["brands"] and then parse_get_brand for the best match.
2. Call parse_search again for the brand's market/category if the brand brief suggests one.
3. Build a four-week plan: baseline measurement, prompt coverage, source opportunity checks, and competitor comparison.
4. Include the exact Parse fetch IDs and follow-up searches the marketer should run.
5. Ground every action in returned Parse data; label assumptions and manual verification steps clearly.`,
    );
  }

  throw new Error(`Unknown prompt: ${name}`);
}

function promptResponse(name: string, text: string) {
  return {
    description: PROMPTS.find((prompt) => prompt.name === name)?.description,
    messages: [
      {
        role: "user",
        content: {
          type: "text",
          text,
        },
      },
    ],
  };
}
