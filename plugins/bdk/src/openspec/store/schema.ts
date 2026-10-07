// The schema directory the plugin ships and its copy in a project: read a tree of text files,
// write one file. Paths in a tree are relative to its directory, with "/" separators.

import { join } from "node:path";

import type { Files } from "../../shared/fs/index.ts";

/** Where the schema lives, under the plugin root and under the project root alike. */
export const SCHEMA_DIR = "openspec/schemas/bdk";

export interface TreeFile {
  readonly path: string;
  readonly text: string;
}

/** Every file under `dir` in path order; empty when the directory does not exist. */
export function readTree(files: Files, dir: string, prefix = ""): TreeFile[] {
  return (files.list(dir) ?? []).flatMap((entry) => {
    const path = prefix === "" ? entry.name : `${prefix}/${entry.name}`;
    if (entry.dir) return readTree(files, join(dir, entry.name), path);
    const text = files.readText(join(dir, entry.name));
    return text === undefined ? [] : [{ path, text }];
  });
}

export function readFile(files: Files, dir: string, path: string): string | undefined {
  return files.readText(join(dir, path));
}

export function writeFile(files: Files, dir: string, path: string, text: string): void {
  files.writeText(join(dir, path), text);
}
