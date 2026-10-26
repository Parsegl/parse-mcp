# Parse MCP installation for agents

Follow the client-specific installation routes in [README.md](README.md). Prefer the hosted Streamable HTTP endpoint over running the historical worker source in this repository.

After connection, verify `tools/list` includes `parse_check_brand`, `parse_search`, `parse_get_brand`, `parse_get_topic`, and `parse_get_question`. Call `parse_check_brand` with `{"brand":"stripe.com"}`. A successful lookup includes the resolved brand and measured public evidence or an explicit coverage state. Do not treat a missing measurement as zero.

Public lookups need no API key. Workspace capabilities require separate OAuth verification and authorization; never assume that connecting the public endpoint grants private access. See [Parse's current documentation](https://parse.gl/mcp).
