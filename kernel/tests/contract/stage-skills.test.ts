// `stage-skills` (v3-t41-design): the two tiers of asking the user in the
// `decision` fragments, and the content of the `design` and `verify-design`
// stage skills. The kernel holds the order of the work; these tests check
// that each skill names the commands that carry it.
import { existsSync, readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { parse } from "yaml";

import { SKILL_CONTEXT } from "../../src/ctx/use-cases/manifest.ts";
import { REPO_ROOT } from "../support/run.ts";

const STAGES = join(REPO_ROOT, "skills", "stages");

function fragment(id: "lavish" | "ask-user"): string {
  return readFileSync(join(REPO_ROOT, "fragments", "decision", `${id}.md`), "utf8");
}

function readSkill(name: string): { meta: Record<string, unknown>; body: string } {
  const text = readFileSync(join(STAGES, name, "SKILL.md"), "utf8");
  const match = /^---\n([\s\S]*?)\n---\n/.exec(text);
  if (match?.[1] === undefined) throw new Error(`${name}: no frontmatter`);
  return { meta: parse(match[1]) as Record<string, unknown>, body: text.slice(match[0].length) };
}

describe("asking the user in two tiers", () => {
  it.each(["lavish", "ask-user"] as const)("%s states the simple and the rich tier", (id) => {
    const text = fragment(id);
    expect(text).toContain("**Simple decision**");
    expect(text).toContain("**Rich decision**");
    expect(text).toContain("`AskUserQuestion`");
    expect(text).toMatch(/recommended option first/);
  });

  it("lavish keeps simple decisions in the terminal and names the loop and the fallback", () => {
    const text = fragment("lavish");
    expect(text).toMatch(/Simple decision\*\*[^\n]*never through Lavish/);
    expect(text).toContain("`lavish-axi --help`");
    expect(text).toContain("`lavish-axi poll <file>`");
    expect(text).toMatch(/Fall back on any failure/);
    expect(text).toMatch(/Never reopen a session the user ended/);
  });

  it("lavish names no flag that lavish-axi --help does not print", () => {
    // `--help` is the only flag the fragment may name: every other one is the
    // CLI's to define, and `--reopen` would reopen a session the user ended.
    const flags = [...fragment("lavish").matchAll(/(?<![\w-])--[a-z][\w-]*/g)].map((m) => m[0]);
    expect([...new Set(flags)]).toStrictEqual(["--help"]);
  });

  it("ask-user states what the terminal loses and what it keeps", () => {
    const text = fragment("ask-user");
    expect(text).toMatch(/loses rendered diagrams, a side-by-side layout and annotation/);
    expect(text).toMatch(/keeps every option, the recommendation and the tradeoffs/);
    expect(text).not.toContain("lavish-axi poll");
  });
});

describe("stage skill invocation", () => {
  it("design and verify-design stay model-invocable; the user-only stages are gated", () => {
    for (const name of readdirSync(STAGES)) {
      const { meta } = readSkill(name);
      const userOnly = ["setup", "change", "plan", "execute", "close", "run"].includes(name);
      expect(meta["disable-model-invocation"] === true, name).toBe(userOnly);
    }
    expect(readdirSync(STAGES)).toEqual(expect.arrayContaining(["design", "verify-design"]));
  });
});

describe("verify-design", () => {
  it("has a manifest entry for its context lines", () => {
    expect(SKILL_CONTEXT["verify-design"]).toStrictEqual([]);
  });

  it("runs the verifier round through the kernel and the reader adapter", () => {
    const { body } = readSkill("verify-design");
    for (const needle of [
      "bdk attempt open verifier design-verify",
      "bdk dispatch build design-verify design-verifier <ticket>",
      "subagent_type: bdk:reader",
      "bdk log add report",
      "bdk attempt close <ticket>",
      "bdk done design-verify",
      "`model`",
    ]) {
      expect(body, needle).toContain(needle);
    }
    expect(body).toMatch(/resume[^.]*once/i);
  });
});

describe("design", () => {
  it("is the only design skill of the plugin", () => {
    expect(existsSync(join(REPO_ROOT, "skills", "design"))).toBe(false);
  });

  it("follows the kernel and records decisions in the ledger", () => {
    const { body } = readSkill("design");
    for (const needle of [
      "bdk next --json",
      "bdk done <id>",
      "bdk log add decision",
      "bdk log add question",
      "/bdk:verify-design",
      "bdk change status --json",
      "/bdk:plan",
      "`false-code-claim`",
    ]) {
      expect(body, needle).toContain(needle);
    }
  });

  it("links every reference it ships", () => {
    const { body } = readSkill("design");
    const references = readdirSync(join(STAGES, "design", "references"));
    expect(references.sort()).toStrictEqual(["approaches.md", "schema-gate.md"]);
    for (const file of references) expect(body).toContain(`](references/${file})`);
  });
});
