import { describe, expect, it } from "vitest";

import type { ResultRow } from "../../harness/results.ts";
import { stagesReport } from "./report.ts";

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

  it("states an empty series", () => {
    const lines = stagesReport([]);
    expect(lines).toContain("Series: none. A case passes a run when every expectation holds.");
    expect(lines.some((line) => line.startsWith("Discarded"))).toBe(false);
  });
});
