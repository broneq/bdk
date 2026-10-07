import { describe, expect, it } from "vitest";

import type { RunContext } from "../../harness/hook.ts";
import type { JudgeRequest } from "../../harness/judge.ts";
import type { KernelCall } from "../stages/checks.ts";
import { MATCH_SCHEMA, createHooks, matchRequest, reviewEntries, withoutHistory } from "./hooks.ts";
import type { RoundFacts } from "./round.ts";
import { parseKey } from "./key.ts";

const KEY = parseKey(
  `seed: executed-two-parts
patch: defects.patch
defects:
  - id: null-body
    class: logic
    file: src/api/http.ts
    lines: [146, 156]
    summary: null passes the object check
  - id: missing-case
    class: test-gap
    file: src/api/http.test.ts
    lines: [65, 84]
    summary: the title and status case is gone
`,
  "key.yaml",
);

const ROUND: RoundFacts = { agents: [], guards: [], packages: [], reports: [], binary: [] };

const LOG = {
  items: [
    {
      id: "L-null",
      type: "blocker",
      summary: "null body throws",
      refs: ["src/api/http.ts:148"],
      ticket: "A-review",
      level: "blocker",
    },
    { id: "L-noise", type: "finding", summary: "naming", refs: ["src/a.ts:3"], ticket: "A-review" },
    { id: "L-seed", type: "finding", summary: "from the seed", refs: [], ticket: "A-task" },
    { id: "L-report", type: "report", summary: "merged", refs: [], ticket: "A-review" },
  ],
};

const ATTEMPTS = {
  items: [
    { ticket: "A-review", loop: "review-fix" },
    { ticket: "A-task", loop: "part" },
  ],
};

function fakeKernel(review = "done", calls: string[] = []) {
  return (args: string): KernelCall => {
    calls.push(args);
    if (args === "attempt list --all") return { code: 0, json: ATTEMPTS };
    if (args === "log list --all") return { code: 0, json: LOG };
    if (args.startsWith("log show ")) {
      return { code: 0, json: { entry: { body: `body of ${args.slice(9)}` } } };
    }
    if (args === "explain review") return { code: 0, json: { state: review } };
    return { code: 2, json: undefined };
  };
}

function context(workDir: string | null): RunContext {
  return {
    plan: {} as RunContext["plan"],
    cellName: "opus",
    cell: {
      workDir,
      settings: { bundle: "/b.mjs", configHome: "/c" },
    } as unknown as RunContext["cell"],
    item: "review",
    run: 1,
    vars: {},
  };
}

describe("reviewEntries", () => {
  it("keeps the review rounds' findings, blockers and observations, with their bodies", () => {
    const calls: string[] = [];
    expect(reviewEntries(fakeKernel("done", calls))).toStrictEqual([
      {
        id: "L-null",
        type: "blocker",
        summary: "null body throws",
        refs: ["src/api/http.ts:148"],
        level: "blocker",
        body: "body of L-null",
      },
      {
        id: "L-noise",
        type: "finding",
        summary: "naming",
        refs: ["src/a.ts:3"],
        body: "body of L-noise",
      },
    ]);
    expect(calls).toStrictEqual([
      "attempt list --all",
      "log list --all",
      "log show L-null",
      "log show L-noise",
    ]);
  });

  it("fails loudly when the ledger cannot be read", () => {
    expect(() => reviewEntries(() => ({ code: 3, json: undefined }))).toThrow(
      /bdk attempt list failed with exit 3/,
    );
  });
});

describe("matchRequest", () => {
  it("gives the judge every defect with its place and every entry with its text", () => {
    const request = matchRequest(KEY, [
      { id: "L-1", type: "finding", summary: "s", refs: ["src/a.ts:1"] },
    ]);
    expect(request.schema).toBe(MATCH_SCHEMA);
    expect(request.prompt).toContain('"lines": "146-156"');
    expect(request.prompt).toContain('"defect": "null passes the object check"');
    expect(request.prompt).toContain('"id": "L-1"');
  });
});

describe("withoutHistory", () => {
  it("drops the kernel's history lines, so the matcher does not see the level", () => {
    expect(
      withoutHistory(
        "Problem: x\n\nTriaged as not-a-problem at 2026-10-07T00:00:00Z: a guard\nResolved as fixed at 2026-10-07T00:00:00Z\n",
      ),
    ).toBe("Problem: x");
  });
});

describe("hooks", () => {
  it("measures one run: the judge's matches, the review state, turns and time", async () => {
    const requests: JudgeRequest[] = [];
    const hooks = createHooks({
      judge: (request) => {
        requests.push(request);
        return Promise.resolve({
          output: {
            defects: [
              { id: "null-body", entries: ["L-null"] },
              { id: "missing-case", entries: [] },
            ],
            uncertain: true,
          },
          cost: 0.02,
          models: ["claude-sonnet-5"],
        });
      },
      key: () => KEY,
      kernel: () => fakeKernel(),
      record: () => undefined,
      round: () => ROUND,
    });
    const measured = await hooks.measure(context("/w"), {
      latencyMs: 90_000,
      response: { metadata: { numTurns: 12 } },
    });
    expect(requests).toHaveLength(1);
    expect(measured).toStrictEqual({
      metrics: {
        "found_null-body": 1,
        "found_missing-case": 0,
        recall_logic: 1,
        "recall_test-gap": 0,
        alarms: 2,
        false_alarms: 1,
        false_alarms_raw: 1,
        "found_after_triage_null-body": 1,
        "found_after_triage_missing-case": 0,
        recall_after_triage_logic: 1,
        "recall_after_triage_test-gap": 0,
        dismissed_by_triage: 0,
        binary_groups: 0,
        reader_write_denials: 0,
        judge_scope_denials: 0,
        reports_without_seams: 0,
        intent_before_areas: 0,
        findings_without_failure_scenario: 2,
        review_done: 1,
        uncertain: 1,
        turns: 12,
        wall_s: 90,
      },
      extraCost: 0.02,
      templateHashes: [],
      models: ["claude-sonnet-5"],
    });
  });

  it("calls no judge when the review wrote no entry, and needs a working copy", async () => {
    const hooks = createHooks({
      judge: () => Promise.reject(new Error("no judge expected")),
      key: () => KEY,
      kernel: () => (args) =>
        args === "explain review"
          ? { code: 0, json: { state: "ready" } }
          : { code: 0, json: { items: [] } },
      record: () => undefined,
      round: () => ROUND,
    });
    const measured = await hooks.measure(context("/w"), {});
    expect(measured.metrics).toMatchObject({ recall_logic: 0, alarms: 0, review_done: 0 });
    expect(measured.extraCost).toBe(0);
    await expect(hooks.measure(context(null), {})).rejects.toThrow(/no working copy/);
  });
});
