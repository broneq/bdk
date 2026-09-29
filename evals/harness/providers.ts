// Provider entries of the rendered configs (design D-2 "As built"). Every
// entry is `anthropic:claude-agent-sdk`; the options that keep a run isolated
// and measurable are set here once, not per suite.

export interface ProviderEntry {
  readonly id: "anthropic:claude-agent-sdk";
  /** The cell name: tests select their cell by this label. */
  readonly label: string;
  readonly config: Readonly<Record<string, unknown>>;
}

const COMMON = {
  // An API key or a logged-in Claude Code both authenticate the SDK.
  apiKeyRequired: false,
  // claude.ai connectors load unless switched off (probe 5).
  env: { ENABLE_CLAUDEAI_MCP_SERVERS: "false" },
};

export interface SessionCell {
  readonly label: string;
  readonly model: string;
  /** The arm's plugin copy, the only directory-loaded plugin of the session. */
  readonly plugin: string;
  readonly workDir: string;
  readonly debugFile: string;
  /** An empty directory as `XDG_CONFIG_HOME`: no user-level BDK layer reaches the session's kernel calls. */
  readonly configHome: string;
  readonly maxBudgetUsd: number;
  readonly maxTurns?: number;
}

/** A full Claude Code session in a fixture copy, started like a user would start it. */
export function sessionProvider(cell: SessionCell): ProviderEntry {
  return {
    id: "anthropic:claude-agent-sdk",
    label: cell.label,
    config: {
      ...COMMON,
      // Merged over the harness's own environment by the provider.
      env: {
        ...COMMON.env,
        XDG_CONFIG_HOME: cell.configHome,
        // The fixture's local config holds the identity; no user signing, hooks path or alias.
        GIT_CONFIG_GLOBAL: "/dev/null",
        GIT_CONFIG_NOSYSTEM: "1",
      },
      model: cell.model,
      working_dir: cell.workDir,
      plugins: [{ type: "local", path: cell.plugin }],
      // Project settings only: no user plugin, user CLAUDE.md or user MCP server (probe 4).
      setting_sources: ["project"],
      permission_mode: "bypassPermissions",
      allow_dangerously_skip_permissions: true,
      // The Agent tool is off without it (probe 1).
      allow_all_tools: true,
      // Otherwise promptfoo strips subagent transcripts from what the orchestrator sees (probe 3).
      forward_subagent_text: true,
      debug_file: cell.debugFile,
      max_budget_usd: cell.maxBudgetUsd,
      ...(cell.maxTurns === undefined ? {} : { max_turns: cell.maxTurns }),
    },
  };
}

export interface OneTurnCell {
  readonly label: string;
  readonly model: string;
  readonly systemPrompt: string;
  /** An empty directory: a one-turn call reads no file. */
  readonly workDir: string;
  readonly debugFile: string;
  readonly maxBudgetUsd: number;
}

/** One model turn with a fixed system prompt and no tools (design D-8). */
export function oneTurnProvider(cell: OneTurnCell): ProviderEntry {
  return {
    id: "anthropic:claude-agent-sdk",
    label: cell.label,
    config: {
      ...COMMON,
      model: cell.model,
      custom_system_prompt: cell.systemPrompt,
      tools: [],
      max_turns: 1,
      setting_sources: [],
      working_dir: cell.workDir,
      debug_file: cell.debugFile,
      max_budget_usd: cell.maxBudgetUsd,
    },
  };
}
