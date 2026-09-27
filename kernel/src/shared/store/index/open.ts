// Opening the index (`kernel-state`, Rebuildable index; design D-3, D-5 of
// T20). `node:sqlite` is imported on first open only, so commands that never
// touch the index never load it. An index SQLite cannot open is deleted and
// rebuilt once; a second failure is `state/corrupted-index`.
import { mkdirSync, rmSync } from "node:fs";
import { dirname, join } from "node:path";
import type * as sqlite from "node:sqlite";
import type { DatabaseSync } from "node:sqlite";

import { KernelRefusal, refuse } from "../../refusal/index.ts";
import type { Store } from "../store.ts";
import { currentVersion, ensureSchema } from "./schema.ts";

const BUSY_TIMEOUT_MS = 5000;

export interface IndexDb {
  /** The database file, or `:memory:`. */
  readonly path: string;
  readonly database: DatabaseSync;
  /** The files the index caches are read through this store. */
  readonly store: Store;
  readonly projectRoot: string;
  /** Milliseconds since the epoch, compared with file mtimes (racy-time guard). */
  readonly now: () => number;
  schemaVersion(): number;
  close(): void;
}

export interface OpenOptions {
  /** An in-memory database, for unit tests on a memory store. */
  readonly memory?: boolean;
  readonly now?: () => number;
}

export function indexPath(projectRoot: string): string {
  return join(projectRoot, ".bdk", ".machine", "index.sqlite");
}

export async function openIndex(
  store: Store,
  projectRoot: string,
  options: OpenOptions = {},
): Promise<IndexDb> {
  const { DatabaseSync } = await loadSqlite();
  const path = options.memory === true ? ":memory:" : indexPath(projectRoot);
  const connect = (): DatabaseSync => {
    if (path !== ":memory:") mkdirSync(dirname(path), { recursive: true });
    const database = new DatabaseSync(path);
    try {
      database.exec(`PRAGMA busy_timeout = ${BUSY_TIMEOUT_MS}`);
      if (path !== ":memory:") database.exec("PRAGMA journal_mode = WAL");
      ensureSchema(database);
      return database;
    } catch (error) {
      database.close();
      throw error;
    }
  };

  let database: DatabaseSync;
  try {
    database = connect();
  } catch {
    try {
      for (const suffix of ["", "-wal", "-shm"]) rmSync(`${path}${suffix}`, { force: true });
      database = connect();
    } catch (error) {
      const reason = error instanceof Error ? error.message.split("\n")[0] : String(error);
      throw new KernelRefusal(
        refuse(
          "state/corrupted-index",
          `the index ${path} cannot be opened or rebuilt (${reason ?? "unknown error"})`,
          ["bdk rebuild", `remove ${path} by hand, then retry`],
        ),
      );
    }
  }

  return {
    path,
    database,
    store,
    projectRoot,
    now: options.now ?? Date.now,
    schemaVersion: () => currentVersion(database) ?? 0,
    close: () => {
      database.close();
    },
  };
}

/**
 * Node 22.13 to 22.x print an ExperimentalWarning when `node:sqlite` loads.
 * Inject-mode wrappers merge stderr into the model's content (`2>&1`), so
 * exactly that warning is dropped; every other warning still prints.
 */
async function loadSqlite(): Promise<typeof sqlite> {
  const original: unknown = Reflect.get(process, "emitWarning");
  const emit = process.emitWarning.bind(process) as (
    warning: string | Error,
    ...rest: unknown[]
  ) => void;
  process.emitWarning = (warning: string | Error, ...rest: unknown[]) => {
    const [options] = rest;
    const type =
      typeof options === "string" ? options : (options as { type?: string } | undefined)?.type;
    const message = typeof warning === "string" ? warning : warning.message;
    if (type === "ExperimentalWarning" && message.includes("SQLite")) return;
    emit(warning, ...rest);
  };
  try {
    return await import("node:sqlite");
  } finally {
    Reflect.set(process, "emitWarning", original);
  }
}

/** How a command opens the index: `main.ts` binds `fileIndex`, unit tests `memoryIndex`. */
export type IndexOpener = (store: Store, projectRoot: string) => Promise<IndexDb>;

export const fileIndex: IndexOpener = (store, projectRoot) => openIndex(store, projectRoot);

export const memoryIndex: IndexOpener = (store, projectRoot) =>
  openIndex(store, projectRoot, { memory: true });

/** Opens the index, runs `work` and always closes it. */
export async function withIndex<T>(
  opener: IndexOpener,
  store: Store,
  projectRoot: string,
  work: (index: IndexDb) => T | Promise<T>,
): Promise<T> {
  const index = await opener(store, projectRoot);
  try {
    return await work(index);
  } finally {
    index.close();
  }
}
