// The kit's own skill: every generic rule explains itself for `--explain`,
// the plugin ships `skill-check` alone, and that skill passes the built CLI
// with the kit's config (the self-check).
import { spawnSync } from "node:child_process";
import { readdirSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { genericRules } from "./rules/index.ts";

const kit = join(import.meta.dirname, "..");
const skills = join(kit, "skills");

describe("kit skills", () => {
  it("every generic rule explains itself and names each of its options", () => {
    for (const rule of genericRules) {
      expect(rule.explain, rule.id).toMatch(/\S/);
      for (const option of Object.keys(rule.defaultOptions ?? {})) {
        expect(rule.explain, `${rule.id}: option ${option}`).toContain(`\`${option}\``);
      }
    }
  });

  it("ships skill-check and no other skill", () => {
    expect(readdirSync(skills)).toEqual(["skill-check"]);
  });

  it("pass every rule of skill-check.config.ts with the built CLI", () => {
    const run = spawnSync(process.execPath, [join(kit, "dist", "skill-check.mjs")], {
      cwd: kit,
      encoding: "utf8",
    });
    expect(run.stderr).toBe("");
    expect(run.status, run.stdout).toBe(0);
  });
});
