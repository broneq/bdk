import { mkdirSync, mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

import type { ResultRow } from "../../harness/results.ts";
import { expectationLines, stagesReport } from "./report.ts";

function row(item: string, run: number, pass: number, discarded: string | null = null): ResultRow {
  return {
    suite: "stages",
    series: "probe-setup",
    cell: "bdk",
    item,
    run,
    discarded,
    cost: 0.5,
    metrics: { expect_pass: pass, questions: 2, turns: 10 },
    provenance: {
      models: [],
      fixtureCommit: null,
      bdkCommit: "c",
      variantHash: null,
      templateHashes: [],
    },
  };
}

describe("stagesReport", () => {
  it("counts passed runs per case and lists discarded runs", () => {
    const lines = stagesReport([
      row("setup/fresh-project", 1, 1),
      row("setup/fresh-project", 2, 0),
      row("setup/v2-project", 1, 1, "provider error: x"),
    ]);
    expect(lines).toContain("| setup/fresh-project | 1/2 | 2 | 10 | n/a | 0.50 |");
    expect(lines).toContain("| setup/v2-project | 0/0 | n/a | n/a | n/a | n/a |");
    expect(lines).toContain("- setup/v2-project run 1: provider error: x");
  });

  it("reports the median refusals and names an unmet acceptance row", () => {
    const flat = {
      ...row("execute/flat", 1, 1),
      metrics: { expect_pass: 1, refusals: 2, "refusal:policy/missing-citation": 2 },
    };
    const lines = stagesReport([flat]);
    expect(lines).toContain("| execute/flat | 1/1 | n/a | n/a | 2 | 0.50 |");
    expect(lines).toContain("- execute/flat run 1: policy/missing-citation refused 2 time(s)");
  });

  it("lists the runs whose journal and transcript refusal totals differ", () => {
    const metrics = (journal: number, transcript: number) => ({
      expect_pass: 1,
      refusals: journal,
      "refusals-transcript": transcript,
    });
    const lines = stagesReport([
      { ...row("execute/a", 1, 1), metrics: metrics(4, 3) },
      { ...row("execute/a", 2, 1), metrics: metrics(2, 2) },
      { ...row("execute/b", 1, 1), metrics: { ...metrics(3, 3), "journal-missing": 1 } },
    ]);
    const at = lines.indexOf("Refusal totals differ (journal, transcript):");
    expect(at).toBeGreaterThan(0);
    expect(lines.slice(at + 2)).toContain("- execute/a run 1: journal 4, transcript 3");
    expect(lines.join("\n")).not.toContain("execute/a run 2: journal");
    expect(lines).toContain("Runs without a journal report (transcript counts): execute/b run 1.");
  });

  it("states an empty series", () => {
    const lines = stagesReport([]);
    expect(lines).toContain("Series: none. A case passes a run when every expectation holds.");
    expect(lines.some((line) => line.startsWith("Discarded"))).toBe(false);
  });
});

describe("expectationLines", () => {
  it("names each counted run's result and the failed expectations from its checks.json", () => {
    const raw = mkdtempSync(join(tmpdir(), "stages-raw-"));
    const dir = join(raw, "bdk", "run/run-auto.run-1");
    mkdirSync(dir, { recursive: true });
    writeFileSync(
      join(dir, "checks.json"),
      JSON.stringify({ pass: false, failures: ["reply does not match /gate:design/"] }),
    );
    const lines = expectationLines(
      [row("run/run-auto", 1, 0), row("run/run-close", 1, 1), row("run/x", 1, 0, "provider error")],
      raw,
    );
    expect(lines).toStrictEqual([
      `expectations: run/run-auto run 1 FAILED: reply does not match /gate:design/ (${join(dir, "checks.json")})`,
      "expectations: run/run-close run 1 met every expectation",
    ]);
  });
});
