// The Change base and the lines a Change adds (`kernel-cli/review`, bdk review
// plan; `kernel-cli/evidence`, bdk evidence coverage): committed state both
// commands read without a slice import (`kernel-architecture`, Dependency
// matrix).
import { join, relative, sep } from "node:path";

import {
  addingCommit,
  headCommit,
  parentCommit,
  trackedAddedLines,
  untrackedFiles,
} from "../git/index.ts";
import type { Git } from "../git/index.ts";
import { readDocument } from "./state/documents.ts";
import type { Store } from "./store.ts";

/** The id git gives the empty tree, the base of a Change its repository's root commit opened. */
export const EMPTY_TREE = "4b825dc642cb6eb9a060e54bf8d69288fbee4904";

/**
 * The `base` a review Change stamps in its `change.md`; else the parent of the
 * first commit that added `change.md`, `HEAD` while it is not committed, and
 * the empty tree when that commit is the root or the repository has none.
 */
export async function changeBase(
  store: Store,
  git: Git,
  projectRoot: string,
  changeDir: string,
): Promise<string> {
  const document = readDocument(store, join(changeDir, "change.md"));
  const stamped = document !== undefined && "data" in document ? document.data.base : undefined;
  if (typeof stamped === "string") return stamped;
  const path = relative(projectRoot, join(changeDir, "change.md")).split(sep).join("/");
  const added = await addingCommit(git, projectRoot, path);
  if (added === undefined) return (await headCommit(git, projectRoot)) ?? EMPTY_TREE;
  return (await parentCommit(git, projectRoot, added)) ?? EMPTY_TREE;
}

/**
 * The lines the working tree adds against `base`, by repository-relative path,
 * committed and uncommitted edits together; an untracked file counts whole.
 */
export async function addedLines(
  store: Store,
  git: Git,
  projectRoot: string,
  base: string,
): Promise<Map<string, number[]>> {
  const added = await trackedAddedLines(git, projectRoot, base);
  for (const path of await untrackedFiles(git, projectRoot)) {
    const text = store.read(join(projectRoot, path));
    if (text === undefined || text === "") continue;
    const count = text.endsWith("\n") ? text.split("\n").length - 1 : text.split("\n").length;
    added.set(
      path,
      Array.from({ length: count }, (_, at) => at + 1),
    );
  }
  return new Map([...added.entries()].sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0)));
}
