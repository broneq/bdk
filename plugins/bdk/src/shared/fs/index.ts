// The file system boundary of the bdk CLI (spec `bdk-cli`, "OS boundary"). `main.ts` passes
// `files` to the slices that need it; use cases see only the `Files` interface, so their tests
// run against an in-memory fake. Synchronous: a CLI call is short-lived and does one thing.
import { appendFileSync, mkdirSync, readdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname } from "node:path";

export interface Entry {
  readonly name: string;
  readonly dir: boolean;
}

export interface Files {
  /** The file as UTF-8 text; undefined when it or a parent directory does not exist. */
  readText(path: string): string | undefined;
  /** The entries of a directory sorted by name; undefined when the directory does not exist. */
  list(dir: string): readonly Entry[] | undefined;
  /** Replaces the file, creating its parent directories. */
  writeText(path: string, text: string): void;
  /**
   * Appends to the file in one write in append mode, creating it and its parent directories.
   * Parallel appends of whole lines from several processes neither overwrite nor interleave.
   */
  appendText(path: string, text: string): void;
}

function missing(error: unknown): boolean {
  const code = (error as { code?: unknown }).code;
  return code === "ENOENT" || code === "ENOTDIR";
}

export const files: Files = {
  readText(path) {
    try {
      return readFileSync(path, "utf8");
    } catch (error) {
      if (missing(error)) return undefined;
      throw error;
    }
  },
  list(dir) {
    try {
      return readdirSync(dir, { withFileTypes: true })
        .map((entry) => ({ name: entry.name, dir: entry.isDirectory() }))
        .sort((a, b) => (a.name < b.name ? -1 : a.name > b.name ? 1 : 0));
    } catch (error) {
      if (missing(error)) return undefined;
      throw error;
    }
  },
  writeText(path, text) {
    mkdirSync(dirname(path), { recursive: true });
    writeFileSync(path, text);
  },
  appendText(path, text) {
    mkdirSync(dirname(path), { recursive: true });
    appendFileSync(path, text);
  },
};
