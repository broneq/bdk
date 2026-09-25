// The resolved snapshot of `kernel-settings`, Resolved snapshot (design D-9):
// a cache of the resolved configuration plus the names of the keys a person
// set in the global or local layer (D4b). Nothing reads it back as input.
import { join } from "node:path";
import { stringify } from "yaml";

import type { Store } from "../store/index.ts";
import type { Resolution } from "./resolve.ts";

export const SNAPSHOT_PATH = ".bdk/.machine/config/resolved.yaml";

const PERSONAL = new Set(["global", "local"]);

/** The sorted names of the leaves and prompt keys the global or local layer sets. */
export function overriddenKeys(resolution: Resolution): string[] {
  const leaves = Object.entries(resolution.merged.origins)
    .filter(([, layer]) => PERSONAL.has(layer))
    .map(([key]) => key);
  const prompts = [...resolution.prompts.values]
    .filter(([, value]) => value.files.some((file) => PERSONAL.has(file.layer)))
    .map(([key]) => `prompts.${key}`);
  return [...leaves, ...prompts].sort();
}

/** Writes the snapshot and returns its project-relative path; nothing without `.bdk/` or on problems. */
export function writeSnapshot(
  store: Store,
  projectRoot: string,
  resolution: Resolution,
): string | undefined {
  if (resolution.value === undefined || !store.isDirectory(join(projectRoot, ".bdk"))) {
    return undefined;
  }
  const snapshot = {
    resolved: resolution.value,
    prompts: Object.fromEntries(resolution.prompts.values),
    overriddenKeys: overriddenKeys(resolution),
  };
  store.write(join(projectRoot, SNAPSHOT_PATH), stringify(snapshot));
  return SNAPSHOT_PATH;
}
