// The reading half of the four configuration layers (D4, A-warstwy) and the
// plugin manifest (design D-4). Merging, the zod registry and the snapshot
// are T12's; this module only finds, reads and parses.
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { parse, YAMLParseError } from "yaml";

import { KernelRefusal, refuse } from "../refusal/index.ts";
import type { Store } from "../store/index.ts";

export const UNKNOWN_VERSION = "0.0.0-unknown";

export type LayerName = "defaults" | "personal" | "project" | "local";

export interface Layer {
  readonly name: LayerName;
  /** Absent for the bundle defaults, which are code, not a file. */
  readonly path?: string;
  readonly values: Readonly<Record<string, unknown>>;
}

export interface LayerPaths {
  readonly home: string;
  readonly projectRoot: string;
}

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

/** Every present layer, lowest precedence first; absent files are skipped. */
export function readLayers(store: Store, paths: LayerPaths): Layer[] {
  const files: readonly (readonly [LayerName, string])[] = [
    ["personal", join(paths.home, ".config", "bdk", "settings.yaml")],
    ["project", join(paths.projectRoot, ".bdk", "settings.yaml")],
    ["local", join(paths.projectRoot, ".bdk", "settings.local.yaml")],
  ];
  const layers: Layer[] = [{ name: "defaults", values: {} }];
  for (const [name, path] of files) {
    const text = store.read(path);
    if (text !== undefined) layers.push({ name, path, values: parseLayer(path, text) });
  }
  return layers;
}

function parseLayer(path: string, text: string): Record<string, unknown> {
  let values: unknown;
  try {
    values = parse(text);
  } catch (error) {
    if (!(error instanceof YAMLParseError)) throw error;
    const line = error.linePos?.[0].line;
    throw invalid(path, `is not valid YAML${line === undefined ? "" : ` at line ${line}`}`);
  }
  if (values === null || values === undefined) return {};
  if (!isRecord(values)) throw invalid(path, "must hold a mapping of keys at the top level");
  return values;
}

function invalid(path: string, problem: string): KernelRefusal {
  return new KernelRefusal(
    refuse("policy/config-invalid", `${path} ${problem}`, [`fix ${path}`, "bdk config check"]),
  );
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
