// The tree hash of a target over the working tree (`kernel-state`, Evidence
// manifest, Tree hash; T23-D45): the scope's plan parts, their `Files:`, the
// build-config files git lists, each read from the store. `evidence record`,
// `evidence check`, `attempt close` and the step nodes share it.
import { join } from "node:path";

import { moduleValue, resolveOrRefuse } from "../../shared/config/index.ts";
import type { Mapping, Resolved } from "../../shared/config/index.ts";
import { workTreeFiles } from "../../shared/git/index.ts";
import type { Git } from "../../shared/git/index.ts";
import { taskHolders, workRoots } from "../../shared/store/index.ts";
import type { PlanPartFile, Store } from "../../shared/store/index.ts";
import type { Refusal } from "../../shared/refusal/index.ts";
import { evidenceModule } from "../config.ts";
import type { EvidenceDeps } from "./deps.ts";
import { coveredPaths, treeOf } from "./tree.ts";
import type { FilePolicy, Tree } from "./tree.ts";

/** The resolved settings, removed keys ignored; `policy.evidence` is read from them. */
export function evidenceSettings(
  deps: EvidenceDeps,
  projectRoot: string,
  globalDir: string,
): Resolved | Refusal {
  return resolveOrRefuse(
    {
      store: deps.store,
      settings: deps.settings,
      globalDir,
      projectRoot,
      pluginRoot: deps.pluginRoot,
    },
    { removed: "ignore" },
  );
}

export function filePolicy(settings: Readonly<Mapping>): FilePolicy {
  const policy = moduleValue(evidenceModule, settings);
  return { nonExecutable: policy["non-executable"], buildConfig: policy["build-config"] };
}

/**
 * The plan parts a target's tree hash covers: its holder part for a task, the
 * part itself, every part for the Change; undefined for any other target.
 */
export function scopeOf(
  parts: readonly PlanPartFile[],
  changeId: string,
  target: string,
): readonly PlanPartFile[] | undefined {
  const holder = taskHolders(parts).get(target);
  if (holder !== undefined) return [holder];
  const part = parts.find((found) => found.id === target);
  if (part !== undefined) return [part];
  return target === changeId ? parts : undefined;
}

interface TreeDeps {
  readonly store: Store;
  readonly git: Git;
}

export async function scopeTree(
  deps: TreeDeps,
  projectRoot: string,
  policy: FilePolicy,
  scope: readonly PlanPartFile[],
): Promise<Tree> {
  return treeIn(deps.store, projectRoot, policy, scope, await workTreeFiles(deps.git, projectRoot));
}

/**
 * The current tree of each target through one work-tree listing per work
 * root: a task's part, a part, the Change; any other target (an artifact)
 * covers the Change. A target of a live worktree part reads its worktree.
 */
export async function currentTrees(
  deps: TreeDeps,
  change: { readonly id: string; readonly projectRoot: string },
  policy: FilePolicy,
  parts: readonly PlanPartFile[],
  targets: Iterable<string>,
): Promise<Map<string, Tree>> {
  const rootOf = await workRoots(deps.git, deps.store, change, parts);
  const listings = new Map<string, readonly string[]>();
  const trees = new Map<string, Tree>();
  const byScope = new Map<string, Tree>();
  for (const target of targets) {
    if (trees.has(target)) continue;
    const root = rootOf(target);
    const scope = scopeOf(parts, change.id, target) ?? parts;
    const key = `${root}\0${scope.map((part) => part.id).join(" ")}`;
    let tree = byScope.get(key);
    if (tree === undefined) {
      const workTree = listings.get(root) ?? (await workTreeFiles(deps.git, root));
      listings.set(root, workTree);
      tree = treeIn(deps.store, root, policy, scope, workTree);
      byScope.set(key, tree);
    }
    trees.set(target, tree);
  }
  return trees;
}

function treeIn(
  store: Store,
  projectRoot: string,
  policy: FilePolicy,
  scope: readonly PlanPartFile[],
  workTree: readonly string[],
): Tree {
  const declared = scope.flatMap((part) =>
    part.tasks.flatMap((task) => task.files.map((file) => file.path)),
  );
  const paths = coveredPaths(policy, declared, workTree);
  return treeOf(paths, (path) => store.readBytes(join(projectRoot, path)));
}
