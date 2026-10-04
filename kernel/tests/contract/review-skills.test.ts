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

  it("grants the report tools and takes --report", () => {
    const { meta } = skill();
    const allowed = ` ${String(meta["allowed-tools"])} `;
    for (const tool of ["AskUserQuestion", "Bash(lavish-axi *)", "Bash(gh issue create *)"]) {
      expect(allowed, tool).toContain(` ${tool} `);
    }
    expect(String(meta["argument-hint"])).toContain("--report");
  });

  it("ends with the human report and records every answer through the kernel", () => {
    const { body } = skill();
    for (const needle of [
      "bdk review render",
      "bdk log decide",
      "lavish-axi poll",
      "--format md",
      "defer --review",
      "/bdk:run",
      "gh issue create",
      "{kind: instruction}",
      "--issue",
    ]) {
      expect(body, needle).toContain(needle);
    }
    expect(body).toMatch(/`fix`[^.]*starts? a new round/);
    expect(body).toMatch(/every (submitted )?id[^.]*accounted for/i);
  });

  it("triages every live entry of the Change without a level, whichever stage wrote it", () => {
    const { body } = skill();
    expect(body).toMatch(/without a level, whichever stage wrote it/);
    // The report triages first: a ticket close can write an entry, and `--report` runs no round.
    expect(body).toMatch(/## Report\n\n[^#]*First triage every live entry/);
    expect(body).toMatch(/`--report` runs no round/);
  });
});

describe("/bdk:pr-review", () => {
  const skill = (): Skill => readSkill("pr-review");

  it("lives under skills/tools/ and drops the v2 reviewer prompt", () => {
    expect(existsSync(join(TOOLS, "pr-review", "SKILL.md"))).toBe(true);
    expect(existsSync(join(REPO_ROOT, "skills", "pr-review"))).toBe(false);
    expect(existsSync(join(TOOLS, "pr-review", "references", "reviewer-prompt.md"))).toBe(false);
    expect(existsSync(join(TOOLS, "pr-review", "references", "comment-templates.md"))).toBe(true);
  });

  it("stays within 200 lines, edits nothing and names no model", () => {
    const { meta, lines } = skill();
    expect(lines).toBeLessThanOrEqual(200);
    expect(meta["disallowed-tools"]).toBe("Edit Write NotebookEdit");
    expect(meta).not.toHaveProperty("model");
  });

  it("starts the forked pr-reviewer role through Skill, never through Agent", () => {
    const { meta, body } = skill();
    const allowed = ` ${String(meta["allowed-tools"])} `;
    expect(allowed).toContain(" Skill ");
    expect(allowed).not.toContain(" Agent ");
    expect(body).toContain("`bdk:pr-reviewer`");
    expect(body).toMatch(/one PR after another/);
    expect(body).not.toContain("/bdk:cr --inline");
    for (const text of skillFiles("pr-review")) {
      for (const agent of V2_AGENTS) expect(text).not.toContain(agent);
    }
  });

  it("builds the PR brief with every field and the Change contract", () => {
    const { body } = skill();
    for (const field of [
      "worktree",
      "<merge-base>..<head>",
      "stack parent",
      "draft",
      "mode",
      "focus",
      "intent",
      ".bdk/changes/",
      ".bdk/changes/archive/",
      "change.md",
      "decision",
    ]) {
      expect(body, field).toContain(field);
    }
  });

  it("lets the user decide each finding on a Lavish page before any GitHub call", () => {
    const { meta, body } = skill();
    expect(` ${String(meta["allowed-tools"])} `).toContain(" Bash(lavish-axi *) ");
    expect(String(meta["argument-hint"])).toContain("--quick");
    for (const needle of ["bdk review render --pr -", "lavish-axi poll", "--out"]) {
      expect(body, needle).toContain(needle);
    }
    for (const choice of ["`blocker`", "`nice-to-have`", "`tracker`", "`drop`"]) {
      expect(body, choice).toContain(choice);
    }
    const decide = body.indexOf("lavish-axi poll");
    expect(body.indexOf("/reviews")).toBeGreaterThan(decide);
    expect(body).toMatch(/every finding id[^.]*accounted for/i);
  });

  it("falls back to the AskUserQuestion confirmation on --quick or any Lavish failure", () => {
    const { body } = skill();
    const confirm = body.slice(body.indexOf("## Confirm"), body.indexOf("## Post"));
    expect(confirm).toMatch(/^## Confirm\n\nWith `--quick`/);
    expect(confirm).toContain("`AskUserQuestion`");
    expect(body).toMatch(/`lavish-axi` exits non-zero|reply does not parse/);
    expect(body).toContain("features.lavish");
  });

  it("files a tracker finding as the tracker setting says and lists it in the summary", () => {
    const { body } = skill();
    expect(body).toContain("gh issue create");
    expect(body).toContain("{kind: instruction}");
    expect(body).toMatch(/`drop`[^.]*not posted/);
    const templates = readFileSync(
      join(TOOLS, "pr-review", "references", "comment-templates.md"),
      "utf8",
    );
    const review = templates.slice(
      templates.indexOf("## 3. Review summary"),
      templates.indexOf("## 4."),
    );
    const verify = templates.slice(templates.indexOf("## 4."), templates.indexOf("## Posting"));
    for (const summary of [review, verify]) expect(summary).toContain("**Tracked issues**");
  });

  it("confirms every verdict before any GitHub call and computes it from the policy table", () => {
    const { body } = skill();
    const confirm = body.indexOf("AskUserQuestion");
    const post = body.indexOf("/reviews");
    expect(confirm).toBeGreaterThan(-1);
    expect(post).toBeGreaterThan(confirm);
    expect(body).toMatch(/\| Result block\s+\| Computed verdict/);
    expect(body).toContain("`COMMENT`");
    expect(body).toMatch(/failed/);
  });
});
