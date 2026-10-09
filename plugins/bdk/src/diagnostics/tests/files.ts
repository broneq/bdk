// An in-memory, read-only `Files` for the diagnostics tests: a tree of absolute paths to file
// contents. Directories exist when a file lies below them. Any write fails the test: the
// command only reads.

import type { Entry, Files } from "../../shared/fs/index.ts";

export function memoryFiles(tree: Readonly<Record<string, string>>): Files {
  const paths = new Map(Object.entries(tree));
  return {
    readText(path) {
      return paths.get(path);
    },
    list(dir) {
      const prefix = `${dir}/`;
      const entries = new Map<string, boolean>();
      for (const path of paths.keys()) {
        if (!path.startsWith(prefix)) continue;
        const [name, ...rest] = path.slice(prefix.length).split("/");
        if (name !== undefined) entries.set(name, rest.length > 0 || entries.get(name) === true);
      }
      if (entries.size === 0) return undefined;
      return [...entries]
        .map(([name, isDir]): Entry => ({ name, dir: isDir }))
        .sort((a, b) => (a.name < b.name ? -1 : 1));
    },
    writeText(path) {
      throw new Error(`bdk diagnostics wrote ${path}`);
    },
    appendText(path) {
      throw new Error(`bdk diagnostics appended to ${path}`);
    },
  };
}
