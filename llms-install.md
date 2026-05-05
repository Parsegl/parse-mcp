# Parse MCP Install Notes For Agents

Use the published npm package unless the client supports hosted MCP endpoints directly.

## Preferred install path

Run:

```bash
npx -y -p @parse-gl/mcp parse-mcp
```

That package starts a local stdio bridge to the hosted Parse MCP endpoint:

`https://mcp.parse.gl/mcp`

No API key is required for the public dataset tools.

## Recommended config

Use this MCP config when the client expects a local stdio command:

```json
{
  "mcpServers": {
    "parse": {
      "command": "npx",
      "args": ["-y", "-p", "@parse-gl/mcp", "parse-mcp"]
    }
  }
}
```

If the client supports hosted MCP servers directly, this remote config also works:

```json
{
  "mcpServers": {
    "parse": {
      "transport": "http",
      "url": "https://mcp.parse.gl/mcp"
    }
  }
}
```

## Post-install smoke check

After install, confirm the server exposes these primary tools:

- `parse_search`
- `parse_get_brand`
- `parse_get_prompt`
- `parse_get_stats`

Compatibility aliases may also appear as `search` and `fetch`.

## Notes

- The repo root `README.md` is sufficient for normal installs; this file is here to remove ambiguity for autonomous setup agents.
- The public repo contains the hosted worker source plus the npm shim used by local MCP clients.
