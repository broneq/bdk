// An in-memory file system for the rules tests; directories are implied by the paths.

import type { Entry, Files } from "../../shared/fs/index.ts";

export function memory(initial: Record<string, string>): Files {
  const data = new Map(Object.entries(initial));
  return {
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
