// The seeded-violation suite: `fixtures/clean/` passes every generic rule, and
// each `fixtures/violations/<rule-id>/` is an overlay that, copied over the
// clean tree, breaks exactly that rule. Runs the committed CLI bundle.
import { spawnSync } from "node:child_process";
import { cpSync, mkdtempSync, readdirSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { genericRules } from "./rules/index.ts";

const kit = join(import.meta.dirname, "..");
const bin = join(kit, "dist", "skill-check.mjs");
const fixtures = join(kit, "fixtures");
const violations = readdirSync(join(fixtures, "violations")).sort();

function materialise(overlay?: string): string {
  const root = mkdtempSync(join(tmpdir(), "skill-check-fixture-"));
  cpSync(join(fixtures, "clean"), root, { recursive: true });
  if (overlay)
    cpSync(join(fixtures, "violations", overlay), root, { recursive: true, force: true });
  return root;
}

function check(root: string, args: string[] = []) {
  const run = spawnSync(process.execPath, [bin, "--json", ...args], {
    cwd: root,
    encoding: "utf8",
  });
  expect(run.stderr).toBe("");
  const out = JSON.parse(run.stdout) as {
    findings: { rule: string; file: string; line: number; message: string }[];
  };
  return { code: run.status, findings: out.findings };
}

describe("fixtures", () => {
  it("clean tree passes every rule", () => {
    expect(check(materialise())).toEqual({ code: 0, findings: [] });
  });

  it("the clean config enables every catalogue rule", () => {
    const run = spawnSync(process.execPath, [bin, "--list-rules", "--json"], {
      cwd: materialise(),
      encoding: "utf8",
    });
    expect(JSON.parse(run.stdout)).toEqual(genericRules.map((r) => r.id).sort());
  });

  it("every catalogue rule has exactly one violation fixture", () => {
    expect(violations).toEqual(genericRules.map((r) => r.id).sort());
  });

  it.each(violations)("%s: the seeded violation fails only that rule", (rule) => {
    const { code, findings } = check(materialise(rule));
    expect(findings.length, "the fixture must seed a violation").toBeGreaterThan(0);
    expect(findings.filter((f) => f.rule !== rule)).toEqual([]);
    expect(code).toBe(1);
  });
});
