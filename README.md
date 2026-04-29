# Parse MCP

Improve AI visibility research with Parse. Find how brands appear across AI-search prompts, citation sources, niches, and competitors, then turn that data into marketer-ready actions. Use the server to discover relevant brands, audit a brand's visibility profile, compare competitors, inspect high-intent prompts, identify source opportunities, and build 30-day visibility plans. Parse returns concise research briefs, fetchable result IDs, public score summaries, top prompts, top citation domains, related products, and dataset freshness signals so marketers can move from raw AI visibility data to prioritized SEO, content, PR, and listing work.

Hosted server:
https://mcp.parse.gl/mcp


## What Is Included

- `mcp-worker/`: Cloudflare Worker source for the hosted Streamable HTTP MCP server.
- `npm/`: `parse-gl-mcp` npm shim that runs the hosted server through package-local `mcp-remote`.
- `mcp-bundle/`: MCPB bundle metadata and node entry point.

## Tools

- `parse_search`: Search brands, organic AI prompts, niches, and citation sources.
- `parse_get_brand`: Fetch a marketer-readable AI visibility brief for a brand.
- `parse_get_prompt`: Fetch one public organic prompt.
- `parse_get_stats`: Summarize public Parse dataset scale and freshness.
- `search` and `fetch`: Compatibility aliases for clients that expect those names.

## Resources

- `parse://showcase-brands`
- `parse://niches`
- `parse://glossary`

## Prompts

- `compare-brands`
- `audit-my-brand`
- `industry-leaders`
- `source-opportunities`
- `prompt-set-planner`
- `ai-visibility-30-day-plan`

## Use With Claude Desktop

```json
{
  "mcpServers": {
    "parse": {
      "command": "npx",
      "args": ["parse-gl-mcp"]
    }
  }
}
```

## Run The NPM Shim Locally

```bash
cd npm
npm ci
npm test
npx parse-gl-mcp
```

## Develop The Worker

```bash
cd mcp-worker
npm ci
npm test
npm run typecheck
```

Copy `mcp-worker/wrangler.example.toml` to `mcp-worker/wrangler.toml` and fill in your own Cloudflare account, route, and KV namespace IDs. Store secrets with `wrangler secret put`; do not commit them.

Required worker secrets:

- `WORKER_HASH_SALT`
- `CF_ORIGIN_VERIFY_SECRET`, if your Parse origin requires it
- `VERCEL_AUTOMATION_BYPASS_SECRET`, if your Vercel project requires it
- `MCP_INTERNAL_SECRET`, if enabling the internal usage endpoint

## Security Notes

- Raw IP addresses are hashed at the worker boundary before rate limiting or telemetry.
- User-Agent values are reduced to a client-family label before persistence.
- Origin validation is strict for browser clients; missing Origin is allowed for native MCP clients.
- Upstream verification and bypass secrets are sent only as HTTP headers.
- This public repository intentionally excludes `.env`, `.wrangler`, `.claude`, and `node_modules`.

