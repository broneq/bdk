// `kernel-cli/attempt` (T22 records) through the built bundle in real
// repositories: one case per exit code and per declared rule of `attempt
// open`, `close` and `list`, every output validated against its schema.
// A `part` ticket closes `ok` only after its agent committed every task with
// the command `bdk check run` prints (#166).
import { rmSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

import {
  answered,
  bdk,
  git,
  outsideRepository,
  read,
  refused,
  repository,
  ingestArgs,
} from "../../../tests/support/repo.ts";
import { fileStore } from "../../shared/store/index.ts";
import {
  close,
  closed,
  conformed,
  dispatched,
  envelope,
  logUnder,
  open,
  opened,
  recorded,
  started,
  stepsDone,
  tasksCommitted,
} from "./e2e-support.ts";

describe("bdk attempt open", () => {
  it("exit 0: attempt 1 of the budget, the record on disk", () => {
    const change = started();
    const head = git(change.root, "rev-parse", "HEAD").trim();
    const report = answered(open(change, "part", "01"), "output/attempt-open.json");
    expect(report).toMatchObject({ attempt: 1, of: 3, scope: "full", base: head });
    expect(report.steps).toStrictEqual([
      { kind: "conform", role: "conformer" },
      { kind: "tests-scoped", command: "bdk check run" },
      { kind: "lint", command: "bdk check run" },
    ]);
    const record = read(
      change.root,
      `.bdk/changes/${change.id}/attempts/part-01-${String(report.ticket)}.md`,
    );
    expect(record).toContain("loop: part");
    expect(record).toContain(`base: ${head}`);
    expect(bdk(["attempt", "open", "part", "01"], started().root).stdout).toContain(
      "attempt 1 of 3, scope full",
    );
  });

  it("exit 3 input/invalid-argument: a task id, and the removed loops", () => {
    const change = started();
    refused(open(change, "part", "01-1"), 3, "input/invalid-argument");
    refused(open(change, "task-redispatch", "01-1"), 3, "input/invalid-argument");
    refused(open(change, "part-lead", "01"), 3, "input/invalid-argument");
  });

  it("exit 3 input/not-found", () => {
    refused(open(started(), "part", "09"), 3, "input/not-found");
  });

  it("exit 2 policy/not-ready", () => {
    const result = refused(open(started(), "part", "02"), 2, "policy/not-ready");
    expect(result.instead).toStrictEqual(["bdk part start 02"]);
  });

  it("exit 2 policy/ticket-open", () => {
    const change = started();
    opened(change, "part", "01");
    refused(open(change, "part", "01"), 2, "policy/ticket-open");
  });

  it("exit 2 policy/files-busy for a part sharing a file with an open ticket's part", () => {
    const root = repository();
    const created = bdk(
      ["change", "new", "Fix the login typo", "--profile", "tiny", "--reason", "r", "--json"],
      root,
    );
    const id = (created.json as { change: string }).change;
    const part = (nn: string) => {
      fileStore().write(
        join(root, ".bdk/changes", id, `plan/parts/${nn}-part.md`),
        `---\nschema: 1\nid: "${nn}"\ntitle: Part ${nn}\ngoal: g\nsuccess-measure: m\ndo-not-touch: []\ndepends-on: []\nspec-impact: none\n---\n` +
          `## ${nn}-1 Task 1\n\n**Files:**\n\n- \`src/login.ts\`\n\n**Test cases:**\n\n- works\n`,
      );
    };
    part("01");
    part("02");
    answered(bdk(["done", "plan", "--json"], root), "output/done.json");
    answered(bdk(["part", "start", "01", "--json"], root), "output/part-start.json");
    answered(bdk(["part", "start", "02", "--json"], root), "output/part-start.json");
    const change = { root, dir: join(root, ".bdk/changes", id), id };
    const first = opened(change, "part", "01");
    const busy = refused(open(change, "part", "02"), 2, "policy/files-busy");
    expect(busy.why).toBe(`src/login.ts of 02 is in the Files: of ticket ${first} (part 01)`);
    closed(change, first, "not-run", "--reason", "r");
    opened(change, "part", "02");
  });

  it("exit 2 policy/budget-exhausted", () => {
    const change = started("policy:\n  budgets:\n    part: 1\n");
    closed(change, opened(change, "part", "01"), "fail");
    const result = refused(open(change, "part", "01"), 2, "policy/budget-exhausted");
    expect(result.instead).toStrictEqual(["bdk attempt open part 01 --escalate"]);
  });

  it("exit 2 policy/oscillation", () => {
    const change = started("policy:\n  budgets:\n    part: 5\n");
    for (const summary of ["expired token accepted", "Expired token accepted!"]) {
      const ticket = opened(change, "part", "01");
      dispatched(change, ticket, "01");
      logUnder(change, ticket, summary, "src/01-1.ts#verifyToken");
      closed(change, ticket, "fail");
    }
    refused(open(change, "part", "01"), 2, "policy/oscillation");
  });

  it("exit 2 policy/invalid-transition: --escalate with budget left", () => {
    refused(open(started(), "part", "01", "--escalate"), 2, "policy/invalid-transition");
  });

  it("exit 0: the escalation ticket, then a failed close parks the Change", () => {
    const change = started("policy:\n  budgets:\n    part: 1\n");
    const first = closed(change, opened(change, "part", "01"), "fail");
    expect(first.next).toMatchObject({ action: "escalate" });
    const report = answered(open(change, "part", "01", "--escalate"), "output/attempt-open.json");
    expect(report).toMatchObject({ escalation: { model: "opus" } });
    refused(open(change, "part", "01", "--escalate"), 2, "policy/ticket-open");
    const last = closed(change, report.ticket as string, "fail");
    expect(last.next).toMatchObject({
      action: "parked",
      resume: `bdk change resume ${change.id} --option <n>`,
    });
    const status = answered(
      bdk(["change", "status", "--json"], change.root),
      "output/change-status.json",
    );
    expect(status.parked).toMatchObject({ entry: (last.next as { entry: string }).entry });
  });

  it("exit 0: the escalation ticket's agents run on its model (T41-D14)", () => {
    const change = started("policy:\n  budgets:\n    part: 1\n");
    closed(change, opened(change, "part", "01"), "fail");
    const ticket = opened(change, "part", "01", "--escalate");
    const build = (role: string) =>
      answered(
        bdk(["dispatch", "build", "01", role, ticket, "--json"], change.root),
        "output/dispatch-build.json",
      );
    const implementer = build("implementer");
    expect(implementer.model).toBe("opus");
    expect(read(change.root, implementer.path as string)).toMatch(/^model: opus$/m);
    expect(build("conformer")).toMatchObject({ model: "opus" });

    const start = (model?: string) =>
      bdk(["hooks", "pre-tool"], change.root, {
        stdin: JSON.stringify({
          session_id: "s",
          cwd: change.root,
          hook_event_name: "PreToolUse",
          tool_name: "Agent",
          tool_input: {
            subagent_type: "bdk:worker",
            prompt: implementer.path,
            run_in_background: true,
            ...(model === undefined ? {} : { model }),
          },
        }),
      });
    const denied = start();
    expect(denied.code).toBe(2);
    expect(denied.stderr).toMatch(/^guard\/escalation-model: .*model: opus/);
    expect(start("sonnet").code).toBe(2);
    expect(start("opus")).toMatchObject({ code: 0, stdout: "" });
  });

  it("exit 0: an answer opens a new round", () => {
    const change = started("policy:\n  budgets:\n    part: 1\n  escalation:\n    enabled: false\n");
    const last = closed(change, opened(change, "part", "01"), "fail");
    expect(last.next).toMatchObject({ action: "parked" });
    answered(
      bdk(["change", "resume", change.id, "--option", "1", "--json"], change.root),
      "output/change-resume.json",
    );
    const report = answered(open(change, "part", "01"), "output/attempt-open.json");
    expect(report).toMatchObject({ attempt: 1, scope: "full" });
  });

  it("exit 2 policy/no-active-change", () => {
    refused(
      open({ root: repository(), dir: "", id: "" }, "verifier", "plan"),
      2,
      "policy/no-active-change",
    );
  });

  it("exit 4 state/ledger-invalid", () => {
    const change = started();
    fileStore().write(join(change.dir, "attempts/part-01-A-broken00.md"), "---\nschema: 1\n---\n");
    refused(open(change, "part", "01"), 4, "state/ledger-invalid");
  });

  it("exit 5 runtime/not-a-repo", () => {
    refused(
      bdk(["attempt", "open", "verifier", "plan", "--json"], outsideRepository()),
      5,
      "runtime/not-a-repo",
    );
  });
});

describe("bdk attempt close", () => {
  it("exit 0: the envelope's entries, the diff, the fingerprints and next", () => {
    const change = started();
    const ticket = opened(change, "part", "01");
    dispatched(change, ticket, "01");
    const entry = logUnder(change, ticket, "expired token accepted", "src/01-1.ts#verifyToken");
    fileStore().write(join(change.root, "src/01-1.ts"), "export {};\n");
    fileStore().write(join(change.root, "src/util.ts"), "export {};\n");
    const report = closed(change, ticket, "fail", "--envelope", envelope(change, ticket, [entry]));
    expect(report).toMatchObject({
      diff: {
        declared: ["src/01-1.ts"],
        touched: ["src/01-1.ts", "src/util.ts"],
        undeclared: ["src/util.ts"],
      },
      notRunCount: 0,
      next: { action: "narrow", scope: "high+" },
    });
    expect(report.fingerprints).toHaveLength(1);
    expect(report.findings).toHaveLength(1);
  });

  it("exit 3 input/not-found", () => {
    refused(close(started(), "A-nothing0", "ok"), 3, "input/not-found");
  });

  it("exit 3 input/missing-argument: not-run without --reason", () => {
    const change = started();
    refused(
      close(change, opened(change, "verifier", "plan"), "not-run"),
      3,
      "input/missing-argument",
    );
  });

  it("exit 2 policy/no-open-ticket", () => {
    const change = started();
    const ticket = opened(change, "verifier", "plan");
    closed(change, ticket, "ok");
    refused(close(change, ticket, "ok"), 2, "policy/no-open-ticket");
  });

  it("exit 2 policy/do-not-touch, the ticket stays open", () => {
    const change = started();
    const ticket = opened(change, "part", "01");
    fileStore().write(join(change.root, "src/billing/invoice.ts"), "export {};\n");
    refused(close(change, ticket, "ok"), 2, "policy/do-not-touch");
    refused(open(change, "part", "01"), 2, "policy/ticket-open");
  });

  it("exit 2 policy/entries-missing: an envelope claiming entries that do not exist [R-16]", () => {
    const change = started();
    const ticket = opened(change, "part", "01");
    const result = refused(
      close(change, ticket, "ok", "--envelope", envelope(change, ticket, ["L-missing0"])),
      2,
      "policy/entries-missing",
    );
    expect(result.why).toContain("L-missing0");
  });

  it("exit 2 policy/entries-missing: the ids log ingest checked are checked again at close", () => {
    const change = started();
    const ticket = opened(change, "part", "01");
    dispatched(change, ticket, "01");
    const ids = [
      logUnder(change, ticket, "expired link accepted", "src/01-1.ts"),
      logUnder(change, ticket, "clock skew on the token", "src/01-1.ts"),
    ];
    const report = `---\nstatus: done\nfiles: [src/01-1.ts]\nentries: [${ids.join(", ")}]\nevidence: []\n---\n# Done\n`;
    const ingested = answered(
      bdk([...ingestArgs(change.root, ticket, report), "--json"], change.root),
      "output/log-ingest.json",
    );
    expect(ingested.entries).toStrictEqual(ids);
    const result = refused(
      close(change, ticket, "ok", "--envelope", envelope(change, ticket, [...ids, "L-missing0"])),
      2,
      "policy/entries-missing",
    );
    expect(result.why).toContain("L-missing0");
    expect(result.why).not.toContain(ids[0] ?? "");
  });

  it("exit 5 runtime/git-missing", () => {
    const change = started();
    const ticket = opened(change, "part", "01");
    refused(
      bdk(["attempt", "close", ticket, "ok", "--json"], change.root, { git: false }),
      5,
      "runtime/git-missing",
    );
  });

  it("exit 0: an implementer closing without rules-read gets one reviewed finding (T23-D28)", () => {
    const change = started();
    const ticket = opened(change, "part", "01");
    dispatched(change, ticket, "01");
    tasksCommitted(change, ticket, "01");
    stepsDone(change, ticket);
    const report = closed(change, ticket, "ok");
    expect(report.rulesFinding).toMatch(/^L-/);
    const shown = answered(
      bdk(["log", "show", report.rulesFinding as string, "--json"], change.root),
      "output/log-show.json",
    ) as { entry: { review: boolean; summary: string; refs: string[] } };
    expect(shown.entry).toMatchObject({
      review: true,
      summary: `implementer closed ${ticket} without reading its rules`,
      refs: ["01", ticket],
    });
  });

  it("exit 0: a conformer reading its rules stamps nothing; the close still finds the implementer's (T23-D42)", () => {
    const change = started();
    const ticket = opened(change, "part", "01");
    dispatched(change, ticket, "01");
    tasksCommitted(change, ticket, "01");
    dispatched(change, ticket, "01", "conformer");
    const rules = answered(
      bdk(["rules", "show", "--ticket", ticket, "--json"], change.root),
      "output/rules-show.json",
    );
    expect(rules).toMatchObject({ role: "conformer" });
    expect(rules).not.toHaveProperty("rulesRead");
    tasksCommitted(change, ticket, "01");
    stepsDone(change, ticket);
    expect(closed(change, ticket, "ok").rulesFinding).toMatch(/^L-/);
  });

  it("exit 0: no rules finding after rules show --ticket", () => {
    const change = started();
    const ticket = opened(change, "part", "01");
    dispatched(change, ticket, "01");
    answered(
      bdk(["rules", "show", "--ticket", ticket, "--json"], change.root),
      "output/rules-show.json",
    );
    tasksCommitted(change, ticket, "01");
    stepsDone(change, ticket);
    expect(closed(change, ticket, "ok").rulesFinding).toBeUndefined();
  });
});

describe("bdk attempt close ok: post-task step evidence (T23-D41)", () => {
  it("exit 0: fresh cited evidence closes; the kernel records conform from the conformer report", () => {
    const change = started();
    const ticket = opened(change, "part", "01");
    dispatched(change, ticket, "01");
    tasksCommitted(change, ticket, "01");
    stepsDone(change, ticket);
    expect(closed(change, ticket, "ok").next).toStrictEqual({ action: "part-done" });
    const conform = answered(
      bdk(["evidence", "check", "01", "--json"], change.root),
      "output/evidence-check.json",
    ) as { evidence: { kind: string; verdict?: string }[] };
    expect(conform.evidence).toContainEqual(
      expect.objectContaining({ kind: "conform", verdict: "pass" }),
    );
  });

  it("exit 2 policy/missing-evidence: a part ticket without the conformer's report stays open", () => {
    const change = started();
    const ticket = opened(change, "part", "01");
    dispatched(change, ticket, "01");
    tasksCommitted(change, ticket, "01");
    const result = refused(close(change, ticket, "ok"), 2, "policy/missing-evidence");
    expect(result.why).toContain("conform");
    expect(result.instead).toContain(`bdk dispatch build 01 conformer ${ticket}`);
    expect(close(change, ticket, "fail").code).toBe(0);
  });

  it("exit 2 policy/stale-evidence: a file of the part changed after its checks were recorded [TSH-10]", () => {
    const change = started();
    const ticket = opened(change, "part", "01");
    dispatched(change, ticket, "01");
    tasksCommitted(change, ticket, "01");
    stepsDone(change, ticket);
    fileStore().write(join(change.root, "src/01-2.ts"), "export const two = 2;\n");
    const result = refused(close(change, ticket, "ok"), 2, "policy/stale-evidence");
    expect(result.why).toMatch(/tests-scoped .*changed: src\/01-2\.ts; lint /);
  });

  it("exit 0: failing tests walk the ladder to a new implementer package", () => {
    const change = started();
    const ticket = opened(change, "part", "01");
    dispatched(change, ticket, "01");
    recorded(change, ticket, "tests-scoped", "fail");
    expect(closed(change, ticket, "fail").next).toMatchObject({ action: "narrow" });
    const next = opened(change, "part", "01");
    expect(read(change.root, dispatched(change, next, "01"))).toContain("## Role: implementer");
  });

  it("exit 0: lint not-run within policy.budgets.not-run", () => {
    const change = started();
    const ticket = opened(change, "part", "01");
    dispatched(change, ticket, "01");
    tasksCommitted(change, ticket, "01");
    conformed(change, ticket);
    recorded(change, ticket, "tests-scoped");
    recorded(change, ticket, "lint", "not-run");
    closed(change, ticket, "ok");
  });
});

describe("bdk attempt list", () => {
  it("exit 0: open first, budgets, and the same answer after .machine/ is rebuilt", () => {
    const change = started();
    closed(change, opened(change, "part", "01"), "fail");
    closed(change, opened(change, "part", "01"), "not-run", "--reason", "no runner");
    const ticket = opened(change, "part", "01");
    const report = answered(
      bdk(["attempt", "list", "--for", "01-1", "--json"], change.root),
      "output/attempt-list.json",
    );
    expect((report.items as { ticket: string }[])[0]?.ticket).toBe(ticket);
    expect(report.budgets).toStrictEqual({
      part: { used: 1, of: 3 },
      "not-run": { used: 1, of: 3 },
    });
    rmSync(join(change.root, ".bdk/.machine"), { recursive: true, force: true });
    answered(
      bdk(["change", "resume", change.id, "--json"], change.root),
      "output/change-resume.json",
    );
    expect(bdk(["attempt", "list", "--for", "01-1", "--json"], change.root).json).toStrictEqual(
      report,
    );
  });

  it("exit 2 policy/no-active-change", () => {
    refused(bdk(["attempt", "list", "--json"], repository()), 2, "policy/no-active-change");
  });

  it("exit 5 runtime/not-a-repo", () => {
    refused(bdk(["attempt", "list", "--json"], outsideRepository()), 5, "runtime/not-a-repo");
  });
});
