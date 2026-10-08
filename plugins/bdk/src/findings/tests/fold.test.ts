import { describe, expect, it } from "vitest";

import { fold } from "../domain/fold.ts";
import { findingId } from "../domain/id.ts";

// Spec `bdk-cli/findings`, "Fold the log".

const A = { source: "review-group", summary: "a is wrong", file: "src/a.ts", line: 3 };
const B = { source: "e2e-check", summary: "login fails" };
const C = { source: "review-group", summary: "c leaks", file: "src/c.ts", rule: "no-leak" };
const idA = findingId(A);
const idB = findingId(B);
const idC = findingId(C);

const finding = (f: Parameters<typeof findingId>[0] & { source: string }): string =>
  JSON.stringify({ type: "finding", id: findingId(f), ...f });
const event = (e: object): string => JSON.stringify(e);
const log = (...lines: string[]): string => lines.map((line) => `${line}\n`).join("");

describe("fold", () => {
  it("folds an empty log to zero findings", () => {
    expect(fold("")).toEqual({
      findings: [],
      counts: {
        findings: 0,
        level: { blocker: 0, "should-fix": 0, "nice-to-have": 0, "not-a-problem": 0, unleveled: 0 },
        decision: { fix: 0, accept: 0, defer: 0, undecided: 0 },
      },
      skipped: [],
    });
  });

  it("applies the latest level and the latest decision in file order", () => {
    const view = fold(
      log(
        finding(A),
        event({ type: "level", id: idA, level: "should-fix" }),
        event({ type: "decision", id: idA, decision: "defer", issue: "#9", reason: "later" }),
        event({ type: "level", id: idA, level: "blocker", reason: "crashes" }),
        event({ type: "decision", id: idA, decision: "fix" }),
      ),
    );
    expect(view.findings).toEqual([
      {
        id: idA,
        source: "review-group",
        sources: ["review-group"],
        reports: 1,
        summary: "a is wrong",
        file: "src/a.ts",
        line: 3,
        level: "blocker",
        levelReason: "crashes",
        decision: "fix",
      },
    ]);
    expect(view.counts.level.blocker).toBe(1);
    expect(view.counts.decision.fix).toBe(1);
  });

  it("keeps the issue and reason of the latest decision only", () => {
    const view = fold(
      log(
        finding(B),
        event({ type: "decision", id: idB, decision: "fix", reason: "now" }),
        event({ type: "decision", id: idB, decision: "defer", issue: "#12" }),
      ),
    );
    expect(view.findings[0]).toMatchObject({ decision: "defer", issue: "#12" });
    expect(view.findings[0]).not.toHaveProperty("decisionReason");
  });

  it("folds duplicates into the first finding with every source", () => {
    const view = fold(
      log(
        finding(C),
        finding({ ...C, source: "review-integration", summary: "other words" }),
        finding(C),
        finding(A),
      ),
    );
    expect(view.findings.map((f) => f.id)).toEqual([idC, idA]);
    expect(view.findings[0]).toMatchObject({
      summary: "c leaks",
      sources: ["review-group", "review-integration"],
      reports: 3,
      level: null,
      decision: null,
    });
    expect(view.counts.findings).toBe(2);
    expect(view.counts.level.unleveled).toBe(2);
  });

  it("counts every level and decision, including none", () => {
    const view = fold(
      log(
        finding(A),
        finding(B),
        finding(C),
        event({ type: "level", id: idA, level: "nice-to-have" }),
        event({ type: "level", id: idB, level: "not-a-problem" }),
        event({ type: "decision", id: idA, decision: "accept" }),
      ),
    );
    expect(view.counts).toEqual({
      findings: 3,
      level: { blocker: 0, "should-fix": 0, "nice-to-have": 1, "not-a-problem": 1, unleveled: 1 },
      decision: { fix: 0, accept: 1, defer: 0, undecided: 2 },
    });
  });

  it("skips and reports damaged, invalid and orphan lines by number", () => {
    const view = fold(
      [
        finding(A),
        '{"type":"finding","id":"f-',
        "",
        event({ type: "level", id: idA, level: "urgent" }),
        event({ type: "comment", id: idA }),
        event({ type: "decision", id: idA, decision: "fix", issue: "#9" }),
        event({ type: "level", id: "f-000000000000", level: "blocker" }),
        "[1]",
        finding(B),
      ].join("\n"),
    );
    expect(view.findings.map((f) => f.id)).toEqual([idA, idB]);
    expect(view.findings[0]?.level).toBeNull();
    expect(view.skipped.map((s) => s.line)).toEqual([2, 4, 5, 6, 7, 8]);
    expect(view.skipped[0]?.reason).toBe("not valid JSON");
    expect(view.skipped[4]?.reason).toBe("no finding has the id f-000000000000");
    for (const { reason } of view.skipped.slice(1, 4)) expect(reason).toMatch(/^not an event: /);
  });

  it("accepts a level line before its finding line", () => {
    const view = fold(log(event({ type: "level", id: idA, level: "blocker" }), finding(A)));
    expect(view.findings[0]?.level).toBe("blocker");
    expect(view.skipped).toEqual([]);
  });

  it("ignores fields it does not know", () => {
    const view = fold(log(JSON.stringify({ type: "finding", id: idB, ...B, at: "later" })));
    expect(view.findings[0]).not.toHaveProperty("at");
    expect(view.skipped).toEqual([]);
  });
});
