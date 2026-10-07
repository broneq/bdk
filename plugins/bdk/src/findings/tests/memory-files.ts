// An in-memory `Files` for the use-case and command tests: a map of path to text plus the
// directories that exist without files.
import { dirname } from "node:path";

import type { Entry, Files } from "../../shared/fs/index.ts";

export class MemoryFiles implements Files {
  readonly texts = new Map<string, string>();
  readonly dirs = new Set<string>();

  constructor(dirs: readonly string[] = []) {
    for (const dir of dirs) this.mkdir(dir);
  }

  private mkdir(dir: string): void {
    for (let at = dir; at !== dirname(at); at = dirname(at)) this.dirs.add(at);
  }

  readText(path: string): string | undefined {
    return this.texts.get(path);
  }

  list(dir: string): readonly Entry[] | undefined {
    if (!this.dirs.has(dir)) return undefined;
    const names = new Map<string, boolean>();
    for (const path of this.texts.keys())
      if (dirname(path) === dir) names.set(path.slice(dir.length + 1), false);
    for (const path of this.dirs)
      if (dirname(path) === dir && path !== dir) names.set(path.slice(dir.length + 1), true);
    return [...names]
      .map(([name, isDir]) => ({ name, dir: isDir }))
      .sort((a, b) => a.name.localeCompare(b.name));
  }

  writeText(path: string, text: string): void {
    this.mkdir(dirname(path));
    this.texts.set(path, text);
  }

  appendText(path: string, text: string): void {
    this.mkdir(dirname(path));
    this.texts.set(path, (this.texts.get(path) ?? "") + text);
  }
}
