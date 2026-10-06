// What each reader of the shipped pack selects (`rule-pack`, Pack layout;
// task 8.1 of v3-153-rule-paths-stages), through the built bundle: the ids
// it selected before #153 (`fixtures/rule-readers-baseline.json`) plus the
// rules the writer/checker symmetry of a stage adds (proposal.md), and no
// reader loses a rule. A role is the union over the fixture's files.
import { mkdirSync, readdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { parse } from "yaml";
import { describe, expect, it } from "vitest";

import { designed, next, passGate } from "../../src/graph/tests/bundle.ts";
import { splitFrontmatter } from "../../src/shared/store/index.ts";
import { answered, bdk } from "../support/repo.ts";
import { REPO_ROOT } from "../support/run.ts";

interface Baseline {
  readonly roles: Record<string, string[]>;
  readonly skills: Record<string, string[]>;
  readonly nodes: Record<string, string[]>;
}

const BASELINE = JSON.parse(
  readFileSync(join(import.meta.dirname, "../fixtures/rule-readers-baseline.json"), "utf8"),
) as Baseline;

const FILES = ["src/a.ts", "src/b.tsx", "src/c.js", "pnpm-lock.yaml"];
const LANGUAGES = ["languages/javascript", "languages/typescript", "languages/react"];

/** The pack directories whose rules a reader gains by the symmetry of its stage. */
const GAINS: Readonly<Record<string, readonly string[]>> = {
  "role verifier": ["code-quality", ...LANGUAGES],
  "role integration-reviewer": ["code-quality", "design-patterns", ...LANGUAGES],
  "skill design": ["security"],
  "skill adr": ["engineering-judgment", "security"],
  "skill plan": ["architecture", "code-quality"],
  "node plan": ["engineering-judgment", ...LANGUAGES],
};

/** The live (not removed) rule ids of a pack directory. */
function idsOf(dir: string): string[] {
  return readdirSync(join(REPO_ROOT, "rules", dir))
    .filter((name) => name.endsWith(".md"))
    .map((name) => {
      const text = readFileSync(join(REPO_ROOT, "rules", dir, name), "utf8");
      return parse(splitFrontmatter(text).frontmatter ?? "") as { id: string; removed?: string };
    })
    .filter((rule) => rule.removed === undefined)
    .map((rule) => rule.id);
}

function expected(reader: string, before: readonly string[]): string[] {
  return [...new Set([...before, ...(GAINS[reader] ?? []).flatMap(idsOf)])].sort();
}

/** The ids of the `- [<id>] <text>` lines of a Markdown text. */
function listed(text: string): string[] {
  return [...text.matchAll(/^- \[([A-Z][A-Z0-9-]*)\] /gm)].map((match) => match[1] ?? "");
}

describe("readers of the shipped pack", () => {
  it("each reader selects its baseline and its stage's gains, and loses nothing", () => {
    // A Change at its plan node, in a work tree of TypeScript, React, JavaScript and a lockfile.
    const { root, dir } = designed();
    writeFileSync(join(root, ".bdk/settings.yaml"), "languages: [javascript, typescript, react]\n");
    for (const file of FILES) {
      mkdirSync(dirname(join(root, file)), { recursive: true });
      writeFileSync(join(root, file), "\n");
    }
    passGate(dir, "gate:design", "plan");

    const actual: Record<string, string[]> = {};
    const wanted: Record<string, string[]> = {};
    for (const [role, before] of Object.entries(BASELINE.roles)) {
      const ids = new Set<string>();
      for (const file of FILES) {
        const shown = answered(
          bdk(["rules", "show", "--role", role, "--file", file, "--json"], root),
          "output/rules-show.json",
        ) as { rules: { id: string }[] };
        for (const rule of shown.rules) ids.add(rule.id);
      }
      actual[`role ${role}`] = [...ids].sort();
      wanted[`role ${role}`] = expected(`role ${role}`, before);
    }
    for (const [skill, before] of Object.entries(BASELINE.skills)) {
      const context = answered(bdk(["ctx", "skill", skill, "--json"], root), "output/ctx.json");
      actual[`skill ${skill}`] = listed(context.content as string).sort();
      wanted[`skill ${skill}`] = expected(`skill ${skill}`, before);
    }
    const report = next(root);
    expect(report.artifact).toMatchObject({ id: "plan" });
    actual["node plan"] = listed(report.instruction as string).sort();
    wanted["node plan"] = expected("node plan", BASELINE.nodes.plan ?? []);
    expect(actual).toStrictEqual(wanted);
  });
});
