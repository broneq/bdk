// The Change base (`kernel-cli/review`, bdk review plan; `kernel-cli/evidence`,
// bdk evidence coverage): the parent of the Change's first commit, the one
// that added `change.md` or the first carrying its `BDK-Change` trailer,
// `HEAD` before either exists, the empty tree when that
// commit is the root, and the stamped `base` of a review Change; and the lines
// added against it, untracked files whole.
import { execFileSync } from "node:child_process";
import { mkdirSync, mkdtempSync, realpathSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { systemGit } from "../../git/index.ts";
import { addedLines, changeBase, EMPTY_TREE, fileStore, writeDocument } from "../index.ts";

let root: string;
const CHANGE = ".bdk/changes/2026-09-25-login";
const sh = (...args: string[]) => execFileSync("git", args, { cwd: root, encoding: "utf8" }).trim();
const write = (path: string, text: string) => {
  mkdirSync(join(root, path, ".."), { recursive: true });
  writeFileSync(join(root, path), text);
};
/** A valid `change.md`; `base` only for a review Change. */
const openChange = (edit = "", reviewBase?: string) => {
  writeDocument(fileStore(), join(root, CHANGE, "change.md"), {
    data: {
      schema: 1,
      id: "2026-09-25-login",
      kind: reviewBase === undefined ? "feature" : "review",
      profile: "small",
      intent: `Users log in with a one-time link.${edit}`,
      source: "user",
      at: "2026-09-25T09:00:00.000Z",
      author: "BDK Test <test@example.com>",
      overridden: [],
      ...(reviewBase === undefined ? {} : { base: reviewBase }),
    },
    body: "",
  });
};
const baseOf = (dir = join(root, CHANGE)) => changeBase(fileStore(), systemGit, root, dir);
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
    openChange();
    commit("open the Change");
    openChange(" Edited.");
    write("src/a.ts", "a\n");
    commit("work");
    expect(await baseOf()).toBe(before);
  });

  it("is the parent of the first task commit when the Change directory is committed later (#166)", async () => {
    write("README.md", "# app\n");
    const before = commit("initial");
    openChange();
    write("src/a.ts", "a\n");
    sh("add", "src/a.ts");
    sh(
      "commit",
      "--quiet",
      "-m",
      "Task 01-1",
      "--trailer",
      "BDK-Change: 2026-09-25-login",
      "--trailer",
      "BDK-Task: 01-1",
      "--",
      "src/a.ts",
    );
    commit("checkpoint the Change");
    expect(await baseOf()).toBe(before);
  });

  it("is the parent of the commit that added change.md before a later trailer commit", async () => {
    write("README.md", "# app\n");
    const before = commit("initial");
    openChange();
    commit("open the Change");
    write("src/a.ts", "a\n");
    sh("add", "src/a.ts");
    sh("commit", "--quiet", "-m", "Task 01-1", "--trailer", "BDK-Change: 2026-09-25-login");
    expect(await baseOf()).toBe(before);
  });

  it("is HEAD while change.md is not committed", async () => {
    write("README.md", "# app\n");
    const head = commit("initial");
    openChange();
    expect(await baseOf()).toBe(head);
  });

  it("is the empty tree when the root commit added change.md", async () => {
    openChange();
    commit("initial");
    expect(await baseOf()).toBe(EMPTY_TREE);
  });

  it("is the stamped base of a review Change, before and after change.md is committed", async () => {
    write("README.md", "# app\n");
    const first = commit("initial");
    write("src/a.ts", "a\n");
    commit("work under review");
    openChange("", first);
    expect(await baseOf()).toBe(first);
    commit("open the review Change");
    expect(await baseOf()).toBe(first);
  });

  it("is the empty tree in a repository without commits", async () => {
    expect(await baseOf()).toBe(EMPTY_TREE);
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
