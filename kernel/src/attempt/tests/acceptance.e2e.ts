// The T22 acceptance signal (docs/V3-IMPLEMENTATION-PLAN.md) through the
// committed bundle in real repositories: one case per item, from the ladder
// ending in a parked Change to a fresh clone resuming with the same budgets.
import { mkdtempSync, realpathSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";

import { answered, bdk, git, refused } from "../../../tests/support/repo.ts";
import { fileStore } from "../../shared/store/index.ts";
import {
  close,
  closed,
  dispatched,
  logUnder,
  open,
  opened,
  started,
  tasks,
} from "./e2e-support.ts";

const clones: string[] = [];
afterEach(() => {
  for (const clone of clones.splice(0)) rmSync(clone, { recursive: true, force: true });
});

function questions(root: string) {
  const listed = answered(
    bdk(["log", "list", "--type", "question", "--json"], root),
    "output/log-list.json",
  );
  return listed.items as { id: string; summary: string }[];
}

function budgets(root: string, target: string) {
  return (
    answered(
      bdk(["attempt", "list", "--for", target, "--json"], root),
      "output/attempt-list.json",
    ) as { budgets: Record<string, { used: number; of: number }> }
  ).budgets;
}

describe("T22 acceptance", () => {
  it("an exhausted budget ends in a parked Change with a question and its options", () => {
    const change = started(
      "policy:\n  budgets:\n    task-redispatch: 1\n  escalation:\n    enabled: false\n",
    );
    const last = closed(change, opened(change, "task-redispatch", "01-1"), "fail");
    expect(last.next).toMatchObject({ action: "parked" });
    const entry = (last.next as { entry: string }).entry;
    const shown = answered(
      bdk(["log", "show", entry, "--json"], change.root),
      "output/log-show.json",
    ).entry as { type: string; park: boolean; options: string[] };
    expect(shown).toMatchObject({ type: "question", park: true });
    expect(shown.options.length).toBeGreaterThanOrEqual(2);
    expect(
      answered(bdk(["change", "status", "--json"], change.root), "output/change-status.json"),
    ).toMatchObject({ parked: { entry, options: shown.options } });
  });

  it("an oscillating finding shortens the ladder while budget remains", () => {
    const change = started("policy:\n  budgets:\n    task-redispatch: 5\n");
    let last: Record<string, unknown> = {};
    for (const summary of ["expired token accepted", "Expired token accepted!"]) {
      const ticket = opened(change, "task-redispatch", "01-1");
      dispatched(change, ticket, "01-1");
      logUnder(change, ticket, summary, "src/01-1.ts#verifyToken");
      last = closed(change, ticket, "fail");
    }
    expect(last.next).toMatchObject({ action: "escalate" });
    expect(budgets(change.root, "01-1")["task-redispatch"]).toMatchObject({ used: 2, of: 5 });
    refused(open(change, "task-redispatch", "01-1"), 2, "policy/oscillation");
  });

  it("three not-run closes leave the loop budget unused and write the question", () => {
    const change = started();
    let last: Record<string, unknown> = {};
    for (let n = 0; n < 3; n++) {
      last = closed(
        change,
        opened(change, "task-redispatch", "01-1"),
        "not-run",
        "--reason",
        "no test runner",
      );
    }
    expect(last.next).toMatchObject({ action: "parked" });
    expect(budgets(change.root, "01-1")).toMatchObject({
      "task-redispatch": { used: 0 },
      "not-run": { used: 3, of: 3 },
    });
    expect(questions(change.root).map((entry) => entry.id)).toContain(
      (last.next as { entry: string }).entry,
    );
  });

  it("a diff touching do-not-touch is rejected at attempt close", () => {
    const change = started();
    const ticket = opened(change, "task-redispatch", "01-1");
    fileStore().write(join(change.root, "src/billing/invoice.ts"), "export {};\n");
    const result = refused(close(change, ticket, "ok"), 2, "policy/do-not-touch");
    expect(result.why).toContain("src/billing/invoice.ts");
  });

  it("a killed session on a fresh clone: resume and rebuild give the same progress and budgets", () => {
    const change = started();
    closed(change, opened(change, "task-redispatch", "01-1"), "ok");
    fileStore().write(join(change.root, "src/01-1.ts"), "export {};\n");
    answered(bdk(["commit", "01-1", "--json"], change.root), "output/commit.json");
    closed(change, opened(change, "task-redispatch", "01-2"), "fail");
    const open = opened(change, "task-redispatch", "01-2");
    git(change.root, "add", "--all");
    git(change.root, "commit", "--quiet", "-m", "wip before the session died");
    const parts = bdk(["part", "list", "--json"], change.root).json;
    const before = budgets(change.root, "01-2");

    const clone = realpathSync(mkdtempSync(join(tmpdir(), "bdk-clone-")));
    clones.push(clone);
    git(clone, "clone", "--quiet", change.root, ".");
    refused(bdk(["part", "list", "--json"], clone), 2, "policy/no-active-change");
    answered(bdk(["change", "resume", change.id, "--json"], clone), "output/change-resume.json");
    answered(bdk(["rebuild", "--json"], clone), "output/rebuild.json");
    expect(bdk(["part", "list", "--json"], clone).json).toStrictEqual(parts);
    expect(budgets(clone, "01-2")).toStrictEqual(before);
    const listed = answered(
      bdk(["attempt", "list", "--for", "01-2", "--json"], clone),
      "output/attempt-list.json",
    ) as { items: { ticket: string; outcome?: string }[] };
    expect(listed.items.find((item) => item.outcome === undefined)?.ticket).toBe(open);
  });

  it("a checkpoint leaves a user-staged file out of its commit", () => {
    const change = started();
    fileStore().write(join(change.root, "notes.md"), "mine\n");
    git(change.root, "add", "notes.md");
    const report = answered(
      bdk(["change", "checkpoint", "--json"], change.root),
      "output/change-checkpoint.json",
    );
    expect(report).toMatchObject({ done: true });
    expect(git(change.root, "show", "--name-only", "--format=", "HEAD")).not.toContain("notes.md");
    expect(git(change.root, "diff", "--cached", "--name-only").trim()).toBe("notes.md");
  });

  it("a 9 KB part is refused by part start", () => {
    const change = started();
    fileStore().write(
      join(change.dir, "plan/parts/03-part.md"),
      `---\nschema: 1\nid: "03"\ntitle: Part 03\ngoal: g\nsuccess-measure: m\ndo-not-touch: []\ndepends-on: []\nspec-impact: none\n---\n${tasks("03", 1)}\n${"x".repeat(9216)}\n`,
    );
    refused(bdk(["part", "start", "03", "--json"], change.root), 2, "policy/part-too-large");
  });

  // T23-D26 replaced the `bdk-entries` block by the report envelope.
  it("a report envelope with a wrong status is refused with its line number", () => {
    const change = started();
    const ticket = opened(change, "task-redispatch", "01-1");
    dispatched(change, ticket, "01-1");
    const report =
      "---\nfiles: [src/01-1.ts]\nstatus: finished\nentries: []\nevidence: []\n---\n# Done\n";
    const result = refused(
      bdk(["log", "ingest", "--ticket", ticket, "--json"], change.root, { stdin: report }),
      3,
      "input/invalid-envelope",
    );
    expect(result.why).toMatch(/^line 3: status is invalid/);
  });
});
