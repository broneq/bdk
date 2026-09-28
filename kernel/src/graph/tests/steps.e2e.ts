// `kernel-pipeline` (T23-D40): the post-task step nodes through the committed
// bundle in real repositories, done from the evidence `evidence record` writes.
import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { describe, expect, it } from "vitest";

import { answered, bdk, refused } from "../../../tests/support/repo.ts";
import { opened, started } from "../../attempt/tests/e2e-support.ts";
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

/** A passing `tests-scoped` record under a new ticket of `task`. */
function testsPass(change: Started, task: string): string {
  const ticket = opened(change, "task-redispatch", task);
  put(change, `.bdk/.machine/evidence/${task}-tests.json`, '{"summary":{"failed":0}}');
  const report = answered(
    bdk(
      [
        "evidence",
        "record",
        "tests-scoped",
        `.bdk/.machine/evidence/${task}-tests.json`,
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
    expect(at("execute-part:01")).toBeLessThan(at("simplify:01"));
    expect(at("simplify:01")).toBeLessThan(at("tests-scoped:01"));
    expect(at("tests-scoped:01")).toBeLessThan(at("lint:01"));
    expect(at("lint:02")).toBeLessThan(at("spec-delta"));
    expect(at("spec-delta")).toBeLessThan(at("review"));
    expect(node(change, "tests-scoped:02")?.requires).toStrictEqual(["simplify:02"]);
    expect(node(change, "review")?.requires).toStrictEqual(
      expect.arrayContaining(["tests-scoped:01", "tests-scoped:02", "lint:01", "lint:02"]),
    );
  });

  it("is done from the latest fresh evidence, stale once a Files: path of the part changes", () => {
    const change = started();
    testsPass(change, "01-1");
    put(change, "src/01-2.ts", "export const two = 2;\n");
    expect(node(change, "tests-scoped:01")?.state).toBe("stale");
    testsPass(change, "01-2");
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
    expect(result.instead).toStrictEqual([
      "bdk evidence record tests-scoped <file> --ticket <ticket>",
    ]);
  });
});
