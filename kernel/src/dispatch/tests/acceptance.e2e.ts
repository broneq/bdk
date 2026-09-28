// The T23 part B acceptance (`v3-t23b-dispatch-envelope` task 7.1) through the
// committed bundle in a real repository: one ticket per role walks the whole
// path from `attempt open` to `attempt close --envelope`, every output
// validated against its schema.
import { describe, expect, it } from "vitest";

import { answered, bdk, read } from "../../../tests/support/repo.ts";
import { closed, opened, started, stepsDone } from "../../attempt/tests/e2e-support.ts";
import type { Started } from "../../attempt/tests/e2e-support.ts";

function run(change: Started, schema: string, argv: string[], stdin?: string) {
  return answered(
    bdk([...argv, "--json"], change.root, stdin === undefined ? {} : { stdin }),
    schema,
  );
}

/** `dispatch build`, `dispatch show` and `rules show --ticket`; answers the package path. */
function dispatchedAndRead(change: Started, target: string, role: string, ticket: string): string {
  const built = run(change, "output/dispatch-build.json", [
    "dispatch",
    "build",
    target,
    role,
    ticket,
  ]);
  const path = built.path as string;
  const shown = run(change, "output/dispatch-show.json", ["dispatch", "show", ticket]);
  expect(shown).toMatchObject({ path, content: read(change.root, path) });
  run(change, "output/rules-show.json", ["rules", "show", "--ticket", ticket]);
  return path;
}

function ingested(change: Started, ticket: string, entries: string[]) {
  const report = `---\nstatus: done\nfiles: []\nentries: [${entries.join(", ")}]\nevidence: []\n---\n# Report\n`;
  return run(change, "output/log-ingest.json", ["log", "ingest", "--ticket", ticket], report);
}

describe("T23 part B acceptance", () => {
  it("an implementer and a verifier ticket each go from open to a closed ticket with a stored report", () => {
    const change = started();

    const task = opened(change, "task-redispatch", "01-1");
    dispatchedAndRead(change, "01-1", "implementer", task);
    const finding = run(change, "output/log-add.json", [
      "log",
      "add",
      "finding",
      "the clock source is implicit",
      "--ref",
      "01-1",
      "--ticket",
      task,
    ]);
    const findingId = (finding.entry as { id: string }).id;
    const report = ingested(change, task, [findingId]);
    expect(report).toMatchObject({ ticket: task, role: "implementer", replaced: false });
    stepsDone(change, task);
    const closedTask = closed(change, task, "ok", "--envelope", report.path as string);
    expect(closedTask).not.toHaveProperty("rulesFinding");

    const part = opened(change, "verify-fix", "01");
    const pkg = dispatchedAndRead(change, "01", "verifier", part);
    expect(read(change.root, pkg)).toContain("## Blocking categories (P8)");
    const blocker = run(change, "output/log-add.json", [
      "log",
      "add",
      "blocker",
      "the helper name reads oddly",
      "--ref",
      "01",
      "--category",
      "style",
      "--ticket",
      part,
    ]);
    expect(blocker).toMatchObject({
      entry: { type: "observation", review: true },
      downgraded: { type: "blocker", category: "style" },
    });
    const verdict = ingested(change, part, [(blocker.entry as { id: string }).id]);
    expect(verdict).toMatchObject({ ticket: part, role: "verifier", status: "done" });
    closed(change, part, "ok", "--envelope", verdict.path as string);
  });
});
