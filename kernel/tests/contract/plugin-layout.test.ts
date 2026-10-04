// `plugin-tooling` (v3-t42-review-skills, T42-E): the agents the plugin ships,
// no `bdk-*` meta-skill, the tools skill directory, and no reference left to
// a removed v2 agent.
import { execFileSync } from "node:child_process";
import { existsSync, readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

import { SKILL_CONTEXT } from "../../src/ctx/use-cases/manifest.ts";
import { pluginSkillDirs } from "../support/plugin-skills.ts";
import { REPO_ROOT } from "../support/run.ts";

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
  it("ships exactly the six adapters and web-researcher", () => {
    const agents = readdirSync(join(REPO_ROOT, "agents"))
      .filter((name) => name.endsWith(".md"))
      .sort();
    expect(agents).toStrictEqual([
      "lead.md",
      "reader.md",
      "reviewer.md",
      "runner.md",
      "scout.md",
      "web-researcher.md",
      "worker.md",
    ]);
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
