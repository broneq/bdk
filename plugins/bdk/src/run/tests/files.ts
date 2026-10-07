// An in-memory `Files` for the run slice tests: a project tree as a map of relative paths to
// file contents. Directories exist when a file lies below them.

import type { Entry, Files } from "../../shared/fs/index.ts";

export const ROOT = "/project";

export function memoryFiles(tree: Readonly<Record<string, string>>): Files & {
  readonly reads: string[];
} {
  const paths = new Map(Object.entries(tree).map(([path, text]) => [`${ROOT}/${path}`, text]));
  const reads: string[] = [];
  return {
    reads,
    readText(path) {
      reads.push(path);
      return paths.get(path);
    },
    list(dir) {
      reads.push(dir);
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
      throw new Error(`bdk run status wrote ${path}`);
    },
    appendText(path) {
      throw new Error(`bdk run status appended to ${path}`);
    },
  };
}
