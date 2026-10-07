// The resolved configuration of the project around `cwd` (spec `bdk-cli/config`, "Configured
// project"): every command of the slice starts here, and other slices read it through
// `config/index.ts`.

import { CliError, closest } from "../../shared/cli/index.ts";
import { resolveKey } from "../domain/keys.ts";
import type { Step } from "../domain/keys.ts";
import type { LayerFile } from "../domain/layer-files.ts";
import type { Layer } from "../domain/merge.ts";
import type { Settings } from "../domain/settings.ts";
import { validate } from "../domain/validate.ts";
import type { Problem } from "../domain/validate.ts";
import type { Files } from "../../shared/fs/index.ts";
import { findRoot, hasOpenSpec, readLayers } from "../store/layers.ts";

/** What the config slice needs from the OS; `main.ts` passes it in. */
export interface ConfigDeps {
  readonly files: Files;
  readonly cwd: string;
  readonly home: string;
  readonly env: Readonly<Record<string, string | undefined>>;
}

export type Missing = "settings" | "openspec";

export interface Loaded {
  readonly root: string;
  readonly files: readonly LayerFile[];
  readonly layers: readonly Layer[];
  /** What the project lacks to count as configured; empty when it is configured. */
  readonly missing: readonly Missing[];
  readonly problems: readonly Problem[];
  /** The resolved configuration, when there is no problem. */
  readonly settings?: Settings;
}

export function load(deps: ConfigDeps): Loaded {
  const root = findRoot(deps.files, deps.cwd);
  const { files, layers, problems: unparsed } = readLayers(deps.files, deps, root);
  const missing: Missing[] = [];
  if (!files.some((file) => file.layer === "project" && file.present)) missing.push("settings");
  if (!hasOpenSpec(deps.files, root)) missing.push("openspec");
  const { problems, settings } = validate(layers, closest);
  const all = [...unparsed, ...problems];
  return {
    root,
    files,
    layers,
    missing,
    problems: all,
    ...(all.length === 0 && settings !== undefined ? { settings } : {}),
  };
}

export type ConfigState =
  | { readonly status: "ok"; readonly root: string; readonly settings: Settings }
  | {
      readonly status: "not-configured";
      readonly root: string;
      readonly missing: readonly Missing[];
    }
  | { readonly status: "invalid"; readonly root: string; readonly problems: readonly Problem[] };

/** The configuration for another slice: resolved, or why there is none. */
export function loadConfig(deps: ConfigDeps): ConfigState {
  const loaded = load(deps);
  if (loaded.missing.length > 0) {
    return { status: "not-configured", root: loaded.root, missing: loaded.missing };
  }
  if (loaded.settings === undefined) {
    return { status: "invalid", root: loaded.root, problems: loaded.problems };
  }
  return { status: "ok", root: loaded.root, settings: loaded.settings };
}

/** The steps of `key`, or the usage error `usage/unknown-key` with the closest known name. */
export function requireKey(key: string): readonly Step[] {
  const resolved = resolveKey(key);
  if (resolved.ok) return resolved.steps;
  const near = closest(resolved.segment, resolved.known);
  const prefix = resolved.at === "" ? "" : `${resolved.at}.`;
  throw new CliError(
    "usage/unknown-key",
    `${key} names no setting`,
    near === undefined
      ? "Run bdk config show for the keys."
      : `did you mean ${prefix}${near}? Run bdk config show for the keys.`,
  );
}
