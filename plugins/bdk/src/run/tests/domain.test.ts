import { describe, expect, it } from "vitest";

import { derive, mergeParts, passes } from "../domain/status.ts";
import type { ChangeSnapshot, Part } from "../domain/status.ts";

// The pure rules of `bdk run status` (spec `bdk-cli/run`): the verdict line, the parts and every
// row of the resume table on hand-built snapshots.

const done = (id: string): Part => ({ id, status: "done", attempts: 1, reason: null });

/** A Change at the end of its life: every row passes, the stage is `done`. */
const finished: ChangeSnapshot = {
  openspec: { archived: true, proposal: true, design: true, planParts: 2 },
  designVerify: { name: "verify-2.md", pass: true },
  planVerify: { name: "verify-1.md", pass: true },
  parts: [done("01"), done("02")],
  rounds: [
    { n: 1, report: true },
    { n: 2, report: true },
  ],
  lastRound: { blockers: 0, fixes: 0 },
  specConformance: true,
  pr: true,
};

function at(change: Partial<ChangeSnapshot>): ReturnType<typeof derive> {
  return derive({ ...finished, ...change });
}

describe("passes", () => {
  it.each([
    ["Verdict: PASS", true],
    ["# Report\n\n**Verdict:** PASS\n", true],
    ["## Verdict: pass", true],
    ["verdict:   **PASS**", true],
    ["Verdict: FAIL", false],
    ["Verdict: FAIL\nVerdict: PASS", false],
    ["All good, PASS", false],
    ["", false],
  ])("%j passes: %s", (text, expected) => {
    expect(passes(text)).toBe(expected);
  });
});

describe("mergeParts", () => {
  it("joins plan parts and part states in id order, pending by default", () => {
    expect(
      mergeParts(["02", "01"], [{ id: "03", status: "blocked", attempts: 2, reason: "flaky" }]),
    ).toEqual([
      { id: "01", status: "pending", attempts: 0, reason: null },
      { id: "02", status: "pending", attempts: 0, reason: null },
      { id: "03", status: "blocked", attempts: 2, reason: "flaky" },
    ]);
  });
});

describe("derive: the resume table", () => {
  it("row 1: no OpenSpec Change directory", () => {
    expect(at({ openspec: undefined })).toMatchObject({ stage: "propose", row: 1, step: null });
  });

  it("row 1: no proposal.md", () => {
    expect(
      at({ openspec: { archived: false, proposal: false, design: false, planParts: 0 } }),
    ).toEqual({ stage: "propose", step: null, row: 1, round: null, reason: "no proposal.md" });
  });

  it("row 2: no design.md", () => {
    expect(
      at({ openspec: { archived: false, proposal: true, design: false, planParts: 0 } }),
    ).toMatchObject({ stage: "design", row: 2, reason: "no design.md" });
  });

  it("row 2: no design verify report", () => {
    expect(at({ designVerify: undefined })).toMatchObject({ stage: "design", row: 2 });
  });

  it("row 2: the last design verify report does not pass", () => {
    expect(at({ designVerify: { name: "verify-2.md", pass: false } })).toEqual({
      stage: "design",
      step: null,
      row: 2,
      round: null,
      reason: "design/verify-2.md does not pass",
    });
  });

  it("row 3: no plan part", () => {
    expect(
      at({ openspec: { archived: false, proposal: true, design: true, planParts: 0 } }),
    ).toMatchObject({ stage: "plan", row: 3, reason: "no plan part in plan/parts/" });
  });

  it("row 3: no plan verify report", () => {
    expect(at({ planVerify: undefined })).toMatchObject({ stage: "plan", row: 3 });
  });

  it("row 3: the last plan verify report does not pass", () => {
    expect(at({ planVerify: { name: "verify-3.md", pass: false } })).toMatchObject({
      stage: "plan",
      row: 3,
      reason: "plan/verify-3.md does not pass",
    });
  });

  it("row 4: a part not done", () => {
    expect(
      at({ parts: [done("01"), { id: "02", status: "blocked", attempts: 2, reason: null }] }),
    ).toEqual({
      stage: "execute",
      step: null,
      row: 4,
      round: null,
      reason: "1 of 2 parts not done, 1 blocked",
    });
  });

  it("row 5: no review round", () => {
    expect(at({ rounds: [] })).toEqual({
      stage: "auto-review",
      step: "first-round",
      row: 5,
      round: 1,
      reason: "no review round yet",
    });
  });

  it("row 6: a round without review.md, the lowest one", () => {
    expect(
      at({
        rounds: [
          { n: 1, report: true },
          { n: 2, report: false },
          { n: 3, report: false },
        ],
      }),
    ).toEqual({
      stage: "auto-review",
      step: "repeat-round",
      row: 6,
      round: 2,
      reason: "review/round-2/ has no review.md",
    });
  });

  it("row 7: blockers without a decision in the last round", () => {
    expect(at({ lastRound: { blockers: 2, fixes: 1 } })).toEqual({
      stage: "auto-review",
      step: "triage",
      row: 7,
      round: 2,
      reason: "review/round-2: 2 blockers without a decision",
    });
  });

  it("row 8: fix decisions in the last round", () => {
    expect(at({ lastRound: { blockers: 0, fixes: 1 } })).toEqual({
      stage: "auto-review",
      step: "fix",
      row: 8,
      round: 2,
      reason: "review/round-2: 1 finding to fix",
    });
  });

  it("row 9: no spec-conformance report", () => {
    expect(at({ specConformance: undefined })).toMatchObject({
      stage: "close",
      step: "spec-conformance",
      row: 9,
      reason: "no close/spec-conformance.md",
    });
  });

  it("row 9: spec conformance does not pass", () => {
    expect(at({ specConformance: false })).toMatchObject({
      stage: "close",
      step: "spec-conformance",
      row: 9,
    });
  });

  it("row 9: not archived", () => {
    expect(
      at({ openspec: { archived: false, proposal: true, design: true, planParts: 2 } }),
    ).toMatchObject({ stage: "close", step: "archive", row: 9 });
  });

  it("row 9: no pull request", () => {
    expect(at({ pr: false })).toMatchObject({ stage: "close", step: "pr", row: 9 });
  });

  it("done: every row passes", () => {
    expect(at({})).toEqual({
      stage: "done",
      step: null,
      row: null,
      round: null,
      reason: "archived, PR opened",
    });
  });

  it("an earlier row wins over later ones", () => {
    expect(
      at({
        parts: [done("01"), { id: "02", status: "pending", attempts: 0, reason: null }],
        lastRound: { blockers: 3, fixes: 0 },
        specConformance: undefined,
      }),
    ).toMatchObject({ stage: "execute", row: 4 });
  });
});
