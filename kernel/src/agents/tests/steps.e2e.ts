// Two steps of one part ticket through the built bundle (#133, #166): the
// conformer's package is built before the implementer stored its report. The
// report lands at the package the ingesting agent was started with, not at the
// ticket's last built one, and `agents wait` attributes each report to its own
// agent.
import { describe, expect, it } from "vitest";

import { answered, bdk, ingestArgs } from "../../../tests/support/repo.ts";
import { dispatched, opened, started as change } from "../../attempt/tests/e2e-support.ts";
import type { Started } from "../../attempt/tests/e2e-support.ts";
import { heartbeat, promptFor, spawned, started } from "./e2e-support.ts";

/** A non-BDK agent that starts the part's agents itself. */
const PARENT = "a5e4d3c2b1a0f9e8d";
const PARENT_TYPE = "general-purpose";
const IMPLEMENTER = "a3b5d7f9b1d3f5b7d";
const CONFORMER = "a1c3e5a7c9e1a3c5e";
const CONFORMER_AGAIN = "a2d4f6a8d0f2a4d6f";

const REPORT = "---\nstatus: done\nfiles: []\nentries: []\nevidence: []\n---\n# Done\n";

interface Steps {
  readonly change: Started;
  readonly ticket: string;
  readonly packages: { readonly implementer: string; readonly conformer: string };
}

/** Part 01 with both packages built, the conformer's last, so it is the active one. */
function steps(): Steps {
  const started_ = change();
  const ticket = opened(started_, "part", "01");
  const packages = {
    implementer: dispatched(started_, ticket, "01"),
    conformer: dispatched(started_, ticket, "01", "conformer"),
  };
  spawned(started_.root, { child: PARENT, type: PARENT_TYPE, prompt: "run part 01" });
  started(started_.root, PARENT, PARENT_TYPE);
  return { change: started_, ticket, packages };
}

function launch(root: string, id: string, type: string, path: string): void {
  spawned(root, {
    parent: { id: PARENT, type: PARENT_TYPE },
    child: id,
    type,
    prompt: promptFor(path),
  });
  started(root, id, type);
}

function ingest(root: string, ticket: string) {
  return answered(
    bdk([...ingestArgs(root, ticket, REPORT), "--json"], root),
    "output/log-ingest.json",
  ) as { role: string; path: string };
}

function wait(root: string) {
  return answered(
    bdk(["agents", "wait", PARENT, "--timeout", "1", "--json"], root),
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

    launch(root, IMPLEMENTER, "bdk:worker", packages.implementer);
    const implemented = ingest(root, ticket);
    expect(implemented).toMatchObject({
      role: "implementer",
      path: reportOf(packages.implementer),
    });
    expect(wait(root)).toEqual([{ kind: "report", agent: IMPLEMENTER, ticket, status: "done" }]);

    launch(root, CONFORMER, "bdk:worker", packages.conformer);
    expect(wait(root)).toEqual([{ kind: "timeout" }]);
    expect(ingest(root, ticket)).toMatchObject({
      role: "conformer",
      path: reportOf(packages.conformer),
    });
    expect(wait(root)).toEqual([{ kind: "report", agent: CONFORMER, ticket, status: "done" }]);
  });

  it("finds the ingesting agent by its open tool call while both steps run", () => {
    const { change: started_, ticket, packages } = steps();
    const root = started_.root;
    launch(root, IMPLEMENTER, "bdk:worker", packages.implementer);
    launch(root, CONFORMER, "bdk:worker", packages.conformer);

    heartbeat(root, IMPLEMENTER, true);
    heartbeat(root, CONFORMER, false);
    expect(ingest(root, ticket)).toMatchObject({
      role: "implementer",
      path: reportOf(packages.implementer),
    });
    heartbeat(root, IMPLEMENTER, false);
    heartbeat(root, CONFORMER, true);
    expect(ingest(root, ticket)).toMatchObject({
      role: "conformer",
      path: reportOf(packages.conformer),
    });
  });

  it("never attributes to an agent a report stored before it started", () => {
    const { change: started_, ticket, packages } = steps();
    const root = started_.root;
    launch(root, CONFORMER, "bdk:worker", packages.conformer);
    ingest(root, ticket);
    expect(wait(root)).toEqual([{ kind: "report", agent: CONFORMER, ticket, status: "done" }]);

    // The same step again: its package path, and so its report path, is the earlier one.
    const again = dispatched(started_, ticket, "01", "conformer");
    expect(again).toBe(packages.conformer);
    launch(root, CONFORMER_AGAIN, "bdk:worker", again);
    expect(wait(root)).toEqual([{ kind: "timeout" }]);
    ingest(root, ticket);
    expect(wait(root)).toEqual([
      { kind: "report", agent: CONFORMER_AGAIN, ticket, status: "done" },
    ]);
  });
});
