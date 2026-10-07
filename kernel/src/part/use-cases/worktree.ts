// The kernel-owned worktree of a part with `isolation: worktree`
// (`kernel-state`, Part worktree; `kernel-cli/part`, bdk part start; T45
// design D2, D7, D10): created from the home checkout's `HEAD`, marked with
// its home, filled with the `.worktreeinclude` files and set up with a time
// bound. Any failure removes what was made, so no half worktree survives.
import { isAbsolute, join, relative } from "node:path";

import { executionWorktreeModule } from "../../graph/index.ts";
import { moduleValue } from "../../shared/config/index.ts";
import {
  addWorktree,
  changedPaths,
  commitTree,
  fastForward,
  gitVersion,
  includedFiles,
  isIgnored,
  mergeCommit,
  mergeInProgress,
  mergeNoCommit,
  mergeTree,
  MIN_GIT,
  removeWorktree,
  resolveCommit,
  runSetup,
  supportsMergeTree,
  unmergedPaths,
} from "../../shared/git/index.ts";
import { refuse } from "../../shared/refusal/index.ts";
import type { Refusal } from "../../shared/refusal/index.ts";
import type { ActiveChange } from "../../shared/registry/index.ts";
import type { Git } from "../../shared/git/index.ts";
import { appendEntry } from "../../log/index.ts";
import {
  firstMatch,
  partBranch,
  partWorktree,
  processLockWait,
  withLock,
  writeHomeMarker,
} from "../../shared/store/index.ts";
import type { IndexDb, PlanPartFile } from "../../shared/store/index.ts";
import type { PartDeps } from "./deps.ts";

export type WorktreeSettings = ReturnType<typeof worktreeSettings>;

export function worktreeSettings(resolved: Readonly<Record<string, unknown>>) {
  return moduleValue(executionWorktreeModule, resolved);
}

interface SetupRecord {
  readonly command: string;
  readonly exitCode: number;
  readonly durationMs: number;
  readonly tail: readonly string[];
}

export interface CreatedWorktree {
  readonly workdir: string;
  readonly branch: string;
  readonly setup?: SetupRecord;
}

/** `<dir>/<change id>/<part>`, `dir` against the home project root unless absolute. */
export function worktreeDir(
  settings: WorktreeSettings,
  change: { readonly id: string; readonly projectRoot: string },
  part: string,
): string {
  const base = isAbsolute(settings.dir) ? settings.dir : join(change.projectRoot, settings.dir);
  return join(base, change.id, part);
}

export async function createWorktree(
  deps: PartDeps,
  change: ActiveChange,
  part: string,
  settings: WorktreeSettings,
): Promise<CreatedWorktree | Refusal> {
  const home = change.projectRoot;
  const version = await gitVersion(deps.git, home);
  if (version === undefined || !supportsMergeTree(version)) {
    return refuse(
      "runtime/git-too-old",
      `a worktree part needs git merge-tree --write-tree, git ${MIN_GIT.slice(0, 2).join(".")} or later; this git is ${version?.join(".") ?? "unknown"}`,
      ["upgrade git from https://git-scm.com/downloads", "set execution.worktree.enabled: false"],
    );
  }
  const workdir = worktreeDir(settings, change, part);
  const inside = relative(home, workdir);
  if (
    !inside.startsWith("..") &&
    !isAbsolute(inside) &&
    !(await isIgnored(deps.git, home, inside))
  ) {
    return refuse(
      "policy/config-invalid",
      `execution.worktree.dir ${settings.dir} lies inside the repository and git does not ignore ${inside}`,
      [
        `add ${settings.dir}/ to .gitignore`,
        "bdk config set execution.worktree.dir <ignored path>",
      ],
    );
  }
  const branch = partBranch(change.id, part);
  if (deps.store.exists(workdir) || (await resolveCommit(deps.git, home, branch)) !== undefined) {
    await removeWorktree(deps.git, home, workdir, branch);
  }
  const added = await addWorktree(deps.git, home, workdir, branch);
  if (!added.ok) {
    await removeWorktree(deps.git, home, workdir, branch);
    return setupFailed(`git worktree add ${workdir}`, added.output.split("\n"), part);
  }
  const filled = await fillWorktree(deps, change, workdir, settings);
  if ("failed" in filled) {
    await removeWorktree(deps.git, home, workdir, branch);
    return setupFailed(filled.failed, filled.tail, part);
  }
  return { workdir, branch, ...filled };
}

type Filled =
  { readonly setup?: SetupRecord } | { readonly failed: string; readonly tail: readonly string[] };

/**
 * What a new or recreated worktree gets after `git worktree add`: the home
 * marker, the `.worktreeinclude` copy and the bounded setup command.
 */
export async function fillWorktree(
  deps: PartDeps,
  change: { readonly id: string; readonly projectRoot: string },
  workdir: string,
  settings: WorktreeSettings,
): Promise<Filled> {
  const home = change.projectRoot;
  writeHomeMarker(deps.store, workdir, home, change.id);
  const include = join(home, ".worktreeinclude");
  const copied = deps.store.exists(include) ? await includedFiles(deps.git, home, include) : [];
  for (const path of copied) {
    const bytes = deps.store.readBytes(join(home, path));
    if (bytes !== undefined) deps.store.writeBytes(join(workdir, path), bytes);
  }
  const command = settings.setup.command;
  if (command === undefined) return {};
  const run = await runSetup(command, workdir, settings.setup.timeout * 1000);
  if (run.exitCode !== 0) {
    const how = run.timedOut
      ? `timed out after ${String(settings.setup.timeout)} s`
      : `exited ${String(run.exitCode ?? "without a code")}`;
    return { failed: `${command} ${how}`, tail: run.tail };
  }
  return { setup: { command, exitCode: 0, durationMs: run.durationMs, tail: run.tail } };
}

function setupFailed(what: string, tail: readonly string[], part: string): Refusal {
  const lines = tail.filter((line) => line.trim() !== "").slice(-20);
  return refuse(
    "runtime/worktree-setup-failed",
    `the worktree setup of part ${part} failed: ${what}${lines.length === 0 ? "" : `; output:\n${lines.join("\n")}`}`,
    [
      `fix execution.worktree.setup, then bdk part start ${part}`,
      "set execution.worktree.enabled: false",
    ],
  );
}

/** The start marker body of a worktree part: `workdir` and the setup that ran. */
export function startMarkerBody(created: CreatedWorktree): string {
  const lines = [`workdir: ${created.workdir}`];
  if (created.setup !== undefined) {
    lines.push(
      `setup: ${created.setup.command}`,
      `exit-code: ${String(created.setup.exitCode)}`,
      `duration-ms: ${String(created.setup.durationMs)}`,
    );
    if (created.setup.tail.length > 0) lines.push("", ...created.setup.tail);
  }
  return `${lines.join("\n")}\n`;
}

export interface MergedPart {
  /** The merge commit's short SHA. */
  readonly merge: string;
  /** Leftover paths of the worktree no task declares, dropped with it. */
  readonly discarded: readonly string[];
}

/**
 * Merges a live worktree part back into the Change branch and removes the
 * worktree (`kernel-cli/part`, bdk part done, steps 1 to 5 but the done
 * marker): computed off-tree, written as a merge commit, moved with a
 * fast-forward under the commit lock, so a refusal leaves home and worktree
 * as they were.
 */
export async function mergeBack(
  deps: PartDeps,
  change: ActiveChange,
  index: IndexDb,
  part: PlanPartFile,
  workdir: string,
): Promise<MergedPart | Refusal> {
  const lock = join(change.projectRoot, ".bdk", ".machine", "commit.lock");
  const result = await withLock(deps.store, lock, `part ${part.id}`, processLockWait(), () =>
    mergeLocked(deps, change, index, part, workdir),
  );
  if (!("busy" in result)) return result;
  const { pid, owner, at } = result.busy;
  return refuse(
    "policy/commit-busy",
    `process ${String(pid)} has held .bdk/.machine/commit.lock for ${owner} since ${at}`,
    [`bdk part done ${part.id}`],
  );
}

async function mergeLocked(
  deps: PartDeps,
  change: ActiveChange,
  index: IndexDb,
  part: PlanPartFile,
  workdir: string,
): Promise<MergedPart | Refusal> {
  const home = change.projectRoot;
  const branch = partBranch(change.id, part.id);
  const declared = part.tasks.flatMap((task) => task.files.map((file) => file.path));
  const changed = await changedPaths(deps.git, workdir);
  const dirty = changed.filter((path) => firstMatch(declared, path) !== undefined);
  if (dirty.length > 0) {
    return refuse(
      "policy/worktree-dirty",
      `the worktree of part ${part.id} still changes ${dirty.join(", ")}, which its tasks declare`,
      [
        `commit the task with the command bdk check run <task> prints, or restore ${dirty.join(" ")} in ${workdir}`,
      ],
    );
  }
  const discarded = changed.filter((path) => !dirty.includes(path));
  const tip = await resolveCommit(deps.git, home, branch);
  const head = await resolveCommit(deps.git, home, "HEAD");
  if (tip === undefined || head === undefined) {
    throw new Error(`part ${part.id}: ${branch} or HEAD names no commit`);
  }
  const merged = await isAncestor(deps.git, home, tip, head);
  let commit = head;
  if (!merged) {
    const tree = await mergeTree(deps.git, home, head, tip);
    if (!tree.clean) {
      return refuse(
        "policy/merge-conflict",
        `merging part ${part.id} into ${change.branch} conflicts in ${tree.conflicts.join(", ")}`,
        [`bdk attempt open verify-fix ${part.id}`],
      );
    }
    commit = await commitTree(
      deps.git,
      home,
      tree.tree,
      [head, tip],
      `chore(bdk): merge part ${part.id} of ${change.id}\n\nBDK-Change: ${change.id}\nBDK-Part: ${part.id}`,
    );
    const moved = await fastForward(deps.git, home, commit);
    if (!moved.ok) {
      return refuse(
        "policy/merge-blocked",
        `merging part ${part.id} would overwrite ${moved.paths.join(", ")}, changed in the home working tree`,
        [`commit the task that changes ${moved.paths.join(", ")}, then bdk part done ${part.id}`],
      );
    }
  }
  if (discarded.length > 0) {
    const written = await appendEntry(
      deps,
      change,
      index,
      {
        type: "finding",
        summary: `part ${part.id} left ${discarded.join(", ")} in its worktree; dropped at merge`,
        status: "proposed",
        refs: [`execute-part:${part.id}`, ...discarded],
        body: `The worktree ${workdir} still changed these paths when part ${part.id} merged back; no task declares them, so they were removed with the worktree:\n\n${discarded.map((path) => `- ${path}`).join("\n")}\n`,
      },
      { dedupe: true },
    );
    if ("refused" in written) return written;
  }
  await removeWorktree(deps.git, home, workdir, branch);
  return { merge: commit.slice(0, 7), discarded };
}

export async function isAncestor(
  git: Git,
  cwd: string,
  commit: string,
  of: string,
): Promise<boolean> {
  return (await git.run(["merge-base", "--is-ancestor", commit, of], cwd)).code === 0;
}

export interface MergeTicket {
  readonly workdir: string;
  /** The paths git reports unmerged in the worktree. */
  readonly conflicts: readonly string[];
}

/**
 * Starts the merge of a merge ticket (`kernel-cli/attempt`, bdk attempt open;
 * T45 design D6): for a live worktree part whose merge back conflicts, merges
 * the Change branch into the worktree without committing, so the markers stay
 * there. A merge still in progress from an earlier ticket is kept. Undefined
 * when the part has no worktree or its merge back is clean.
 */
export async function openMergeTicket(
  deps: PartDeps,
  change: ActiveChange,
  part: string,
): Promise<MergeTicket | undefined> {
  const workdir = await partWorktree(deps.git, deps.store, change, part);
  if (workdir === undefined) return undefined;
  if (await mergeInProgress(deps.git, workdir)) {
    return { workdir, conflicts: await stillConflicting(deps.git, workdir) };
  }
  const home = change.projectRoot;
  const tip = await resolveCommit(deps.git, home, partBranch(change.id, part));
  const head = await resolveCommit(deps.git, home, "HEAD");
  if (tip === undefined || head === undefined) return undefined;
  if (await isAncestor(deps.git, home, tip, head)) return undefined;
  if ((await mergeTree(deps.git, home, head, tip)).clean) return undefined;
  await mergeNoCommit(deps.git, workdir, change.branch);
  return { workdir, conflicts: await stillConflicting(deps.git, workdir) };
}

/** The unmerged paths, or the merge's conflicting paths once none is unmerged. */
async function stillConflicting(git: Git, workdir: string): Promise<string[]> {
  const unmerged = await unmergedPaths(git, workdir);
  if (unmerged.length > 0) return unmerged;
  const merged = await mergeTree(git, workdir, "HEAD", "MERGE_HEAD");
  return merged.clean ? [] : [...merged.conflicts];
}

const MARKER = /^(?:<{7} |={7}$|>{7} )/m;

/**
 * The first check of a merge ticket closed `ok` (`kernel-cli/attempt`, bdk
 * attempt close): `policy/merge-unresolved` while a conflicted path still
 * holds a marker line or git reports a new unmerged path. Undefined when the
 * merge is resolved or none is in progress.
 */
export async function unresolvedMerge(
  deps: PartDeps,
  change: ActiveChange,
  part: string,
  conflicts: readonly string[],
): Promise<Refusal | undefined> {
  const workdir = await partWorktree(deps.git, deps.store, change, part);
  if (workdir === undefined || !(await mergeInProgress(deps.git, workdir))) return undefined;
  const marked = conflicts.filter((path) =>
    MARKER.test(deps.store.read(join(workdir, path)) ?? ""),
  );
  const unmerged = (await unmergedPaths(deps.git, workdir)).filter(
    (path) => !conflicts.includes(path),
  );
  const unresolved = [...new Set([...marked, ...unmerged])].sort();
  if (unresolved.length === 0) return undefined;
  return refuse(
    "policy/merge-unresolved",
    `the merge in the worktree of part ${part} still has conflicts in ${unresolved.join(", ")}`,
    [`resolve ${unresolved.join(" ")} in ${workdir}, then close the ticket again`],
  );
}

/**
 * The last step of a merge ticket closed `ok`: stages the conflicted and
 * declared paths and commits the merge on the part branch, a part merge
 * commit (`kernel-loops`, Progress from git).
 */
export async function commitMergeTicket(
  deps: PartDeps,
  change: ActiveChange,
  part: string,
  paths: readonly string[],
): Promise<Refusal | undefined> {
  const workdir = await partWorktree(deps.git, deps.store, change, part);
  if (workdir === undefined || !(await mergeInProgress(deps.git, workdir))) return undefined;
  const committed = await mergeCommit(
    deps.git,
    workdir,
    [...new Set(paths)].sort(),
    `chore(bdk): merge ${change.branch} into part ${part}\n\nBDK-Change: ${change.id}\nBDK-Part: ${part}`,
  );
  if (committed.committed) return undefined;
  return refuse(
    "policy/git-hook-failed",
    `a git hook rejected the merge commit of part ${part}: ${committed.output}`,
    [`fix what the hook reports, then close the ticket again`],
  );
}
