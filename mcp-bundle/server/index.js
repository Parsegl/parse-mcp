#!/usr/bin/env node

import { spawn } from "node:child_process";
import { createRequire } from "node:module";
import { dirname, join } from "node:path";

const MCP_URL = "https://mcp.parse.gl/mcp";
const require = createRequire(import.meta.url);
const mcpRemotePackageJson = require.resolve("mcp-remote/package.json");
const mcpRemote = join(dirname(mcpRemotePackageJson), "dist", "proxy.js");

const child = spawn(
  process.execPath,
  [mcpRemote, MCP_URL, ...process.argv.slice(2)],
  {
    stdio: "inherit",
  },
);

child.on("exit", (code, signal) => {
  if (signal) {
    process.kill(process.pid, signal);
    return;
  }

  process.exit(code ?? 0);
});
