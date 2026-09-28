// `kernel-cli/attempt`: `attempt open`, `close` and `list` through the real
// registry over a Change in memory and a scripted git (`kernel-loops`).
import { describe, expect, it } from "vitest";

import { writeEntry } from "../../graph/tests/support.ts";
import { ROOT } from "../../log/tests/support.ts";
import {
  readAttempts,
  readDocument,
  readManifests,
  writeDocument,
} from "../../shared/store/index.ts";
import type { Store } from "../../shared/store/index.ts";
import { attemptCloseOutput, attemptListOutput, attemptOpenOutput } from "../schema/outputs.ts";
import {
  close,
  cycle,
  DIR,
  envelope,
  harness,
  open,
  packaged,
  recorded,
  simplified,
  started,
  stepsDone,
  underTicket,
} from "./support.ts";

const NO_ESCALATION = "policy:\n  escalation:\n    enabled: false\n";

function refusal(result: { code: number; json: unknown }) {
  return result.json as { rule: string; why: string; instead: string[] };
}

function records(store: Store) {
  return readAttempts(store, DIR).map((record) => record.data);
}

function entries(store: Store, type: string) {
  return store
    .list(`${DIR}/log`)
    .filter((name) => name.includes(`-${type}-`))
    .map((name) => readDocument(store, `${DIR}/log/${name}`))
    .map((document) => (document !== undefined && "data" in document ? document.data : {}));
}

describe("attempt open", () => {
  it("opens attempt 1 of the budget in scope full and writes the record", async () => {
    const h = await started();
    const opened = await open(h, "task-redispatch", "01-1");
    expect(opened.code, opened.stdout).toBe(0);
    expect(attemptOpenOutput.parse(opened.json)).toMatchObject({
      loop: "task-redispatch",
      target: "01-1",
      attempt: 1,
      of: 3,
      scope: "full",
    });
    expect(h.store.read(`${DIR}/attempts/task-redispatch-01-1-${opened.ticket}.md`)).toBeDefined();
    const text = await h.step(["attempt", "open", "task-redispatch", "01-2"]);
    expect(text.stdout).toMatch(
      /^A-\w{8} opened: task-redispatch 01-2, attempt 1 of 3, scope full/,
    );
  });

  it("lists the post-task steps in pipeline order with their roles for the code loops (T23-D41)", async () => {
    const h = await started();
    const steps = [
      { kind: "simplify", role: "simplifier" },
      { kind: "tests-scoped", role: "runner" },
      { kind: "lint", role: "runner" },
    ];
    expect(
      attemptOpenOutput.parse((await open(h, "task-redispatch", "01-1")).json).steps,
    ).toStrictEqual(steps);
    expect(attemptOpenOutput.parse((await open(h, "verify-fix", "01")).json).steps).toStrictEqual(
      steps,
    );
    const verifier = await open(h, "verifier", "plan");
    expect(verifier.code, verifier.stdout).toBe(0);
    expect(attemptOpenOutput.parse(verifier.json)).not.toHaveProperty("steps");
  });

  it.each([
    ["an unknown loop", ["task-escalation", "01-1"]],
    ["a part id for task-redispatch", ["task-redispatch", "01"]],
    ["a task id for verify-fix", ["verify-fix", "01-1"]],
    ["another id for review-fix", ["review-fix", "01"]],
    ["a task id for verifier", ["verifier", "01-1"]],
  ])("refuses %s with input/invalid-argument", async (_, [loop = "", target = ""]) => {
    const h = await started();
    const result = await open(h, loop, target);
    expect(result.code).toBe(3);
    expect(refusal(result).rule).toBe("input/invalid-argument");
  });

  it.each([
    ["task-redispatch", "01-9"],
    ["verify-fix", "07"],
    ["verifier", "nothing"],
  ])("refuses %s %s with input/not-found", async (loop, target) => {
    const h = await started();
    const result = await open(h, loop, target);
    expect(result.code).toBe(3);
    expect(refusal(result).rule).toBe("input/not-found");
  });

  it("refuses a task of a part that is not started with policy/not-ready", async () => {
    const h = await started();
    const result = await open(h, "task-redispatch", "02-1");
    expect(result.code).toBe(2);
    expect(refusal(result)).toMatchObject({
      rule: "policy/not-ready",
      instead: ["bdk part start 02"],
    });
  });

  it("refuses a skipped verifier node with policy/not-ready", async () => {
    const h = await started();
    const result = await open(h, "verifier", "plan-verify");
    expect(refusal(result).rule).toBe("policy/not-ready");
  });

  it("opens review-fix for the Change id and verify-fix for a started part", async () => {
    const h = await started();
    expect((await open(h, "verify-fix", "01")).code).toBe(0);
    const review = await open(h, "review-fix", "2026-09-25-login");
    expect(refusal(review).rule).toBe("policy/not-ready");
  });

  it("refuses a second ticket of the same key, not of a sibling", async () => {
    const h = await started();
    const first = await open(h, "task-redispatch", "01-1");
    const again = await open(h, "task-redispatch", "01-1");
    expect(again.code).toBe(2);
    expect(refusal(again)).toMatchObject({
      rule: "policy/ticket-open",
      instead: [`bdk attempt close ${first.ticket} ok|fail|not-run`],
    });
    expect((await open(h, "task-redispatch", "01-2")).code).toBe(0);
  });

  it("refuses an exhausted budget with --escalate as instead", async () => {
    const h = await started("policy:\n  budgets:\n    task-redispatch: 1\n");
    await cycle(h, "task-redispatch", "01-1", "fail");
    const result = await open(h, "task-redispatch", "01-1");
    expect(result.code).toBe(2);
    expect(refusal(result)).toMatchObject({
      rule: "policy/budget-exhausted",
      instead: ["bdk attempt open task-redispatch 01-1 --escalate"],
    });
  });

  it("budget 0 allows no plain attempt", async () => {
    const h = await started("policy:\n  budgets:\n    task-redispatch: 0\n");
    expect(refusal(await open(h, "task-redispatch", "01-1")).rule).toBe("policy/budget-exhausted");
  });

  it("refuses an oscillating round with policy/oscillation although budget is left", async () => {
    const h = await started("policy:\n  budgets:\n    task-redispatch: 5\n");
    const finding = { summary: "expired token accepted", refs: ["src/01-1.ts#verify"] };
    await cycle(h, "task-redispatch", "01-1", "fail", finding);
    await cycle(h, "task-redispatch", "01-1", "fail", {
      ...finding,
      summary: "Expired token accepted!",
    });
    const result = await open(h, "task-redispatch", "01-1");
    expect(refusal(result)).toMatchObject({
      rule: "policy/oscillation",
      instead: ["bdk attempt open task-redispatch 01-1 --escalate"],
    });
  });

  it("--escalate with budget left is policy/invalid-transition", async () => {
    const h = await started();
    await cycle(h, "task-redispatch", "01-1", "fail");
    const result = await open(h, "task-redispatch", "01-1", "--escalate");
    expect(result.code).toBe(2);
    expect(refusal(result).rule).toBe("policy/invalid-transition");
  });

  it("--escalate opens the one-shot ticket with the model, after a checkpoint", async () => {
    const h = await started("policy:\n  budgets:\n    task-redispatch: 2\n");
    await cycle(h, "task-redispatch", "01-1", "fail");
    await cycle(h, "task-redispatch", "01-1", "fail");
    h.git.status = [".bdk/changes/2026-09-25-login/log/x.md"];
    const opened = await open(h, "task-redispatch", "01-1", "--escalate");
    expect(opened.code, opened.stdout).toBe(0);
    expect(attemptOpenOutput.parse(opened.json)).toMatchObject({
      attempt: 3,
      of: 2,
      scope: "high+",
      escalation: { model: "opus" },
    });
    expect(h.git.committed.map((args) => args.join(" "))).toStrictEqual([
      "commit --quiet --only -m chore(bdk): checkpoint 2026-09-25-login -- .bdk/changes/2026-09-25-login/",
    ]);
    expect(records(h.store).at(-1)).toMatchObject({ escalation: true });
    await close(h, opened.ticket, "ok");
    const again = await open(h, "task-redispatch", "01-1", "--escalate");
    expect(refusal(again)).toMatchObject({
      rule: "policy/invalid-transition",
      why: "no escalation ticket: this round already used its escalation ticket",
    });
  });

  it("--escalate is refused when disabled or over per-change", async () => {
    const disabled = await started(
      "policy:\n  budgets:\n    task-redispatch: 1\n  escalation:\n    enabled: false\n",
    );
    await cycle(disabled, "task-redispatch", "01-1", "ok");
    expect(refusal(await open(disabled, "task-redispatch", "01-1", "--escalate")).why).toContain(
      "policy.escalation.enabled is false",
    );
    const capped = await started(
      "policy:\n  budgets:\n    task-redispatch: 1\n  escalation:\n    per-change: 1\n",
    );
    await cycle(capped, "task-redispatch", "01-1", "ok");
    await cycle(capped, "task-redispatch", "01-2", "ok");
    expect((await open(capped, "task-redispatch", "01-1", "--escalate")).code).toBe(0);
    expect(refusal(await open(capped, "task-redispatch", "01-2", "--escalate")).why).toContain(
      "policy.escalation.per-change",
    );
  });

  it("narrowing drops the previous fail's findings outside the scope into one entry", async () => {
    const h = await started();
    const first = await open(h, "task-redispatch", "01-1");
    const high = underTicket(h, first.ticket, {
      summary: "token not checked",
      refs: ["src/01-1.ts"],
      severity: "high",
    });
    const low = underTicket(h, first.ticket, {
      summary: "rename helper for clarity",
      refs: ["src/01-1.ts"],
      severity: "low",
    });
    await close(h, first.ticket, "fail");
    const second = await open(h, "task-redispatch", "01-1");
    const report = attemptOpenOutput.parse(second.json);
    expect(report).toMatchObject({
      attempt: 2,
      scope: "high+",
      narrowedFrom: "full",
      dropped: [{ id: low, summary: "rename helper for clarity" }],
    });
    expect(records(h.store).at(-1)).toMatchObject({ dropped: [low], "narrowed-from": "full" });
    const kernel = entries(h.store, "finding").find((entry) => entry.id === report.entry);
    expect(kernel).toMatchObject({ source: "kernel", review: true, refs: ["01-1", low] });
    expect(JSON.stringify(report)).not.toContain(high);
  });

  it("removes its own record and refuses when a rival ticket of the key appears", async () => {
    const h = await started();
    const write = h.store.write.bind(h.store);
    let raced = false;
    h.store.write = (path, text) => {
      write(path, text);
      if (raced || !path.includes("/attempts/")) return;
      raced = true;
      write(
        `${DIR}/attempts/task-redispatch-01-1-A-rival000.md`,
        text.replace(/ticket: A-\w{8}/, "ticket: A-rival000"),
      );
    };
    const result = await open(h, "task-redispatch", "01-1");
    expect(refusal(result)).toMatchObject({ rule: "policy/ticket-open" });
    expect(records(h.store).map((record) => record.ticket)).toStrictEqual(["A-rival000"]);
  });
});

describe("attempt close", () => {
  it("refuses an unknown ticket and a closed one", async () => {
    const h = await started();
    expect(refusal(await close(h, "A-nothing0", "ok")).rule).toBe("input/not-found");
    const { ticket } = await cycle(h, "task-redispatch", "01-1", "ok");
    const again = await close(h, ticket, "ok");
    expect(again.code).toBe(2);
    expect(refusal(again).rule).toBe("policy/no-open-ticket");
  });

  it("not-run needs --reason and leaves the record open", async () => {
    const h = await started();
    const { ticket } = await open(h, "task-redispatch", "01-1");
    const result = await close(h, ticket, "not-run");
    expect(result.code).toBe(3);
    expect(refusal(result).rule).toBe("input/missing-argument");
    expect(records(h.store)[0]?.outcome).toBeUndefined();
  });

  it("a do-not-touch path refuses and leaves the ticket open", async () => {
    const h = await started();
    const { ticket } = await open(h, "task-redispatch", "01-1");
    h.git.status = ["src/billing/invoice.ts"];
    const result = await close(h, ticket, "ok");
    expect(refusal(result)).toMatchObject({
      rule: "policy/do-not-touch",
      why: "src/billing/invoice.ts matches do-not-touch src/billing/** of part 01",
    });
    expect(records(h.store)[0]?.outcome).toBeUndefined();
  });

  it("records undeclared files as one kernel finding and in diff", async () => {
    const h = await started();
    const { ticket } = await open(h, "task-redispatch", "01-1");
    h.git.status = ["src/01-1.ts", "src/util.ts"];
    const report = attemptCloseOutput.parse((await close(h, ticket, "ok")).json);
    expect(report).toMatchObject({
      diff: {
        declared: ["src/01-1.ts"],
        touched: ["src/01-1.ts", "src/util.ts"],
        undeclared: ["src/util.ts"],
      },
      next: { action: "post-task-steps" },
    });
    const finding = entries(h.store, "finding").find((entry) => entry.id === report.findings?.[0]);
    expect(finding).toMatchObject({ source: "kernel", refs: ["01-1", "src/util.ts"] });
  });

  it("refuses an envelope naming entries not written under the ticket", async () => {
    const h = await started();
    const { ticket } = await open(h, "task-redispatch", "01-1");
    const mine = underTicket(h, ticket, { summary: "a finding", refs: ["src/01-1.ts"] });
    const stranger = writeEntry(h.store, { type: "finding", at: "2026-09-25T11:30:00.000Z" });
    const path = envelope(h, ticket, [mine, stranger]);
    const result = await close(h, ticket, "fail", "--envelope", path);
    expect(refusal(result)).toMatchObject({ rule: "policy/entries-missing" });
    expect(refusal(result).why).toContain(stranger);
    expect(refusal(result).why).not.toContain(mine);
    const fine = await close(h, ticket, "fail", "--envelope", envelope(h, ticket, [mine]));
    expect(fine.code, fine.stdout).toBe(0);
  });

  it("a fail stores the fingerprints of located findings only", async () => {
    const h = await started();
    const { ticket } = await open(h, "task-redispatch", "01-1");
    underTicket(h, ticket, {
      summary: "expired token accepted",
      refs: ["src/auth/login.ts#verifyToken"],
    });
    underTicket(h, ticket, { summary: "no location", refs: ["01-1"] });
    const report = attemptCloseOutput.parse((await close(h, ticket, "fail")).json);
    const stored = records(h.store)[0]?.findings;
    expect(stored).toStrictEqual([
      {
        fingerprint: expect.stringMatching(/^sha256:[0-9a-f]{64}$/) as string,
        type: "finding",
        file: "src/auth/login.ts",
        symbol: "verifyToken",
      },
    ]);
    expect(report.fingerprints).toStrictEqual([stored?.[0]?.fingerprint]);
    expect(report.next).toStrictEqual({ action: "narrow", scope: "high+" });
  });

  it("different problems on one symbol do not oscillate", async () => {
    const h = await started("policy:\n  budgets:\n    task-redispatch: 5\n");
    const at = ["src/01-1.ts#verify"];
    await cycle(h, "task-redispatch", "01-1", "fail", { summary: "first problem", refs: at });
    const second = await cycle(h, "task-redispatch", "01-1", "fail", {
      summary: "another problem",
      refs: at,
    });
    expect(attemptCloseOutput.parse(second.close.json).next.action).toBe("narrow");
  });

  it("oscillation returns escalate naming the fingerprint", async () => {
    const h = await started("policy:\n  budgets:\n    task-redispatch: 5\n");
    const at = ["src/01-1.ts#verify"];
    await cycle(h, "task-redispatch", "01-1", "fail", {
      summary: "expired token accepted",
      refs: at,
    });
    const second = await cycle(h, "task-redispatch", "01-1", "fail", {
      summary: "Expired token accepted!",
      refs: at,
    });
    const next = attemptCloseOutput.parse(second.close.json).next;
    expect(next.action).toBe("escalate");
    expect(next.why).toMatch(/^fingerprint sha256:[0-9a-f]{64} recurs in 2 failed attempts/);
  });

  it("not-run retries in the same scope without consuming the budget", async () => {
    const h = await started();
    const { close: closed } = await cycle(h, "task-redispatch", "01-1", "not-run");
    expect(attemptCloseOutput.parse(closed.json)).toMatchObject({
      notRunCount: 1,
      next: { action: "retry", scope: "full" },
    });
    expect(h.store.read(`${DIR}/attempts/${h.store.list(`${DIR}/attempts`)[0] ?? ""}`)).toContain(
      "no test runner",
    );
    const next = await open(h, "task-redispatch", "01-1");
    expect(attemptOpenOutput.parse(next.json)).toMatchObject({ attempt: 1, scope: "full" });
  });

  it("exhausting the budget without escalation parks the Change with the ladder question", async () => {
    const h = await started(
      "policy:\n  budgets:\n    task-redispatch: 2\n  escalation:\n    enabled: false\n",
    );
    const first = await cycle(h, "task-redispatch", "01-1", "fail");
    h.git.status = [".bdk/changes/2026-09-25-login/log/x.md"];
    const second = await cycle(h, "task-redispatch", "01-1", "fail");
    const next = attemptCloseOutput.parse(second.close.json).next;
    expect(next).toMatchObject({
      action: "parked",
      why: "2 of 2 attempts used; policy.escalation.enabled is false",
      resume: "bdk change resume 2026-09-25-login --option <n>",
    });
    const questions = entries(h.store, "question");
    expect(questions).toHaveLength(1);
    expect(questions[0]).toMatchObject({
      id: next.entry,
      park: true,
      review: true,
      source: "kernel",
      options: ["retry 01-1 with a fresh budget", "accept 01-1 as debt", "split part 01"],
      refs: ["01-1", first.ticket, second.ticket],
    });
    expect(h.git.committed).toHaveLength(1);
    const status = await h.step(["change", "status", "--json"]);
    expect(status.json).toMatchObject({ parked: { entry: next.entry, resume: next.resume } });
    const refused = await open(h, "task-redispatch", "01-1");
    expect(refusal(refused)).toMatchObject({
      rule: "policy/budget-exhausted",
      instead: ["bdk change resume 2026-09-25-login --option <n>"],
    });
  });

  it("an answer opens a new round with attempt 1 and scope full", async () => {
    const h = await started(
      NO_ESCALATION.replace("policy:\n", "policy:\n  budgets:\n    task-redispatch: 1\n"),
    );
    await cycle(h, "task-redispatch", "01-1", "fail");
    const resumed = await h.step([
      "change",
      "resume",
      "2026-09-25-login",
      "--option",
      "1",
      "--json",
    ]);
    expect(resumed.code, resumed.stdout).toBe(0);
    const opened = await open(h, "task-redispatch", "01-1");
    expect(attemptOpenOutput.parse(opened.json)).toMatchObject({ attempt: 1, scope: "full" });
    expect(opened.json).not.toHaveProperty("narrowedFrom");
  });

  it("the escalation ticket's fail parks the Change", async () => {
    const h = await started("policy:\n  budgets:\n    task-redispatch: 1\n");
    const first = await cycle(h, "task-redispatch", "01-1", "fail");
    expect(attemptCloseOutput.parse(first.close.json).next).toMatchObject({
      action: "escalate",
      why: "1 of 1 attempts used",
    });
    const escalation = await open(h, "task-redispatch", "01-1", "--escalate");
    const closed = await close(h, escalation.ticket, "fail");
    expect(attemptCloseOutput.parse(closed.json).next).toMatchObject({
      action: "parked",
      why: "the escalation ticket failed",
    });
  });

  it("three not-run closes of a verifier park without narrowing", async () => {
    const h = await started();
    const outcomes = [];
    for (let at = 0; at < 3; at++) {
      const opened = await open(h, "verifier", "plan");
      expect(opened.code, opened.stdout).toBe(0);
      const closed = await close(h, opened.ticket, "not-run", "--reason", "no reviewer");
      outcomes.push(attemptCloseOutput.parse(closed.json).next.action);
    }
    expect(outcomes).toStrictEqual(["retry", "retry", "parked"]);
    expect(entries(h.store, "question")[0]).toMatchObject({
      refs: expect.arrayContaining(["plan"]) as string[],
      options: ["retry plan with a fresh budget", "accept plan as debt"],
    });
    const list = attemptListOutput.parse(
      (await h.step(["attempt", "list", "--for", "plan", "--json"])).json,
    );
    expect(list.budgets).toStrictEqual({
      verifier: { used: 0, of: 2 },
      "not-run": { used: 3, of: 3 },
    });
  });
});

describe("attempt list", () => {
  it("open tickets first, then newest first, with budgets and entries for a task", async () => {
    const h = await started();
    const first = await cycle(h, "task-redispatch", "01-1", "fail");
    await cycle(h, "task-redispatch", "01-1", "not-run");
    const opened = await open(h, "task-redispatch", "01-1");
    underTicket(h, opened.ticket, { summary: "one", refs: ["src/01-1.ts"] });
    const list = attemptListOutput.parse(
      (await h.step(["attempt", "list", "--for", "01-1", "--json"])).json,
    );
    expect(
      list.items.map((item) => [item.ticket === opened.ticket, item.outcome, item.entries]),
    ).toStrictEqual([
      [true, undefined, 1],
      [false, "not-run", 0],
      [false, "fail", 0],
    ]);
    expect(list.items.at(-1)?.ticket).toBe(first.ticket);
    expect(list).toMatchObject({
      for: "01-1",
      total: 3,
      budgets: { "task-redispatch": { used: 1, of: 3 }, "not-run": { used: 1, of: 3 } },
    });
  });

  it("--for a part includes its tasks; without --for no budgets", async () => {
    const h = await started();
    await cycle(h, "task-redispatch", "01-1", "ok");
    await cycle(h, "verify-fix", "01", "ok");
    const part = attemptListOutput.parse(
      (await h.step(["attempt", "list", "--for", "01", "--json"])).json,
    );
    expect(part.items.map((item) => item.target).sort()).toStrictEqual(["01", "01-1"]);
    expect(part.budgets).toStrictEqual({
      "verify-fix": { used: 1, of: 2 },
      "not-run": { used: 0, of: 3 },
    });
    expect(part.items[0]).not.toHaveProperty("entries");
    const all = attemptListOutput.parse((await h.step(["attempt", "list", "--json"])).json);
    expect(all.total).toBe(2);
    expect(all).not.toHaveProperty("budgets");
  });

  it("shows the current round only, every round with --all", async () => {
    const h = await started(
      NO_ESCALATION.replace("policy:\n", "policy:\n  budgets:\n    task-redispatch: 1\n"),
    );
    await cycle(h, "task-redispatch", "01-1", "fail");
    await h.step(["change", "resume", "2026-09-25-login", "--option", "1"]);
    await open(h, "task-redispatch", "01-1");
    const current = attemptListOutput.parse((await h.step(["attempt", "list", "--json"])).json);
    expect(current.total).toBe(1);
    const all = attemptListOutput.parse(
      (await h.step(["attempt", "list", "--all", "--json"])).json,
    );
    expect(all.total).toBe(2);
  });

  it("an empty list", async () => {
    const h = harness();
    const text = await h.step(["attempt", "list"]);
    expect(text.stdout).toBe("No attempts.\n");
  });
});

describe("attempt close: rules read (T23-D28)", () => {
  it("writes one reviewed finding when an implementer closes without rules-read; the close goes on", async () => {
    const h = await started();
    const { ticket } = await open(h, "task-redispatch", "01-1");
    await stepsDone(h, ticket);
    const result = await close(h, ticket, "ok");
    expect(result.code, result.stdout).toBe(0);
    const report = attemptCloseOutput.parse(result.json);
    expect(report.rulesFinding).toMatch(/^L-/);
    expect(records(h.store)[0]).toMatchObject({ ticket, outcome: "ok" });
    expect(entries(h.store, "finding")).toContainEqual(
      expect.objectContaining({
        id: report.rulesFinding,
        source: "kernel",
        review: true,
        summary: `implementer closed ${ticket} without reading its rules`,
        refs: ["01-1", ticket],
      }),
    );
  });

  it("writes none when the implementer read its rules", async () => {
    const h = await started();
    const { ticket } = await open(h, "task-redispatch", "01-1");
    await stepsDone(h, ticket);
    const [record] = readAttempts(h.store, DIR);
    if (record === undefined) throw new Error("no attempt record");
    writeDocument(h.store, record.path, {
      data: { ...record.data, "rules-read": "2026-09-25T11:01:30.000Z" },
      body: record.body,
    });
    const report = attemptCloseOutput.parse((await close(h, ticket, "ok")).json);
    expect(report.rulesFinding).toBeUndefined();
    expect(entries(h.store, "finding")).toStrictEqual([]);
  });

  it("writes one when a later role's package is active", async () => {
    const h = await started();
    const { ticket } = await open(h, "task-redispatch", "01-1");
    await stepsDone(h, ticket);
    const report = attemptCloseOutput.parse((await close(h, ticket, "ok")).json);
    expect(report.rulesFinding).toMatch(/^L-/);
  });

  it("writes none for another role", async () => {
    const h = await started();
    const { ticket } = await open(h, "task-redispatch", "01-1");
    packaged(h, ticket, "runner");
    const report = attemptCloseOutput.parse((await close(h, ticket, "ok")).json);
    expect(report.rulesFinding).toBeUndefined();
  });
});

describe("attempt close ok: the post-task step evidence (T23-D41, D43)", () => {
  async function coded(settings?: string) {
    const h = await started(settings);
    const { ticket } = await open(h, "task-redispatch", "01-1");
    packaged(h, ticket, "implementer");
    return { h, ticket };
  }

  it("records simplify from the simplifier report and closes with fresh cited evidence", async () => {
    const { h, ticket } = await coded();
    await stepsDone(h, ticket);
    const result = await close(h, ticket, "ok");
    expect(result.code, result.stdout).toBe(0);
    const simplify = readManifests(h.store, DIR).filter((m) => m.data.kind === "simplify");
    expect(simplify.map((m) => m.data)).toMatchObject([
      { ticket, target: "01-1", source: "kernel", verdict: "pass" },
    ]);
    expect(simplify[0]?.data.files[0]?.stored).toBe("committed");
    expect(records(h.store)[0]).toMatchObject({ outcome: "ok" });
  });

  it("records simplify as not-run from a blocked simplifier report", async () => {
    const { h, ticket } = await coded();
    simplified(h, ticket, "blocked");
    packaged(h, ticket, "runner");
    await recorded(h, ticket, "tests-scoped");
    await recorded(h, ticket, "lint");
    expect((await close(h, ticket, "ok")).code).toBe(0);
    expect(readManifests(h.store, DIR).find((m) => m.data.kind === "simplify")?.data.verdict).toBe(
      "not-run",
    );
  });

  it("refuses a missing step with policy/missing-evidence naming its role; the ticket stays open", async () => {
    const { h, ticket } = await coded();
    simplified(h, ticket);
    await recorded(h, ticket, "tests-scoped");
    const result = await close(h, ticket, "ok");
    expect(result.code).toBe(2);
    expect(refusal(result)).toMatchObject({
      rule: "policy/missing-evidence",
      instead: [`bdk dispatch build 01-1 runner ${ticket}`],
    });
    expect(refusal(result).why).toContain("lint");
    expect(records(h.store)[0]?.outcome).toBeUndefined();
  });

  it("refuses a missing simplifier report as missing simplify evidence", async () => {
    const { h, ticket } = await coded();
    await recorded(h, ticket, "tests-scoped");
    await recorded(h, ticket, "lint");
    const result = await close(h, ticket, "ok");
    expect(refusal(result)).toMatchObject({
      rule: "policy/missing-evidence",
      instead: [`bdk dispatch build 01-1 simplifier ${ticket}`],
    });
  });

  it("refuses a failing step with policy/missing-evidence and attempt close fail as instead", async () => {
    const { h, ticket } = await coded();
    simplified(h, ticket);
    await recorded(h, ticket, "tests-scoped");
    await recorded(h, ticket, "lint", "fail");
    const result = await close(h, ticket, "ok");
    expect(refusal(result)).toMatchObject({
      rule: "policy/missing-evidence",
      instead: [`bdk attempt close ${ticket} fail`],
    });
    expect(refusal(result).why).toMatch(/^lint E-\w{8} says fail$/);
  });

  it("refuses stale steps with policy/stale-evidence naming the kinds and the changed file", async () => {
    const { h, ticket } = await coded();
    simplified(h, ticket);
    await recorded(h, ticket, "tests-scoped");
    await recorded(h, ticket, "lint");
    h.store.write(`${ROOT}/src/01-2.ts`, "export const two = 2;\n");
    const result = await close(h, ticket, "ok");
    expect(refusal(result).rule).toBe("policy/stale-evidence");
    expect(refusal(result).why).toMatch(/^tests-scoped E-\w{8} .*changed: src\/01-2\.ts; lint E-/);
    expect(records(h.store)[0]?.outcome).toBeUndefined();
  });

  it("refuses a pass without a citation and a changed committed file with policy/missing-citation", async () => {
    const { h, ticket } = await coded();
    simplified(h, ticket);
    await recorded(h, ticket, "tests-scoped");
    await recorded(h, ticket, "lint", "not-run", false);
    const manifest = readManifests(h.store, DIR).find((m) => m.data.kind === "tests-scoped");
    if (manifest === undefined) throw new Error("no manifest");
    writeDocument(h.store, manifest.path, {
      data: { ...manifest.data, citations: undefined },
      body: "",
    });
    const uncited = await close(h, ticket, "ok");
    expect(refusal(uncited)).toMatchObject({ rule: "policy/missing-citation" });
    expect(refusal(uncited).why).toContain("passes without a citation");

    writeDocument(h.store, manifest.path, { data: manifest.data, body: "" });
    const committed = manifest.data.files[0]?.path ?? "";
    h.store.write(`${ROOT}/${committed}`, '{"failed":3}\n');
    const changed = await close(h, ticket, "ok");
    expect(refusal(changed).why).toContain(`has a changed committed file ${committed}`);
  });

  it("accepts not-run within policy.budgets.not-run and refuses it past the budget", async () => {
    const within = await coded();
    simplified(within.h, within.ticket);
    await recorded(within.h, within.ticket, "tests-scoped");
    await recorded(within.h, within.ticket, "lint", "not-run", false);
    expect((await close(within.h, within.ticket, "ok")).code).toBe(0);

    const past = await coded("policy:\n  budgets:\n    not-run: 0\n");
    simplified(past.h, past.ticket);
    await recorded(past.h, past.ticket, "tests-scoped");
    await recorded(past.h, past.ticket, "lint", "not-run", false);
    const result = await close(past.h, past.ticket, "ok");
    expect(refusal(result)).toMatchObject({
      rule: "policy/missing-evidence",
      instead: [`bdk attempt close ${past.ticket} not-run --reason "<what was missing>"`],
    });
  });

  it("checks nothing for a verifier ticket, a fail or a not-run close", async () => {
    const h = await started();
    const verifier = await open(h, "verifier", "plan");
    packaged(h, verifier.ticket, "verifier", "plan");
    expect((await close(h, verifier.ticket, "ok")).code).toBe(0);
    const failed = await open(h, "task-redispatch", "01-1");
    packaged(h, failed.ticket, "implementer");
    expect((await close(h, failed.ticket, "fail")).code).toBe(0);
    const skipped = await open(h, "task-redispatch", "01-1");
    packaged(h, skipped.ticket, "implementer");
    expect((await close(h, skipped.ticket, "not-run", "--reason", "no runner")).code).toBe(0);
  });
});
