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

describe("bdk evidence check", () => {
  function recorded(change: Started): string {
    const ticket = opened(change, "task-redispatch", "01-1");
    put(change, "lint.txt", "clean\n");
    const report = answered(
      record(change, "lint", "lint.txt", "--ticket", ticket, "--verdict", "fail"),
      "output/evidence-record.json",
    );
    return String(report.evidence);
  }

  function check(change: Started, target: string, ...flags: string[]) {
    return bdk(["evidence", "check", target, ...flags], change.root);
  }

  it("exit 0: fresh, then stale with the changed path after a sibling task's file changes", () => {
    const change = started();
    const id = recorded(change);
    expect(answered(check(change, "01-1", "--json"), "output/evidence-check.json").fresh).toBe(
      true,
    );
    expect(check(change, "01-1").stdout).toContain("fresh");
    put(change, "src/01-2.ts", "export {};\n");
    const report = answered(check(change, "01-1", "--json"), "output/evidence-check.json");
    expect(report).toMatchObject({
      fresh: false,
      evidence: [{ evidence: id, kind: "lint", fresh: false, changedSince: ["src/01-2.ts"] }],
    });
    expect(answered(check(change, id, "--json"), "output/evidence-check.json").fresh).toBe(false);
  });

  it("exit 0: a build-config change is stale, a target without evidence is not fresh", () => {
    const change = started();
    recorded(change);
    put(change, "package.json", "{}\n");
    const report = answered(check(change, "01-1", "--json"), "output/evidence-check.json");
    expect(report).toMatchObject({ fresh: false, evidence: [{ changedSince: ["package.json"] }] });
    expect(answered(check(change, "02", "--json"), "output/evidence-check.json")).toMatchObject({
      fresh: false,
      evidence: [],
    });
  });

  it("exit 2 policy/stale-evidence in text mode", () => {
    const change = started();
    recorded(change);
    put(change, "src/01-1.ts", "export {};\n");
    const result = check(change, "01-1");
    expect(result.code).toBe(2);
    expect(result.stdout).toContain("policy/stale-evidence");
  });

  it("exit 3 input/not-found", () => {
    const change = started();
    refused(check(change, "09", "--json"), 3, "input/not-found");
    refused(check(change, "E-zzzzzzzz", "--json"), 3, "input/not-found");
  });
});
