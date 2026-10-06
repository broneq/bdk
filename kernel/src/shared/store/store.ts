// The file primitives every slice persists through (`kernel-architecture`,
// shared/store). Paths are absolute; the in-memory implementation answers
// exactly as the file system one does, so use-case tests need no disk.
import { randomBytes } from "node:crypto";
import {
  appendFileSync,
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

import { KernelRefusal, refuse } from "../refusal/index.ts";
import { homeIsValid, readHomeMarker } from "./worktree.ts";

/** What freshness checks compare (`kernel-state`, Rebuildable index). */
export interface FileStat {
  readonly mtimeMs: number;
  readonly ino: number;
  readonly size: number;
  readonly directory: boolean;
}

export interface Store {
  /** The file's text, or undefined when there is no file at `path`. */
  read(path: string): string | undefined;
  /** The file's bytes, or undefined when there is no file at `path`. */
  readBytes(path: string): Uint8Array | undefined;
  /** Replaces the file in one step (temp file, then rename), creating parents. */
  write(path: string, content: string): void;
  /** `write` for bytes: evidence files that need not be text. */
  writeBytes(path: string, content: Uint8Array): void;
  /**
   * Direct children, sorted, directories with a trailing `/`; [] when absent.
   * The temp file of a `write` still in flight (in another kernel process) is
   * never listed, so a reader cannot take it for a document.
   */
  list(dir: string): string[];
  /** True for a file or a directory. */
  exists(path: string): boolean;
  isDirectory(path: string): boolean;
  /** Undefined when there is nothing at `path`. */
  stat(path: string): FileStat | undefined;
  /** Removes a file; an absent file is not an error, a directory is. */
  remove(path: string): void;
  /** Creates the file only when nothing is at `path`, creating parents; false when something is. */
  create(path: string, content: string): boolean;
  /** Appends to a file, creating it and its parents. */
  append(path: string, content: string): void;
  /**
   * Renames a file or a directory in one step, creating the target's parents;
   * an existing target or an absent source is an error (the Change archive).
   */
  move(from: string, to: string): void;
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
    readBytes(path) {
      try {
        return new Uint8Array(readFileSync(path));
      } catch (error) {
        if (isCode(error, "ENOENT")) return undefined;
        throw error;
      }
    },
    write(path, content) {
      replaceFile(path, content);
    },
    writeBytes(path, content) {
      replaceFile(path, content);
    },
    list(dir) {
      try {
        return readdirSync(dir, { withFileTypes: true })
          .map((entry) => (entry.isDirectory() ? `${entry.name}/` : entry.name))
          .filter((name) => !TEMP_FILE.test(name))
          .sort();
      } catch (error) {
        if (isCode(error, "ENOENT") || isCode(error, "ENOTDIR")) return [];
        throw error;
      }
    },
    exists: (path) => existsSync(path),
    isDirectory: (path) => statSync(path, { throwIfNoEntry: false })?.isDirectory() === true,
    stat(path) {
      const stats = statSync(path, { throwIfNoEntry: false });
      if (stats === undefined) return undefined;
      return {
        mtimeMs: stats.mtimeMs,
        ino: stats.ino,
        size: stats.size,
        directory: stats.isDirectory(),
      };
    },
    remove(path) {
      rmSync(path, { force: true });
    },
    create(path, content) {
      mkdirSync(dirname(path), { recursive: true });
      try {
        writeFileSync(path, content, { flag: "wx" });
        return true;
      } catch (error) {
        if (isCode(error, "EEXIST")) return false;
        throw error;
      }
    },
    append(path, content) {
      mkdirSync(dirname(path), { recursive: true });
      appendFileSync(path, content);
    },
    move(from, to) {
      if (existsSync(to)) throw new Error(`EEXIST: ${to} exists`);
      if (!existsSync(from)) throw new Error(`ENOENT: ${from} does not exist`);
      mkdirSync(dirname(to), { recursive: true });
      renameSync(from, to);
    },
  };
}

/** The name `replaceFile` gives its temp file: the target's, a random suffix, `.tmp`. */
const TEMP_FILE = /\.[0-9a-f]{8}\.tmp$/;

/** Replaces the file in one step (temp file, then rename), creating parents. */
function replaceFile(path: string, content: string | Uint8Array): void {
  mkdirSync(dirname(path), { recursive: true });
  const temp = `${path}.${randomBytes(4).toString("hex")}.tmp`;
  writeFileSync(temp, content);
  try {
    renameSync(temp, path);
  } catch (error) {
    rmSync(temp, { force: true });
    throw error;
  }
}

/** Absolute path -> content; a key ending in `/` is an (empty) directory. */
export function memoryStore(initial: Readonly<Record<string, string>> = {}): Store {
  // Bytes, so a binary file reads back as written; text reads decode UTF-8 as the disk does.
  const files = new Map<string, Buffer>();
  const dirs = new Set<string>();
  // A logical clock stands in for mtimes and inodes: every write is a new
  // inode and touches its directory, as a rename on disk does.
  let tick = 0;
  const times = new Map<string, { mtimeMs: number; ino: number }>();
  const touch = (path: string): void => {
    tick++;
    times.set(path, { mtimeMs: tick, ino: tick });
  };
  const addParents = (path: string): void => {
    touch(dirname(path));
    for (let dir = dirname(path); !dirs.has(dir); dir = dirname(dir)) {
      dirs.add(dir);
      touch(dirname(dir));
      if (dirname(dir) === dir) break;
    }
  };
  for (const [key, content] of Object.entries(initial)) {
    const path = resolve(key);
    if (key.endsWith("/")) {
      dirs.add(path);
      touch(path);
      addParents(path);
    } else {
      files.set(path, Buffer.from(content));
      touch(path);
      addParents(path);
    }
  }

  const put = (path: string, content: Buffer): void => {
    const target = resolve(path);
    if (dirs.has(target)) throw new Error(`EISDIR: ${target} is a directory`);
    files.set(target, content);
    touch(target);
    addParents(target);
  };

  return {
    read: (path) => files.get(resolve(path))?.toString("utf8"),
    readBytes(path) {
      const bytes = files.get(resolve(path));
      return bytes === undefined ? undefined : Uint8Array.from(bytes);
    },
    write(path, content) {
      put(path, Buffer.from(content));
    },
    writeBytes(path, content) {
      put(path, Buffer.from(content));
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
      return names.filter((name) => !TEMP_FILE.test(name)).sort();
    },
    exists: (path) => files.has(resolve(path)) || dirs.has(resolve(path)),
    isDirectory: (path) => dirs.has(resolve(path)),
    stat(path) {
      const target = resolve(path);
      const time = times.get(target);
      if (time === undefined || (!files.has(target) && !dirs.has(target))) return undefined;
      return {
        ...time,
        size: files.get(target)?.length ?? 0,
        directory: dirs.has(target),
      };
    },
    remove(path) {
      const target = resolve(path);
      if (dirs.has(target)) throw new Error(`EISDIR: ${target} is a directory`);
      if (files.delete(target)) touch(dirname(target));
    },
    create(path, content) {
      const target = resolve(path);
      if (files.has(target) || dirs.has(target)) return false;
      put(target, Buffer.from(content));
      return true;
    },
    append(path, content) {
      const target = resolve(path);
      if (dirs.has(target)) throw new Error(`EISDIR: ${target} is a directory`);
      const existed = files.has(target);
      files.set(
        target,
        Buffer.concat([files.get(target) ?? Buffer.alloc(0), Buffer.from(content)]),
      );
      if (existed) times.set(target, { mtimeMs: ++tick, ino: times.get(target)?.ino ?? tick });
      else {
        touch(target);
        addParents(target);
      }
    },
    move(from, to) {
      const source = resolve(from);
      const target = resolve(to);
      if (files.has(target) || dirs.has(target)) throw new Error(`EEXIST: ${target} exists`);
      if (!files.has(source) && !dirs.has(source)) {
        throw new Error(`ENOENT: ${source} does not exist`);
      }
      const rebase = (path: string): string | undefined =>
        path === source
          ? target
          : path.startsWith(`${source}/`)
            ? target + path.slice(source.length)
            : undefined;
      for (const [path, content] of [...files]) {
        const moved = rebase(path);
        if (moved === undefined) continue;
        files.delete(path);
        files.set(moved, content);
        touch(moved);
        addParents(moved);
      }
      for (const dir of [...dirs]) {
        const moved = rebase(dir);
        if (moved === undefined) continue;
        dirs.delete(dir);
        dirs.add(moved);
        touch(moved);
        addParents(moved);
      }
      touch(dirname(source));
    },
  };
}

/** All of the process's stdin (`log add --body -`). */
export function readStdin(): string {
  return readFileSync(0, "utf8");
}

/**
 * The nearest directory holding `.bdk/` from `cwd` up to the work tree root,
 * else that root; inside a kernel part worktree, the home checkout its marker
 * names (`kernel-cli`, Invocation), or `state/worktree-orphaned` when that
 * home is no longer a work tree of the same repository.
 */
export function findProjectRoot(store: Store, cwd: string, workTreeRoot: string): string {
  const top = resolve(workTreeRoot);
  const marker = readHomeMarker(store, top);
  if (marker !== undefined) {
    if (homeIsValid(store, top, marker)) return marker.home;
    throw new KernelRefusal(
      refuse(
        "state/worktree-orphaned",
        `the part worktree ${top} names the home checkout ${marker.home}, which is no longer a work tree of this repository`,
        ["bdk rebuild"],
      ),
    );
  }
  for (let dir = resolve(cwd); ; dir = dirname(dir)) {
    if (store.isDirectory(join(dir, ".bdk"))) return dir;
    if (dir === top || dirname(dir) === dir) return top;
  }
}

function isCode(error: unknown, code: string): boolean {
  return error instanceof Error && "code" in error && error.code === code;
}
