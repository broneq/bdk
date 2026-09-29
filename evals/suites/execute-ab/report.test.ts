import { describe, expect, it } from "vitest";

import type { ResultRow } from "../../harness/results.ts";
import { executeReport } from "./report.ts";

function row(
  cell: string,
  run: number,
  metrics: Record<string, number | null>,
  cost = 5,
): ResultRow {
  return {
    suite: "execute-ab",
    series: "series-2026-09-28",
    cell,
    item: "audit-csv",
    run,
    discarded: null,
    cost,
    metrics,
    provenance: {
      models: ["claude-opus-5-5"],
      fixtureCommit: "a".repeat(40),
      bdkCommit: "b".repeat(40),
      variantHash: null,
      templateHashes: [],
    },
  };
}

function cell(name: string, acceptance: number[], completeness: number[]): ResultRow[] {
  return acceptance.map((value, index) =>
    row(name, index + 1, {
      acceptance: value,
      completeness: completeness[index] ?? 0,
      kernel_calls: null,
    }),
  );
}

function rowsWith(thinCompleteness: number[]): ResultRow[] {
  return [
    ...cell("v2", [1, 1, 0.75], [0.9, 0.8, 0.9]),
    ...cell("v3-long", [1, 1, 1], [0.9, 0.95, 1]),
    ...cell("v3-long-prime", [1, 0.75, 1], [0.95, 0.9, 1]),
    ...cell("v3-thin", [1, 1, 1], thinCompleteness),
  ];
}

describe("executeReport", () => {
  it("tabulates medians and ranges and applies the criterion: thin no worse", () => {
    const lines = executeReport(rowsWith([0.9, 1, 0.95]));
    expect(lines).toContain("| acceptance | 1 [0.75..1] | 1 [1..1] | 1 [0.75..1] | 1 [1..1] |");
    expect(lines).toContain("| kernel_calls | n/a | n/a | n/a | n/a |");
    expect(lines).toContain("thin is no worse: T41 writes thin stage skills");
    expect(lines.join("\n")).toMatch(/\| completeness \| no difference \(gap 0, noise 0\.10\) \|/);
  });

  it("falls back to approach B when the gate measures thin lower on a primary metric", () => {
    const lines = executeReport(rowsWith([0.4, 0.45, 0.5]));
    expect(lines).toContain("thin is worse on completeness: T41 falls back to approach B");
    expect(lines.join("\n")).toMatch(/v3-long higher \(gap 0\.50, noise 0\.10\)/);
  });

  it("leaves the criterion undecided below 2 counted runs and lists discarded runs", () => {
    const rows = [
      ...rowsWith([1, 1, 1]).filter((entry) => entry.cell !== "v3-thin"),
      row("v3-thin", 1, { acceptance: 1, completeness: 1 }),
      { ...row("v3-thin", 2, {}), discarded: "provider error: overloaded" },
    ];
    const lines = executeReport(rows);
    expect(lines).toContain(
      "undecided: fewer than 2 counted runs per cell on acceptance, completeness",
    );
    expect(lines).toContain("- series-2026-09-28 v3-thin run 2: provider error: overloaded");
  });
});
