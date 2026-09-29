// The per-run isolation check (design D-3): the session's debug log must show
// exactly the arm's plugin copy and disabled claude.ai connectors, and the run
// must not have called an MCP tool. A run that fails is discarded, not counted.

export interface IsolationInput {
  /** The session's `debug_file` content; undefined when the file is missing. */
  readonly debugLog: string | undefined;
  readonly toolCalls: readonly { readonly name: string }[];
  /** Directory-loaded plugins the arm passes: 1 for a session with its plugin copy, 0 for a one-turn call. */
  readonly expectedPlugins?: number;
}

/** The discard reason, or null when the run was isolated. */
export function checkIsolation(input: IsolationInput): string | null {
  if (input.debugLog === undefined) return "no session log: the run's debug_file is missing";
  const expected = input.expectedPlugins ?? 1;
  // A session without a directory plugin logs no "Loaded N" line at all (probe 9).
  const loaded = Number(/Loaded (\d+) directory-loaded plugins/.exec(input.debugLog)?.[1] ?? 0);
  if (loaded !== expected) {
    return `expected ${expected} directory-loaded plugin, the session log shows ${loaded} directory-loaded plugins`;
  }
  if (!input.debugLog.includes("[claudeai-mcp] Disabled via env var")) {
    return "claude.ai connectors were not disabled (ENABLE_CLAUDEAI_MCP_SERVERS)";
  }
  const mcp = input.toolCalls.find((call) => call.name.startsWith("mcp__"));
  if (mcp !== undefined) return `MCP tool call ${mcp.name}`;
  return null;
}
