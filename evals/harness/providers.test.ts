import { describe, expect, it } from "vitest";

import { oneTurnProvider, sessionProvider } from "./providers.ts";

describe("providers", () => {
  it("isolates a session: one plugin, project settings only, no user BDK or git config, connectors off, subagent text forwarded", () => {
    const entry = sessionProvider({
      label: "v3-thin",
      model: "claude-opus-5-5",
      plugin: "/p",
      workDir: "/w",
      debugFile: "/d.log",
      configHome: "/x",
      maxBudgetUsd: 15,
    });
    expect(entry).toMatchObject({
      id: "anthropic:claude-agent-sdk",
      label: "v3-thin",
      config: {
        apiKeyRequired: false,
        plugins: [{ type: "local", path: "/p" }],
        setting_sources: ["project"],
        allow_all_tools: true,
        forward_subagent_text: true,
        debug_file: "/d.log",
        max_budget_usd: 15,
        env: {
          ENABLE_CLAUDEAI_MCP_SERVERS: "false",
          XDG_CONFIG_HOME: "/x",
          GIT_CONFIG_GLOBAL: "/dev/null",
          GIT_CONFIG_NOSYSTEM: "1",
        },
      },
    });
    expect(entry.config).not.toHaveProperty("max_turns");
    const capped = sessionProvider({
      label: "x",
      model: "m",
      plugin: "/p",
      workDir: "/w",
      debugFile: "/d",
      configHome: "/x",
      maxBudgetUsd: 1,
      maxTurns: 9,
    });
    expect(capped.config).toHaveProperty("max_turns", 9);
    expect(entry.config).not.toHaveProperty("ask_user_question");
    const asking = sessionProvider({
      label: "x",
      model: "m",
      plugin: "/p",
      workDir: "/w",
      debugFile: "/d",
      configHome: "/x",
      maxBudgetUsd: 1,
      askUserQuestion: true,
    });
    expect(asking.config).toHaveProperty("ask_user_question", { behavior: "first_option" });
  });

  it("gives a one-turn call no tools and no settings", () => {
    const entry = oneTurnProvider({
      label: "haiku",
      model: "claude-haiku-4-5-20251001",
      systemPrompt: "Answer.",
      workDir: "/e",
      debugFile: "/d.log",
      maxBudgetUsd: 1,
    });
    expect(entry.config).toMatchObject({
      custom_system_prompt: "Answer.",
      tools: [],
      max_turns: 1,
      setting_sources: [],
    });
    expect(entry.config).not.toHaveProperty("plugins");
  });
});
