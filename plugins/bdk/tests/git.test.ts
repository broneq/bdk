import { execFileSync } from "node:child_process";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { gitGroup } from "../src/git/index.ts";
import { groupsSchema } from "../src/git/schema/groups.ts";
import { scopeSchema } from "../src/git/schema/scope.ts";
import { run } from "../src/shared/cli/index.ts";
import { files } from "../src/shared/fs/index.ts";
import { git } from "../src/shared/git/index.ts";

// Spec `bdk-cli/git` end to end: the frame, the slice and both OS boundaries against real
// temporary git repositories, the way `src/main.ts` wires them.

let root: string;
let repo: string;

function sh(args: readonly string[], cwd = repo): string {
  return execFileSync(
    "git",
    [
      "-c",
      "user.name=bdk",
      "-c",
      "user.email=bdk@example.com",
      "-c",
      "commit.gpgsign=false",
      ...args,
    ],
    { cwd, encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] },
  ).trim();
}

function write(path: string, text = `${path}\n`): void {
  mkdirSync(dirname(join(repo, path)), { recursive: true });
  writeFileSync(join(repo, path), text);
}

function commit(message: string, ...paths: string[]): string {
  for (const path of paths) write(path, `${path} ${message}\n`);
  sh(["add", "-A"]);
  sh(["commit", "-q", "--allow-empty", "-m", message]);
  return sh(["rev-parse", "HEAD"]);
}

async function bdk(
  args: readonly string[],
  cwd = repo,
): Promise<{ code: number; stdout: string; stderr: string }> {
  let stdout = "";
  let stderr = "";
  const code = await run({
    argv: args,
    version: "0.0.0",
    nodeVersion: process.versions.node,
    groups: [gitGroup({ files, cwd, git: (dir, gitArgs) => git(dir, gitArgs) })],
    stdout: (text) => (stdout += text),
    stderr: (text) => (stderr += text),
  });
  return { code, stdout, stderr };
}

async function json(args: readonly string[]): Promise<unknown> {
  const { code, stdout, stderr } = await bdk([...args, "--json"]);
  expect({ code, stderr }).toEqual({ code: 0, stderr: "" });
  return JSON.parse(stdout);
}

beforeEach(() => {
  root = mkdtempSync(join(tmpdir(), "bdk-git-e2e-"));
  repo = join(root, "repo");
  mkdirSync(repo);
  sh(["init", "-q", "-b", "main"]);
  commit("base", "README.md", "src/old.ts", "src/keep.ts");
  sh(["checkout", "-q", "-b", "work"]);
});

afterEach(() => {
  rmSync(root, { recursive: true, force: true });
});

describe("bdk git scope", () => {
  it("covers the branch from the merge base on the first round", async () => {
    const base = sh(["rev-parse", "main"]);
    commit("one", "src/auth/login.ts");
    commit("main moves", "src/keep.ts");
    sh(["checkout", "-q", "main"]);
    commit("on main", "other.ts");
    sh(["checkout", "-q", "work"]);
    commit("three", "src/mail/send.ts");
    const result = scopeSchema.parse(await json(["git", "scope", "main"]));
    expect(result.anchor).toEqual({ kind: "base", sha: base });
    expect(result.head).toBe(sh(["rev-parse", "HEAD"]));
    expect(result.files).toEqual(["src/auth/login.ts", "src/keep.ts", "src/mail/send.ts"]);
  });

  it("names binary, deleted and uncommitted files apart", async () => {
    write("src/a.ts");
    mkdirSync(join(repo, "img"));
    writeFileSync(join(repo, "img", "logo.png"), Buffer.from([0x89, 0x50, 0x00, 0x01, 0x02]));
    sh(["rm", "-q", "src/old.ts"]);
    commit("mixed");
    write("src/keep.ts", "changed, not committed\n");
    const result = scopeSchema.parse(await json(["git", "scope", "main"]));
    expect(result).toMatchObject({
      files: ["src/a.ts"],
      binary: ["img/logo.png"],
      deleted: ["src/old.ts"],
      dirty: ["src/keep.ts"],
    });
  });

  it("splits a rename into a deletion and an addition, and keeps unusual names byte-exact", async () => {
    sh(["mv", "src/old.ts", "src/new name ą.ts"]);
    commit("rename");
    const result = scopeSchema.parse(await json(["git", "scope", "main"]));
    expect(result.files).toEqual(["src/new name ą.ts"]);
    expect(result.deleted).toEqual(["src/old.ts"]);
  });

  it("has nothing to review when the anchor is HEAD", async () => {
    const result = scopeSchema.parse(await json(["git", "scope", "main"]));
    expect(result).toMatchObject({ files: [], binary: [], deleted: [], dirty: [] });
    const { stdout } = await bdk(["git", "groups", "main"]);
    expect(stdout).toContain("no changed text file, no group");
  });
});

describe("rounds", () => {
  it("records a round and starts the next one after it, ignoring a crashed round", async () => {
    commit("work", "src/auth/login.ts", "src/mail/send.ts");
    const review = join(root, "run", "review");
    const first = groupsSchema.parse(
      await json([
        "git",
        "groups",
        "main",
        "--rounds",
        review,
        "--record",
        join(review, "round-1"),
      ]),
    );
    const h1 = first.head;
    writeFileSync(join(review, "round-1", "review.md"), "# Round 1\n");
    commit("fix", "src/mail/send.ts");
    // A second round that crashed: a record, no report.
    await json(["git", "groups", "main", "--rounds", review, "--record", join(review, "round-2")]);

    const next = scopeSchema.parse(await json(["git", "scope", "main", "--rounds", review]));
    expect(next.anchor).toEqual({ kind: "round", sha: h1, round: 1 });
    expect(next.files).toEqual(["src/mail/send.ts"]);
    const { stdout } = await bdk(["git", "scope", "main", "--rounds", review]);
    expect(stdout).toMatch(/^range [0-9a-f]{7}\.\.[0-9a-f]{7}, since round 1\n/);
  });

  it("falls back to the merge base after a rebase rewrote the recorded head", async () => {
    commit("work", "src/a.ts");
    const review = join(root, "review");
    await json(["git", "groups", "main", "--record", join(review, "round-1")]);
    writeFileSync(join(review, "round-1", "review.md"), "");
    sh(["commit", "-q", "--amend", "-m", "work, amended"]);
    const result = scopeSchema.parse(await json(["git", "scope", "main", "--rounds", review]));
    expect(result.anchor.kind).toBe("base");
    expect(result.anchor.fallback).toMatch(
      /round 1 recorded [0-9a-f]{7}, which is not an ancestor of HEAD/,
    );
    expect(result.files).toEqual(["src/a.ts"]);
    const { stdout } = await bdk(["git", "scope", "main", "--rounds", review]);
    expect(stdout).toMatch(/\nfallback: round 1 recorded/);
  });
});

describe("bdk git groups", () => {
  it("follows the plan parts and gives the same output on the same state", async () => {
    commit("work", "src/auth/login.ts", "src/mail/send.ts", "src/util/date.ts");
    const parts = join(root, "plan", "parts");
    mkdirSync(parts, { recursive: true });
    writeFileSync(
      join(parts, "01.md"),
      '---\nid: "01"\nfiles:\n  - src/auth/login.ts\n---\n# Part\n',
    );
    writeFileSync(join(parts, "02.md"), '---\nid: "02"\nfiles: [src/mail/send.ts]\n---\n');
    const args = ["git", "groups", "main", "--plan", parts, "--max-files", "30"];
    const result = groupsSchema.parse(await json(args));
    expect(result.groups.map((g) => [g.id, g.files])).toEqual([
      ["p01", ["src/auth/login.ts"]],
      ["p02", ["src/mail/send.ts"]],
      ["unplanned", ["src/util/date.ts"]],
      ["integration", ["src/auth/login.ts", "src/mail/send.ts", "src/util/date.ts"]],
    ]);
    const [a, b] = [await bdk(args), await bdk(args)];
    expect(a).toEqual(b);
    expect(a.stdout).toContain("group p01 (part 01, 1 file)\n  src/auth/login.ts\n");
    expect(a.stdout.includes(String.fromCharCode(27))).toBe(false);
  });

  it("packs modules by the file target without a plan", async () => {
    commit("work", "a/x/1.ts", "a/x/2.ts", "b/y/1.ts", "c/z/1.ts");
    const result = groupsSchema.parse(await json(["git", "groups", "main", "--max-files", "2"]));
    expect(result.groups.map((g) => [g.id, g.files.length])).toEqual([
      ["m1", 2],
      ["m2", 2],
      ["integration", 4],
    ]);
  });
});

describe("errors", () => {
  it("reports an unknown base as usage/invalid-argument", async () => {
    const { code, stdout } = await bdk(["git", "scope", "no-such-branch", "--json"]);
    expect(code).toBe(2);
    const { error } = JSON.parse(stdout) as { error: { code: string; message: string } };
    expect(error.code).toBe("usage/invalid-argument");
    expect(error.message).toContain("no-such-branch");
  });

  it("reports a directory outside a work tree as env/not-a-repo", async () => {
    const outside = join(root, "outside");
    mkdirSync(outside);
    const { code, stdout, stderr } = await bdk(["git", "groups", "main"], outside);
    expect({ code, stdout }).toEqual({ code: 3, stdout: "" });
    expect(stderr).toMatch(/^bdk: .*not inside a git work tree\nhint: /);
  });

  it("reports a repository without commits as env/no-head", async () => {
    const empty = join(root, "empty");
    mkdirSync(empty);
    sh(["init", "-q"], empty);
    const { code, stdout } = await bdk(["git", "scope", "main", "--json"], empty);
    expect(code).toBe(3);
    expect(JSON.parse(stdout)).toMatchObject({ error: { code: "env/no-head" } });
  });

  it("reports an invalid plan part as env/plan-invalid and writes no record", async () => {
    commit("work", "src/a.ts");
    const parts = join(root, "parts");
    mkdirSync(parts);
    writeFileSync(join(parts, "03.md"), "---\nfiles: src/a.ts\n---\n");
    const record = join(root, "round-1");
    const { code, stdout } = await bdk([
      "git",
      "groups",
      "main",
      "--plan",
      parts,
      "--record",
      record,
      "--json",
    ]);
    expect(code).toBe(3);
    const { error } = JSON.parse(stdout) as { error: { code: string; message: string } };
    expect(error.code).toBe("env/plan-invalid");
    expect(error.message).toContain("03.md");
    expect(files.list(record)).toBeUndefined();
  });

  it("rejects a --max-files that is no positive integer", async () => {
    for (const value of ["0", "-3", "2.5", "x"]) {
      const { code, stdout } = await bdk([
        "git",
        "groups",
        "main",
        `--max-files=${value}`,
        "--json",
      ]);
      expect(code).toBe(2);
      expect(JSON.parse(stdout)).toMatchObject({ error: { code: "usage/invalid-argument" } });
    }
  });
});
