// `kernel-pipeline` (T23-D40): the post-task step nodes through the committed
// bundle in real repositories, done from the evidence `evidence record` writes.
import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { describe, expect, it } from "vitest";

import { answered, bdk, git, refused } from "../../../tests/support/repo.ts";
import {
  checkedIn,
  closed,
  conformed,
  dispatched,
  opened,
  started,
  stepsDone,
} from "../../attempt/tests/e2e-support.ts";
import type { Started } from "../../attempt/tests/e2e-support.ts";

interface Node {
  id: string;
  state: string;
  requires?: string[];
}

function put(change: Started, path: string, content: string): void {
  mkdirSync(dirname(join(change.root, path)), { recursive: true });
  writeFileSync(join(change.root, path), content);
}

function nodes(change: Started): Node[] {
  const status = answered(
    bdk(["change", "status", "--json"], change.root),
    "output/change-status.json",
  );
  return status.nodes as Node[];
}

function node(change: Started, id: string): Node | undefined {
  return nodes(change).find((found) => found.id === id);
}

/** A passing `tests-scoped` record under the part ticket `ticket`. */
function testsPass(change: Started, ticket: string): string {
  const file = `.bdk/.machine/checks/${ticket}/tests.json`;
  put(change, file, '{"summary":{"failed":0}}');
  const report = answered(
    bdk(
      [
        "evidence",
        "record",
        "tests-scoped",
        file,
        "--ticket",
        ticket,
        "--verdict",
        "pass",
        "--cite",
        "/summary/failed",
        "--json",
      ],
      change.root,
    ),
    "output/evidence-record.json",
  );
  return String(report.evidence);
}

describe("post-task step nodes", () => {
  it("follow execute in change status, paired by part", () => {
    const change = started();
    const ids = nodes(change).map((found) => found.id);
    const at = (id: string) => ids.indexOf(id);
    expect(at("execute-part:01")).toBeLessThan(at("conform:01"));
    expect(at("conform:01")).toBeLessThan(at("tests-scoped:01"));
    expect(at("tests-scoped:01")).toBeLessThan(at("lint:01"));
    expect(at("lint:02")).toBeLessThan(at("spec-delta"));
    expect(at("spec-delta")).toBeLessThan(at("review"));
    expect(node(change, "tests-scoped:02")?.requires).toStrictEqual(["conform:02"]);
    expect(node(change, "review")?.requires).toStrictEqual(
      expect.arrayContaining(["tests-scoped:01", "tests-scoped:02", "lint:01", "lint:02"]),
    );
  });

  it("is done from the latest fresh evidence, stale once a Files: path of the part changes", () => {
    const change = started();
    const ticket = opened(change, "part", "01");
    testsPass(change, ticket);
    put(change, "src/01-2.ts", "export const two = 2;\n");
    expect(node(change, "tests-scoped:01")?.state).toBe("stale");
    testsPass(change, ticket);
    expect(node(change, "tests-scoped:01")?.state).toBe("done");

    put(change, "docs/notes.md", "# Notes\n");
    expect(node(change, "tests-scoped:01")?.state).toBe("done");
    put(change, "src/01-1.ts", "export const one = 1;\n");
    expect(node(change, "tests-scoped:01")?.state).toBe("stale");
    const validated = answered(
      bdk(["validate", "tests-scoped:01", "--json"], change.root),
      "output/validate.json",
    );
    expect(validated.valid).toBe(false);
  });

  it("exit 2 policy/invalid-transition: bdk done on a step names its command", () => {
    const change = started();
    const result = refused(
      bdk(["done", "tests-scoped:01", "--json"], change.root),
      2,
      "policy/invalid-transition",
    );
    expect(result.instead).toStrictEqual(["bdk check run <part> --ticket <ticket>"]);
  });

  // A whole executed Change spawns dozens of kernel and git processes: about 10 s
  // alone, over the 30 s project default when the whole E2E suite loads the machine.
  it("a stale step of a done part comes back through a verify-fix ticket of the part", () => {
    const change = started();
    /** A part through its ticket; `extra` files go into the last task's commit. */
    const partDone = (part: string, tasks: string[], extra: Record<string, string> = {}) => {
      const ticket = opened(change, "part", part);
      dispatched(change, ticket, part);
      for (const [at, task] of tasks.entries()) {
        put(change, `src/${task}.ts`, `export const value = "${task}";\n`);
        if (at === tasks.length - 1) {
          for (const [file, content] of Object.entries(extra)) put(change, file, content);
        }
        git(change.root, "add", "-A", "--", "src");
        git(
          change.root,
          "commit",
          "--quiet",
          "-m",
          `Task ${task}\n\nBDK-Change: ${change.id}\nBDK-Part: ${part}\nBDK-Task: ${task}`,
        );
      }
      conformed(change, ticket, part);
      checkedIn(change, ticket, part);
      closed(change, ticket, "ok");
      answered(bdk(["part", "done", part, "--json"], change.root), "output/part-done.json");
    };
    partDone("01", ["01-1", "01-2"]);
    answered(bdk(["part", "start", "02", "--json"], change.root), "output/part-start.json");
    // Part 02's task also edits a file of part 01, outside its own Files:.
    partDone("02", ["02-1"], { "src/01-1.ts": "export const one = 11;\n" });

    const stale = answered(bdk(["next", "--json"], change.root), "output/next.json");
    expect(stale.artifact).toMatchObject({ id: "conform:01", state: "stale" });
    expect(stale.wave).toBeUndefined();
    const open = answered(
      bdk(["attempt", "open", "verify-fix", "01", "--json"], change.root),
      "output/attempt-open.json",
    );
    expect((open.steps as { kind: string }[]).map((step) => step.kind)).toStrictEqual([
      "conform",
      "tests-scoped",
      "lint",
    ]);
    const ticket = String(open.ticket);
    stepsDone(change, ticket, "01");
    closed(change, ticket, "ok");
    for (const step of ["conform:01", "tests-scoped:01", "lint:01"]) {
      expect(node(change, step)?.state, step).toBe("done");
    }
  }, 120_000);
});
