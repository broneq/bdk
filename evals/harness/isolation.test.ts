import { describe, expect, it } from "vitest";

import { checkIsolation } from "./isolation.ts";

const CLEAN = [
  "2026-09-28T18:09:13.591Z [DEBUG] Loaded 1 directory-loaded plugins",
  "2026-09-28T18:09:13.600Z [DEBUG] [claudeai-mcp] Disabled via env var",
].join("\n");

describe("checkIsolation", () => {
  it("accepts one directory-loaded plugin, disabled connectors and no MCP tool call", () => {
    expect(checkIsolation({ debugLog: CLEAN, toolCalls: [{ name: "Bash" }] })).toBeNull();
  });

  it("discards a run with a second directory-loaded plugin", () => {
    const log = CLEAN.replace("Loaded 1 directory", "Loaded 2 directory");
    expect(checkIsolation({ debugLog: log, toolCalls: [] })).toMatch(/2 directory-loaded plugins/);
  });

  it("discards a run whose claude.ai connectors were not disabled", () => {
    const log = CLEAN.replace("Disabled via env var", "Fetched 5 servers");
    expect(checkIsolation({ debugLog: log, toolCalls: [] })).toMatch(/claude.ai connectors/);
  });

  it("discards a run with an MCP tool call, naming the tool", () => {
    expect(
      checkIsolation({ debugLog: CLEAN, toolCalls: [{ name: "mcp__serena__find_symbol" }] }),
    ).toMatch(/mcp__serena__find_symbol/);
  });

  it("expects no directory-loaded plugin in a one-turn call", () => {
    const oneTurn = "2026-09-28T18:21:49.521Z [DEBUG] [claudeai-mcp] Disabled via env var";
    expect(checkIsolation({ debugLog: oneTurn, toolCalls: [], expectedPlugins: 0 })).toBeNull();
    expect(checkIsolation({ debugLog: CLEAN, toolCalls: [], expectedPlugins: 0 })).toMatch(
      /shows 1 directory-loaded/,
    );
    expect(checkIsolation({ debugLog: oneTurn, toolCalls: [] })).toMatch(
      /shows 0 directory-loaded/,
    );
  });

  it("discards a run without a session log", () => {
    expect(checkIsolation({ debugLog: undefined, toolCalls: [] })).toMatch(/no session log/);
  });
});
