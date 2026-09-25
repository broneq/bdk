// The file layers of `kernel-settings`, Configuration layers: where they live
// and how they are read. The default layer is the registry's, not a file.
import { posix, win32 } from "node:path";
import { parse, YAMLParseError } from "yaml";

import { KernelRefusal, refuse } from "../refusal/index.ts";
import type { Store } from "../store/index.ts";
import { isRecord } from "./values.ts";
import type { Mapping } from "./values.ts";

export type LayerName = "default" | "global" | "project" | "local";
export type FileLayerName = Exclude<LayerName, "default">;

export const LAYER_NAMES: readonly LayerName[] = ["default", "global", "project", "local"];

export interface Layer {
  readonly name: FileLayerName;
  readonly path: string;
  readonly text: string;
  readonly values: Readonly<Mapping>;
}

/** What the global path depends on; `main.ts` binds the process, tests a fake. */
export interface Environment {
  readonly env: Readonly<Record<string, string | undefined>>;
  readonly platform: string;
  readonly home: string;
}

export interface LayerPaths {
  readonly globalDir: string;
  readonly projectRoot: string;
}

/**
 * `$XDG_CONFIG_HOME/bdk` when set and absolute (the XDG spec ignores relative
 * values), `%APPDATA%\bdk` on Windows, `~/.config/bdk` otherwise.
 */
export function globalDir({ env, platform, home }: Environment): string {
  const path = platform === "win32" ? win32 : posix;
  const xdg = env.XDG_CONFIG_HOME;
  if (xdg !== undefined && xdg !== "" && path.isAbsolute(xdg)) return path.join(xdg, "bdk");
  const appData = env.APPDATA;
  if (platform === "win32" && appData !== undefined && appData !== "") {
    return path.join(appData, "bdk");
  }
  return path.join(home, ".config", "bdk");
}

/** The three file layers, lowest precedence first, present or not. */
export function layerFiles(
  global: string,
  projectRoot: string,
): { readonly name: FileLayerName; readonly path: string }[] {
  const path = global.includes("\\") ? win32 : posix;
  return [
    { name: "global", path: path.join(global, "settings.yaml") },
    { name: "project", path: posix.join(projectRoot, ".bdk", "settings.yaml") },
    { name: "local", path: posix.join(projectRoot, ".bdk", "settings.local.yaml") },
  ];
}

/** Every present file layer, lowest precedence first; absent files are skipped. */
export function readLayers(store: Store, paths: LayerPaths): Layer[] {
  const layers: Layer[] = [];
  for (const { name, path } of layerFiles(paths.globalDir, paths.projectRoot)) {
    const text = store.read(path);
    if (text !== undefined) layers.push({ name, path, text, values: parseLayer(path, text) });
  }
  return layers;
}

function parseLayer(path: string, text: string): Mapping {
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
