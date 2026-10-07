// `bdk config show [<key>]` (spec `bdk-cli/config`, "config show"; design D4): the resolved
// configuration with origins, or the state that keeps a skill from using it. Every state is a
// result, never an error, because the `!` block of a skill drops a failing command's output.

import { withOrigins } from "../domain/merge.ts";
import { DEFAULT_LAYER } from "../domain/validate.ts";
import type { ShowResult } from "../schema/show.ts";
import { load, requireKey } from "./load.ts";
import type { ConfigDeps } from "./load.ts";

export function show(deps: ConfigDeps, key?: string): ShowResult {
  if (key !== undefined) requireKey(key);
  const loaded = load(deps);
  const { root, files } = loaded;
  if (loaded.missing.length > 0)
    return { status: "not-configured", root, missing: [...loaded.missing] };
  if (loaded.settings === undefined) {
    return { status: "invalid", root, layers: [...files], problems: [...loaded.problems] };
  }
  const entries = withOrigins(loaded.settings, [DEFAULT_LAYER, ...loaded.layers]).filter(
    (leaf) => key === undefined || leaf.key === key || leaf.key.startsWith(`${key}.`),
  );
  return {
    status: "ok",
    root,
    layers: [...files],
    ...(key === undefined ? {} : { key }),
    entries,
  };
}
