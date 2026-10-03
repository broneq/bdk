// One review round end to end through the built bundle (T42; tasks
// 10.1): `review plan` gives the range and groups, one package per group plus
// the integration reviewer and the gate runner, grouped findings and reports,
// the full gate with coverage, triage of every entry and the merged report.
// A triaged blocker fails the verdict; the fix is reviewed alone in a second
// round, whose merged report passes `review`.
import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { describe, expect, it } from "vitest";

import { answered, bdk, git, refused } from "../../../tests/support/repo.ts";
import {
  closed,
  executed,
  opened,
  recorded,
  started,
  stepsDone,
} from "../../attempt/tests/e2e-support.ts";
import type { Started } from "../../attempt/tests/e2e-support.ts";

const TOOLS =
  "tools:\n  test:\n    - id: unit\n      tier: fast\n      command: vitest run\n" +
  "      coverage:\n        command: vitest run --coverage\n        report: coverage/lcov.info\n        format: lcov\n        min: 50\n";

interface Plan {
  anchor: { kind: string; sha: string };
  range: string;
  groups: { id: string; kind: string; files: string[] }[];
}

function run(change: Started, argv: string[], stdin?: string) {
  return bdk([...argv, "--json"], change.root, stdin === undefined ? {} : { stdin });
}

function put(change: Started, path: string, content: string): void {
  mkdirSync(dirname(join(change.root, path)), { recursive: true });
  writeFileSync(join(change.root, path), content);
}

const report = (entries: string[]) =>
  `---\nstatus: done\nfiles: []\nentries: [${entries.join(", ")}]\nevidence: []\n---\n# Review\n`;

function finding(change: Started, ref: string, ticket: string, summary: string): string {
  return (
    answered(
      run(change, ["log", "add", "finding", summary, "--ref", ref, "--ticket", ticket]),
      "output/log-add.json",
    ).entry as { id: string }
  ).id;
}

/** The gate runner's package and records: `tests-full`, `lint-full` and a passing coverage. */
function gate(change: Started, round: string): void {
  answered(
    run(change, ["dispatch", "build", change.id, "runner", round, "--group", "gate"]),
    "output/dispatch-build.json",
  );
  recorded(change, `${round}@gate`, "tests-full");
  recorded(change, `${round}@gate`, "lint-full");
  put(
    change,
    "coverage/lcov.info",
    ["01-1", "01-2", "02-1"].map((task) => `SF:src/${task}.ts\nDA:1,1\nend_of_record\n`).join(""),
  );
  expect(
    answered(
      run(change, [
        "evidence",
        "coverage",
        "unit",
        "coverage/lcov.info",
        "--ticket",
        `${round}@gate`,
      ]),
      "output/evidence-coverage.json",
    ),
  ).toMatchObject({ verdict: "pass" });
}

/** The merged review of the round under `merge`, naming every entry of the round. */
function mergedReview(change: Started, round: string, entries: string[], summary: string): void {
  answered(
    run(change, ["log", "ingest", "--ticket", `${round}@merge`], report(entries)),
    "output/log-ingest.json",
  );
  answered(
    run(change, ["log", "add", "report", summary, "--ticket", `${round}@merge`]),
    "output/log-add.json",
  );
}

describe("a review round end to end", () => {
  it("fails on a triaged blocker, then passes after a second round reviewing only the fix", () => {
    const change = executed(started(TOOLS));
    // A file no task names, for the `unplanned` group.
    put(change, "scripts/release.sh", "echo release\n");
    git(change.root, "add", "scripts/release.sh");
    git(change.root, "commit", "--quiet", "-m", "release script");

    const first = opened(change, "review-fix", change.id);
    const plan = answered(
      run(change, ["review", "plan"]),
      "output/review-plan.json",
    ) as unknown as Plan;
    expect(plan.anchor.kind).toBe("full");
    expect(plan.groups.map((group) => group.id)).toStrictEqual([
      "p01",
      "p02",
      "unplanned",
      "integration",
    ]);

    const entries: string[] = [];
    for (const group of plan.groups.filter((item) => item.kind !== "integration")) {
      answered(
        run(change, [
          "dispatch",
          "build",
          change.id,
          "reviewer",
          first,
          "--group",
          group.id,
          "--range",
          plan.range,
          ...group.files.flatMap((file) => ["--file", file]),
        ]),
        "output/dispatch-build.json",
      );
      const id = finding(
        change,
        group.files[0] ?? "",
        `${first}@${group.id}`,
        `issue in ${group.id}`,
      );
      entries.push(id);
      answered(
        run(change, ["log", "ingest", "--ticket", `${first}@${group.id}`], report([id])),
        "output/log-ingest.json",
      );
    }
    answered(
      run(change, [
        "dispatch",
        "build",
        change.id,
        "integration-reviewer",
        first,
        "--group",
        "integration",
        "--range",
        plan.range,
      ]),
      "output/dispatch-build.json",
    );
    answered(
      run(change, ["log", "ingest", "--ticket", `${first}@integration`], report([])),
      "output/log-ingest.json",
    );
    gate(change, first);

    const [blocker = "", minor = "", noise = ""] = entries;
    answered(run(change, ["log", "triage", blocker, "blocker"]), "output/log-triage.json");
    answered(run(change, ["log", "triage", minor, "nice-to-have"]), "output/log-triage.json");
    answered(
      run(change, [
        "log",
        "triage",
        noise,
        "not-a-problem",
        "--reason",
        "release scripts are manual",
      ]),
      "output/log-triage.json",
    );
    mergedReview(change, first, entries, "1 blocker, 1 nice-to-have");
    expect(refused(run(change, ["done", "review"]), 2, "policy/validation-failed").why).toContain(
      `blockers: live blocker ${blocker}`,
    );
    closed(change, first, "fail");

    // The fix, committed as the implementer of the next round would.
    const second = opened(change, "review-fix", change.id);
    put(change, "src/01-1.ts", 'export const value = "validated";\n');
    git(change.root, "add", "src/01-1.ts");
    git(change.root, "commit", "--quiet", "-m", "fix the blocker");
    answered(
      run(change, ["log", "resolve", blocker, "resolved", "--reason", "validated"]),
      "output/log-resolve.json",
    );

    const delta = answered(
      run(change, ["review", "plan"]),
      "output/review-plan.json",
    ) as unknown as Plan;
    expect(delta.anchor.kind).toBe("delta");
    expect(delta.groups.map((group) => [group.id, group.files])).toStrictEqual([
      ["p01", ["src/01-1.ts"]],
      ["integration", ["src/01-1.ts"]],
    ]);
    // The fix's post-task steps under the round's ticket, then the full gate again.
    stepsDone(change, second, change.id);
    gate(change, second);
    mergedReview(change, second, [], "fix verified");
    // `attempt close ok` records the fix's simplify evidence (`kernel-pipeline`, Artifact kinds).
    closed(change, second, "ok");
    expect(answered(run(change, ["done", "review"]), "output/done.json")).toMatchObject({
      artifact: "review",
      state: "done",
    });
  });
});
