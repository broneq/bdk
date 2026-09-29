import { describe, expect, it } from "vitest";

import type { ResultRow } from "../../harness/results.ts";
import { withWithoutReport } from "./report.ts";

function row(
  cell: string,
  item: string,
  run: number,
  assertPass: number | null,
  discarded: string | null = null,
): ResultRow {
  return {
    suite: "with-without",
    series: "series-mermaid-drawer-2026-09-29",
    cell,
    item,
    run,
    discarded,
    cost: 0.4,
    metrics: { assert_pass: assertPass, assert_score: assertPass, turns: 3, wall_s: 20 },
    provenance: {
      models: ["claude-opus-5-5"],
      fixtureCommit: null,
      bdkCommit: "b".repeat(40),
      variantHash: null,
      templateHashes: [],
    },
  };
}

const cell = (name: string, item: string, values: (number | null)[]): ResultRow[] =>
  values.map((value, index) => row(name, item, index + 1, value));

describe("withWithoutReport", () => {
  const lines = withWithoutReport([
    ...cell("with", "mermaid-drawer/a", [1, 1, 1]),
    ...cell("without", "mermaid-drawer/a", [0, 0, 0]),
    ...cell("with", "mermaid-drawer/b", [1, 0, 1]),
    ...cell("without", "mermaid-drawer/b", [1, 1, 0]),
    ...cell("with", "mermaid-drawer/c", [null, null]),
    ...cell("without", "mermaid-drawer/c", [null, null]),
    row("without", "mermaid-drawer/a", 4, 1, "provider error: x"),
  ]);
  const section = (item: string): string[] =>
    lines.slice(lines.indexOf(`## ${item}`), lines.indexOf(`## ${item}`) + 10);

  it("states per task and metric whether the gap is measurable", () => {
    expect(section("mermaid-drawer/a")).toContain(
      "| assert_pass | 1 [1..1] | 0 [0..0] | with higher (gap 1, noise 0) |",
    );
    expect(section("mermaid-drawer/b")).toContain(
      "| assert_pass | 1 [0..1] | 1 [0..1] | no measurable difference (gap 0, noise 1) |",
    );
    expect(section("mermaid-drawer/a")).toContain(
      "| cost | 0.40 [0.40..0.40] | 0.40 [0.40..0.40] | no measurable difference (gap 0, noise 0) |",
    );
  });

  it("shows n/a for a metric that does not apply and lists discarded runs", () => {
    expect(section("mermaid-drawer/c")).toContain(
      "| assert_pass | n/a | n/a | fewer than 2 counted runs |",
    );
    expect(lines).toContain(
      "- series-mermaid-drawer-2026-09-29 without mermaid-drawer/a run 4: provider error: x",
    );
  });
});
