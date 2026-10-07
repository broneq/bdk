// The git operations of a kernel-owned part worktree (`kernel-state`, Part
// worktree; T45 design D2, D5, D10). Every merge back is computed off-tree
// with `git merge-tree --write-tree` (git 2.38), so no working tree changes
// until the home checkout fast-forwards.
import { runCommand, tailLines } from "./run.ts";
import type { Git } from "./index.ts";

export type GitVersion = readonly [number, number, number];

/** The oldest git whose `merge-tree --write-tree` the merge back relies on. */
export const MIN_GIT: GitVersion = [2, 38, 0];

/** `git --version` as three numbers; undefined when git prints something else. */
export async function gitVersion(git: Git, cwd: string): Promise<GitVersion | undefined> {
  const result = await git.run(["--version"], cwd);
  const match = /git version (\d+)\.(\d+)(?:\.(\d+))?/.exec(result.stdout);
  if (result.code !== 0 || match === null) return undefined;
  return [Number(match[1]), Number(match[2]), Number(match[3] ?? "0")];
}

export function supportsMergeTree(version: GitVersion): boolean {
  for (let at = 0; at < MIN_GIT.length; at += 1) {
    const have = version[at] ?? 0;
    const need = MIN_GIT[at] ?? 0;
    if (have !== need) return have > need;
  }
  return true;
}

export type GitStep = { readonly ok: true } | { readonly ok: false; readonly output: string };

function step(result: { code: number; stdout: string; stderr: string }): GitStep {
  if (result.code === 0) return { ok: true };
  const output = `${result.stderr}\n${result.stdout}`.trim();
  return { ok: false, output: output === "" ? `git exited ${String(result.code)}` : output };
}

/** `git worktree add -b <branch> <dir> HEAD`, run in the home checkout. */
export async function addWorktree(
  git: Git,
  home: string,
  dir: string,
  branch: string,
): Promise<GitStep> {
  return step(await git.run(["worktree", "add", "--quiet", "-b", branch, dir, "HEAD"], home));
}

/** `git worktree add <dir> <branch>` for a branch that exists (rebuild recovery). */
export async function checkoutWorktree(
  git: Git,
  home: string,
  dir: string,
  branch: string,
): Promise<GitStep> {
  return step(await git.run(["worktree", "add", "--quiet", dir, branch], home));
}

/**
 * Removes the worktree, its leftovers included, and deletes its branch; a
 * directory already gone is pruned from git's list instead.
 */
export async function removeWorktree(
  git: Git,
  home: string,
  dir: string,
  branch: string | undefined,
): Promise<void> {
  const removed = await git.run(["worktree", "remove", "--force", "--force", dir], home);
  if (removed.code !== 0) await git.run(["worktree", "prune"], home);
  if (branch !== undefined) await git.run(["branch", "--quiet", "-D", branch], home);
}

export interface WorktreeEntry {
  readonly path: string;
  readonly head?: string;
  /** The short branch name; absent for a detached worktree. */
  readonly branch?: string;
}

/** `git worktree list --porcelain`, the home checkout first. */
export async function listWorktrees(git: Git, home: string): Promise<WorktreeEntry[]> {
  const result = await git.run(["worktree", "list", "--porcelain", "-z"], home);
  if (result.code !== 0) return [];
  const entries: WorktreeEntry[] = [];
  let current: { path: string; head?: string; branch?: string } | undefined;
  for (const field of result.stdout.split("\0")) {
    if (field === "") {
      if (current !== undefined) entries.push(current);
      current = undefined;
    } else if (field.startsWith("worktree ")) current = { path: field.slice(9) };
    else if (current !== undefined && field.startsWith("HEAD ")) current.head = field.slice(5);
    else if (current !== undefined && field.startsWith("branch refs/heads/")) {
      current.branch = field.slice(18);
    }
  }
  if (current !== undefined) entries.push(current);
  return entries;
}

export type MergeTree =
  | { readonly clean: true; readonly tree: string }
  | { readonly clean: false; readonly conflicts: readonly string[] };

/** `git merge-tree --write-tree <ours> <theirs>`: the merged tree or the conflicting paths. */
export async function mergeTree(
  git: Git,
  cwd: string,
  ours: string,
  theirs: string,
): Promise<MergeTree> {
  const result = await git.run(
    ["merge-tree", "--write-tree", "-z", "--name-only", "--no-messages", ours, theirs],
    cwd,
  );
  const [tree = "", ...paths] = result.stdout.split("\0").filter((field) => field !== "");
  if (result.code === 0 && /^[0-9a-f]{40,64}$/.test(tree)) return { clean: true, tree };
  if (result.code === 1) return { clean: false, conflicts: [...new Set(paths)].sort() };
  throw new Error(`git merge-tree failed: ${result.stderr.trim()}`);
}

/** `git commit-tree` with the parents in order; answers the new commit's id. */
export async function commitTree(
  git: Git,
  cwd: string,
  tree: string,
  parents: readonly string[],
  message: string,
): Promise<string> {
  const paragraphs = message.split(/\n{2,}/).flatMap((paragraph) => ["-m", paragraph]);
  const result = await git.run(
    ["commit-tree", tree, ...parents.flatMap((parent) => ["-p", parent]), ...paragraphs],
    cwd,
  );
  const sha = result.stdout.trim();
  if (result.code !== 0 || !/^[0-9a-f]{40,64}$/.test(sha)) {
    throw new Error(`git commit-tree failed: ${result.stderr.trim()}`);
  }
  return sha;
}

export type FastForward = { readonly ok: true } | { readonly ok: false; readonly paths: string[] };

/**
 * `git merge --ff-only <commit>` in the home checkout; a dirty path the merge
 * would overwrite answers its paths and leaves `HEAD` and the tree as they were.
 */
export async function fastForward(git: Git, home: string, commit: string): Promise<FastForward> {
  const result = await git.run(["merge", "--ff-only", "--quiet", commit], home);
  if (result.code === 0) return { ok: true };
  const paths = `${result.stderr}\n${result.stdout}`
    .split("\n")
    .filter((line) => line.startsWith("\t"))
    .map((line) => line.trim())
    .filter((line) => line !== "");
  if (paths.length === 0) throw new Error(`git merge --ff-only failed: ${result.stderr.trim()}`);
  return { ok: false, paths: [...new Set(paths)].sort() };
}

/**
 * `git merge --no-commit --no-ff <ref>` in a worktree; a conflict is the
 * expected result (exit 1), anything else is an error.
 */
export async function mergeNoCommit(git: Git, workTree: string, ref: string): Promise<void> {
  const result = await git.run(["merge", "--no-commit", "--no-ff", "--quiet", ref], workTree);
  if (result.code !== 0 && result.code !== 1) {
    throw new Error(`git merge failed: ${result.stderr.trim()}`);
  }
}

/** The paths git reports unmerged in the index, sorted. */
export async function unmergedPaths(git: Git, workTree: string): Promise<string[]> {
  const result = await git.run(["diff", "--name-only", "-z", "--diff-filter=U"], workTree);
  if (result.code !== 0) throw new Error(`git diff failed: ${result.stderr.trim()}`);
  return [...new Set(result.stdout.split("\0").filter((path) => path !== ""))].sort();
}

/** Whether git ignores `path` in the work tree `cwd` (`git check-ignore`). */
export async function isIgnored(git: Git, cwd: string, path: string): Promise<boolean> {
  const result = await git.run(["check-ignore", "--quiet", "--no-index", "--", path], cwd);
  return result.code === 0;
}

/**
 * The files to copy into a new worktree: untracked files that match a
 * pattern of `.worktreeinclude` and that git ignores, sorted. Without the file
 * none are copied.
 */
export async function includedFiles(
  git: Git,
  home: string,
  includeFile: string,
): Promise<string[]> {
  const listed = async (exclude: readonly string[]) => {
    const result = await git.run(["ls-files", "-z", "--others", "--ignored", ...exclude], home);
    if (result.code !== 0) throw new Error(`git ls-files failed: ${result.stderr.trim()}`);
    return result.stdout.split("\0").filter((path) => path !== "");
  };
  const matching = await listed([`--exclude-from=${includeFile}`]);
  if (matching.length === 0) return [];
  const ignored = new Set(await listed(["--exclude-standard"]));
  return matching.filter((path) => ignored.has(path)).sort();
}

export interface SetupRun {
  readonly exitCode: number | undefined;
  readonly timedOut: boolean;
  readonly durationMs: number;
  /** The last lines of stdout and stderr together. */
  readonly tail: readonly string[];
}

const TAIL_LINES = 20;

/**
 * Runs the worktree setup command through the shell in `cwd`, bounded by
 * `timeoutMs`; a command still running at the bound is killed with its
 * process group (`execution.worktree.setup`, T45).
 */
export async function runSetup(command: string, cwd: string, timeoutMs: number): Promise<SetupRun> {
  const run = await runCommand(command, cwd, timeoutMs);
  return {
    exitCode: run.exitCode,
    timedOut: run.timedOut,
    durationMs: run.durationMs,
    tail: tailLines(run.output, TAIL_LINES),
  };
}

/** Whether a merge is in progress in `workTree` (`MERGE_HEAD` exists). */
export async function mergeInProgress(git: Git, workTree: string): Promise<boolean> {
  const result = await git.run(["rev-parse", "--quiet", "--verify", "MERGE_HEAD"], workTree);
  return result.code === 0;
}

/** The paths of `paths` whose working-tree content differs from `ref`, sorted. */
export async function differFrom(
  git: Git,
  workTree: string,
  ref: string,
  paths: readonly string[],
): Promise<string[]> {
  if (paths.length === 0) return [];
  const result = await git.run(
    ["diff", "--name-only", "-z", "--no-ext-diff", ref, "--", ...paths],
    workTree,
  );
  if (result.code !== 0) throw new Error(`git diff failed: ${result.stderr.trim()}`);
  return [...new Set(result.stdout.split("\0").filter((path) => path !== ""))].sort();
}

export type MergeCommit =
  | { readonly committed: true; readonly commit: string }
  | { readonly committed: false; readonly output: string };

/**
 * Stages `paths` and concludes the merge in progress in `workTree` with
 * `message`; the user's hooks run, and a rejection leaves the merge in
 * progress. A merge commits the whole index, so `--only` cannot apply.
 */
export async function mergeCommit(
  git: Git,
  workTree: string,
  paths: readonly string[],
  message: string,
): Promise<MergeCommit> {
  if (paths.length > 0) {
    const added = await git.run(["add", "-A", "--", ...paths], workTree);
    if (added.code !== 0) throw new Error(`git add failed: ${added.stderr.trim()}`);
  }
  const paragraphs = message.split(/\n{2,}/).flatMap((paragraph) => ["-m", paragraph]);
  const committed = await git.run(["commit", "--quiet", ...paragraphs], workTree);
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
