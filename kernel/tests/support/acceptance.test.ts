import { describe, expect, it } from "vitest";

import { catalogueProblems, evidenceProblems, parseCatalogue, renderReport } from "./acceptance.ts";
import type { CatalogueItem, TestTitle } from "./acceptance.ts";

function spec(rows: string[]): string {
  return [
    "### Requirement: Catalogue of acceptance items",
    "",
    "Intro.",
    "",
    "| ID | Item | Evidence |",
    "| --- | --- | --- |",
    ...rows,
    "",
    "#### Scenario: x",
  ].join("\n");
}

const title = (project: string, file: string, name: string): TestTitle => ({ project, file, name });

describe("parseCatalogue", () => {
  it("returns every row with its id, item and evidence kinds", () => {
    const items = parseCatalogue(
      spec([
        "| `S1` | Size limits | `test` |",
        "| `R-15` | Guard latency | `test`, `perf` |",
        "| `S-EVALS` | Evals | `report docs/V3-EVAL-EXECUTE-AB.md` |",
        "| `R-14` | Time gate | `accepted`: rejected for v3 |",
        "| `R-16` | Envelope ids | `open #140` |",
      ]),
    );
    expect(items).toEqual([
      { id: "S1", item: "Size limits", evidence: [{ kind: "test" }] },
      { id: "R-15", item: "Guard latency", evidence: [{ kind: "test" }, { kind: "perf" }] },
      {
        id: "S-EVALS",
        item: "Evals",
        evidence: [{ kind: "report", path: "docs/V3-EVAL-EXECUTE-AB.md" }],
      },
      {
        id: "R-14",
        item: "Time gate",
        evidence: [{ kind: "accepted", reason: "rejected for v3" }],
      },
      { id: "R-16", item: "Envelope ids", evidence: [{ kind: "open", issue: 140 }] },
    ]);
  });

  it("fails when the requirement has no catalogue table", () => {
    expect(() =>
      parseCatalogue("### Requirement: Catalogue of acceptance items\n\nNo table.\n"),
    ).toThrow(/table/);
  });
});

describe("catalogueProblems", () => {
  const problems = (rows: string[]) => catalogueProblems(parseCatalogue(spec(rows)));

  it("accepts a well-formed catalogue", () => {
    expect(problems(["| `S1` | a | `test` |", "| `R-14` | b | `accepted`: by design |"])).toEqual(
      [],
    );
  });

  it("names a duplicate id", () => {
    expect(problems(["| `AC-1` | a | `test` |", "| `AC-1` | b | `test` |"])).toEqual([
      "AC-1: duplicate id",
    ]);
  });

  it("names an unknown evidence kind", () => {
    expect(problems(["| `AC-1` | a | `manual` |"])).toEqual(["AC-1: unknown evidence `manual`"]);
  });

  it("names a row without evidence", () => {
    expect(problems(["| `AC-1` | a | none |"])).toEqual(["AC-1: no evidence"]);
  });

  it("names an accepted row without a reason", () => {
    expect(problems(["| `R-14` | a | `accepted` |"])).toEqual([
      "R-14: `accepted` without a reason",
    ]);
  });

  it("names an open row without an issue", () => {
    expect(problems(["| `R-16` | a | `open` |"])).toEqual(["R-16: `open` without an issue"]);
  });

  it("names an open success criterion", () => {
    expect(problems(["| `S4` | a | `open #200` |"])).toEqual([
      "S4: a success criterion cannot be `open`",
    ]);
  });
});

describe("evidenceProblems", () => {
  const items: CatalogueItem[] = [
    { id: "AC-2", item: "resume", evidence: [{ kind: "test" }] },
    { id: "TSH-7", item: "stash", evidence: [{ kind: "test" }] },
    { id: "NFR-SCALE-1", item: "scale", evidence: [{ kind: "perf" }] },
    { id: "S-EVALS", item: "evals", evidence: [{ kind: "report", path: "docs/eval.md" }] },
    { id: "R-14", item: "gate", evidence: [{ kind: "accepted", reason: "by design" }] },
  ];
  const exists = (path: string) => path === "docs/eval.md";

  it("passes when every item is answered", () => {
    const titles = [
      title("e2e", "a.e2e.ts", "attempt > a killed session resumes [AC-2] [TSH-7]"),
      title("perf", "scale.perf.ts", "[NFR-SCALE-1] two hundred calls"),
    ];
    expect(evidenceProblems(items, titles, exists)).toEqual([]);
  });

  it("names an item with `test` and no title", () => {
    const titles = [
      title("e2e", "a.e2e.ts", "resume [AC-2]"),
      title("perf", "s.perf.ts", "[NFR-SCALE-1] x"),
    ];
    expect(evidenceProblems(items, titles, exists)).toEqual([
      "TSH-7: no test in unit, e2e or contract names it",
    ]);
  });

  it("names a perf item answered only outside the perf project", () => {
    const titles = [title("e2e", "a.e2e.ts", "[AC-2] [TSH-7] [NFR-SCALE-1] x")];
    expect(evidenceProblems(items, titles, exists)).toEqual([
      "NFR-SCALE-1: no test in perf names it",
    ]);
  });

  it("names a report that does not exist", () => {
    const titles = [
      title("e2e", "a.e2e.ts", "[AC-2] [TSH-7]"),
      title("perf", "s.perf.ts", "[NFR-SCALE-1]"),
    ];
    expect(evidenceProblems(items, titles, () => false)).toEqual([
      "S-EVALS: report docs/eval.md does not exist",
    ]);
  });

  it("names a title with an unknown id of a catalogue prefix, with its file", () => {
    const titles = [
      title("e2e", "a.e2e.ts", "[AC-2] [TSH-7]"),
      title("perf", "s.perf.ts", "[NFR-SCALE-1]"),
      title("unit", "b.test.ts", "describe > [AC-99] something"),
    ];
    expect(evidenceProblems(items, titles, exists)).toEqual([
      "b.test.ts: [AC-99] is not in the catalogue",
    ]);
  });

  it("ignores brackets that are not catalogue ids", () => {
    const titles = [
      title("e2e", "a.e2e.ts", "[AC-2] [TSH-7] parses [x] and [CQ-4]"),
      title("perf", "s.perf.ts", "[NFR-SCALE-1]"),
    ];
    expect(evidenceProblems(items, titles, exists)).toEqual([]);
  });

  it("lets a describe title answer its tests", () => {
    const titles = [
      title("e2e", "a.e2e.ts", "guards [TSH-7] > denies stash"),
      title("e2e", "a.e2e.ts", "resume [AC-2] > rebuild"),
      title("perf", "s.perf.ts", "scale [NFR-SCALE-1] > p95"),
    ];
    expect(evidenceProblems(items, titles, exists)).toEqual([]);
  });
});

describe("renderReport", () => {
  const items: CatalogueItem[] = [
    { id: "S1", item: "Size limits", evidence: [{ kind: "test" }] },
    { id: "NFR-LAT-2", item: "Prefilter", evidence: [{ kind: "perf" }] },
    { id: "R-14", item: "Time gate", evidence: [{ kind: "accepted", reason: "by design" }] },
  ];
  const titles = [
    title("unit", "kernel/src/b.test.ts", "size [S1] > nine tasks"),
    title("e2e", "kernel/src/a.e2e.ts", "[S1] part start refuses 9 KB"),
    title("perf", "kernel/src/g.perf.ts", "[NFR-LAT-2] p95"),
  ];

  it("starts with the generated marker and lists every item with its tests", () => {
    const report = renderReport(items, titles);
    expect(report.split("\n")[0]).toMatch(/^<!-- Generated by `pnpm acceptance:report`/);
    expect(report).toContain(
      "| `S1` | Size limits | test | `kernel/src/a.e2e.ts`: [S1] part start refuses 9 KB<br>`kernel/src/b.test.ts`: size [S1] > nine tasks |",
    );
    expect(report).toContain(
      "| `NFR-LAT-2` | Prefilter | perf (local only) | `kernel/src/g.perf.ts`: [NFR-LAT-2] p95 |",
    );
    expect(report).toContain("| `R-14` | Time gate | accepted: by design | |");
  });

  it("is byte-stable for unchanged input in any order", () => {
    expect(renderReport(items, [...titles].reverse())).toBe(renderReport(items, titles));
  });
});
