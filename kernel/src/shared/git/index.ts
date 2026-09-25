// The git boundary. Work tree detection reads the file system instead of
// spawning `git`: `base.all` has no `runtime/git-missing`, so a command that
// never shells out must not fail because git is absent (design D-6).
import { execFile } from "node:child_process";
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
      { cwd, encoding: "utf8" },
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
