import { execFileSync } from "node:child_process";
import { mkdirSync, mkdtempSync, realpathSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { KernelRefusal } from "../../refusal/index.ts";
import {
  authorIdent,
  currentBranch,
  findWorkTree,
  gitInProgress,
  runGit,
  systemGit,
} from "../index.ts";
import type { Git } from "../index.ts";

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

describe("currentBranch", () => {
  it("reads the branch from HEAD, slashes included", () => {
    init(root);
    execFileSync("git", ["checkout", "--quiet", "-b", "feat/login"], { cwd: root });
    expect(currentBranch(root)).toBe("feat/login");
    expect(systemGit.currentBranch(root)).toBe("feat/login");
  });

  it("answers undefined for a detached HEAD", () => {
    init(root);
    writeFileSync(join(root, ".git/HEAD"), "3b18e512dba79e4c8300dd08aeb37f8e728b8dad\n");
    expect(currentBranch(root)).toBeUndefined();
  });

  it("follows the .git file of a linked worktree", () => {
    const gitDir = join(root, "main/.git/worktrees/linked");
    mkdirSync(gitDir, { recursive: true });
    writeFileSync(join(gitDir, "HEAD"), "ref: refs/heads/fix/x\n");
    mkdirSync(join(root, "linked"));
    writeFileSync(join(root, "linked/.git"), `gitdir: ${gitDir}\n`);
    expect(currentBranch(join(root, "linked"))).toBe("fix/x");
  });

  it("answers undefined without a HEAD file", () => {
    expect(currentBranch(root)).toBeUndefined();
  });
});

function fakeGit(code: number, stdout: string): Git {
  return {
    run: () => Promise.resolve({ code, stdout, stderr: "" }),
    currentBranch: () => undefined,
  };
}

describe("authorIdent", () => {
  it("strips the timestamp and zone from git var GIT_AUTHOR_IDENT", async () => {
    const git = fakeGit(0, "Jan Kowalski <jan@example.com> 1727255467 +0200\n");
    expect(await authorIdent(git, root)).toBe("Jan Kowalski <jan@example.com>");
  });

  it("answers unknown when git has no identity", async () => {
    expect(await authorIdent(fakeGit(128, ""), root)).toBe("unknown");
  });

  it("reads the identity of a real repository", async () => {
    init(root);
    execFileSync("git", ["config", "user.name", "Ada"], { cwd: root });
    execFileSync("git", ["config", "user.email", "ada@example.com"], { cwd: root });
    expect(await authorIdent(systemGit, root)).toBe("Ada <ada@example.com>");
  });

  it("refuses runtime/git-missing without git", async () => {
    const git: Git = {
      run: (args, cwd) => runGit(args, cwd, { executable: "git-that-does-not-exist" }),
      currentBranch: () => undefined,
    };
    await expect(authorIdent(git, root)).rejects.toMatchObject({
      refusal: { rule: "runtime/git-missing" },
    });
  });
});
