import { readdirSync, readFileSync } from "node:fs";
import { join, relative, sep } from "node:path";
import { describe, expect, it } from "vitest";

import { RULE_KINDS, RULE_STAGES } from "../src/config/index.ts";
import { isRuleFile, KINDS, parseRule, STAGES } from "../src/rules/domain/rule.ts";
import type { Rule } from "../src/rules/domain/rule.ts";

// The BDK rule pack as shipped (spec `rule-pack`, "BDK pack and language packs" and "Admission by
// measurement"): every file valid, and every rule admitted by a measurement on record.

const PACK = join(import.meta.dirname, "..", "rules");
const REPO = join(import.meta.dirname, "..", "..", "..");
const ADMITTED = ["effective", "corrects the model"];

function walk(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) =>
    entry.isDirectory() ? walk(join(dir, entry.name)) : [join(dir, entry.name)],
  );
}

const files = walk(PACK)
  .map((path) => relative(PACK, path).split(sep).join("/"))
  .filter(isRuleFile)
  .sort();

const parsed = files.map((relPath) => ({
  relPath,
  rule: parseRule({
    relPath,
    file: `rules/${relPath}`,
    content: readFileSync(join(PACK, relPath), "utf8"),
  }),
}));

const rules = parsed.flatMap(({ rule }) => (typeof rule === "string" ? [] : [rule]));

/** The class cell of the bullet's row in a report's per-bullet table, if the row exists. */
function classOf(report: string, bullet: string): string | undefined {
  for (const line of report.split("\n")) {
    const cells = line.split("|").map((cell) => cell.trim());
    // | id | haiku | sonnet | with | without | class | correction |
    if (cells[1] === bullet && cells.length >= 8) return cells[6];
  }
  return undefined;
}

describe("BDK rule pack", () => {
  it("holds rules", () => {
    expect(files.length).toBeGreaterThan(0);
  });

  it.each(parsed.map(({ relPath, rule }) => [relPath, rule]))("%s is valid", (_, rule) => {
    expect(typeof rule === "string" ? rule : "valid").toBe("valid");
  });

  it("uses unique ids with the BDK- prefix", () => {
    const ids = rules.map((rule) => rule.id);
    expect(ids.filter((id) => !id.startsWith("BDK-"))).toEqual([]);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it("uses the stages and kinds the configuration accepts for a project rule", () => {
    expect(RULE_STAGES).toEqual(STAGES);
    expect(RULE_KINDS).toEqual(KINDS);
  });

  it("keeps the plan stage only in the rules a plan decides", () => {
    const plan = rules.filter((rule) => rule.stages.includes("plan")).map((rule) => rule.id);
    expect(plan.sort()).toEqual(["BDK-ARCH-3", "BDK-ARCH-4", "BDK-CQ-1"]);
  });

  it("ships the javascript, typescript and react language packs, each for its own files", () => {
    const globs = (language: string): string[] => [
      ...new Set(rules.filter((rule) => rule.language === language).flatMap((rule) => rule.paths)),
    ];
    expect(globs("javascript").sort()).toEqual(["**/*.cjs", "**/*.js", "**/*.jsx", "**/*.mjs"]);
    expect(globs("typescript").sort()).toEqual(["**/*.cts", "**/*.mts", "**/*.ts", "**/*.tsx"]);
    expect(globs("react").sort()).toEqual(["**/*.jsx", "**/*.tsx"]);
  });

  it.each(rules.map((rule): [string, Rule] => [rule.id, rule]))(
    "%s names a measurement that shows its effect",
    (_, rule) => {
      expect(rule.measured, `${rule.file} has no measured field`).not.toBeNull();
      const { report, bullet, class: cls } = rule.measured ?? { report: "", bullet: "", class: "" };
      expect(ADMITTED).toContain(cls);
      const text = readFileSync(join(REPO, report), "utf8");
      expect(classOf(text, bullet), `${report} has no row ${bullet} of class ${cls}`).toBe(cls);
    },
  );
});
