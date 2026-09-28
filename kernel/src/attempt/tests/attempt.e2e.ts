// `kernel-cli/attempt` (T22 records) through the committed bundle in real
// repositories: one case per exit code and per declared rule of `attempt
// open`, `close` and `list`, every output validated against its schema.
// `policy/stale-evidence` and `policy/missing-citation` of `attempt close`
// are emitted from T23 and tested there. The dispatch package a ticket needs
// for `log add --ticket` is a hand-written fixture until T23 builds it.
import { rmSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

import {
  answered,
  bdk,
  outsideRepository,
  read,
  refused,
  repository,
} from "../../../tests/support/repo.ts";
import { fileStore } from "../../shared/store/index.ts";
import {
  close,
  closed,
  dispatched,
  envelope,
  logUnder,
  open,
  opened,
  started,
} from "./e2e-support.ts";

describe("bdk attempt open", () => {
  it("exit 0: attempt 1 of the budget, the record on disk", () => {
    const change = started();
    const report = answered(open(change, "task-redispatch", "01-1"), "output/attempt-open.json");
    expect(report).toMatchObject({ attempt: 1, of: 3, scope: "full" });
    expect(
      read(
        change.root,
        `.bdk/changes/${change.id}/attempts/task-redispatch-01-1-${String(report.ticket)}.md`,
      ),
    ).toContain("loop: task-redispatch");
    expect(bdk(["attempt", "open", "task-redispatch", "01-2"], change.root).stdout).toContain(
      "attempt 1 of 3, scope full",
    );
  });

  it("exit 3 input/invalid-argument", () => {
    refused(open(started(), "task-redispatch", "01"), 3, "input/invalid-argument");
  });

  it("exit 3 input/not-found", () => {
    refused(open(started(), "task-redispatch", "01-9"), 3, "input/not-found");
  });

  it("exit 2 policy/not-ready", () => {
    const result = refused(open(started(), "task-redispatch", "02-1"), 2, "policy/not-ready");
    expect(result.instead).toStrictEqual(["bdk part start 02"]);
  });

  it("exit 2 policy/ticket-open, not for a sibling", () => {
    const change = started();
    opened(change, "task-redispatch", "01-1");
    refused(open(change, "task-redispatch", "01-1"), 2, "policy/ticket-open");
    opened(change, "task-redispatch", "01-2");
  });

  it("exit 2 policy/budget-exhausted", () => {
    const change = started("policy:\n  budgets:\n    task-redispatch: 1\n");
    closed(change, opened(change, "task-redispatch", "01-1"), "fail");
    const result = refused(open(change, "task-redispatch", "01-1"), 2, "policy/budget-exhausted");
    expect(result.instead).toStrictEqual(["bdk attempt open task-redispatch 01-1 --escalate"]);
  });

  it("exit 2 policy/oscillation", () => {
    const change = started("policy:\n  budgets:\n    task-redispatch: 5\n");
    for (const summary of ["expired token accepted", "Expired token accepted!"]) {
      const ticket = opened(change, "task-redispatch", "01-1");
      dispatched(change, ticket, "01-1");
      logUnder(change, ticket, summary, "src/01-1.ts#verifyToken");
      closed(change, ticket, "fail");
    }
    refused(open(change, "task-redispatch", "01-1"), 2, "policy/oscillation");
  });

  it("exit 2 policy/invalid-transition: --escalate with budget left", () => {
    refused(
      open(started(), "task-redispatch", "01-1", "--escalate"),
      2,
      "policy/invalid-transition",
    );
  });

  it("exit 0: the escalation ticket, then a failed close parks the Change", () => {
    const change = started("policy:\n  budgets:\n    task-redispatch: 1\n");
    const first = closed(change, opened(change, "task-redispatch", "01-1"), "fail");
    expect(first.next).toMatchObject({ action: "escalate" });
    const report = answered(
      open(change, "task-redispatch", "01-1", "--escalate"),
      "output/attempt-open.json",
    );
    expect(report).toMatchObject({ escalation: { model: "opus" } });
    refused(open(change, "task-redispatch", "01-1", "--escalate"), 2, "policy/ticket-open");
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

  it("exit 0: an answer opens a new round", () => {
    const change = started(
      "policy:\n  budgets:\n    task-redispatch: 1\n  escalation:\n    enabled: false\n",
    );
    const last = closed(change, opened(change, "task-redispatch", "01-1"), "fail");
    expect(last.next).toMatchObject({ action: "parked" });
    answered(
      bdk(["change", "resume", change.id, "--option", "1", "--json"], change.root),
      "output/change-resume.json",
    );
    const report = answered(open(change, "task-redispatch", "01-1"), "output/attempt-open.json");
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
    fileStore().write(
      join(change.dir, "attempts/task-redispatch-01-1-A-broken00.md"),
      "---\nschema: 1\n---\n",
    );
    refused(open(change, "task-redispatch", "01-1"), 4, "state/ledger-invalid");
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
    const ticket = opened(change, "task-redispatch", "01-1");
    dispatched(change, ticket, "01-1");
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
    const ticket = opened(change, "task-redispatch", "01-1");
    fileStore().write(join(change.root, "src/billing/invoice.ts"), "export {};\n");
    refused(close(change, ticket, "ok"), 2, "policy/do-not-touch");
    refused(open(change, "task-redispatch", "01-1"), 2, "policy/ticket-open");
  });

  it("exit 2 policy/entries-missing", () => {
    const change = started();
    const ticket = opened(change, "task-redispatch", "01-1");
    const result = refused(
      close(change, ticket, "ok", "--envelope", envelope(change, ticket, ["L-missing0"])),
      2,
      "policy/entries-missing",
    );
    expect(result.why).toContain("L-missing0");
  });

  it("exit 2 policy/entries-missing: the ids log ingest checked are checked again at close", () => {
    const change = started();
    const ticket = opened(change, "task-redispatch", "01-1");
    dispatched(change, ticket, "01-1");
    const ids = [
      logUnder(change, ticket, "expired link accepted", "src/01-1.ts"),
      logUnder(change, ticket, "clock skew on the token", "src/01-1.ts"),
    ];
    const report = `---\nstatus: done\nfiles: [src/01-1.ts]\nentries: [${ids.join(", ")}]\nevidence: []\n---\n# Done\n`;
    const ingested = answered(
      bdk(["log", "ingest", "--ticket", ticket, "--json"], change.root, { stdin: report }),
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
    const ticket = opened(change, "task-redispatch", "01-1");
    refused(
      bdk(["attempt", "close", ticket, "ok", "--json"], change.root, { git: false }),
      5,
      "runtime/git-missing",
    );
  });

  it("exit 0: an implementer closing without rules-read gets one reviewed finding (T23-D28)", () => {
    const change = started();
    const ticket = opened(change, "task-redispatch", "01-1");
    dispatched(change, ticket, "01-1");
    const report = closed(change, ticket, "ok");
    expect(report.rulesFinding).toMatch(/^L-/);
    const shown = answered(
      bdk(["log", "show", report.rulesFinding as string, "--json"], change.root),
      "output/log-show.json",
    ) as { entry: { review: boolean; summary: string; refs: string[] } };
    expect(shown.entry).toMatchObject({
      review: true,
      summary: `implementer closed ${ticket} without reading its rules`,
      refs: ["01-1", ticket],
    });
  });

  it("exit 0: no rules finding after rules show --ticket", () => {
    const change = started();
    const ticket = opened(change, "task-redispatch", "01-1");
    dispatched(change, ticket, "01-1");
    answered(
      bdk(["rules", "show", "--ticket", ticket, "--json"], change.root),
      "output/rules-show.json",
    );
    expect(closed(change, ticket, "ok").rulesFinding).toBeUndefined();
  });
});

describe("bdk attempt list", () => {
  it("exit 0: open first, budgets, and the same answer after .machine/ is rebuilt", () => {
    const change = started();
    closed(change, opened(change, "task-redispatch", "01-1"), "fail");
    closed(change, opened(change, "task-redispatch", "01-1"), "not-run", "--reason", "no runner");
    const ticket = opened(change, "task-redispatch", "01-1");
    const report = answered(
      bdk(["attempt", "list", "--for", "01-1", "--json"], change.root),
      "output/attempt-list.json",
    );
    expect((report.items as { ticket: string }[])[0]?.ticket).toBe(ticket);
    expect(report.budgets).toStrictEqual({
      "task-redispatch": { used: 1, of: 3 },
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
