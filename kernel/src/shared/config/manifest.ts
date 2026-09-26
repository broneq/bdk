// The plugin manifest (design D-4 of v3-t11-kernel-skeleton): where the plugin
// lives and which version it is.
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import type { Store } from "../store/index.ts";
import { isRecord } from "./values.ts";

export const UNKNOWN_VERSION = "0.0.0-unknown";

/** The plugin root is the parent of `dist/`, where the bundle runs from. */
export function pluginRootOf(bundleUrl: string): string {
  return dirname(dirname(fileURLToPath(bundleUrl)));
}

/**
 * The kernel version is the plugin's, read at run time so a release PR that
 * bumps `plugin.json` never needs a rebuild. `version` must always answer,
 * so an unreadable manifest gives UNKNOWN_VERSION instead of an error.
 */
export function readKernelVersion(store: Store, pluginRoot: string): string {
  const text = store.read(join(pluginRoot, ".claude-plugin", "plugin.json"));
  if (text === undefined) return UNKNOWN_VERSION;
  try {
    const manifest: unknown = JSON.parse(text);
    const version = isRecord(manifest) ? manifest.version : undefined;
    return typeof version === "string" ? version : UNKNOWN_VERSION;
  } catch {
    return UNKNOWN_VERSION;
  }
}
