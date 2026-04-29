import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const packageJson = require("../package.json");
const bin = await readFile(new URL("../bin/parse-gl-mcp.js", import.meta.url), "utf8");

assert.equal(packageJson.mcpName, "gl.parse/mcp");
assert.equal(packageJson.dependencies["mcp-remote"], "0.1.38");
assert.match(bin, /require\.resolve\("mcp-remote\/package\.json"\)/);
assert.doesNotMatch(bin, /\bnpx\b/);
assert.doesNotMatch(bin, /npm_execpath/);
