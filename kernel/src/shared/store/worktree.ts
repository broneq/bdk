// The home of a kernel part worktree and the work root of a target
// (`kernel-state`, Part worktree; T45 design D3, D4). A worktree's git
// directory holds `bdk-home`, naming the home checkout and the Change, so a
// command run inside it reads and writes the one ledger of the home checkout.
// Liveness comes from git itself: a part is live while a worktree on its
// branch exists, and `part done` removes it before the done marker.
import { dirname, join, resolve } from "node:path";

import type { Git } from "../git/index.ts";
import { listWorktrees } from "../git/index.ts";
import type { Store } from "./store.ts";

export const HOME_MARKER = "bdk-home";

/** `bdk-part/<change id>/<part id>`. */
export function partBranch(change: string, part: string): string {
  return `bdk-part/${change}/${part}`;
}

/** A linked worktree's own git directory, read through the store (`.git` is a `gitdir:` file there). */
export function gitDirIn(store: Store, workTree: string): string {
  const dotGit = join(workTree, ".git");
  if (store.isDirectory(dotGit)) return dotGit;
  const pointer = /^gitdir:\s*(.+?)\s*$/m.exec(store.read(dotGit) ?? "")?.[1];
  return pointer === undefined ? dotGit : resolve(workTree, pointer);
}

export function homeMarkerPath(store: Store, workTree: string): string {
  return join(gitDirIn(store, workTree), HOME_MARKER);
}

export interface HomeMarker {
  readonly home: string;
  readonly change: string;
}

export function writeHomeMarker(
  store: Store,
  workTree: string,
  home: string,
  change: string,
): void {
  store.write(homeMarkerPath(store, workTree), `${home}\n${change}\n`);
}

/** The marker of a kernel worktree; undefined in the home checkout or a worktree the user made. */
export function readHomeMarker(store: Store, workTree: string): HomeMarker | undefined {
  const dotGit = join(workTree, ".git");
  if (store.isDirectory(dotGit) || !store.exists(dotGit)) return undefined;
  const [home = "", change = ""] = (store.read(homeMarkerPath(store, workTree)) ?? "")
    .split("\n")
    .map((line) => line.trim());
  return home === "" || change === "" ? undefined : { home, change };
}

/**
 * Whether the marker's home is still a work tree of the worktree's repository:
 * the worktree's git directory sits in `<home>/.git/worktrees/`.
 */
export function homeIsValid(store: Store, workTree: string, marker: HomeMarker): boolean {
  const common = join(marker.home, ".git");
  return (
    store.isDirectory(common) && dirname(dirname(gitDirIn(store, workTree))) === resolve(common)
  );
}

export interface KernelWorktree {
  readonly change: string;
  readonly part: string;
  readonly path: string;
}

/** Every kernel worktree of the project that still exists, any Change (`execution.worktree.max-live`). */
export async function kernelWorktrees(
  git: Git,
  store: Store,
  home: string,
): Promise<KernelWorktree[]> {
  const found: KernelWorktree[] = [];
  for (const entry of await listWorktrees(git, home)) {
    const match = /^bdk-part\/(.+)\/(\d{2})$/.exec(entry.branch ?? "");
    if (match === null || !store.isDirectory(entry.path)) continue;
    found.push({ change: match[1] ?? "", part: match[2] ?? "", path: entry.path });
  }
  return found;
}

/** The directory of the live worktree of a part; undefined when none exists. */
export async function partWorktree(
  git: Git,
  store: Store,
  change: { readonly id: string; readonly projectRoot: string },
  part: string,
): Promise<string | undefined> {
  const branch = partBranch(change.id, part);
  const found = (await listWorktrees(git, change.projectRoot)).find(
    (entry) => entry.branch === branch,
  );
  return found !== undefined && store.isDirectory(found.path) ? found.path : undefined;
}

interface PartTasks {
  readonly id: string;
  readonly tasks: readonly { readonly id: string }[];
  /** A part whose frontmatter is known: only `isolation: worktree` has a worktree. */
  readonly data?: { readonly isolation?: string | undefined };
}

/** The part holding a task or part target; undefined for any other target. */
function holder(parts: readonly PartTasks[], target: string): PartTasks | undefined {
  return (
    parts.find((found) => found.id === target) ??
    parts.find((found) => found.tasks.some((task) => task.id === target))
  );
}

/** Whether the part may have a worktree; a part without its frontmatter is asked of git. */
function mayBeIsolated(part: PartTasks): boolean {
  return part.data === undefined || part.data.isolation === "worktree";
}

/**
 * The work root of a target: the part's worktree for a task or part of a live
 * worktree part, the home checkout for every other target. A `shared` part
 * costs no git call.
 */
export async function workRootOf(
  git: Git,
  store: Store,
  change: { readonly id: string; readonly projectRoot: string },
  parts: readonly PartTasks[],
  target: string,
): Promise<string> {
  const part = holder(parts, target);
  if (part === undefined || !mayBeIsolated(part)) return change.projectRoot;
  return (await partWorktree(git, store, change, part.id)) ?? change.projectRoot;
}

/**
 * The work root of every target through one worktree listing: what
 * `workRootOf` answers, for the many targets of one graph read.
 */
export async function workRoots(
  git: Git,
  store: Store,
  change: { readonly id: string; readonly projectRoot: string },
  parts: readonly PartTasks[],
): Promise<(target: string) => string> {
  if (!parts.some(mayBeIsolated)) return () => change.projectRoot;
  const live = new Map<string, string>();
  const prefix = partBranch(change.id, "");
  for (const entry of await listWorktrees(git, change.projectRoot)) {
    if (entry.branch?.startsWith(prefix) === true && store.isDirectory(entry.path)) {
      live.set(entry.branch.slice(prefix.length), entry.path);
    }
  }
  return (target) => {
    const part = holder(parts, target);
    if (part === undefined || !mayBeIsolated(part)) return change.projectRoot;
    return live.get(part.id) ?? change.projectRoot;
  };
}
