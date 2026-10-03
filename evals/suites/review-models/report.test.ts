import { describe, expect, it } from "vitest";

import type { ResultRow } from "../../harness/results.ts";
import { criterion, reviewModelsReport } from "./report.ts";

function row(
  cell: string,
  run: number,
  recall: Record<string, number>,
  discarded: string | null = null,
): ResultRow {
  return {
    suite: "review-models",
    series: "series-1",
    cell,
    item: "review",
    run,
    discarded,
    cost: 4,
    metrics: { false_alarms: 1, ...recall },
    provenance: {
      models: [],
      fixtureCommit: null,
      bdkCommit: "c",
      variantHash: null,
      templateHashes: [],
    },
  };
}

const SAME = { recall_logic: 0.5, "recall_test-gap": 0.5, recall_integration: 0 };
const BETTER = { recall_logic: 1, "recall_test-gap": 0.5, recall_integration: 1 };

describe("criterion", () => {
  it("moves the reviewer to opus only on a measurable recall gain with no loss", () => {
    const sonnet = [row("sonnet", 1, SAME), row("sonnet", 2, SAME)];
    expect(criterion([...sonnet, row("opus", 1, BETTER), row("opus", 2, BETTER)])).toBe(
      "opus finds more on recall_logic, recall_integration: the reviewer adapter moves to opus",
    );
    expect(criterion([...sonnet, row("opus", 1, SAME), row("opus", 2, SAME)])).toBe(
      "no measurable recall gain for opus: the reviewer adapter stays on sonnet",
    );
    const worse = { ...BETTER, "recall_test-gap": 0 };
    expect(criterion([...sonnet, row("opus", 1, worse), row("opus", 2, worse)])).toMatch(
      /stays on sonnet/,
    );
    expect(criterion([...sonnet, row("opus", 1, BETTER)])).toMatch(
      /^undecided: fewer than 2 counted runs per cell on recall_logic/,
    );
  });
});

describe("reviewModelsReport", () => {
  it("tabulates the cells, the A/A floor and the model comparison, and lists discarded runs", () => {
    const lines = reviewModelsReport([
      row("sonnet", 1, SAME),
      row("sonnet", 2, SAME),
      row("sonnet-prime", 1, SAME),
      row("sonnet-prime", 2, SAME),
      row("opus", 1, BETTER),
      row("opus", 2, BETTER),
      row("opus", 3, BETTER, "provider error: x"),
    ]);
    expect(lines).toContain(
      "Series: series-1. Counted runs: sonnet 2, sonnet-prime 2, opus 2. Discarded: 1.",
    );
    expect(lines).toContain("| recall_logic | 0.50 [0.50..0.50] | 0.50 [0.50..0.50] | 1 [1..1] |");
    expect(lines).toContain(
      "| recall_logic | no difference (gap 0, noise 0) | opus higher (gap 0.50, noise 0) |",
    );
    expect(lines).toContain("| review_done | n/a | n/a | n/a |");
    expect(lines).toContain("- series-1 opus run 3: provider error: x");
  });

  it("states an empty series", () => {
    const lines = reviewModelsReport([]);
    expect(lines).toContain(
      "Series: none. Counted runs: sonnet 0, sonnet-prime 0, opus 0. Discarded: 0.",
    );
    expect(lines).not.toContain("## Discarded runs");
  });
});
