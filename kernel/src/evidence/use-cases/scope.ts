// The tree hash of a target over the working tree (`kernel-state`, Evidence
// manifest, Tree hash; T23-D45): the scope's plan parts, their `Files:`, the
// build-config files git lists, each read from the store. `evidence record`,
// `evidence check`, `attempt close` and the step nodes share it.
import { join } from "node:path";

import { moduleValue, resolveOrRefuse } from "../../shared/config/index.ts";
import type { Mapping, Resolved } from "../../shared/config/index.ts";
import { workTreeFiles } from "../../shared/git/index.ts";
import type { Git } from "../../shared/git/index.ts";
import { taskHolders } from "../../shared/store/index.ts";
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

export async function scopeTree(
  deps: { readonly store: Store; readonly git: Git },
  projectRoot: string,
  policy: FilePolicy,
  scope: readonly PlanPartFile[],
): Promise<Tree> {
  const declared = scope.flatMap((part) =>
    part.tasks.flatMap((task) => task.files.map((file) => file.path)),
  );
  const paths = coveredPaths(policy, declared, await workTreeFiles(deps.git, projectRoot));
  return treeOf(paths, (path) => deps.store.readBytes(join(projectRoot, path)));
}
