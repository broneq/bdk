import { execFileSync } from "node:child_process";
import {
  chmodSync,
  mkdirSync,
  mkdtempSync,
  realpathSync,
  rmSync,
  unlinkSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { KernelRefusal } from "../../refusal/index.ts";
import {
  changedPaths,
  pathspecCommit,
  runGit,
  systemGit,
  trailerCommits,
  workTreePaths,
} from "../index.ts";
import type { Git } from "../index.ts";

let root: string;
beforeEach(() => {
  root = realpathSync(mkdtempSync(join(tmpdir(), "bdk-commits-")));
  sh("init", "--quiet");
  sh("config", "user.name", "BDK Test");
  sh("config", "user.email", "test@example.com");
  write({ "README.md": "# app\n", "src/a.ts": "a\n", "src/b.ts": "b\n" });
  sh("add", "-A");
  sh("commit", "--quiet", "-m", "initial");
});
afterEach(() => {
  rmSync(root, { recursive: true, force: true });
});

function sh(...args: string[]): string {
  return execFileSync("git", args, { cwd: root, encoding: "utf8" });
}

function write(files: Record<string, string>): void {
  for (const [path, text] of Object.entries(files)) {
    mkdirSync(join(root, path, ".."), { recursive: true });
    writeFileSync(join(root, path), text);
  }
}

const missing: Git = {
  run: (args, cwd) => runGit(args, cwd, { executable: "git-that-does-not-exist" }),
  currentBranch: () => undefined,
};

describe("changedPaths", () => {
  it("lists modified, deleted, renamed and untracked paths against HEAD, sorted", async () => {
    write({ "src/a.ts": "changed\n", "src/new/c.ts": "c\n" });
    unlinkSync(join(root, "src/b.ts"));
    sh("mv", "README.md", "READ.md");
    expect(await changedPaths(systemGit, root)).toStrictEqual([
      "READ.md",
      "README.md",
      "src/a.ts",
      "src/b.ts",
      "src/new/c.ts",
    ]);
  });

  it("includes staged changes and limits to a pathspec", async () => {
    write({ "src/a.ts": "staged\n", ".bdk/changes/x/log/e.md": "e\n" });
    sh("add", "src/a.ts");
    expect(await changedPaths(systemGit, root)).toStrictEqual([
      ".bdk/changes/x/log/e.md",
      "src/a.ts",
    ]);
    expect(await changedPaths(systemGit, root, [".bdk/changes/x/"])).toStrictEqual([
      ".bdk/changes/x/log/e.md",
    ]);
  });

  it("refuses runtime/git-missing without git", async () => {
    await expect(changedPaths(missing, root)).rejects.toBeInstanceOf(KernelRefusal);
  });
});

describe("workTreePaths", () => {
  it("leaves out paths whose whole change is staged, keeps partly staged and untracked ones", async () => {
    write({ "src/a.ts": "staged\n", "README.md": "staged\n", "src/new/c.ts": "c\n" });
    sh("add", "src/a.ts", "README.md");
    write({ "src/a.ts": "staged and then edited\n" });
    unlinkSync(join(root, "src/b.ts"));
    expect(await workTreePaths(systemGit, root)).toStrictEqual([
      "src/a.ts",
      "src/b.ts",
      "src/new/c.ts",
    ]);
  });
});

describe("pathspecCommit", () => {
  it("commits only the given paths and leaves another staged file staged", async () => {
    write({ "README.md": "user edit\n", "src/a.ts": "task\n", "src/c.ts": "new\n" });
    sh("add", "README.md");
    const result = await pathspecCommit(
      systemGit,
      root,
      ["src/a.ts", "src/c.ts"],
      "feat: task\n\nBDK-Change: x\nBDK-Part: 01\nBDK-Task: 01-1",
    );
    expect(result).toStrictEqual({ committed: true, commit: sh("rev-parse", "HEAD").trim() });
    expect(sh("show", "--name-only", "--format=", "HEAD").trim().split("\n")).toStrictEqual([
      "src/a.ts",
      "src/c.ts",
    ]);
    expect(sh("diff", "--cached", "--name-only").trim()).toBe("README.md");
    expect(sh("log", "-1", "--format=%(trailers:key=BDK-Task,valueonly)").trim()).toBe("01-1");
  });

  it("stages a deletion", async () => {
    unlinkSync(join(root, "src/b.ts"));
    const result = await pathspecCommit(systemGit, root, ["src/b.ts"], "chore: drop b");
    expect(result.committed).toBe(true);
    expect(sh("ls-files", "src").trim()).toBe("src/a.ts");
  });

  it("reports a failing hook with its first output line and leaves HEAD unchanged", async () => {
    const head = sh("rev-parse", "HEAD");
    const hook = join(root, ".git/hooks/pre-commit");
    writeFileSync(hook, "#!/bin/sh\necho\necho 'lint failed: src/a.ts'\necho 'more'\nexit 1\n");
    chmodSync(hook, 0o755);
    write({ "src/a.ts": "task\n" });
    const result = await pathspecCommit(systemGit, root, ["src/a.ts"], "feat: task");
    expect(result).toStrictEqual({ committed: false, output: "lint failed: src/a.ts" });
    expect(sh("rev-parse", "HEAD")).toBe(head);
  });

  it("refuses runtime/git-missing without git", async () => {
    await expect(pathspecCommit(missing, root, ["src/a.ts"], "x")).rejects.toBeInstanceOf(
      KernelRefusal,
    );
  });
});

describe("trailerCommits", () => {
  function commit(message: string, file: string): void {
    write({ [file]: message });
    sh("add", "-A");
    sh("commit", "--quiet", "-m", message);
  }

  it("reads the commits of one Change with their trailers, newest first", async () => {
    commit("feat: one\n\nBDK-Change: x\nBDK-Part: 01\nBDK-Task: 01-1", "one.txt");
    commit("feat: other\n\nBDK-Change: y\nBDK-Part: 01\nBDK-Task: 01-1", "other.txt");
    commit("chore: partial\n\nBDK-Change: x", "partial.txt");
    commit("docs: mentions BDK-Change: x in prose", "prose.txt");
    const found = await trailerCommits(systemGit, root, "x");
    expect(found.map(({ subject, part, task }) => ({ subject, part, task }))).toStrictEqual([
      { subject: "chore: partial", part: undefined, task: undefined },
      { subject: "feat: one", part: "01", task: "01-1" },
    ]);
    expect(found[1]?.commit).toMatch(/^[0-9a-f]{40}$/);
  });

  it("answers no commits before the first commit", async () => {
    const empty = realpathSync(mkdtempSync(join(tmpdir(), "bdk-empty-")));
    execFileSync("git", ["init", "--quiet"], { cwd: empty });
    expect(await trailerCommits(systemGit, empty, "x")).toStrictEqual([]);
    rmSync(empty, { recursive: true, force: true });
  });

  it("refuses runtime/git-missing without git", async () => {
    await expect(trailerCommits(missing, root, "x")).rejects.toBeInstanceOf(KernelRefusal);
  });
});
