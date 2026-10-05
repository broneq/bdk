import { describe, expect, it } from "vitest";

import type { ResultRow } from "../../harness/results.ts";
import {
  ACCEPTANCE,
  acceptanceFailures,
  countRefusals,
  refusalMetrics,
  reportRefusals,
} from "./refusals.ts";

const TEXT = (rule: string) => `Exit code 2\nrefused: ${rule}\nwhy: x\ninstead: y\ninstead: z`;
const JSON_REFUSAL = (rule: string) =>
  `{"refused": true, "rule": "${rule}", "why": "x", "instead": ["y"]}`;

describe("countRefusals", () => {
  it("counts a refusal in text mode and one in --json mode, per rule", () => {
    const calls = [
      { name: "Bash", output: TEXT("policy/missing-citation") },
      { name: "Bash", output: TEXT("policy/missing-citation") },
      { name: "Bash", output: JSON_REFUSAL("input/invalid-envelope") },
      { name: "Bash", output: "ok" },
    ];
    expect(countRefusals(calls)).toEqual({
      "policy/missing-citation": 2,
      "input/invalid-envelope": 1,
    });
  });

  it("counts each refused call once, and reads Bash outputs only", () => {
    const calls = [
      {
        name: "Bash",
        output: `${TEXT("policy/missing-citation")}\n${JSON_REFUSAL("policy/missing-citation")}`,
      },
      { name: "Read", output: TEXT("input/unknown-flag") },
      { name: "Bash" },
    ];
    expect(countRefusals(calls)).toEqual({ "policy/missing-citation": 1 });
  });
});

describe("refusalMetrics", () => {
  it("gives the total and a metric per rule seen", () => {
    expect(refusalMetrics({ "policy/missing-citation": 2, "input/unknown-flag": 1 })).toEqual({
      refusals: 3,
      "refusal:policy/missing-citation": 2,
      "refusal:input/unknown-flag": 1,
    });
    expect(refusalMetrics({})).toEqual({ refusals: 0 });
  });
});

function row(item: string, metrics: Record<string, number>): ResultRow {
  return {
    suite: "stages",
    series: "probe",
    cell: "bdk",
    item,
    run: 1,
    discarded: null,
    cost: 1,
    metrics: { expect_pass: 1, ...metrics },
    provenance: {
      models: [],
      fixtureCommit: null,
      bdkCommit: "c",
      variantHash: null,
      templateHashes: [],
    },
  };
}

describe("acceptanceFailures", () => {
  it("passes execute rows with no fixed rule and a total below the T41 probe 2 count", () => {
    const rows = [row("execute/flat", { refusals: 4 }), row("execute/tree", { refusals: 5 })];
    expect(acceptanceFailures(rows)).toEqual([]);
  });

  it("fails a row that holds a refusal of a fixed rule", () => {
    const rows = [row("execute/flat", { refusals: 1, "refusal:policy/missing-citation": 1 })];
    expect(acceptanceFailures(rows)).toEqual([
      "execute/flat run 1: policy/missing-citation refused 1 time(s)",
    ]);
  });

  it("fails when the total is not below the count of probe 2", () => {
    const rows = [row("execute/flat", { refusals: ACCEPTANCE.total }), row("execute/tree", {})];
    expect(acceptanceFailures(rows)).toEqual([
      `execute total ${String(ACCEPTANCE.total)} refusals; it must be below ${String(ACCEPTANCE.total)}`,
    ]);
  });

  it("ignores cases of other stages", () => {
    expect(acceptanceFailures([row("setup/fresh-project", { refusals: 99 })])).toEqual([]);
  });
});

describe("reportRefusals", () => {
  it("takes the counts per rule of a stubbed bdk diagnostics report", () => {
    const report = {
      code: 0,
      json: { refusals: { total: 3, byRule: { "policy/missing-evidence": 3 }, byRole: {} } },
    };
    expect(reportRefusals(report)).toEqual({ "policy/missing-evidence": 3 });
  });

  it("gives undefined for a refused report or a shape it does not know", () => {
    expect(reportRefusals({ code: 3, json: { refused: true, rule: "input/not-found" } })).toBe(
      undefined,
    );
    expect(reportRefusals({ code: 0, json: { refusals: { byRule: { x: "3" } } } })).toBe(undefined);
    expect(reportRefusals({ code: 0, json: undefined })).toBe(undefined);
  });
});
