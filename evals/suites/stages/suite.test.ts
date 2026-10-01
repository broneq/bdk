import { join } from "node:path";

import { describe, expect, it } from "vitest";

import { readVersions } from "../../harness/paths.ts";
import { caseFile, readCases } from "./cases.ts";
import { CASE_VAR } from "./hooks.ts";
import { describeStages, stageSkill } from "./suite.ts";

const REPO_ROOT = join(import.meta.dirname, "..", "..", "..");

describe("stageSkill", () => {
  it("takes the name with or without the plugin prefix", () => {
    expect(stageSkill("setup")).toBe("setup");
    expect(stageSkill("bdk:change")).toBe("change");
    expect(stageSkill("bdk:design")).toBe("design");
    expect(stageSkill("verify-design")).toBe("verify-design");
    expect(stageSkill("bdk:plan")).toBe("plan");
    expect(stageSkill("verify-plan")).toBe("verify-plan");
  });

  it("refuses a skill without a case file", () => {
    expect(() => stageSkill("bdk:execute")).toThrow(/setup, change/);
    expect(() => stageSkill(undefined)).toThrow(/got nothing/);
  });
});

describe("describeStages", () => {
  it("runs every case once per run in one cell with the plugin's bundle", () => {
    const cases = readCases(caseFile("change"));
    const setup = describeStages({
      skill: "change",
      series: "probe-change",
      dir: "/runs/s",
      sandbox: "/sandbox",
      cases,
      plugin: REPO_ROOT,
      bdkCommit: "c".repeat(40),
      fixtureBase: "/cache/fixture",
      emptyBase: "/sandbox/empty-base",
      versions: readVersions(),
      runs: 1,
      budgetUsd: 10,
      runCapUsd: 3,
      ledgerFile: "/runs/budget.json",
      resultsFile: "/results/rows.jsonl",
    });
    expect(Object.keys(setup.cells)).toEqual(["bdk"]);
    const cell = setup.cells.bdk;
    expect(cell?.plan.workDir).toBe("/sandbox/work/bdk");
    expect(cell?.provider.config).toHaveProperty("ask_user_question");
    expect(cell?.plan.settings).toEqual({
      bundle: join(REPO_ROOT, "dist", "bdk.mjs"),
      configHome: "/sandbox/config-home",
      emptyBase: "/sandbox/empty-base",
    });
    expect(cell?.plan.provenance.variantHash).toMatch(/^[0-9a-f]{64}$/);
    expect(setup.items.map((item) => item.id)).toEqual(cases.map((stage) => `change/${stage.id}`));
    const [first] = setup.items;
    expect(first?.vars.bdk_prompt).toBe(cases[0]?.command);
    expect(JSON.parse(first?.vars[CASE_VAR] ?? "")).toEqual(cases[0]);
  });
});
