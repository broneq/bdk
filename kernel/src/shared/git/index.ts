// The git boundary. Work tree detection reads the file system instead of
// spawning `git`: `base.all` has no `runtime/git-missing`, so a command that
// never shells out must not fail because git is absent (design D-6).
import { execFile } from "node:child_process";
import { createHash } from "node:crypto";
import { existsSync, readFileSync, statSync } from "node:fs";
import { dirname, join, resolve } from "node:path";

import { KernelRefusal, refuse } from "../refusal/index.ts";
import type { Refusal } from "../refusal/index.ts";

export interface GitResult {
  readonly code: number;
  readonly stdout: string;
  readonly stderr: string;
}

export interface GitOptions {
  /** Only tests change it, to simulate a machine without git. */
  readonly executable?: string;
}

/**
 * The git operations the kernel needs, as a port: `main.ts` binds `systemGit`,
 * use-case tests a fake, so they run without a repository or a git binary.
 */
export interface Git {
  run(args: readonly string[], cwd: string): Promise<GitResult>;
  currentBranch(workTree: string): string | undefined;
}

/** The nearest directory from `cwd` up holding a `.git` directory or file. */
export function findWorkTree(cwd: string): string | undefined {
  for (let dir = resolve(cwd); ; dir = dirname(dir)) {
    if (existsSync(join(dir, ".git"))) return dir;
    if (dirname(dir) === dir) return undefined;
  }
}

/** Runs git; a non-zero exit is a result, a missing executable a refusal. */
export function runGit(
  args: readonly string[],
  cwd: string,
  options: GitOptions = {},
): Promise<GitResult> {
  return new Promise((done, fail) => {
    execFile(
      options.executable ?? "git",
      args,
      // A numstat of a large history exceeds the 1 MiB default.
      { cwd, encoding: "utf8", maxBuffer: 256 * 1024 * 1024 },
      (error, stdout, stderr) => {
        if (error !== null && "code" in error && error.code === "ENOENT") {
          fail(
            new KernelRefusal(
              refuse("runtime/git-missing", "no git executable on PATH", [
                "install git from https://git-scm.com/downloads",
                "bdk doctor",
              ]),
            ),
          );
          return;
        }
        done({
          code: typeof error?.code === "number" ? error.code : error === null ? 0 : 1,
          stdout,
          stderr,
        });
      },
    );
  });
}

/**
 * The branch `HEAD` points at, read from the git directory (no process; a
 * linked worktree's `.git` file is followed). Undefined for a detached `HEAD`
 * or when there is no `HEAD` file.
 */
export function currentBranch(workTree: string): string | undefined {
  let head: string;
  try {
    head = readFileSync(join(resolveGitDir(workTree), "HEAD"), "utf8");
  } catch {
    return undefined;
  }
  return /^ref: refs\/heads\/(.+?)\s*$/.exec(head)?.[1];
}

export const systemGit: Git = { run: (args, cwd) => runGit(args, cwd), currentBranch };

/**
 * `user.name <user.email>` as a commit would record it (`git var
 * GIT_AUTHOR_IDENT` without its timestamp and zone), or `unknown` when git has
 * no identity; a missing git is `runtime/git-missing` (design D-7 of T20).
 */
export async function authorIdent(git: Git, workTree: string): Promise<string> {
  const result = await git.run(["var", "GIT_AUTHOR_IDENT"], workTree);
  if (result.code !== 0) return "unknown";
  const ident = result.stdout.trim().replace(/\s+\d+\s+[+-]\d{4}$/, "");
  return ident === "" ? "unknown" : ident;
}

/**
 * sha256 of the committed tree of `HEAD` without `.bdk/`: `git ls-tree -r`
 * lines sorted by path, so ledger commits and uncommitted edits never change
 * it (the `review` kind's input, design D-4 of T21). Undefined before the
 * first commit; a missing git is `runtime/git-missing`.
 */
export async function codeTreeHash(git: Git, workTree: string): Promise<string | undefined> {
  const result = await git.run(["ls-tree", "-r", "-z", "HEAD"], workTree);
  if (result.code !== 0) return undefined;
  const lines = result.stdout
    .split("\0")
    .filter((line) => line !== "" && !line.split("\t")[1]?.startsWith(".bdk/"))
    .sort((a, b) => {
      const pa = a.split("\t")[1] ?? "";
      const pb = b.split("\t")[1] ?? "";
      return pa < pb ? -1 : pa > pb ? 1 : 0;
    });
  return `sha256:${createHash("sha256").update(lines.join("\n")).digest("hex")}`;
}

/**
 * The paths that differ from `HEAD` in the index or the working tree,
 * untracked files included and both sides of a rename, sorted; `pathspecs`
 * limits the listing. A missing git is `runtime/git-missing`.
 */
export async function changedPaths(
  git: Git,
  workTree: string,
  pathspecs: readonly string[] = [],
): Promise<string[]> {
  return (await statusEntries(git, workTree, pathspecs)).map((entry) => entry.path).sort();
}

/**
 * The paths the working tree changes, untracked files included: a path whose
 * whole change is staged is left out, because staging is the user's act on
 * the main thread (T3) and the kernel never sweeps it into its own work.
 */
export async function workTreePaths(git: Git, workTree: string): Promise<string[]> {
  return (await statusEntries(git, workTree, []))
    .filter((entry) => entry.worktree !== " ")
    .map((entry) => entry.path)
    .sort();
}

/**
 * Every file of the working tree git knows or would add: tracked files, a
 * deleted one included, and untracked files that are not ignored, sorted.
 * The tree hash finds build config here (`kernel-state`, Tree hash).
 */
export async function workTreeFiles(git: Git, workTree: string): Promise<string[]> {
  const result = await git.run(["ls-files", "-z", "-c", "-o", "--exclude-standard"], workTree);
  if (result.code !== 0) throw new Error(`git ls-files failed: ${result.stderr.trim()}`);
  return [...new Set(result.stdout.split("\0").filter((path) => path !== ""))].sort();
}

interface StatusEntry {
  readonly path: string;
  /** The `Y` column of `git status --porcelain=v1`: ` ` when the working tree matches the index. */
  readonly worktree: string;
}

async function statusEntries(
  git: Git,
  workTree: string,
  pathspecs: readonly string[],
): Promise<StatusEntry[]> {
  const result = await git.run(
    ["status", "--porcelain=v1", "-z", "--untracked-files=all", "--", ...pathspecs],
    workTree,
  );
  if (result.code !== 0) throw new Error(`git status failed: ${result.stderr.trim()}`);
  const fields = result.stdout.split("\0");
  const entries = new Map<string, StatusEntry>();
  for (let at = 0; at < fields.length; at += 1) {
    const field = fields[at] ?? "";
    if (field.length < 4) continue;
    const worktree = field[1] ?? " ";
    entries.set(field.slice(3), { path: field.slice(3), worktree });
    // A rename or copy is followed by its source path as a field of its own.
    if (/^[RC]|^.[RC]/.test(field)) {
      const source = fields[(at += 1)] ?? "";
      if (source !== "") entries.set(source, { path: source, worktree });
    }
  }
  return [...entries.values()];
}

export type PathspecCommit =
  | { readonly committed: true; readonly commit: string }
  | { readonly committed: false; readonly output: string };

/**
 * Stages `paths` and commits exactly them (`git commit --only`), so what the
 * user staged elsewhere stays staged and out of the commit. The user's hooks
 * run: a rejected commit answers `committed: false` with the first line the
 * hook printed, and `HEAD` is unchanged. A missing git is `runtime/git-missing`.
 */
export async function pathspecCommit(
  git: Git,
  workTree: string,
  paths: readonly string[],
  message: string,
): Promise<PathspecCommit> {
  const added = await git.run(["add", "-A", "--", ...paths], workTree);
  if (added.code !== 0) throw new Error(`git add failed: ${added.stderr.trim()}`);
  const paragraphs = message.split(/\n{2,}/).flatMap((paragraph) => ["-m", paragraph]);
  const committed = await git.run(
    ["commit", "--quiet", "--only", ...paragraphs, "--", ...paths],
    workTree,
  );
  if (committed.code !== 0) {
    const output = `${committed.stderr}\n${committed.stdout}`
      .split("\n")
      .map((line) => line.trim())
      .find((line) => line !== "");
    return { committed: false, output: output ?? `git commit exited ${String(committed.code)}` };
  }
  const head = await git.run(["rev-parse", "HEAD"], workTree);
  return { committed: true, commit: head.stdout.trim() };
}

/** The full commit id `HEAD` names; undefined in a repository without commits. */
export async function headCommit(git: Git, workTree: string): Promise<string | undefined> {
  const head = await git.run(["rev-parse", "--verify", "--quiet", "HEAD"], workTree);
  const commit = head.stdout.trim();
  return head.code === 0 && /^[0-9a-f]{40}$/.test(commit) ? commit : undefined;
}

/** A commit reachable from `HEAD` that carries `BDK-Change` of one Change. */
export interface TrailerCommit {
  readonly commit: string;
  readonly subject: string;
  readonly part?: string;
  readonly task?: string;
}

const TRAILER_FORMAT = [
  "%H",
  "%s",
  "%(trailers:key=BDK-Change,valueonly,separator=%x2c)",
  "%(trailers:key=BDK-Part,valueonly,separator=%x2c)",
  "%(trailers:key=BDK-Task,valueonly,separator=%x2c)",
].join("%x1f");

/**
 * The commits whose `BDK-Change` trailer names `change`, newest first, with
 * their `BDK-Part` and `BDK-Task` trailers (progress from git, V1-4). No
 * commits before the first one; a missing git is `runtime/git-missing`.
 */
export async function trailerCommits(
  git: Git,
  workTree: string,
  change: string,
): Promise<TrailerCommit[]> {
  const result = await git.run(
    [
      "log",
      "HEAD",
      "--fixed-strings",
      `--grep=BDK-Change: ${change}`,
      `--format=${TRAILER_FORMAT}%x1e`,
    ],
    workTree,
  );
  if (result.code !== 0) return [];
  const commits: TrailerCommit[] = [];
  for (const record of result.stdout.split("\x1e")) {
    const [commit = "", subject = "", changes = "", part = "", task = ""] = record
      .trim()
      .split("\x1f");
    if (commit === "" || !changes.split(",").some((value) => value.trim() === change)) continue;
    commits.push({
      commit,
      subject,
      ...(part.trim() === "" ? {} : { part: part.trim() }),
      ...(task.trim() === "" ? {} : { task: task.trim() }),
    });
  }
  return commits;
}

const IN_PROGRESS = [
  ["rebase-merge", "rebase"],
  ["rebase-apply", "rebase"],
  ["MERGE_HEAD", "merge"],
  ["CHERRY_PICK_HEAD", "cherry-pick"],
] as const;

const INSTEAD: Record<(typeof IN_PROGRESS)[number][1], readonly [string, string]> = {
  rebase: ["git rebase --continue", "git rebase --abort"],
  merge: ["git commit to finish the merge", "git merge --abort"],
  "cherry-pick": ["git cherry-pick --continue", "git cherry-pick --abort"],
};

/** `policy/git-in-progress` when a rebase, merge or cherry-pick is unfinished (V1-4). */
export function gitInProgress(workTree: string): Refusal | undefined {
  const gitDir = resolveGitDir(workTree);
  for (const [marker, operation] of IN_PROGRESS) {
    if (existsSync(join(gitDir, marker))) {
      return refuse(
        "policy/git-in-progress",
        `a ${operation} is in progress in ${workTree}`,
        INSTEAD[operation],
      );
    }
  }
  return undefined;
}

function resolveGitDir(workTree: string): string {
  const dotGit = join(workTree, ".git");
  if (statSync(dotGit, { throwIfNoEntry: false })?.isFile() !== true) return dotGit;
  const pointer = /^gitdir:\s*(.+?)\s*$/m.exec(readFileSync(dotGit, "utf8"))?.[1];
  return pointer === undefined ? dotGit : resolve(workTree, pointer);
}
