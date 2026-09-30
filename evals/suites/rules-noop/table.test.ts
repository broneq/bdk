import { describe, expect, it } from "vitest";

import type { ResultRow } from "../../harness/results.ts";
import type { Bullet } from "./bullets.ts";
import type { Violations } from "./patches.ts";
import { bulletRows, majority, rulesReport } from "./table.ts";

const COVERED = 1;
const MISSED = 0;
const WRONG = -1;

function row(
  cell: string,
  item: string,
  run: number,
  metrics: Record<string, number | null>,
  discarded: string | null = null,
): ResultRow {
  return {
    suite: "rules-noop",
    series: "m1-2026-09-28",
    cell,
    item,
    run,
    discarded,
    cost: 0.01,
    metrics,
    provenance: {
      models: ["claude-sonnet-5"],
      fixtureCommit: null,
      bdkCommit: "b".repeat(40),
      variantHash: null,
      templateHashes: [],
    },
  };
}

/** Five M1 runs of one cell on one bullet. */
function knowledge(cell: string, bullet: string, outcomes: number[]): ResultRow[] {
  return outcomes.map((value, index) => row(cell, bullet, index + 1, { knowledge: value }));
}

/** M2 runs of one cell on one patch: per run, whether each listed key was found. */
function reviews(
  cell: string,
  patch: string,
  found: Record<string, number[]>,
  claimed: number[] = [],
): ResultRow[] {
  const runs = Math.max(...Object.values(found).map((values) => values.length), claimed.length);
  return Array.from({ length: runs }, (_, index) =>
    row(cell, patch, index + 1, {
      ...Object.fromEntries(
        Object.entries(found).map(([key, values]) => [key, values[index] ?? 0]),
      ),
      claimed: claimed[index] ?? 0,
    }),
  );
}

const bullets: Bullet[] = [
  {
    id: "security.01.aaaaaaaa",
    rule: "BDK-SEC-1",
    file: "rules/security/BDK-SEC-1.md",
    text: "**Trust.** A | B.",
  },
  {
    id: "security.02.bbbbbbbb",
    rule: "BDK-SEC-2",
    file: "rules/security/BDK-SEC-2.md",
    text: "**Inject.** No.",
  },
  {
    id: "security.03.cccccccc",
    rule: "BDK-SEC-3",
    file: "rules/security/BDK-SEC-3.md",
    text: "**Encode.** Yes.",
  },
  {
    id: "security.04.dddddddd",
    rule: "BDK-SEC-4",
    file: "rules/security/BDK-SEC-4.md",
    text: "**Note.** Meta.",
  },
];

const violations: Violations = {
  patches: [
    {
      patch: "01-a",
      violations: [
        { bullet: "security.01.aaaaaaaa", file: "a.ts", line: 3, what: "x" },
        { bullet: "security.02.bbbbbbbb", file: "a.ts", line: 5, what: "y" },
      ],
    },
    {
      patch: "02-b",
      violations: [{ bullet: "security.03.cccccccc", file: "b.ts", line: 1, what: "z" }],
    },
    { patch: "03-clean", violations: [] },
  ],
  notSeedable: [{ bullet: "security.04.dddddddd", reason: "a note" }],
};

const A = "security.01.aaaaaaaa@a.ts:3";
const B = "security.02.bbbbbbbb@a.ts:5";
const C = "security.03.cccccccc@b.ts:1";

describe("majority", () => {
  it("names the outcome of more than half of the counted runs", () => {
    expect(majority([COVERED, COVERED, COVERED, MISSED, WRONG])).toBe("COVERED");
    expect(majority([WRONG, WRONG, WRONG, COVERED, COVERED])).toBe("WRONG");
  });

  it("is MIXED without a strict majority and n/a without runs", () => {
    expect(majority([COVERED, COVERED, MISSED, MISSED, WRONG])).toBe("MIXED");
    expect(majority([])).toBe("n/a");
  });
});

describe("bulletRows", () => {
  const rows = [
    // Bullet 1: both models covered, with == without at a high rate: no-op candidate.
    ...knowledge("haiku", "security.01.aaaaaaaa", [1, 1, 1, 1, 0]),
    ...knowledge("sonnet", "security.01.aaaaaaaa", [1, 1, 1, 1, 1]),
    // Bullet 2: covered by both, but the rules raise detection: effective.
    ...knowledge("haiku", "security.02.bbbbbbbb", [1, 1, 1, 1, 1]),
    ...knowledge("sonnet", "security.02.bbbbbbbb", [1, 1, 1, 1, 1]),
    // Bullet 3: Haiku answers against it: corrects the model.
    ...knowledge("haiku", "security.03.cccccccc", [WRONG, WRONG, WRONG, 1, 0]),
    ...knowledge("sonnet", "security.03.cccccccc", [1, 1, 1, 1, 1]),
    // Bullet 4: covered, not seedable: no-op candidate.
    ...knowledge("haiku", "security.04.dddddddd", [1, 1, 1, 1, 1]),
    ...knowledge("sonnet", "security.04.dddddddd", [1, 1, 1, 0, 1]),
    ...reviews("with", "01-a", { [A]: [1, 1, 1, 1, 1], [B]: [1, 1, 1, 1, 1] }),
    ...reviews("without", "01-a", { [A]: [1, 1, 0, 1, 1], [B]: [0, 0, 0, 0, 0] }),
    ...reviews("with", "02-b", { [C]: [1, 1, 1, 1, 1] }),
    ...reviews("without", "02-b", { [C]: [0, 1, 1, 0, 1] }),
    // A discarded run is not counted.
    row("without", "01-a", 6, { [A]: 0, [B]: 1, claimed: 0 }, "provider error: x"),
  ];
  const table = bulletRows(rows, bullets, violations);
  const byId = (id: string) => table.find((entry) => entry.id === id);

  it("has one row per bullet, in bullet order", () => {
    expect(table.map((entry) => entry.id)).toEqual(bullets.map((bullet) => bullet.id));
  });

  it("carries the majority knowledge outcome of each model", () => {
    expect(byId("security.03.cccccccc")).toMatchObject({ haiku: "WRONG", sonnet: "COVERED" });
  });

  it("gives per-run detection rates of a seeded bullet and marks the rest not seedable", () => {
    expect(byId("security.02.bbbbbbbb")?.detection).toMatchObject({
      with: [1, 1, 1, 1, 1],
      without: [0, 0, 0, 0, 0],
    });
    expect(byId("security.04.dddddddd")?.detection).toBeNull();
  });

  it("assigns the provisional classes of design D-8", () => {
    expect(table.map((entry) => entry.provisionalClass)).toEqual([
      "no-op candidate",
      "effective",
      "corrects the model",
      "no-op candidate",
    ]);
  });

  it("is unclear when the without-rules rate stays below 0.8 without a measurable gap", () => {
    const weak = bulletRows(
      [
        ...knowledge("haiku", "security.01.aaaaaaaa", [1, 1, 1, 1, 1]),
        ...knowledge("sonnet", "security.01.aaaaaaaa", [1, 1, 1, 1, 1]),
        ...reviews("with", "01-a", { [A]: [1, 0, 1, 0, 1] }),
        ...reviews("without", "01-a", { [A]: [0, 1, 0, 1, 0] }),
      ],
      bullets,
      violations,
    );
    expect(weak[0]?.provisionalClass).toBe("unclear");
  });
});

describe("rulesReport", () => {
  const rows = [
    ...knowledge("haiku", "security.01.aaaaaaaa", [1, 1, 1, 1, 1]),
    ...knowledge("sonnet", "security.01.aaaaaaaa", [1, 1, 1, 1, 1]),
    ...knowledge("sonnet-prime", "security.01.aaaaaaaa", [1, 1, 0, 0, 0]),
    ...reviews("with", "01-a", { [A]: [1, 1, 1], [B]: [1, 0, 1] }),
    ...reviews("with-prime", "01-a", { [A]: [1, 1, 1], [B]: [1, 1, 1] }),
    ...reviews("without", "01-a", { [A]: [1, 1, 1], [B]: [0, 0, 0] }),
    ...reviews("with", "03-clean", {}, [0, 1, 0]),
    ...reviews("without", "03-clean", {}, [2, 2, 3]),
  ];
  const text = rulesReport(rows, bullets, violations).join("\n");

  it("states the A/A noise floor of both measurements", () => {
    expect(text).toContain("M1 A/A (sonnet vs sonnet-prime): 1 of 1 bullets differ in majority");
    expect(text).toMatch(/M2 A\/A \(with vs with-prime\), detection per run: no difference/);
  });

  it("reports the claimed findings on the clean controls per cell", () => {
    expect(text).toMatch(/clean controls, claimed findings per review: with 0 \[0\.\.1\]/);
    expect(text).toMatch(/without 2 \[2\.\.3\]/);
  });

  it("has one table row per bullet with not seedable and escaped text", () => {
    const tableRows = text.split("\n").filter((line) => line.startsWith("| security."));
    expect(tableRows).toHaveLength(4);
    expect(tableRows[0]).toContain("**Trust.** A \\| B.");
    expect(tableRows[3]).toContain("not seedable");
  });
});
