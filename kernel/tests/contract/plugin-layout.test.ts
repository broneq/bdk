// `plugin-tooling` (v3-t42-review-skills, T42-E): the agents the plugin ships
// with web-researcher's tool allowlist (T32), no `bdk-*` meta-skill, the tools
// skill directory, and no reference left to a removed v2 agent.
import { execFileSync } from "node:child_process";
import { existsSync, readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { parse } from "yaml";

import { SKILL_CONTEXT } from "../../src/ctx/use-cases/manifest.ts";
import { pluginSkillDirs } from "../support/plugin-skills.ts";
import { REPO_ROOT } from "../support/run.ts";
import { MIGRATION_PAGE_PATH } from "../support/user-facing.ts";

const REMOVED_AGENTS = [
  "implementer",
  "fixer",
  "plan-verifier",
  "design-verifier",
  "code-reviewer",
  "architecture-reviewer",
  "test-runner",
  "static-analyse",
  "explorer",
  "log-analyzer",
  "dead-code-detector",
  "duplicate-detector",
];

describe("plugin layout", () => {
  it("ships exactly the eight adapters and web-researcher", () => {
    const agents = readdirSync(join(REPO_ROOT, "agents"))
      .filter((name) => name.endsWith(".md"))
      .sort();
    expect(agents).toStrictEqual([
      "integrator.md",
      "judge.md",
      "lead.md",
      "reader.md",
      "reviewer.md",
      "runner.md",
      "scout.md",
      "web-researcher.md",
      "worker.md",
    ]);
  });

  it("keeps web-researcher on its five read and web tools", () => {
    const text = readFileSync(join(REPO_ROOT, "agents", "web-researcher.md"), "utf8");
    const frontmatter = /^---\n([\s\S]*?)\n---/.exec(text)?.[1] ?? "";
    const { tools } = parse(frontmatter) as { tools?: unknown };
    expect(tools).toStrictEqual(["WebSearch", "WebFetch", "Read", "Grep", "Glob"]);
  });

  it("ships no bdk-* meta-skill, and the context manifest holds none", () => {
    const dirs = readdirSync(join(REPO_ROOT, "skills"), { withFileTypes: true })
      .filter((entry) => entry.isDirectory())
      .map((entry) => entry.name);
    expect(dirs.filter((name) => name.startsWith("bdk-"))).toStrictEqual([]);
    expect(Object.keys(SKILL_CONTEXT).filter((name) => name.startsWith("bdk-"))).toStrictEqual([]);
  });

  it("lists skills/tools/ and holds each review skill there only", () => {
    expect(pluginSkillDirs(REPO_ROOT)).toContain("skills/tools");
    expect(existsSync(join(REPO_ROOT, "skills", "cr"))).toBe(false);
    expect(existsSync(join(REPO_ROOT, "skills", "pr-review"))).toBe(false);
  });

  it("keeps every skill name unique across the skill directories", () => {
    const names = pluginSkillDirs(REPO_ROOT).flatMap((dir) =>
      readdirSync(join(REPO_ROOT, dir), { withFileTypes: true })
        .filter(
          (entry) =>
            entry.isDirectory() && existsSync(join(REPO_ROOT, dir, entry.name, "SKILL.md")),
        )
        .map((entry) => entry.name),
    );
    expect(names.filter((name, at) => names.indexOf(name) !== at)).toStrictEqual([]);
  });

  it("names no removed agent anywhere the plugin or its guide ships", () => {
    // POSIX ERE has no \b: a name ends at a character that cannot continue it.
    // The migration page maps each removed agent to its adapter.
    const pattern = `bdk:(${REMOVED_AGENTS.join("|")})([^a-z0-9-]|$)`;
    let found = "";
    try {
      found = execFileSync(
        "git",
        [
          "grep",
          "-nE",
          pattern,
          "--",
          "skills/",
          "agents/",
          "rules/",
          "hooks/",
          "STARTUP_INSTRUCTIONS.md",
          "README.md",
          "docs/guide/",
          `:!${MIGRATION_PAGE_PATH}`,
        ],
        { cwd: REPO_ROOT, encoding: "utf8" },
      );
    } catch (error) {
      // git grep exits 1 when nothing matches.
      if ((error as { status?: number }).status !== 1) throw error;
    }
    expect(found).toBe("");
  });

  // `plugin-tooling`, Plugin names no removed MCP server. The removed-key
  // registry names the old feature switches so that config check can refuse
  // them; tests name them as inputs and as text that must not appear; the
  // migration page tells a v2 user what became of them.
  it("names no removed MCP server, its tools or uvx in what it ships", () => {
    let found = "";
    try {
      found = execFileSync(
        "git",
        [
          "grep",
          "-nE",
          "mcp__plugin_bdk|code-review-graph|serena|uvx",
          "--",
          ".claude-plugin/",
          "skills/",
          "agents/",
          "rules/",
          "hooks/",
          "plugins/",
          "STARTUP_INSTRUCTIONS.md",
          "README.md",
          "docs/guide/",
          "kernel/src/",
          ":!kernel/src/**/tests/**",
          ":!kernel/src/shared/config/known.ts",
          `:!${MIGRATION_PAGE_PATH}`,
        ],
        { cwd: REPO_ROOT, encoding: "utf8" },
      );
    } catch (error) {
      // git grep exits 1 when nothing matches.
      if ((error as { status?: number }).status !== 1) throw error;
    }
    expect(found).toBe("");
  });

  it("keeps the STARTUP agents table on the seven remaining agents", () => {
    const startup = readFileSync(join(REPO_ROOT, "STARTUP_INSTRUCTIONS.md"), "utf8");
    for (const name of REMOVED_AGENTS) expect(startup).not.toContain(`bdk:${name}\``);
  });
});
