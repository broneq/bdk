// `bdk change close` (`kernel-cli/change`; T30-D11) through the committed
// bundle in real repositories: one case per exit code and per declared rule,
// every output validated against its schema, and the delta scenarios (close
// archives, prunes and commits only its paths; keep evidence; dry run).
import { chmodSync, existsSync, readdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

import { answered, bdk, git, read, refused } from "../../../tests/support/repo.ts";
import { fileStore, writeDocument } from "../../shared/store/index.ts";
import {
  archived,
  block,
  creating,
  executed,
  reviewed,
  writeDelta,
  writeLiving,
} from "../../spec/tests/e2e-support.ts";
import type { Reviewed } from "../../spec/tests/e2e-support.ts";

const CAP = "auth/login";
const SPEC = ".bdk/specs/auth/login/spec.md";
const DELTAS = { [CAP]: creating(["Magic link sent", ["sent"]]) };

function close(change: Reviewed, ...flags: string[]) {
  return bdk(["change", "close", ...flags, "--json"], change.root);
}

describe("bdk change close", () => {
  it("exit 0: archives, prunes, merges and commits only its paths", () => {
    const change = reviewed({ deltas: DELTAS });
    fileStore().write(join(change.root, "staged.txt"), "the user's\n");
    git(change.root, "add", "staged.txt");
    const report = answered(close(change), "output/change-close.json");
    expect(report).toMatchObject({
      change: change.id,
      archivedTo: `.bdk/changes/archive/${change.id}`,
      spec: { merged: [CAP], unchanged: false },
    });
    expect(report).not.toHaveProperty("learning");
    expect(report.summary).toContain("## Users log in with a link");
    const archive = join(change.root, ".bdk/changes/archive", change.id);
    expect(existsSync(change.dir)).toBe(false);
    expect(readdirSync(join(archive, "dispatch"))).toStrictEqual(["pruned.md"]);
    expect(readdirSync(join(archive, "reports"))).toStrictEqual(["pruned.md"]);
    expect(read(change.root, SPEC)).toContain(`bdk-change: ${change.id}`);
    expect(git(change.root, "log", "-1", "--format=%B").trim()).toBe(
      `chore(bdk): close ${change.id}\n\nBDK-Change: ${change.id}`,
    );
    const touched = git(change.root, "show", "--name-only", "--format=", "HEAD").trim().split("\n");
    expect(touched.every((path) => path.startsWith(".bdk/"))).toBe(true);
    expect(touched).toContain(SPEC);
    expect(git(change.root, "diff", "--cached", "--name-only").trim()).toBe("staged.txt");
    refused(bdk(["change", "status", "--json"], change.root), 2, "policy/no-active-change");
    expect(bdk(["change", "close"], reviewed().root).stdout).toContain("no spec change");
  });

  it("keep evidence: the archive keeps dispatch/ and reports/ bodies", () => {
    const change = reviewed({ settings: "archive:\n  keep-evidence: true\n" });
    fileStore().write(join(change.dir, "reports/notes.md"), "kept\n");
    answered(close(change), "output/change-close.json");
    const archive = join(change.root, ".bdk/changes/archive", change.id);
    expect(readdirSync(join(archive, "reports"))).not.toContain("pruned.md");
    expect(readdirSync(join(archive, "reports"))).toContain("notes.md");
    expect(readdirSync(join(archive, "dispatch"))).not.toContain("pruned.md");
  });

  it("dry run writes nothing", () => {
    const change = reviewed({ deltas: DELTAS });
    const before = git(change.root, "status", "--porcelain");
    const report = answered(close(change, "--dry-run"), "output/change-close.json");
    expect(report).toMatchObject({
      archivedTo: `.bdk/changes/archive/${change.id}`,
      spec: { merged: [CAP] },
    });
    expect(git(change.root, "status", "--porcelain")).toBe(before);
    expect(bdk(["change", "close", "--dry-run"], change.root).stdout).toContain(
      `would close ${change.id}`,
    );
  });

  it("exit 2: policy/gate-not-ready", () => {
    refused(close(executed()), 2, "policy/gate-not-ready");
  });

  it("exit 2: policy/ticket-open", () => {
    const change = reviewed();
    writeDocument(fileStore(), join(change.dir, "attempts/part-01-A-0000000z.md"), {
      data: {
        schema: 1,
        ticket: "A-0000000z",
        loop: "part",
        target: "01",
        attempt: 2,
        of: 3,
        scope: "full",
        "opened-at": new Date().toISOString(),
        author: "BDK Test <test@example.com>",
      },
      body: "",
    });
    refused(close(change), 2, "policy/ticket-open");
  });

  it("exit 4: state/trailer-mismatch", () => {
    const change = reviewed();
    git(
      change.root,
      "commit",
      "--quiet",
      "--allow-empty",
      "-m",
      `Stray\n\nBDK-Change: ${change.id}\nBDK-Part: 01\nBDK-Task: 01-9`,
    );
    const refusal = refused(close(change), 4, "state/trailer-mismatch");
    expect(refusal.why).toContain("01-9");
  });

  it("exit 2: policy/git-in-progress", () => {
    const change = reviewed();
    writeFileSync(join(change.root, ".git/MERGE_HEAD"), git(change.root, "rev-parse", "HEAD"));
    refused(close(change), 2, "policy/git-in-progress");
  });

  it("exit 2: policy/merge-hash-mismatch [NFR-SEC-3]", () => {
    const change = reviewed({ deltas: DELTAS });
    fileStore().write(join(change.root, SPEC), "# auth/login Specification\n\nBy hand.\n");
    refused(close(change), 2, "policy/merge-hash-mismatch");
  });

  it("exit 2: policy/spec-invalid", () => {
    const change = reviewed({ deltas: DELTAS });
    writeDelta(change, CAP, "## ADDED Requirements\n");
    refused(close(change), 2, "policy/spec-invalid");
    expect(existsSync(change.dir)).toBe(true);
  });

  it("exit 2: policy/spec-conflict", () => {
    const expires = (minutes: number) =>
      `## MODIFIED Requirements\n\n${block("Magic link expires", ["expired link"], `SHALL expire after ${String(minutes)} minutes`)}`;
    const change = reviewed({
      living: { [CAP]: block("Magic link expires", ["expired link"]) },
      deltas: { [CAP]: expires(10) },
    });
    const other = "2026-01-01-link-lifetime";
    archived(change.root, other, new Date(Date.now() + 5000).toISOString(), {
      [CAP]: expires(15),
    });
    writeLiving(
      change.root,
      CAP,
      block("Magic link expires", ["expired link"], "SHALL expire after 15 minutes"),
      other,
    );
    refused(close(change), 2, "policy/spec-conflict");
  });

  it("exit 2: policy/git-hook-failed, the archive stays in the work tree", () => {
    const change = reviewed();
    const hook = join(change.root, ".git/hooks/pre-commit");
    writeFileSync(hook, "#!/bin/sh\necho 'lint says no' >&2\nexit 1\n");
    chmodSync(hook, 0o755);
    const refusal = refused(close(change), 2, "policy/git-hook-failed");
    expect(refusal.why).toContain("lint says no");
    expect(existsSync(join(change.root, ".bdk/changes/archive", change.id))).toBe(true);
  });

  it("exit 5: runtime/git-missing", () => {
    refused(
      bdk(["change", "close", "--json"], reviewed().root, { git: false }),
      5,
      "runtime/git-missing",
    );
  });
});
