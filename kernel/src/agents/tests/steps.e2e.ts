// Two steps of one ticket through the built bundle (#133): a lead builds the
// runner's package before the simplifier stored its report. The report lands
// at the package the ingesting agent was started with, not at the ticket's
// last built one, and `agents wait` attributes each report to its own agent.
import { describe, expect, it } from "vitest";

import { answered, bdk } from "../../../tests/support/repo.ts";
import { dispatched, opened, started as change } from "../../attempt/tests/e2e-support.ts";
import type { Started } from "../../attempt/tests/e2e-support.ts";
import { heartbeat, promptFor, spawned, started } from "./e2e-support.ts";

const LEAD = "a5e4d3c2b1a0f9e8d";
const SIMPLIFIER = "a1c3e5a7c9e1a3c5e";
const SIMPLIFIER_AGAIN = "a2d4f6a8d0f2a4d6f";
const RUNNER = "a3b5d7f9b1d3f5b7d";

const REPORT = "---\nstatus: done\nfiles: []\nentries: []\nevidence: []\n---\n# Done\n";

interface Steps {
  readonly change: Started;
  readonly ticket: string;
  readonly packages: { readonly simplifier: string; readonly runner: string };
}

/** Task 01-1 with both step packages built, the runner's last, so it is the active one. */
function steps(): Steps {
  const started_ = change();
  const ticket = opened(started_, "task-redispatch", "01-1");
  const packages = {
    simplifier: dispatched(started_, ticket, "01-1", "simplifier"),
    runner: dispatched(started_, ticket, "01-1", "runner"),
  };
  spawned(started_.root, { child: LEAD, type: "bdk:lead", prompt: "lead part 01" });
  started(started_.root, LEAD, "bdk:lead");
  return { change: started_, ticket, packages };
}

function launch(root: string, id: string, type: string, path: string): void {
  spawned(root, {
    parent: { id: LEAD, type: "bdk:lead" },
    child: id,
    type,
    prompt: promptFor(path),
  });
  started(root, id, type);
}

function ingest(root: string, ticket: string) {
  return answered(
    bdk(["log", "ingest", "--ticket", ticket, "--json"], root, { stdin: REPORT }),
    "output/log-ingest.json",
  ) as { role: string; path: string };
}

function wait(root: string) {
  return answered(
    bdk(["agents", "wait", LEAD, "--timeout", "1", "--json"], root),
    "output/agents-wait.json",
  ).events;
}

/** The report path a package names: `dispatch/` swapped for `reports/`. */
function reportOf(packagePath: string): string {
  return packagePath.replace("/dispatch/", "/reports/");
}

describe("steps of one ticket", { timeout: 60_000 }, () => {
  it("stores each step's report at its own package and attributes it to its own agent", () => {
    const { change: started_, ticket, packages } = steps();
    const root = started_.root;

    launch(root, SIMPLIFIER, "bdk:simplifier", packages.simplifier);
    const simplified = ingest(root, ticket);
    expect(simplified).toMatchObject({ role: "simplifier", path: reportOf(packages.simplifier) });
    expect(wait(root)).toEqual([{ kind: "report", agent: SIMPLIFIER, ticket, status: "done" }]);

    launch(root, RUNNER, "bdk:runner", packages.runner);
    expect(wait(root)).toEqual([{ kind: "timeout" }]);
    expect(ingest(root, ticket)).toMatchObject({ role: "runner", path: reportOf(packages.runner) });
    expect(wait(root)).toEqual([{ kind: "report", agent: RUNNER, ticket, status: "done" }]);
  });

  it("finds the ingesting agent by its open tool call while both steps run", () => {
    const { change: started_, ticket, packages } = steps();
    const root = started_.root;
    launch(root, SIMPLIFIER, "bdk:simplifier", packages.simplifier);
    launch(root, RUNNER, "bdk:runner", packages.runner);

    heartbeat(root, SIMPLIFIER, true);
    heartbeat(root, RUNNER, false);
    expect(ingest(root, ticket)).toMatchObject({
      role: "simplifier",
      path: reportOf(packages.simplifier),
    });
    heartbeat(root, SIMPLIFIER, false);
    heartbeat(root, RUNNER, true);
    expect(ingest(root, ticket)).toMatchObject({ role: "runner", path: reportOf(packages.runner) });
  });

  it("never attributes to an agent a report stored before it started", () => {
    const { change: started_, ticket, packages } = steps();
    const root = started_.root;
    launch(root, SIMPLIFIER, "bdk:simplifier", packages.simplifier);
    ingest(root, ticket);
    expect(wait(root)).toEqual([{ kind: "report", agent: SIMPLIFIER, ticket, status: "done" }]);

    // The same step again: its package path, and so its report path, is the earlier one.
    const again = dispatched(started_, ticket, "01-1", "simplifier");
    expect(again).toBe(packages.simplifier);
    launch(root, SIMPLIFIER_AGAIN, "bdk:simplifier", again);
    expect(wait(root)).toEqual([{ kind: "timeout" }]);
    ingest(root, ticket);
    expect(wait(root)).toEqual([
      { kind: "report", agent: SIMPLIFIER_AGAIN, ticket, status: "done" },
    ]);
  });
});
