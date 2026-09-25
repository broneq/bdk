import { execFileSync } from "node:child_process";
import { mkdirSync, mkdtempSync, realpathSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { KernelRefusal } from "../../refusal/index.ts";
import { findWorkTree, gitInProgress, runGit } from "../index.ts";

let root: string;
beforeEach(() => {
  root = realpathSync(mkdtempSync(join(tmpdir(), "bdk-git-")));
});
afterEach(() => {
  rmSync(root, { recursive: true, force: true });
});

function init(dir: string): void {
  mkdirSync(dir, { recursive: true });
  execFileSync("git", ["init", "--quiet"], { cwd: dir });
}

describe("findWorkTree", () => {
  it("finds a .git directory from a nested directory", () => {
    init(root);
    mkdirSync(join(root, "a/b"), { recursive: true });
    expect(findWorkTree(join(root, "a/b"))).toBe(root);
  });

  it("finds a .git file, as in a linked worktree", () => {
    mkdirSync(join(root, "linked/src"), { recursive: true });
    writeFileSync(join(root, "linked/.git"), "gitdir: /elsewhere/.git/worktrees/linked\n");
    expect(findWorkTree(join(root, "linked/src"))).toBe(join(root, "linked"));
  });

  it("answers undefined outside a repository", () => {
    expect(findWorkTree(root)).toBeUndefined();
  });
});

describe("runGit", () => {
  it("returns stdout of a git call", async () => {
    init(root);
    expect((await runGit(["rev-parse", "--is-inside-work-tree"], root)).stdout).toBe("true\n");
  });

  it("returns a failing exit code instead of throwing", async () => {
    const result = await runGit(["rev-parse", "HEAD"], root);
    expect(result.code).not.toBe(0);
    expect(result.stderr).not.toBe("");
  });

  it("maps a missing executable to runtime/git-missing", async () => {
    const call = runGit(["status"], root, { executable: "git-that-does-not-exist" });
    await expect(call).rejects.toBeInstanceOf(KernelRefusal);
    await expect(call).rejects.toMatchObject({ refusal: { rule: "runtime/git-missing" } });
  });
});

describe("gitInProgress", () => {
  it("answers undefined for a clean repository", () => {
    init(root);
    expect(gitInProgress(root)).toBeUndefined();
  });

  it.each([
    ["rebase-merge/", "rebase"],
    ["rebase-apply/", "rebase"],
    ["MERGE_HEAD", "merge"],
    ["CHERRY_PICK_HEAD", "cherry-pick"],
  ])("refuses on %s", (marker, operation) => {
    init(root);
    const path = join(root, ".git", marker);
    if (marker.endsWith("/")) mkdirSync(path);
    else writeFileSync(path, "0000000000000000000000000000000000000000\n");
    const refusal = gitInProgress(root);
    expect(refusal?.rule).toBe("policy/git-in-progress");
    expect(refusal?.why).toContain(operation);
  });

  it("follows the .git file of a linked worktree to its git directory", () => {
    const gitDir = join(root, "main/.git/worktrees/linked");
    mkdirSync(gitDir, { recursive: true });
    writeFileSync(join(gitDir, "MERGE_HEAD"), "");
    mkdirSync(join(root, "linked"));
    writeFileSync(join(root, "linked/.git"), `gitdir: ${gitDir}\n`);
    expect(gitInProgress(join(root, "linked"))?.rule).toBe("policy/git-in-progress");
  });
});
