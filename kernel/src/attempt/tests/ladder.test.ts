// `kernel-loops`: the ladder as pure functions over records and entries
// (T22 design D-1 to D-5).
import { describe, expect, it } from "vitest";

import {
  currentRound,
  escalationBlocked,
  inScope,
  ladderOptions,
  nextRung,
  refLocation,
  roundState,
  scopeFor,
} from "../domain/ladder.ts";
import type { LadderEntry, LadderPolicy, LadderRecord, Outcome } from "../domain/ladder.ts";

const POLICY: LadderPolicy = {
  budget: 3,
  notRunBudget: 3,
  threshold: 2,
  escalation: { enabled: true, model: "opus", perChange: 3 },
};

let serial = 0;

function record(outcome: Outcome | undefined, fields: Partial<LadderRecord> = {}): LadderRecord {
  serial++;
  return {
    ticket: `A-${String(serial).padStart(8, "0")}`,
    attempt: 1,
    scope: "full",
    openedAt: "2026-09-25T10:00:00.000Z",
    outcome,
    fingerprints: [],
    ...fields,
  };
}

/** Records in the order they ran, with `attempt` stamped as `attempt open` stamps it. */
function run(...outcomes: (Outcome | [Outcome, string[]])[]): LadderRecord[] {
  const records: LadderRecord[] = [];
  for (const item of outcomes) {
    const [outcome, fingerprints] = Array.isArray(item) ? item : [item, []];
    const state = roundState(records, POLICY);
    records.push(
      record(outcome, { attempt: state.attempt, scope: scopeFor(state.attempt), fingerprints }),
    );
  }
  return records;
}

function question(id: string, refs: string[]): LadderEntry {
  return { id, type: "question", source: "kernel", park: true, refs };
}

function decision(id: string, question: string): LadderEntry {
  return { id, type: "decision", source: "user", refs: [question] };
}

describe("currentRound", () => {
  it("holds every record while no ladder question is answered", () => {
    const records = run("fail", "fail", "fail");
    expect(currentRound(records, [question("L-q", ["02-3", records[2]?.ticket ?? ""])])).toEqual(
      records,
    );
  });

  it("an answering decision opens a new round without the question's tickets", () => {
    const old = run("fail", "fail");
    const fresh = record(undefined);
    const tickets = old.map((item) => item.ticket);
    const entries = [question("L-q", ["02-3", ...tickets]), decision("L-d", "L-q")];
    expect(currentRound([...old, fresh], entries)).toEqual([fresh]);
  });

  it("a user question or a question of another key does not end the round", () => {
    const records = run("fail");
    const entries = [
      { ...question("L-u", ["change.md"]), source: "user" },
      decision("L-d", "L-u"),
      question("L-o", ["A-someoneel"]),
      decision("L-e", "L-o"),
    ];
    expect(currentRound(records, entries)).toEqual(records);
  });

  it("orders records of one second by attempt, not-run first, escalation last", () => {
    const escalation = record("fail", { attempt: 3, escalation: true, ticket: "A-00000000" });
    const failTwo = record("fail", { attempt: 2, ticket: "A-11111111" });
    const notRunTwo = record("not-run", { attempt: 2, ticket: "A-zzzzzzzz" });
    const failOne = record("fail", { attempt: 1, ticket: "A-yyyyyyyy" });
    expect(currentRound([escalation, failTwo, notRunTwo, failOne], [])).toEqual([
      failOne,
      notRunTwo,
      failTwo,
      escalation,
    ]);
  });
});

describe("roundState", () => {
  it("a fresh round: attempt 1 of the budget, no scope", () => {
    expect(roundState([], POLICY)).toMatchObject({
      used: 0,
      of: 3,
      attempt: 1,
      notRun: 0,
      scope: undefined,
      escalated: false,
      oscillating: undefined,
    });
  });

  it("counts ok and fail, not not-run and not the escalation ticket", () => {
    const records = [
      ...run("fail", "not-run", "fail"),
      record("fail", { attempt: 3, escalation: true }),
    ];
    expect(roundState(records, POLICY)).toMatchObject({ used: 2, attempt: 3, escalated: true });
  });

  it("the not-run counter is consecutive and reset by ok or fail", () => {
    expect(roundState(run("not-run", "not-run"), POLICY).notRun).toBe(2);
    expect(roundState(run("not-run", "fail"), POLICY).notRun).toBe(0);
    expect(roundState(run("not-run", "ok", "not-run"), POLICY).notRun).toBe(1);
  });

  it("an open ticket neither counts nor resets", () => {
    expect(roundState([...run("not-run"), record(undefined)], POLICY)).toMatchObject({
      used: 0,
      notRun: 1,
    });
  });

  it("the scope is the latest plain ticket's", () => {
    expect(roundState(run("fail", "fail"), POLICY).scope).toBe("high+");
  });

  it("a not-run escalation ticket leaves the escalation unused", () => {
    const records = [...run("fail"), record("not-run", { attempt: 2, escalation: true })];
    expect(roundState(records, POLICY).escalated).toBe(false);
    const open = [...run("fail"), record(undefined, { attempt: 2, escalation: true })];
    expect(roundState(open, POLICY).escalated).toBe(true);
  });

  it("the latest fail record is remembered for dropped findings", () => {
    const records = run("fail", "not-run");
    expect(roundState(records, POLICY).lastFail).toBe(records[0]?.ticket);
  });

  it("oscillation over non-consecutive fail records reaching the threshold", () => {
    const records = run(["fail", ["sha256:a"]], ["fail", ["sha256:b"]], ["fail", ["sha256:a"]]);
    expect(roundState(records, { ...POLICY, budget: 5 }).oscillating).toBe("sha256:a");
    expect(roundState(records, { ...POLICY, threshold: 3 }).oscillating).toBeUndefined();
  });

  it("one record carrying a fingerprint twice counts once", () => {
    const records = run(["fail", ["sha256:a", "sha256:a"]]);
    expect(roundState(records, POLICY).oscillating).toBeUndefined();
  });
});

describe("scopes", () => {
  it("full, high+, then blockers", () => {
    expect([1, 2, 3, 4].map(scopeFor)).toStrictEqual(["full", "high+", "blockers", "blockers"]);
  });

  it("high+ keeps blockers and critical or high findings; blockers keeps critical", () => {
    const low = { type: "finding", severity: "low" };
    const high = { type: "finding", severity: "high" };
    const critical = { type: "finding", severity: "critical" };
    const blocker = { type: "blocker" };
    expect([low, high, critical, blocker].map((entry) => inScope("full", entry))).toStrictEqual([
      true,
      true,
      true,
      true,
    ]);
    expect([low, high, critical, blocker].map((entry) => inScope("high+", entry))).toStrictEqual([
      false,
      true,
      true,
      true,
    ]);
    expect([low, high, critical, blocker].map((entry) => inScope("blockers", entry))).toStrictEqual(
      [false, false, true, true],
    );
    expect(inScope("high+", { type: "finding" })).toBe(false);
  });
});

describe("escalationBlocked", () => {
  const used = roundState(run("fail", "fail", "fail"), POLICY);

  it("available when enabled, unused in the round and under per-change", () => {
    expect(escalationBlocked(used, POLICY, 2)).toBeUndefined();
  });

  it("names why not", () => {
    expect(
      escalationBlocked(
        used,
        { ...POLICY, escalation: { ...POLICY.escalation, enabled: false } },
        0,
      ),
    ).toBe("policy.escalation.enabled is false");
    expect(escalationBlocked({ ...used, escalated: true }, POLICY, 0)).toBe(
      "this round already used its escalation ticket",
    );
    expect(escalationBlocked(used, POLICY, 3)).toContain("policy.escalation.per-change");
  });
});

describe("nextRung", () => {
  const state = (...outcomes: (Outcome | [Outcome, string[]])[]) =>
    roundState(run(...outcomes), POLICY);

  it("ok: commit, the step evidence having passed at the close", () => {
    expect(nextRung("ok", false, state("ok"), POLICY, undefined)).toStrictEqual({
      action: "commit",
    });
  });

  it("not-run with budget left: retry in the same scope", () => {
    expect(nextRung("not-run", false, state("fail", "not-run"), POLICY, undefined)).toStrictEqual({
      action: "retry",
      scope: "high+",
    });
  });

  it("not-run budget used up: parked, never escalate", () => {
    const after = state("not-run", "not-run", "not-run");
    expect(nextRung("not-run", false, after, POLICY, undefined)).toMatchObject({
      action: "parked",
    });
  });

  it("fail with budget left: narrow with the next scope", () => {
    expect(nextRung("fail", false, state("fail"), POLICY, undefined)).toStrictEqual({
      action: "narrow",
      scope: "high+",
    });
  });

  it("fail with the budget used and escalation available: escalate", () => {
    expect(nextRung("fail", false, state("fail", "fail", "fail"), POLICY, undefined)).toMatchObject(
      { action: "escalate", why: "3 of 3 attempts used" },
    );
  });

  it("fail oscillating with budget left: escalate naming the fingerprint", () => {
    const after = state(["fail", ["sha256:a"]], ["fail", ["sha256:a"]]);
    expect(nextRung("fail", false, after, POLICY, undefined)).toMatchObject({
      action: "escalate",
      why: "fingerprint sha256:a recurs in 2 failed attempts of the round",
    });
  });

  it("fail with no escalation available: parked with the reason", () => {
    expect(
      nextRung(
        "fail",
        false,
        state("fail", "fail", "fail"),
        POLICY,
        "policy.escalation.enabled is false",
      ),
    ).toStrictEqual({
      action: "parked",
      why: "3 of 3 attempts used; policy.escalation.enabled is false",
    });
  });

  it("fail of the escalation ticket: parked", () => {
    expect(nextRung("fail", true, state("fail"), POLICY, undefined)).toMatchObject({
      action: "parked",
    });
  });

  it("budget 0 allows no plain attempt", () => {
    const zero = roundState([], { ...POLICY, budget: 0 });
    expect(zero).toMatchObject({ used: 0, of: 0 });
    expect(zero.used >= zero.of).toBe(true);
  });
});

describe("ladderOptions", () => {
  it("retry and accept, plus split for a task or part target", () => {
    expect(ladderOptions("02-3", "02")).toStrictEqual([
      "retry 02-3 with a fresh budget",
      "accept 02-3 as debt",
      "split part 02",
    ]);
    expect(ladderOptions("plan-verify", undefined)).toHaveLength(2);
  });
});

describe("refLocation", () => {
  it("the first path ref, with its symbol", () => {
    expect(refLocation(["02-3", "src/auth/login.ts#verifyToken", "src/b.ts"])).toStrictEqual({
      file: "src/auth/login.ts",
      symbol: "verifyToken",
    });
    expect(refLocation(["README.md"])).toStrictEqual({ file: "README.md" });
  });

  it("skips entry, ticket, task, part and rule ids", () => {
    expect(
      refLocation([
        "L-abcd1234",
        "2026-09-25-login/L-abcd1234",
        "A-abcd1234",
        "02-3",
        "02",
        "policy/do-not-touch",
      ]),
    ).toBeUndefined();
  });
});
