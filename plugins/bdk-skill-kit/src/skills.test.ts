// The kit's own skill: every generic rule explains itself for `--explain`,
// and the plugin ships `skill-check` alone.
import { readdirSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { genericRules } from "./rules/index.ts";

const skills = join(import.meta.dirname, "..", "skills");

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
});
