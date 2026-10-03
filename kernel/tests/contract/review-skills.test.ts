// `review-skills` (v3-t42-review-skills): the shape of `/bdk:cr` and
// `/bdk:pr-review` under skills/tools/, and the kernel commands each names.
// The kernel holds the order of a review round; these tests check that the
// skill names the commands that carry it and writes no file of its own.
import { existsSync, readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { parse } from "yaml";

import { REPO_ROOT } from "../support/run.ts";

const TOOLS = join(REPO_ROOT, "skills", "tools");
const KERNEL_PAIR = 'Bash(node "${CLAUDE_PLUGIN_ROOT}/dist/bdk.mjs" *) Bash(echo *)';
const V2_AGENTS = [
  "bdk:code-reviewer",
  "bdk:architecture-reviewer",
  "bdk:duplicate-detector",
  "bdk:dead-code-detector",
  "bdk:static-analyse",
  "bdk:test-runner",
  "general-purpose",
];

interface Skill {
  readonly meta: Record<string, unknown>;
  readonly body: string;
  readonly lines: number;
}

function readSkill(name: string): Skill {
  const text = readFileSync(join(TOOLS, name, "SKILL.md"), "utf8");
  const match = /^---\n([\s\S]*?)\n---\n/.exec(text);
  if (match?.[1] === undefined) throw new Error(`${name}: no frontmatter`);
  return {
    meta: parse(match[1]) as Record<string, unknown>,
    body: text.slice(match[0].length),
    lines: text.split("\n").length,
  };
}

/** Every file of a skill directory, for the checks that cover references too. */
function skillFiles(name: string): string[] {
  const dir = join(TOOLS, name);
  return readdirSync(dir, { recursive: true, withFileTypes: true })
    .filter((entry) => entry.isFile())
    .map((entry) => readFileSync(join(entry.parentPath, entry.name), "utf8"));
}

describe("/bdk:cr", () => {
  const skill = (): Skill => readSkill("cr");

  it("lives under skills/tools/ and replaces skills/cr/", () => {
    expect(existsSync(join(TOOLS, "cr", "SKILL.md"))).toBe(true);
    expect(existsSync(join(REPO_ROOT, "skills", "cr"))).toBe(false);
  });

  it("stays within 200 lines and opens with its context lines", () => {
    expect(skill().lines).toBeLessThanOrEqual(200);
    expect(skill().body.trimStart()).toMatch(
      /^!`node "\$\{CLAUDE_PLUGIN_ROOT\}\/dist\/bdk\.mjs" ctx skill cr /,
    );
  });

  it("edits nothing and writes only through the kernel", () => {
    const { meta, body } = skill();
    expect(meta["disallowed-tools"]).toBe("Edit Write NotebookEdit");
    const allowed = String(meta["allowed-tools"]);
    expect(allowed.startsWith(KERNEL_PAIR)).toBe(true);
    for (const tool of [
      "Agent",
      "SendMessage",
      "Skill",
      "Read",
      "Bash(git diff *)",
      "Bash(git log *)",
    ]) {
      expect(` ${allowed} `).toContain(` ${tool} `);
    }
    expect(allowed).not.toContain("Write(");
    expect(body).not.toContain(".bdk/cr/");
    expect(body).not.toContain("bdk_run_state.py");
  });

  it("stays model-invocable so /bdk:run can start it", () => {
    expect(skill().meta).not.toHaveProperty("disable-model-invocation");
  });

  it("names no v2 agent", () => {
    for (const text of skillFiles("cr")) {
      for (const agent of V2_AGENTS) expect(text).not.toContain(agent);
    }
  });

  it("names the commands of a round", () => {
    const { body } = skill();
    for (const needle of [
      "--kind review",
      "bdk review plan",
      "bdk attempt open review-fix",
      "--group",
      "bdk log list --since-ticket-start",
      "bdk log triage",
      "@merge",
      "bdk commit <change-id>",
      "bdk log resolve",
      "bdk done review",
      "--escalate",
      "bdk:swarm",
    ]) {
      expect(body, needle).toContain(needle);
    }
  });

  it("acts on every rung the ladder returns after a failed round", () => {
    const { body } = skill();
    for (const action of ["`retry`", "`narrow`", "`escalate`", "`parked`"]) {
      expect(body, action).toContain(action);
    }
  });

  it("has an inline mode that starts no agent and fixes nothing", () => {
    const { body } = skill();
    expect(body).toContain("--inline");
    expect(body).toMatch(/no `Agent` call/);
  });
});
