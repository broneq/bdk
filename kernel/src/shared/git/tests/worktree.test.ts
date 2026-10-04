// The git operations of a part worktree (`kernel-state`, Part worktree;
// `kernel-cli/part`, bdk part done; T45 design D2, D5, D10), run against a
// real repository so the parsing follows what git 2.38+ prints.
import { execFileSync } from "node:child_process";
import { mkdirSync, mkdtempSync, readFileSync, realpathSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import {
  addWorktree,
  checkoutWorktree,
  commitTree,
  differFrom,
  fastForward,
  gitDirOf,
  gitVersion,
  includedFiles,
  isIgnored,
  listWorktrees,
  mergeCommit,
  mergeInProgress,
  mergeNoCommit,
  mergeTree,
  removeWorktree,
  runSetup,
  supportsMergeTree,
  systemGit,
  unmergedPaths,
} from "../index.ts";
import type { Git } from "../index.ts";

let root: string;
let home: string;
beforeEach(() => {
  root = realpathSync(mkdtempSync(join(tmpdir(), "bdk-worktree-")));
  home = join(root, "home");
  mkdirSync(home);
  sh(home, "init", "--quiet", "-b", "main");
  sh(home, "config", "user.name", "BDK Test");
  sh(home, "config", "user.email", "test@example.com");
  write(home, { "a.txt": "a\n", "lock.txt": "l1\n", ".gitignore": ".bdk/.machine/\n" });
  sh(home, "add", "-A");
  sh(home, "commit", "--quiet", "-m", "initial");
});
afterEach(() => {
  rmSync(root, { recursive: true, force: true });
});

function sh(cwd: string, ...args: string[]): string {
  return execFileSync("git", args, { cwd, encoding: "utf8" });
}

function write(dir: string, files: Record<string, string>): void {
  for (const [path, text] of Object.entries(files)) {
    mkdirSync(join(dir, path, ".."), { recursive: true });
    writeFileSync(join(dir, path), text);
  }
}

function commit(dir: string, files: Record<string, string>, message: string): void {
  write(dir, files);
  sh(dir, "add", "-A");
  sh(dir, "commit", "--quiet", "-m", message);
}

const BRANCH = "bdk-part/2026-10-04-x/02";

async function worktree(): Promise<string> {
  const dir = join(home, ".bdk/.machine/worktrees/2026-10-04-x/02");
  const added = await addWorktree(systemGit, home, dir, BRANCH);
  expect(added).toStrictEqual({ ok: true });
  return dir;
}

describe("gitVersion", () => {
  it("parses the version and checks it against 2.38", async () => {
    const version = await gitVersion(systemGit, home);
    expect(version?.[0]).toBeGreaterThanOrEqual(2);
    expect(supportsMergeTree([2, 38, 0])).toBe(true);
    expect(supportsMergeTree([2, 37, 9])).toBe(false);
    expect(supportsMergeTree([3, 0, 0])).toBe(true);
  });

  it("reads an Apple suffix", async () => {
    const apple: Git = {
      run: () =>
        Promise.resolve({ code: 0, stdout: "git version 2.39.5 (Apple Git-154)\n", stderr: "" }),
      currentBranch: () => undefined,
    };
    expect(await gitVersion(apple, home)).toStrictEqual([2, 39, 5]);
  });
});

describe("addWorktree, listWorktrees, removeWorktree", () => {
  it("creates the branch from HEAD and lists it with its git dir", async () => {
    const dir = await worktree();
    expect(sh(dir, "rev-parse", "HEAD")).toBe(sh(home, "rev-parse", "HEAD"));
    const listed = await listWorktrees(systemGit, home);
    expect(listed.map((found) => [found.path, found.branch])).toStrictEqual([
      [home, "main"],
      [dir, BRANCH],
    ]);
    expect(gitDirOf(dir)).toBe(sh(dir, "rev-parse", "--absolute-git-dir").trim());
  });

  it("answers the git output when the branch exists", async () => {
    sh(home, "branch", BRANCH);
    const added = await addWorktree(systemGit, home, join(root, "other"), BRANCH);
    expect(added).toMatchObject({ ok: false });
    expect(!added.ok && added.output).toContain(BRANCH);
  });

  it("removes a dirty worktree and its branch", async () => {
    const dir = await worktree();
    write(dir, { "left.txt": "x\n" });
    await removeWorktree(systemGit, home, dir, BRANCH);
    expect((await listWorktrees(systemGit, home)).map((found) => found.path)).toStrictEqual([home]);
    expect(sh(home, "branch", "--list", BRANCH)).toBe("");
  });
});

describe("mergeTree", () => {
  it("answers the tree of a clean merge", async () => {
    const dir = await worktree();
    commit(dir, { "b.txt": "b\n" }, "part");
    commit(home, { "c.txt": "c\n" }, "shared");
    const merged = await mergeTree(systemGit, home, "main", BRANCH);
    expect(merged).toMatchObject({ clean: true });
    expect(merged.clean && sh(home, "ls-tree", "--name-only", merged.tree)).toBe(
      ".gitignore\na.txt\nb.txt\nc.txt\nlock.txt\n",
    );
  });

  it("names the conflicting paths and touches no tree", async () => {
    const dir = await worktree();
    commit(dir, { "lock.txt": "l2\n" }, "part lock");
    commit(home, { "lock.txt": "l3\n" }, "home lock");
    const merged = await mergeTree(systemGit, home, "main", BRANCH);
    expect(merged).toStrictEqual({ clean: false, conflicts: ["lock.txt"] });
    expect(sh(home, "status", "--porcelain")).toBe("");
    expect(readFileSync(join(dir, "lock.txt"), "utf8")).toBe("l2\n");
  });
});

describe("commitTree and fastForward", () => {
  it("writes a two-parent merge commit with trailers and moves the branch forward", async () => {
    const dir = await worktree();
    commit(dir, { "b.txt": "b\n" }, "part");
    const merged = await mergeTree(systemGit, home, "main", BRANCH);
    if (!merged.clean) throw new Error("expected a clean merge");
    const message = "chore(bdk): merge part 02 of x\n\nBDK-Change: x\nBDK-Part: 02";
    const sha = await commitTree(systemGit, home, merged.tree, ["main", BRANCH], message);
    expect(sh(home, "log", "-1", "--format=%P", sha).trim().split(" ")).toHaveLength(2);
    expect(sh(home, "log", "-1", "--format=%(trailers:key=BDK-Part,valueonly)", sha).trim()).toBe(
      "02",
    );
    write(home, { "a.txt": "dirty, not merged\n" });
    expect(await fastForward(systemGit, home, sha)).toStrictEqual({ ok: true });
    expect(sh(home, "rev-parse", "HEAD").trim()).toBe(sha);
    expect(readFileSync(join(home, "a.txt"), "utf8")).toBe("dirty, not merged\n");
  });

  it("names the dirty home paths the merge would overwrite", async () => {
    const dir = await worktree();
    commit(dir, { "b.txt": "b\n", "a.txt": "part a\n" }, "part");
    const merged = await mergeTree(systemGit, home, "main", BRANCH);
    if (!merged.clean) throw new Error("expected a clean merge");
    const sha = await commitTree(systemGit, home, merged.tree, ["main", BRANCH], "merge");
    write(home, { "b.txt": "untracked\n", "a.txt": "edited\n" });
    const before = sh(home, "rev-parse", "HEAD");
    expect(await fastForward(systemGit, home, sha)).toStrictEqual({
      ok: false,
      paths: ["a.txt", "b.txt"],
    });
    expect(sh(home, "rev-parse", "HEAD")).toBe(before);
  });
});

describe("mergeNoCommit and unmergedPaths", () => {
  it("starts the merge in the worktree and lists the unmerged paths", async () => {
    const dir = await worktree();
    commit(dir, { "lock.txt": "l2\n" }, "part lock");
    commit(home, { "lock.txt": "l3\n", "c.txt": "c\n" }, "home lock");
    await mergeNoCommit(systemGit, dir, "main");
    expect(await unmergedPaths(systemGit, dir)).toStrictEqual(["lock.txt"]);
    expect(sh(home, "status", "--porcelain")).toBe("");
    write(dir, { "lock.txt": "l2\nl3\n" });
    sh(dir, "add", "lock.txt");
    expect(await unmergedPaths(systemGit, dir)).toStrictEqual([]);
  });
});

describe("mergeInProgress, differFrom and mergeCommit", () => {
  it("concludes a resolved merge with the message, hooks failing it first", async () => {
    const dir = await worktree();
    commit(dir, { "lock.txt": "l2\n" }, "part lock");
    commit(home, { "lock.txt": "l3\n", "c.txt": "c\n" }, "home lock");
    expect(await mergeInProgress(systemGit, dir)).toBe(false);
    await mergeNoCommit(systemGit, dir, "main");
    expect(await mergeInProgress(systemGit, dir)).toBe(true);
    write(dir, { "lock.txt": "l4\n", "new.txt": "n\n" });
    expect(await differFrom(systemGit, dir, "main", ["lock.txt", "c.txt"])).toStrictEqual([
      "lock.txt",
    ]);
    expect(await differFrom(systemGit, dir, "main", [])).toStrictEqual([]);

    const hooks = join(root, "hooks");
    write(hooks, { "commit-msg": "#!/bin/sh\necho 'subject too long' >&2\nexit 1\n" });
    execFileSync("chmod", ["+x", join(hooks, "commit-msg")]);
    sh(home, "config", "core.hooksPath", hooks);
    expect(
      await mergeCommit(systemGit, dir, ["lock.txt"], "chore(bdk): merge\n\nBDK-Part: 02"),
    ).toStrictEqual({ committed: false, output: "subject too long" });
    expect(await mergeInProgress(systemGit, dir)).toBe(true);

    sh(home, "config", "--unset", "core.hooksPath");
    const done = await mergeCommit(
      systemGit,
      dir,
      ["lock.txt"],
      "chore(bdk): merge\n\nBDK-Part: 02",
    );
    expect(done).toMatchObject({ committed: true });
    expect(sh(dir, "log", "-1", "--format=%P").trim().split(" ")).toHaveLength(2);
    expect(sh(dir, "log", "-1", "--format=%(trailers:key=BDK-Part,valueonly)").trim()).toBe("02");
    expect(sh(dir, "status", "--porcelain")).toBe("?? new.txt\n");
  });
});

describe("checkoutWorktree, isIgnored and includedFiles", () => {
  it("checks out an existing branch again", async () => {
    const dir = await worktree();
    await removeWorktree(systemGit, home, dir, undefined);
    expect(await checkoutWorktree(systemGit, home, dir, BRANCH)).toStrictEqual({ ok: true });
    expect((await listWorktrees(systemGit, home)).map((entry) => entry.branch)).toContain(BRANCH);
    expect(await checkoutWorktree(systemGit, home, join(root, "other"), "missing")).toMatchObject({
      ok: false,
    });
  });

  it("knows ignored paths that do not exist yet", async () => {
    expect(await isIgnored(systemGit, home, ".bdk/.machine/worktrees/x/02")).toBe(true);
    expect(await isIgnored(systemGit, home, "worktrees/x/02")).toBe(false);
  });

  it("copies only ignored untracked files the include file names", async () => {
    write(home, {
      ".gitignore": ".bdk/.machine/\n.env\nnode_modules/\n",
      ".env": "TOKEN=1\n",
      "notes.txt": "untracked, not ignored\n",
      "node_modules/x/index.js": "x\n",
      ".worktreeinclude": ".env\nnotes.txt\n",
    });
    const include = join(home, ".worktreeinclude");
    expect(await includedFiles(systemGit, home, include)).toStrictEqual([".env"]);
    write(home, { ".worktreeinclude": "missing.txt\n" });
    expect(await includedFiles(systemGit, home, include)).toStrictEqual([]);
  });
});

describe("runSetup", () => {
  it("answers the exit code, the duration and the output tail", async () => {
    const run = await runSetup("for i in $(seq 1 25); do echo line $i; done; exit 3", home, 10_000);
    expect(run).toMatchObject({ exitCode: 3, timedOut: false });
    expect(run.tail).toHaveLength(20);
    expect(run.tail.at(-1)).toBe("line 25");
    expect(run.durationMs).toBeGreaterThanOrEqual(0);
  });

  it("kills a command still running at the bound, with its children", async () => {
    const run = await runSetup("echo started; sleep 30 & sleep 30", home, 300);
    expect(run).toMatchObject({ exitCode: undefined, timedOut: true, tail: ["started"] });
    expect(run.durationMs).toBeLessThan(10_000);
  });
});
