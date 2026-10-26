# Parse MCP

[Parse](https://parse.gl) lets your assistant look up how AI sees a brand, compare competitors, and explore buyer topics and cited sources. Public lookups are free and require no account. Responses include measurement dates and coverage; an unmeasured or unindexed brand is not evidence of zero visibility.

## Connect

The hosted Streamable HTTP endpoint is `https://mcp.parse.gl/mcp`.

- **Cursor and other Agent Plugins clients:** install this repository as a plugin. The root `plugin.json` and `mcp.json` use the Agent Plugins standard.
- **Gemini CLI:** run `gemini extensions install https://github.com/Parsegl/parse-mcp`.
- **Claude:** add the endpoint as a custom connector for public lookups. Authenticated Claude workspace access is not yet verified; the October 26, 2026 CIMD sign-in check returned `invalid_client`.
- **Other remote MCP clients:** add the endpoint using the client's Streamable HTTP configuration.
- **Clients requiring stdio:** run `npx -y -p @parse-gl/mcp parse-mcp` to bridge to the hosted service.

These installation paths do not imply marketplace approval. [Setup and current tool reference](https://parse.gl/mcp).

## Try it

- “How does AI see stripe.com? Include sources and measurement dates.”
- “Compare Stripe and Adyen using matching markets and date windows.”
- “Find buyer topics related to payment APIs.”

Start with `parse_check_brand` for a named brand or domain, or `parse_search` to discover brands, topics and markets. Follow returned identifiers into `parse_get_brand`, `parse_get_topic` and `parse_get_question`. `search` and `fetch` are compatibility aliases.

## Workspace access

The same endpoint also advertises workspace tools. These require Parse sign-in and selected-workspace membership, with plan-based access. Writes require write consent and workspace administrator opt-in. The service can save drafts and record confirmed task changes; it does not send email. Billing, membership and connection permissions stay in Parse. OAuth compatibility must be verified separately for each client; public lookup support does not establish authenticated support.

## Repository contents

The root manifests connect clients to the hosted service without running this repository's server code. `mcp-worker/`, `npm/` and `mcp-bundle/` contain earlier worker, shim and desktop-bundle sources; they are not a complete snapshot of the currently deployed service. The published stdio package is `@parse-gl/mcp`, not the name of the historical `npm/` source package.

## Privacy and support

[Privacy policy](https://parse.gl/privacy) · [Terms](https://parse.gl/terms) · [Documentation](https://parse.gl/mcp) · [Support](mailto:dimitry@soar.sh)

Parse records bounded MCP request information for operational diagnostics as described in its privacy policy. Do not put credentials or unrelated private information into tool arguments.
