// The rebuildable SQLite index (R-store). T11 ships the skeleton: the file,
// the busy timeout and a `meta` table with the schema version; T14 adds the
// tables. `node:sqlite` is imported on first open only, so commands that
// never touch the index never load it.
import { mkdirSync } from "node:fs";
import { dirname, join } from "node:path";
import type * as sqlite from "node:sqlite";
import type { DatabaseSync } from "node:sqlite";

export const INDEX_SCHEMA_VERSION = 1;

const BUSY_TIMEOUT_MS = 5000;

export interface IndexDb {
  readonly path: string;
  readonly database: DatabaseSync;
  schemaVersion(): number;
  close(): void;
}

export async function openIndex(projectRoot: string): Promise<IndexDb> {
  const { DatabaseSync } = await loadSqlite();
  const path = join(projectRoot, ".bdk", ".machine", "index.sqlite");
  mkdirSync(dirname(path), { recursive: true });
  const database = new DatabaseSync(path);
  database.exec(`PRAGMA busy_timeout = ${BUSY_TIMEOUT_MS}`);
  database.exec("CREATE TABLE IF NOT EXISTS meta (key TEXT PRIMARY KEY, value TEXT NOT NULL)");
  database
    .prepare("INSERT OR IGNORE INTO meta (key, value) VALUES ('schema_version', ?)")
    .run(String(INDEX_SCHEMA_VERSION));

  return {
    path,
    database,
    schemaVersion() {
      const row = database.prepare("SELECT value FROM meta WHERE key = 'schema_version'").get();
      return Number(row?.value);
    },
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
