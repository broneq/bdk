// `kernel-cli/evidence` through the committed bundle in real repositories:
// one case per exit code and per declared rule of `evidence record`, every
// output validated against its schema, and the storage split seen by git.
import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { describe, expect, it } from "vitest";

import { answered, bdk, git, read, refused } from "../../../tests/support/repo.ts";
import { opened, started } from "../../attempt/tests/e2e-support.ts";
import type { Started } from "../../attempt/tests/e2e-support.ts";

function put(change: Started, path: string, content: string): void {
  mkdirSync(dirname(join(change.root, path)), { recursive: true });
  writeFileSync(join(change.root, path), content);
}

function record(change: Started, ...argv: string[]) {
  return bdk(["evidence", "record", ...argv, "--json"], change.root);
}

const SUMMARY = JSON.stringify({ summary: { failed: 0, passed: 12 } });

describe("bdk evidence record", () => {
  it("exit 0: the example run writes the manifest and copies the report into the Change", () => {
    const change = started();
    const ticket = opened(change, "task-redispatch", "01-1");
    put(change, ".bdk/.machine/evidence/01-1-tests.json", SUMMARY);
    const report = answered(
      record(
        change,
        "tests-scoped",
        ".bdk/.machine/evidence/01-1-tests.json",
        "--ticket",
        ticket,
        "--verdict",
        "pass",
        "--cite",
        "/summary/failed",
      ),
      "output/evidence-record.json",
    );
    const id = String(report.evidence);
    expect(report.path).toBe(`.bdk/changes/${change.id}/evidence/01-1-${id}.md`);
    expect(read(change.root, String(report.path))).toContain("kind: tests-scoped");
    expect(read(change.root, `.bdk/changes/${change.id}/evidence/01-1-${id}-01-1-tests.json`)).toBe(
      SUMMARY,
    );
    expect(
      bdk(
        [
          "evidence",
          "record",
          "tests-scoped",
          ".bdk/.machine/evidence/01-1-tests.json",
          "--ticket",
          ticket,
          "--verdict",
          "pass",
          "--cite",
          "/summary/failed",
        ],
        change.root,
      ).stdout,
    ).toContain(`${id} already records this evidence`);
  });

  it("exit 3 input/not-found", () => {
    const change = started();
    const ticket = opened(change, "task-redispatch", "01-1");
    refused(record(change, "lint", "out/lint.txt", "--ticket", ticket), 3, "input/not-found");
  });

  it("exit 3 input/invalid-argument for a kind that is not kebab-case", () => {
    const change = started();
    const ticket = opened(change, "task-redispatch", "01-1");
    put(change, "lint.txt", "clean\n");
    refused(record(change, "Lint", "lint.txt", "--ticket", ticket), 3, "input/invalid-argument");
  });

  it("exit 2 policy/no-open-ticket", () => {
    const change = started();
    put(change, "lint.txt", "clean\n");
    refused(
      record(change, "lint", "lint.txt", "--ticket", "A-zzzzzzzz"),
      2,
      "policy/no-open-ticket",
    );
  });

  it("exit 2 policy/missing-citation: pass without a citation, and one that does not resolve", () => {
    const change = started();
    const ticket = opened(change, "task-redispatch", "01-1");
    put(change, "run.txt", "running 12 tests\nall suites loaded\n12 passed, 0 failed\n");
    refused(
      record(change, "tests-scoped", "run.txt", "--ticket", ticket, "--verdict", "pass"),
      2,
      "policy/missing-citation",
    );
    const result = refused(
      record(
        change,
        "tests-scoped",
        "run.txt",
        "--ticket",
        ticket,
        "--verdict",
        "pass",
        "--cite",
        "run.txt:3=2 failed",
      ),
      2,
      "policy/missing-citation",
    );
    expect(result.why).toContain("run.txt:3=2 failed");
  });

  it("commits small text, keeps a large file on the machine, and git sees only the Change", () => {
    const change = started();
    const ticket = opened(change, "task-redispatch", "01-1");
    put(change, ".bdk/.machine/evidence/junit.txt", "ok 1\n".repeat(3600));
    put(change, ".bdk/.machine/evidence/coverage.json", `{"lines":"${"x".repeat(2_000_000)}"}`);
    git(change.root, "add", "-A");
    git(change.root, "commit", "-q", "-m", "open the ticket");
    const report = answered(
      record(
        change,
        "tests-scoped",
        ".bdk/.machine/evidence/junit.txt",
        ".bdk/.machine/evidence/coverage.json",
        "--ticket",
        ticket,
        "--verdict",
        "fail",
      ),
      "output/evidence-record.json",
    );
    expect((report.files as { stored: string }[]).map((file) => file.stored)).toStrictEqual([
      "committed",
      "machine",
    ]);
    const status = git(change.root, "status", "--porcelain", "--untracked-files=all")
      .split("\n")
      .filter((line) => line !== "")
      .map((line) => line.slice(3));
    const evidence = `.bdk/changes/${change.id}/evidence/`;
    expect(status.sort()).toStrictEqual(
      [`${evidence}01-1-${String(report.evidence)}-junit.txt`, String(report.path)].sort(),
    );
  });

  it("exit 0 for a project kind", () => {
    const change = started();
    const ticket = opened(change, "task-redispatch", "01-1");
    put(change, "snap.json", "{}");
    const report = answered(
      record(change, "contract-snapshot", "snap.json", "--ticket", ticket, "--verdict", "not-run"),
      "output/evidence-record.json",
    );
    expect(read(change.root, String(report.path))).toContain("kind: contract-snapshot");
  });
});
