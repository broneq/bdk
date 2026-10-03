// The Change base (`kernel-cli/review`, bdk review plan; `kernel-cli/evidence`,
// bdk evidence coverage): the parent of the first commit that added the
// Change's `change.md`, `HEAD` before it is committed, the empty tree when that
// commit is the root; and the lines added against it, untracked files whole.
import { execFileSync } from "node:child_process";
import { mkdirSync, mkdtempSync, realpathSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { systemGit } from "../../git/index.ts";
import { addedLines, changeBase, EMPTY_TREE, fileStore } from "../index.ts";

let root: string;
const CHANGE = ".bdk/changes/2026-09-25-login";
const sh = (...args: string[]) => execFileSync("git", args, { cwd: root, encoding: "utf8" }).trim();
const write = (path: string, text: string) => {
  mkdirSync(join(root, path, ".."), { recursive: true });
  writeFileSync(join(root, path), text);
};
const commit = (message: string) => {
  sh("add", "-A");
  sh("commit", "--quiet", "-m", message);
  return sh("rev-parse", "HEAD");
};

beforeEach(() => {
  root = realpathSync(mkdtempSync(join(tmpdir(), "bdk-base-")));
  sh("init", "--quiet");
  sh("config", "user.name", "BDK Test");
  sh("config", "user.email", "test@example.com");
});
afterEach(() => {
  rmSync(root, { recursive: true, force: true });
});

describe("changeBase", () => {
  it("is the parent of the commit that added change.md, later edits aside", async () => {
    write("README.md", "# app\n");
    const before = commit("initial");
    write(`${CHANGE}/change.md`, "---\nid: 2026-09-25-login\n---\n");
    commit("open the Change");
    write(`${CHANGE}/change.md`, "---\nid: 2026-09-25-login\n---\nedited\n");
    write("src/a.ts", "a\n");
    commit("work");
    expect(await changeBase(systemGit, root, join(root, CHANGE))).toBe(before);
  });

  it("is HEAD while change.md is not committed", async () => {
    write("README.md", "# app\n");
    const head = commit("initial");
    write(`${CHANGE}/change.md`, "---\n---\n");
    expect(await changeBase(systemGit, root, join(root, CHANGE))).toBe(head);
  });

  it("is the empty tree when the root commit added change.md", async () => {
    write(`${CHANGE}/change.md`, "---\n---\n");
    commit("initial");
    expect(await changeBase(systemGit, root, join(root, CHANGE))).toBe(EMPTY_TREE);
  });

  it("is the empty tree in a repository without commits", async () => {
    expect(await changeBase(systemGit, root, join(root, CHANGE))).toBe(EMPTY_TREE);
  });
});

describe("addedLines", () => {
  beforeEach(() => {
    write("src/a.ts", "1\n2\n3\n");
    commit("base");
  });

  it("joins committed, uncommitted and untracked additions against the base", async () => {
    const base = sh("rev-parse", "HEAD");
    write("src/a.ts", "1\n2\nadded\n3\n");
    sh("commit", "--quiet", "-am", "one line");
    write("src/a.ts", "1\n2\nadded\n3\ndirty\n");
    write("src/new file.ts", "x\ny\n");
    expect(await addedLines(fileStore(), systemGit, root, base)).toStrictEqual(
      new Map([
        ["src/a.ts", [3, 5]],
        ["src/new file.ts", [1, 2]],
      ]),
    );
  });

  it("reads a moved file's edits, not the whole file", async () => {
    const base = sh("rev-parse", "HEAD");
    sh("mv", "src/a.ts", "src/b.ts");
    write("src/b.ts", "1\n2\n3\n4\n");
    sh("commit", "--quiet", "-am", "move");
    expect(await addedLines(fileStore(), systemGit, root, base)).toStrictEqual(
      new Map([["src/b.ts", [4]]]),
    );
  });
});
