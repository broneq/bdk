// An in-memory file system and the paths of a sample project, for the config tests.

import type { Entry, Files } from "../../shared/fs/index.ts";

/** A file system of `path -> text`; directories are implied by the paths. */
export function memory(
  initial: Record<string, string>,
): Files & { readonly data: Map<string, string> } {
  const data = new Map(Object.entries(initial));
  return {
    data,
    readText: (path) => data.get(path),
    list(dir) {
      const entries = new Map<string, Entry>();
      for (const path of data.keys()) {
        if (!path.startsWith(`${dir}/`)) continue;
        const [name = "", ...rest] = path.slice(dir.length + 1).split("/");
        entries.set(name, { name, dir: rest.length > 0 });
      }
      if (entries.size === 0) return undefined;
      return [...entries.values()].sort((a, b) => (a.name < b.name ? -1 : 1));
    },
    writeText: (path, text) => data.set(path, text),
    appendText: (path, text) => data.set(path, (data.get(path) ?? "") + text),
  };
}

export const ROOT = "/work/app";
export const GLOBAL = "/home/me/.config/bdk/settings.yaml";
export const PROJECT = `${ROOT}/.bdk/settings.yaml`;
export const LOCAL = `${ROOT}/.bdk/settings.local.yaml`;
export const OPENSPEC = `${ROOT}/openspec/config.yaml`;
