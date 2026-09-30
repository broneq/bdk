// The index schema (`kernel-state`, Rebuildable index; design D-3 of T20).
// The public tables are the contract of `bdk query`; `_` tables are internal.
// `entries` is a view over `_entries`, so the derived `status` and
// `superseded_by` are never stale after a partial refresh.
import type { DatabaseSync } from "node:sqlite";

export const INDEX_SCHEMA_VERSION = 5;

const TABLES = `
CREATE TABLE _meta (key TEXT PRIMARY KEY, value TEXT NOT NULL);
CREATE TABLE _dirs (
  path TEXT PRIMARY KEY, change_id TEXT NOT NULL,
  mtime REAL NOT NULL, count INTEGER NOT NULL, trusted INTEGER NOT NULL
);
CREATE TABLE _files (
  path TEXT PRIMARY KEY, change_id TEXT NOT NULL,
  ino REAL NOT NULL, mtime REAL NOT NULL, size INTEGER NOT NULL
);
CREATE INDEX _files_change ON _files (change_id);
CREATE TABLE changes (
  id TEXT PRIMARY KEY, kind TEXT NOT NULL, profile TEXT NOT NULL, source TEXT NOT NULL,
  intent TEXT NOT NULL, at TEXT NOT NULL, author TEXT NOT NULL,
  archived INTEGER NOT NULL, dir TEXT NOT NULL
);
CREATE TABLE _entries (
  change_id TEXT NOT NULL, id TEXT NOT NULL, type TEXT NOT NULL, summary TEXT NOT NULL,
  status TEXT NOT NULL, source TEXT NOT NULL, author TEXT NOT NULL, at TEXT NOT NULL,
  ticket TEXT, supersedes TEXT, review INTEGER NOT NULL, severity TEXT, category TEXT,
  fingerprint TEXT, applies TEXT, evidence TEXT, to_stage TEXT, gate TEXT, input_hash TEXT, profile TEXT,
  park INTEGER NOT NULL, options TEXT, path TEXT NOT NULL,
  PRIMARY KEY (change_id, id)
);
CREATE INDEX _entries_supersedes ON _entries (supersedes);
CREATE INDEX _entries_path ON _entries (path);
CREATE TABLE refs (
  change_id TEXT NOT NULL, entry_id TEXT NOT NULL, position INTEGER NOT NULL, ref TEXT NOT NULL,
  PRIMARY KEY (change_id, entry_id, position)
);
CREATE TABLE attempts (
  change_id TEXT NOT NULL, ticket TEXT NOT NULL, loop TEXT NOT NULL, target TEXT NOT NULL,
  attempt INTEGER NOT NULL, "of" INTEGER NOT NULL, scope TEXT NOT NULL,
  opened_at TEXT NOT NULL, closed_at TEXT, outcome TEXT, path TEXT NOT NULL,
  PRIMARY KEY (change_id, ticket)
);
CREATE TABLE dispatches (
  change_id TEXT NOT NULL, ticket TEXT NOT NULL, target TEXT NOT NULL, role TEXT NOT NULL,
  rules TEXT NOT NULL, path TEXT PRIMARY KEY
);
CREATE TABLE findings (
  change_id TEXT NOT NULL, ticket TEXT NOT NULL, position INTEGER NOT NULL,
  fingerprint TEXT NOT NULL, type TEXT NOT NULL, file TEXT NOT NULL, symbol TEXT,
  PRIMARY KEY (change_id, ticket, position)
);
CREATE INDEX findings_fingerprint ON findings (fingerprint);
CREATE VIEW entries AS
SELECT e.change_id, e.id, e.type, e.summary,
  CASE WHEN s.id IS NULL THEN e.status ELSE 'superseded' END AS status,
  e.source, e.author, e.at, e.ticket, e.supersedes,
  CASE WHEN s.id IS NULL THEN NULL
       WHEN s.change_id = e.change_id THEN s.id
       ELSE s.change_id || '/' || s.id END AS superseded_by,
  e.review, e.severity, e.category, e.fingerprint, e.applies, e.evidence, e.to_stage, e.gate,
  e.input_hash,
  e.profile, e.park, e.options, e.path
FROM _entries e
LEFT JOIN _entries s ON s.rowid = (
  SELECT c.rowid FROM _entries c
  WHERE (c.change_id = e.change_id AND c.supersedes = e.id)
     OR c.supersedes = e.change_id || '/' || e.id
  ORDER BY c.at, c.id LIMIT 1
);
`;

/**
 * Creates the tables, or drops everything and recreates them when the file
 * carries another schema version: the index is a cache, so there is no
 * migration path. Runs in one `BEGIN IMMEDIATE` so concurrent processes
 * never both create.
 */
export function ensureSchema(database: DatabaseSync): void {
  if (currentVersion(database) === INDEX_SCHEMA_VERSION) return;
  database.exec("BEGIN IMMEDIATE");
  try {
    if (currentVersion(database) !== INDEX_SCHEMA_VERSION) {
      const objects = database
        .prepare(
          "SELECT type, name FROM sqlite_master WHERE type IN ('table', 'view') AND name NOT LIKE 'sqlite_%' ORDER BY type = 'table'",
        )
        .all() as { type: string; name: string }[];
      for (const { type, name } of objects) {
        database.exec(`DROP ${type === "view" ? "VIEW" : "TABLE"} IF EXISTS "${name}"`);
      }
      database.exec(TABLES);
      database
        .prepare("INSERT INTO _meta (key, value) VALUES ('schema_version', ?)")
        .run(String(INDEX_SCHEMA_VERSION));
    }
    database.exec("COMMIT");
  } catch (error) {
    database.exec("ROLLBACK");
    throw error;
  }
}

/** The recorded version, or undefined when there is none. */
export function currentVersion(database: DatabaseSync): number | undefined {
  const table = database
    .prepare("SELECT 1 FROM sqlite_master WHERE type = 'table' AND name = '_meta'")
    .get();
  if (table === undefined) return undefined;
  const row = database.prepare("SELECT value FROM _meta WHERE key = 'schema_version'").get();
  return row === undefined ? undefined : Number(row.value);
}
