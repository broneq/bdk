// Change directory paths, branch markers and the active-Change resolution
// (`kernel-state`, Branch binding). Only `shared/store` builds these paths.
import { join, resolve } from "node:path";

import type { Git } from "../git/index.ts";
import { isChangeId } from "../ids/index.ts";
import { refuse } from "../refusal/index.ts";
import type { Refusal } from "../refusal/index.ts";
import type { ActiveChange } from "../registry/index.ts";
import { findProjectRoot } from "./store.ts";
import type { Store } from "./store.ts";
import { readHomeMarker } from "./worktree.ts";

export interface ChangeLocation {
  readonly id: string;
  /** Absolute path of the Change directory. */
  readonly dir: string;
  readonly archived: boolean;
}

function changesDir(projectRoot: string): string {
  return join(projectRoot, ".bdk", "changes");
}

function archiveDir(projectRoot: string): string {
  return join(changesDir(projectRoot), "archive");
}

/** Where `change close` moves a Change. */
export function archivedChangeDir(projectRoot: string, id: string): string {
  return join(archiveDir(projectRoot), id);
}

/** Where `change new` creates a Change. */
export function liveChangeDir(projectRoot: string, id: string): string {
  return join(changesDir(projectRoot), id);
}

/** Every Change directory holding a `change.md`, live ones first, each group by id. */
export function listChangeDirs(store: Store, projectRoot: string): ChangeLocation[] {
  const found = (parent: string, archived: boolean): ChangeLocation[] =>
    store
      .list(parent)
      .filter((name) => name.endsWith("/"))
      .map((name) => name.slice(0, -1))
      .filter((id) => isChangeId(id) && store.exists(join(parent, id, "change.md")))
      .map((id) => ({ id, dir: join(parent, id), archived }));
  return [...found(changesDir(projectRoot), false), ...found(archiveDir(projectRoot), true)];
}

/** The Change `id`, live or archived, or undefined. */
export function findChange(
  store: Store,
  projectRoot: string,
  id: string,
): ChangeLocation | undefined {
  if (!isChangeId(id)) return undefined;
  for (const [dir, archived] of [
    [liveChangeDir(projectRoot, id), false],
    [join(archiveDir(projectRoot), id), true],
  ] as const) {
    if (store.exists(join(dir, "change.md"))) return { id, dir, archived };
  }
  return undefined;
}

const SAFE = /[A-Za-z0-9._-]/;

/** Every character outside `[A-Za-z0-9._-]` percent-encoded, byte by byte. */
export function encodeBranch(branch: string): string {
  let out = "";
  for (const char of branch) {
    if (SAFE.test(char)) out += char;
    else
      for (const byte of Buffer.from(char, "utf8"))
        out += `%${byte.toString(16).toUpperCase().padStart(2, "0")}`;
  }
  return out;
}

export function decodeBranch(encoded: string): string {
  return decodeURIComponent(encoded);
}

function markersDir(projectRoot: string): string {
  return join(projectRoot, ".bdk", ".machine", "branches");
}

export function markerPath(projectRoot: string, branch: string): string {
  return join(markersDir(projectRoot), encodeBranch(branch));
}

export function readMarker(store: Store, projectRoot: string, branch: string): string | undefined {
  const text = store.read(markerPath(projectRoot, branch))?.trim();
  return text === undefined || text === "" ? undefined : text;
}

export function writeMarker(store: Store, projectRoot: string, branch: string, id: string): void {
  store.write(markerPath(projectRoot, branch), `${id}\n`);
}

export function removeMarker(store: Store, projectRoot: string, branch: string): void {
  store.remove(markerPath(projectRoot, branch));
}

/** Every local binding, sorted by branch. */
export function listMarkers(
  store: Store,
  projectRoot: string,
): { readonly branch: string; readonly change: string }[] {
  return store
    .list(markersDir(projectRoot))
    .filter((name) => !name.endsWith("/"))
    .map((name) => ({
      branch: decodeBranch(name),
      change: store.read(join(markersDir(projectRoot), name))?.trim() ?? "",
    }))
    .filter((marker) => marker.change !== "")
    .sort((a, b) => (a.branch < b.branch ? -1 : a.branch > b.branch ? 1 : 0));
}

/**
 * The Change bound to the current branch, or the refusal a Change-scoped
 * command answers: `policy/no-active-change` without a binding (a detached
 * `HEAD` or a marker naming an archived Change included) and
 * `state/change-dir-missing` for a marker naming a Change that is gone.
 */
export function resolveActiveChange(
  store: Store,
  git: Git,
  where: { readonly cwd: string; readonly workTree: string },
): ActiveChange | Refusal {
  const projectRoot = findProjectRoot(store, where.cwd, where.workTree);
  const home = readHomeMarker(store, resolve(where.workTree));
  if (home !== undefined) return worktreeChange(store, git, projectRoot, home.change);
  const branch = git.currentBranch(where.workTree);
  if (branch === undefined) {
    return refuse(
      "policy/no-active-change",
      `HEAD is detached in ${where.workTree}, so no Change is bound to it`,
      ["git switch <branch>", "bdk change list"],
    );
  }
  const id = readMarker(store, projectRoot, branch);
  const location = id === undefined ? undefined : findChange(store, projectRoot, id);
  if (id !== undefined && location === undefined) {
    return refuse(
      "state/change-dir-missing",
      `branch ${branch} is bound to ${id}, whose directory .bdk/changes/${id}/ is missing`,
      ["bdk rebuild", ...resumeLines(store, projectRoot)],
    );
  }
  if (location === undefined || location.archived) {
    return refuse("policy/no-active-change", `no active Change on branch ${branch}`, [
      '/bdk:change new "<intent>"',
      ...resumeLines(store, projectRoot),
    ]);
  }
  return { id: location.id, dir: location.dir, projectRoot, branch };
}

/** The Change a part worktree's home marker names, on the home checkout's branch. */
function worktreeChange(
  store: Store,
  git: Git,
  projectRoot: string,
  id: string,
): ActiveChange | Refusal {
  const location = findChange(store, projectRoot, id);
  const branch = git.currentBranch(projectRoot);
  if (location === undefined || location.archived || branch === undefined) {
    return refuse(
      "state/worktree-orphaned",
      `this part worktree belongs to ${id}, which is not the active Change of ${projectRoot}`,
      ["bdk rebuild"],
    );
  }
  return { id: location.id, dir: location.dir, projectRoot, branch };
}

function resumeLines(store: Store, projectRoot: string): string[] {
  const live = listChangeDirs(store, projectRoot).filter((change) => !change.archived);
  return live.length === 0
    ? ["bdk change resume <id>"]
    : live.map((change) => `bdk change resume ${change.id}`);
}
