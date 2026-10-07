import { describe, expect, it } from "vitest";

import { parseKey } from "./key.ts";
import { isAlarm, locates, namedLines, reviewMetrics } from "./metrics.ts";
import type { ReviewEntry } from "./metrics.ts";

const KEY = parseKey(
  `seed: executed-two-parts
patch: defects.patch
defects:
  - id: null-body
    class: logic
    file: src/api/http.ts
    lines: [146, 156]
    summary: null passes the object check
  - id: blank-title
    class: logic
    file: src/ui/asyncState.ts
    lines: [50, 52]
    summary: a blank title gives an empty message
  - id: missing-case
    class: test-gap
    file: src/api/http.test.ts
    lines: [65, 84]
    summary: the title and status case is gone
`,
  "key.yaml",
);

function entry(id: string, fields: Partial<ReviewEntry>): ReviewEntry {
  return { id, type: "finding", summary: "", refs: [], ...fields };
}

describe("namedLines and locates", () => {
  it("reads a line, a range and a GitHub anchor from the refs and the text", () => {
    const named = entry("L-1", {
      refs: ["src/api/http.ts:148", "src/api/http.ts#L150-L151"],
      summary: "see src/api/http.ts:160-161",
      body: "and src/api/http.tsx:149 is another file",
    });
    expect(namedLines(named, "src/api/http.ts")).toStrictEqual([148, 150, 151, 160, 161]);
  });

  it("needs the defect's file and a line in its range", () => {
    const [defect] = KEY.defects;
    if (defect === undefined) throw new Error("no defect");
    expect(locates(entry("a", { refs: ["src/api/http.ts:156"] }), defect)).toBe(true);
    expect(locates(entry("b", { refs: ["src/api/http.ts:157"] }), defect)).toBe(false);
    expect(locates(entry("c", { refs: ["src/api/http.ts"] }), defect)).toBe(false);
    expect(locates(entry("d", { refs: ["src/ui/asyncState.ts:150"] }), defect)).toBe(false);
  });
});

describe("isAlarm", () => {
  it("counts findings and blockers, and observations raised to blocker or should-fix", () => {
    expect(isAlarm(entry("a", {}))).toBe(true);
    expect(isAlarm(entry("b", { type: "blocker" }))).toBe(true);
    expect(isAlarm(entry("c", { type: "observation" }))).toBe(false);
    expect(isAlarm(entry("d", { type: "observation", level: "should-fix" }))).toBe(true);
    expect(isAlarm(entry("e", { type: "observation", level: "nice-to-have" }))).toBe(false);
    expect(isAlarm(entry("f", { level: "not-a-problem" }))).toBe(false);
    expect(isAlarm(entry("g", { type: "report" }))).toBe(false);
  });
});

describe("reviewMetrics", () => {
  it("measures a recorded review: found, missed, and false alarms", () => {
    const entries = [
      entry("L-null", { type: "blocker", refs: ["src/api/http.ts:148"] }),
      // The judge matches it to blank-title, but it names no line in the range.
      entry("L-vague", { refs: ["src/ui/asyncState.ts"] }),
      entry("L-noise", { refs: ["src/ui/asyncState.ts:10"] }),
      entry("L-dismissed", { refs: ["src/ui/asyncState.ts:12"], level: "not-a-problem" }),
      entry("L-note", { type: "observation", refs: ["src/api/http.ts:1"] }),
    ];
    const matches = {
      defects: [
        { id: "null-body", entries: ["L-null"] },
        { id: "blank-title", entries: ["L-vague"] },
        { id: "missing-case", entries: [] },
      ],
    };
    expect(reviewMetrics(KEY, entries, matches)).toStrictEqual({
      "found_null-body": 1,
      "found_blank-title": 0,
      "found_missing-case": 0,
      recall_logic: 0.5,
      "recall_test-gap": 0,
      alarms: 3,
      false_alarms: 1,
      false_alarms_raw: 2,
      "found_after_triage_null-body": 1,
      "found_after_triage_blank-title": 0,
      "found_after_triage_missing-case": 0,
      recall_after_triage_logic: 0.5,
      "recall_after_triage_test-gap": 0,
      dismissed_by_triage: 0,
    });
  });

  it("triage that drops a seeded defect is visible", () => {
    const entries = [
      entry("L-null", { refs: ["src/api/http.ts:148"], level: "not-a-problem" }),
      entry("L-case", { refs: ["src/api/http.test.ts:70"], level: "should-fix" }),
    ];
    const matches = {
      defects: [
        { id: "null-body", entries: ["L-null"] },
        { id: "missing-case", entries: ["L-case"] },
      ],
    };
    expect(reviewMetrics(KEY, entries, matches)).toMatchObject({
      "found_null-body": 1,
      "found_after_triage_null-body": 0,
      "found_after_triage_missing-case": 1,
      recall_logic: 0.5,
      recall_after_triage_logic: 0,
      dismissed_by_triage: 1,
      false_alarms_raw: 0,
    });
  });

  it("finds nothing without entries", () => {
    expect(reviewMetrics(KEY, [], { defects: [] })).toMatchObject({
      recall_logic: 0,
      alarms: 0,
      false_alarms: 0,
    });
  });
});
