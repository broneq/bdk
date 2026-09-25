// The file primitives every slice persists through (`kernel-architecture`,
// shared/store). Paths are absolute; the in-memory implementation answers
// exactly as the file system one does, so use-case tests need no disk.
import { randomBytes } from "node:crypto";
import {
  existsSync,
  mkdirSync,
  readdirSync,
  readFileSync,
  renameSync,
  rmSync,
  statSync,
  writeFileSync,
} from "node:fs";
import { dirname, join, resolve } from "node:path";

export interface Store {
  /** The file's text, or undefined when there is no file at `path`. */
  read(path: string): string | undefined;
  /** Replaces the file in one step (temp file, then rename), creating parents. */
  write(path: string, content: string): void;
  /** Direct children, sorted, directories with a trailing `/`; [] when absent. */
  list(dir: string): string[];
  /** True for a file or a directory. */
  exists(path: string): boolean;
  isDirectory(path: string): boolean;
}

export function fileStore(): Store {
  return {
    read(path) {
      try {
        return readFileSync(path, "utf8");
      } catch (error) {
        if (isCode(error, "ENOENT")) return undefined;
        throw error;
      }
    },
    write(path, content) {
      mkdirSync(dirname(path), { recursive: true });
      const temp = `${path}.${randomBytes(4).toString("hex")}.tmp`;
      writeFileSync(temp, content);
      try {
        renameSync(temp, path);
      } catch (error) {
        rmSync(temp, { force: true });
        throw error;
      }
    },
    list(dir) {
      try {
        return readdirSync(dir, { withFileTypes: true })
          .map((entry) => (entry.isDirectory() ? `${entry.name}/` : entry.name))
          .sort();
      } catch (error) {
        if (isCode(error, "ENOENT") || isCode(error, "ENOTDIR")) return [];
        throw error;
      }
    },
    exists: (path) => existsSync(path),
    isDirectory: (path) => statSync(path, { throwIfNoEntry: false })?.isDirectory() === true,
  };
}

/** Absolute path -> content; a key ending in `/` is an (empty) directory. */
export function memoryStore(initial: Readonly<Record<string, string>> = {}): Store {
  const files = new Map<string, string>();
  const dirs = new Set<string>();
  const addParents = (path: string): void => {
    for (let dir = dirname(path); !dirs.has(dir); dir = dirname(dir)) {
      dirs.add(dir);
      if (dirname(dir) === dir) break;
    }
  };
  for (const [key, content] of Object.entries(initial)) {
    const path = resolve(key);
    if (key.endsWith("/")) {
      dirs.add(path);
      addParents(path);
    } else {
      files.set(path, content);
      addParents(path);
    }
  }

  return {
    read: (path) => files.get(resolve(path)),
    write(path, content) {
      const target = resolve(path);
      if (dirs.has(target)) throw new Error(`EISDIR: ${target} is a directory`);
      files.set(target, content);
      addParents(target);
    },
    list(dir) {
      const parent = resolve(dir);
      const names = [
        ...[...files.keys()]
          .filter((path) => dirname(path) === parent)
          .map((path) => path.slice(parent.length + 1)),
        ...[...dirs]
          .filter((path) => path !== parent && dirname(path) === parent)
          .map((path) => `${path.slice(parent.length + 1)}/`),
      ];
      return names.sort();
    },
    exists: (path) => files.has(resolve(path)) || dirs.has(resolve(path)),
    isDirectory: (path) => dirs.has(resolve(path)),
  };
}

/** The nearest directory holding `.bdk/` from `cwd` up to the work tree root, else that root. */
export function findProjectRoot(store: Store, cwd: string, workTreeRoot: string): string {
  const top = resolve(workTreeRoot);
  for (let dir = resolve(cwd); ; dir = dirname(dir)) {
    if (store.isDirectory(join(dir, ".bdk"))) return dir;
    if (dir === top || dirname(dir) === dir) return top;
  }
}

function isCode(error: unknown, code: string): boolean {
  return error instanceof Error && "code" in error && error.code === code;
}
