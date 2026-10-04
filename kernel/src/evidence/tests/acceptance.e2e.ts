// The T23 part C acceptance signal (docs/V3-IMPLEMENTATION-PLAN.md) through
// the built bundle in real repositories: one task ticket through the
// implementer, simplifier and runner packages to a close that the evidence
// decides, the step nodes it leaves done, `plan-verify` going stale, and a
// project evidence kind. Every output validates against its schema.
import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { describe, expect, it } from "vitest";

import { answered, bdk, read, refused } from "../../../tests/support/repo.ts";
import {
  close,
  closed,
  dispatched,
  open,
  recorded,
  started,
} from "../../attempt/tests/e2e-support.ts";
import type { Started } from "../../attempt/tests/e2e-support.ts";
import {
  done,
  pastDesignGate,
  taskBody,
  verdict,
  writePlanPart,
} from "../../graph/tests/e2e-support.ts";

const TOOLS =
  "tools:\n  test:\n    - id: unit\n      tier: fast\n      command: vitest run\n      related: vitest related {files}\n  lint:\n    - id: eslint\n      tier: lint\n      command: eslint .\n      scoped: eslint {files}\n";

function put(change: Started, path: string, content: string): void {
  mkdirSync(dirname(join(change.root, path)), { recursive: true });
  writeFileSync(join(change.root, path), content);
}

function ingest(change: Started, ticket: string, files: string[]): void {
  answered(
    bdk(["log", "ingest", "--ticket", ticket, "--json"], change.root, {
      stdin: `---\nstatus: done\nfiles: [${files.join(", ")}]\nentries: []\nevidence: []\n---\n# Report\n`,
    }),
    "output/log-ingest.json",
  );
}

function state(change: Started, id: string): string | undefined {
  const status = answered(
    bdk(["change", "status", "--json"], change.root),
    "output/change-status.json",
  );
  return (status.nodes as { id: string; state: string }[]).find((node) => node.id === id)?.state;
}

function check(change: Started, target: string) {
  return answered(
    bdk(["evidence", "check", target, "--json"], change.root),
    "output/evidence-check.json",
  ) as {
    fresh: boolean;
    evidence: { evidence: string; kind: string; fresh: boolean; changedSince?: string[] }[];
  };
}

describe("T23 part C acceptance", () => {
  it("one task ticket: implementer, simplifier and runner, closed on fresh cited evidence", () => {
    const change = started(TOOLS);
    const opening = answered(open(change, "task-redispatch", "01-1"), "output/attempt-open.json");
    const ticket = String(opening.ticket);
    expect(opening.steps).toStrictEqual([
      { kind: "simplify", role: "simplifier" },
      { kind: "tests-scoped", role: "runner" },
      { kind: "lint", role: "runner" },
    ]);

    dispatched(change, ticket, "01-1");
    put(change, "src/01-1.ts", "export const one = 1;\n");
    ingest(change, ticket, ["src/01-1.ts"]);
    dispatched(change, ticket, "01-1", "simplifier");
    ingest(change, ticket, []);
    const runner = read(change.root, dispatched(change, ticket, "01-1", "runner"));
    expect(runner).toContain("- `vitest related src/01-1.ts`");
    expect(runner).toContain("- `eslint src/01-1.ts`");

    put(change, ".bdk/.machine/uncited.json", '{"failed":0}\n');
    refused(
      bdk(
        [
          "evidence",
          "record",
          "tests-scoped",
          ".bdk/.machine/uncited.json",
          "--ticket",
          ticket,
          "--verdict",
          "pass",
          "--json",
        ],
        change.root,
      ),
      2,
      "policy/missing-citation",
    );
    recorded(change, ticket, "tests-scoped");
    recorded(change, ticket, "lint");

    put(change, "src/01-1.ts", "export const one = 1;\nexport const two = 2;\n");
    refused(close(change, ticket, "ok"), 2, "policy/stale-evidence");
    expect(check(change, "01-1").evidence).toContainEqual(
      expect.objectContaining({
        kind: "tests-scoped",
        fresh: false,
        changedSince: ["src/01-1.ts"],
      }),
    );
    recorded(change, ticket, "tests-scoped");
    recorded(change, ticket, "lint");

    put(change, "docs/notes.md", "# Notes\n");
    expect(check(change, "01-1").fresh).toBe(true);
    expect(closed(change, ticket, "ok").next).toStrictEqual({ action: "commit" });
    expect(state(change, "simplify:01")).toBe("done");
    expect(state(change, "tests-scoped:01")).toBe("done");
    expect(state(change, "lint:01")).toBe("done");
  });

  it("plan-verify goes stale after a plan part edit", () => {
    const { root, dir } = pastDesignGate();
    writePlanPart(dir, "01");
    done(root, "plan");
    verdict(dir);
    expect(done(root, "plan-verify")).toMatchObject({ state: "done" });
    writePlanPart(dir, "01", { body: taskBody("01", "stores a hashed token") });
    expect(
      answered(bdk(["explain", "plan-verify", "--json"], root), "output/explain.json"),
    ).toMatchObject({ state: "stale" });
  });

  it("a project evidence kind records a manifest, not-run with no citation and a cited pass", () => {
    const change = started();
    const ticket = String(
      answered(open(change, "task-redispatch", "01-1"), "output/attempt-open.json").ticket,
    );
    const skipped = recorded(change, ticket, "contract-snapshot", "not-run");
    const passed = recorded(change, ticket, "contract-snapshot");
    const manifest = (id: string) =>
      read(change.root, `.bdk/changes/${change.id}/evidence/01-1-${id}.md`);
    expect(manifest(skipped)).toContain("verdict: not-run");
    expect(manifest(skipped)).not.toContain("citations:");
    expect(manifest(passed)).toContain("verdict: pass");
    expect(manifest(passed)).toContain("- /failed");
    const [latest, ...rest] = check(change, "01-1").evidence;
    expect(rest).toStrictEqual([]);
    expect(latest).toMatchObject({ kind: "contract-snapshot", fresh: true, evidence: passed });
  });
});
