// Lazy refresh of the index (`kernel-state`, Rebuildable index; design D-4
// of T20). Fast path: the Change directory and its `log/`, `attempts/` and
// `dispatch/` directories carry the recorded mtime and entry count, so no
// file is read. Slow path: each file is compared by inode, mtime and size and
// only new or changed files are parsed. A state younger than RACY_MS when it
// was recorded is not trusted (git's "racy clean" rule).
import { join, relative, sep } from "node:path";

import { KernelRefusal, refuse } from "../../refusal/index.ts";
import { listChangeDirs } from "../changes.ts";
import type { ChangeLocation } from "../changes.ts";
import { readDocument } from "../state/documents.ts";
import type { IndexDb } from "./open.ts";

const RACY_MS = 2000;

const WATCHED = ["", "log", "attempts", "dispatch"] as const;

type Data = Readonly<Record<string, unknown>>;

interface DirState {
  readonly path: string;
  readonly mtime: number;
  readonly count: number;
}

/** Brings the rows of one Change up to its files; true when the slow path ran. */
export function refreshChange(index: IndexDb, location: ChangeLocation): boolean {
  const states = dirStates(index, location);
  if (isFresh(index, location, states)) return false;
  transaction(index, () => {
    slowPath(index, location, states);
  });
  return true;
}

/** Every Change of the project, archived ones included; drops the rows of removed Changes. */
export function refreshAll(index: IndexDb): boolean {
  const locations = listChangeDirs(index.store, index.projectRoot);
  const seen = new Map<string, ChangeLocation>();
  for (const location of locations) {
    const first = seen.get(location.id);
    if (first !== undefined) {
      throw new KernelRefusal(
        refuse(
          "state/ledger-invalid",
          `${location.id} exists as both ${rel(index, first.dir)}/ and ${rel(index, location.dir)}/`,
          ["remove the stale copy of the Change directory"],
        ),
      );
    }
    seen.set(location.id, location);
  }
  let refreshed = false;
  for (const location of locations) refreshed = refreshChange(index, location) || refreshed;
  const indexed = index.database
    .prepare("SELECT id FROM changes UNION SELECT change_id FROM _dirs")
    .all() as { id: string }[];
  const gone = indexed.map((row) => row.id).filter((id) => !seen.has(id));
  if (gone.length > 0) {
    transaction(index, () => {
      for (const id of gone) removeChange(index, id);
    });
    refreshed = true;
  }
  return refreshed;
}

function dirStates(index: IndexDb, location: ChangeLocation): DirState[] {
  return WATCHED.map((name) => {
    const path = name === "" ? location.dir : join(location.dir, name);
    const stat = index.store.stat(path);
    return {
      path: rel(index, path),
      mtime: stat?.mtimeMs ?? -1,
      count: stat === undefined ? -1 : index.store.list(path).length,
    };
  });
}

function isFresh(index: IndexDb, location: ChangeLocation, states: readonly DirState[]): boolean {
  const change = index.database.prepare("SELECT dir FROM changes WHERE id = ?").get(location.id);
  if (change?.dir !== rel(index, location.dir)) return false;
  const rows = index.database
    .prepare("SELECT path, mtime, count, trusted FROM _dirs WHERE change_id = ?")
    .all(location.id) as { path: string; mtime: number; count: number; trusted: number }[];
  const recorded = new Map(rows.map((row) => [row.path, row]));
  return states.every((state) => {
    const row = recorded.get(state.path);
    return row?.trusted === 1 && row.mtime === state.mtime && row.count === state.count;
  });
}

function slowPath(index: IndexDb, location: ChangeLocation, states: readonly DirState[]): void {
  const { database, store } = index;
  const dir = rel(index, location.dir);
  const change = database.prepare("SELECT dir FROM changes WHERE id = ?").get(location.id);
  if (change !== undefined && change.dir !== dir) removeChange(index, location.id);

  const known = new Map(
    (
      database
        .prepare("SELECT path, ino, mtime, size FROM _files WHERE change_id = ?")
        .all(location.id) as { path: string; ino: number; mtime: number; size: number }[]
    ).map((row) => [row.path, row]),
  );
  const present = filesOf(index, location);
  const presentPaths = new Set(present.map((path) => rel(index, path)));
  for (const path of known.keys()) {
    if (!presentPaths.has(path)) removeFile(index, location.id, path);
  }

  const now = index.now();
  const recordFile = database.prepare(
    "INSERT OR REPLACE INTO _files (path, change_id, ino, mtime, size) VALUES (?, ?, ?, ?, ?)",
  );
  for (const path of present) {
    const stat = store.stat(path);
    if (stat === undefined) continue;
    const relPath = rel(index, path);
    const row = known.get(relPath);
    if (row?.ino === stat.ino && row.mtime === stat.mtimeMs && row.size === stat.size) {
      continue;
    }
    if (row !== undefined) removeFile(index, location.id, relPath);
    const document = readDocument(store, path);
    if (document === undefined || !("data" in document)) continue;
    insertRows(index, location, relPath, document.kind, document.data);
    const racy = now - stat.mtimeMs < RACY_MS;
    recordFile.run(relPath, location.id, stat.ino, racy ? -1 : stat.mtimeMs, stat.size);
  }

  database.prepare("DELETE FROM _dirs WHERE change_id = ?").run(location.id);
  const recordDir = database.prepare(
    "INSERT OR REPLACE INTO _dirs (path, change_id, mtime, count, trusted) VALUES (?, ?, ?, ?, ?)",
  );
  for (const state of states) {
    const trusted = now - state.mtime >= RACY_MS ? 1 : 0;
    recordDir.run(state.path, location.id, state.mtime, state.count, trusted);
  }
}

/** `change.md` and the files of `log/`, `attempts/` and `dispatch/`, as absolute paths. */
function filesOf(index: IndexDb, location: ChangeLocation): string[] {
  const files = [join(location.dir, "change.md")];
  for (const name of WATCHED) {
    if (name === "") continue;
    const dir = join(location.dir, name);
    for (const child of index.store.list(dir)) {
      if (!child.endsWith("/")) files.push(join(dir, child));
    }
  }
  return files;
}

function insertRows(
  index: IndexDb,
  location: ChangeLocation,
  path: string,
  kind: string,
  data: Data,
): void {
  const { database } = index;
  const text = (value: unknown): string | null =>
    typeof value === "string" || typeof value === "number" ? String(value) : null;
  const flag = (value: unknown): number => (value === true ? 1 : 0);
  switch (kind) {
    case "change":
      database
        .prepare(
          "INSERT OR REPLACE INTO changes (id, kind, profile, source, intent, at, author, archived, dir) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)",
        )
        .run(
          location.id,
          text(data.kind),
          text(data.profile),
          text(data.source),
          text(data.intent),
          text(data.at),
          text(data.author),
          location.archived ? 1 : 0,
          rel(index, location.dir),
        );
      return;
    case "entry": {
      const id = String(data.id);
      refuseDuplicate(index, "_entries", "id", location.id, id, path);
      database
        .prepare(
          `INSERT INTO _entries (change_id, id, type, summary, status, source, author, at, ticket,
            supersedes, review, severity, category, fingerprint, routed_to, to_stage, gate, profile,
            park, options, path) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        )
        .run(
          location.id,
          id,
          text(data.type),
          text(data.summary),
          text(data.status),
          text(data.source),
          text(data.author),
          text(data.at),
          text(data.ticket),
          text(data.supersedes),
          flag(data.review),
          text(data.severity),
          text(data.category),
          text(data.fingerprint),
          text(data["routed-to"]),
          text(data.to),
          text(data.gate),
          text(data.profile),
          flag(data.park),
          Array.isArray(data.options) ? JSON.stringify(data.options) : null,
          path,
        );
      const ref = database.prepare(
        "INSERT INTO refs (change_id, entry_id, position, ref) VALUES (?, ?, ?, ?)",
      );
      const refs = Array.isArray(data.refs) ? (data.refs as unknown[]) : [];
      refs.forEach((value, position) => ref.run(location.id, id, position, String(value)));
      return;
    }
    case "attempt":
      refuseDuplicate(index, "attempts", "ticket", location.id, String(data.ticket), path);
      database
        .prepare(
          `INSERT INTO attempts (change_id, ticket, loop, target, attempt, "of", scope, opened_at,
            closed_at, outcome, path) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        )
        .run(
          location.id,
          text(data.ticket),
          text(data.loop),
          text(data.target),
          Number(data.attempt),
          Number(data.of),
          JSON.stringify(data.scope),
          text(data["opened-at"]),
          text(data["closed-at"]),
          text(data.outcome),
          path,
        );
      return;
    case "dispatch":
      database
        .prepare(
          "INSERT OR REPLACE INTO dispatches (change_id, ticket, target, role, path) VALUES (?, ?, ?, ?, ?)",
        )
        .run(location.id, text(data.ticket), text(data.target), text(data.role), path);
      return;
    default:
      return;
  }
}

/** Two files carrying one id refuse as `readChange` does, naming both. */
function refuseDuplicate(
  index: IndexDb,
  table: "_entries" | "attempts",
  column: "id" | "ticket",
  changeId: string,
  id: string,
  path: string,
): void {
  const other = index.database
    .prepare(`SELECT path FROM ${table} WHERE change_id = ? AND ${column} = ?`)
    .get(changeId, id);
  if (other === undefined) return;
  throw new KernelRefusal(
    refuse("state/ledger-invalid", `${id} is used by both ${String(other.path)} and ${path}`, [
      "give one of the two a fresh id and fix the references to it",
    ]),
  );
}

function removeFile(index: IndexDb, changeId: string, path: string): void {
  const { database } = index;
  database
    .prepare(
      "DELETE FROM refs WHERE change_id = ? AND entry_id IN (SELECT id FROM _entries WHERE path = ?)",
    )
    .run(changeId, path);
  for (const table of ["_entries", "attempts", "dispatches", "_files"]) {
    database.prepare(`DELETE FROM ${table} WHERE path = ?`).run(path);
  }
  if (path.endsWith("/change.md")) {
    database.prepare("DELETE FROM changes WHERE id = ?").run(changeId);
  }
}

function removeChange(index: IndexDb, changeId: string): void {
  const { database } = index;
  database.prepare("DELETE FROM changes WHERE id = ?").run(changeId);
  for (const table of ["_entries", "refs", "attempts", "dispatches", "_files", "_dirs"]) {
    database.prepare(`DELETE FROM ${table} WHERE change_id = ?`).run(changeId);
  }
}

/** One `BEGIN IMMEDIATE` transaction: concurrent kernels serialise on it, a refusal leaves no trace. */
function transaction(index: IndexDb, work: () => void): void {
  index.database.exec("BEGIN IMMEDIATE");
  try {
    work();
    index.database.exec("COMMIT");
  } catch (error) {
    index.database.exec("ROLLBACK");
    throw error;
  }
}

/** Relative to the project root with `/`, as every path in the index. */
function rel(index: IndexDb, path: string): string {
  return relative(index.projectRoot, path).split(sep).join("/");
}
