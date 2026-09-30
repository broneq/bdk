// Typed reads over the index (`kernel-architecture`, shared/store: typed
// read queries). Slices read the index only through these functions and the
// read-only `selectReadOnly`, so none of them imports the `attempt` slice or
// writes SQL against the internal tables.
import type { EntryFacts } from "../state/derived.ts";
import type { IndexDb } from "./open.ts";

export interface EntryRow extends EntryFacts {
  readonly changeId: string;
  readonly summary: string;
  /** Derived: `superseded` when another entry names this one in `supersedes`. */
  readonly status: string;
  readonly author: string;
  readonly ticket?: string;
  readonly supersededBy?: string;
  readonly review: boolean;
  readonly severity?: string;
  readonly category?: string;
  readonly fingerprint?: string;
  /** A learning's globs. */
  readonly applies?: readonly string[];
  /** A learning's supporting attempts or entries. */
  readonly evidence?: readonly string[];
  readonly gate?: string;
  /** `input-hash` of a transition written by `done`. */
  readonly inputHash?: string;
  /** Relative to the project root. */
  readonly path: string;
}

export interface EntryFilter {
  readonly type?: string;
  readonly status?: string;
  readonly review?: boolean;
  /**
   * A ref equal to the value, a task ref of a part (`02` matches `02-3`) or a
   * symbol ref of a file (`src/a.ts` matches `src/a.ts#login`).
   */
  readonly for?: string;
}

export interface ChangeRow {
  readonly id: string;
  readonly kind: string;
  readonly profile: string;
  readonly source: string;
  readonly intent: string;
  readonly at: string;
  readonly author: string;
  readonly archived: boolean;
  /** Relative to the project root. */
  readonly dir: string;
  /** The latest `at` of the Change's entries, or of `change.md` without entries. */
  readonly updatedAt: string;
}

type Row = Record<string, unknown>;

/** The Change's entries matching the filter, ordered by `at` then id. */
export function listEntries(
  index: IndexDb,
  changeId: string,
  filter: EntryFilter = {},
): EntryRow[] {
  const where = ["e.change_id = ?"];
  const params: (string | number)[] = [changeId];
  if (filter.type !== undefined) {
    where.push("e.type = ?");
    params.push(filter.type);
  }
  if (filter.status !== undefined) {
    where.push("e.status = ?");
    params.push(filter.status);
  }
  if (filter.review === true) where.push("e.review = 1");
  if (filter.for !== undefined) {
    const value = filter.for;
    const prefix = /^\d{2}$/.test(value) ? `${value}-` : `${value}#`;
    where.push(
      "EXISTS (SELECT 1 FROM refs r WHERE r.change_id = e.change_id AND r.entry_id = e.id AND (r.ref = ? OR substr(r.ref, 1, ?) = ?))",
    );
    params.push(value, prefix.length, prefix);
  }
  const rows = index.database
    .prepare(`SELECT * FROM entries e WHERE ${where.join(" AND ")} ORDER BY e.at, e.id`)
    .all(...params) as Row[];
  const refs = refsOf(index, changeId);
  return rows.map((row) => toEntry(row, refs.get(String(row.id)) ?? []));
}

/** One entry of the Change, or undefined. */
export function findEntry(index: IndexDb, changeId: string, id: string): EntryRow | undefined {
  const row = index.database
    .prepare("SELECT * FROM entries WHERE change_id = ? AND id = ?")
    .get(changeId, id) as Row | undefined;
  if (row === undefined) return undefined;
  const refs = index.database
    .prepare("SELECT ref FROM refs WHERE change_id = ? AND entry_id = ? ORDER BY position")
    .all(changeId, id) as { ref: string }[];
  return toEntry(
    row,
    refs.map((ref) => ref.ref),
  );
}

/** Entries of every indexed Change, archived ones included, newest first; `types` narrows them. */
export function listAllEntries(index: IndexDb, types?: readonly string[]): EntryRow[] {
  const where = types === undefined ? "" : `WHERE e.type IN (${types.map(() => "?").join(", ")})`;
  const rows = index.database
    .prepare(`SELECT * FROM entries e ${where} ORDER BY e.at DESC, e.change_id, e.id`)
    .all(...(types ?? [])) as Row[];
  const refs = new Map<string, string[]>();
  const all = index.database
    .prepare("SELECT change_id, entry_id, ref FROM refs ORDER BY change_id, entry_id, position")
    .all() as { change_id: string; entry_id: string; ref: string }[];
  for (const row of all) {
    const key = `${row.change_id}/${row.entry_id}`;
    refs.set(key, [...(refs.get(key) ?? []), row.ref]);
  }
  return rows.map((row) =>
    toEntry(row, refs.get(`${String(row.change_id)}/${String(row.id)}`) ?? []),
  );
}

/** One finding fingerprint an attempt record keeps (`kernel-state`, Attempt record). */
export interface AttemptFindingRow {
  readonly changeId: string;
  readonly ticket: string;
  readonly fingerprint: string;
  readonly type: string;
  readonly file: string;
  readonly symbol?: string;
  /** The attempt's `closed-at`, or `opened-at` while it is open. */
  readonly at: string;
}

/** The findings of every attempt record, archived Changes included, newest first. */
export function listAttemptFindings(index: IndexDb): AttemptFindingRow[] {
  const rows = index.database
    .prepare(
      `SELECT f.change_id, f.ticket, f.fingerprint, f.type, f.file, f.symbol,
         COALESCE(a.closed_at, a.opened_at) AS at
       FROM findings f JOIN attempts a ON a.change_id = f.change_id AND a.ticket = f.ticket
       ORDER BY at DESC, f.change_id, f.ticket, f.position`,
    )
    .all() as Row[];
  return rows.map((row) =>
    omitUndefined<AttemptFindingRow>({
      changeId: String(row.change_id),
      ticket: String(row.ticket),
      fingerprint: String(row.fingerprint),
      type: String(row.type),
      file: String(row.file),
      symbol: typeof row.symbol === "string" ? row.symbol : undefined,
      at: String(row.at),
    }),
  );
}

/** True when the Change holds an attempt record of the ticket. */
export function hasAttempt(index: IndexDb, changeId: string, ticket: string): boolean {
  return (
    index.database
      .prepare("SELECT 1 FROM attempts WHERE change_id = ? AND ticket = ?")
      .get(changeId, ticket) !== undefined
  );
}

export interface OpenAttempt {
  readonly ticket: string;
  readonly loop: string;
  readonly target: string;
  readonly attempt: number;
  readonly of: number;
  readonly scope: string;
  readonly openedAt: string;
}

/** Attempt records of the Change without an outcome, oldest first. */
export function openAttempts(index: IndexDb, changeId: string): OpenAttempt[] {
  const rows = index.database
    .prepare(
      `SELECT ticket, loop, target, attempt, "of", scope, opened_at FROM attempts
       WHERE change_id = ? AND closed_at IS NULL ORDER BY opened_at, ticket`,
    )
    .all(changeId) as Row[];
  return rows.map((row) => ({
    ticket: String(row.ticket),
    loop: String(row.loop),
    target: String(row.target),
    attempt: Number(row.attempt),
    of: Number(row.of),
    scope: JSON.parse(String(row.scope)) as string,
    openedAt: String(row.opened_at),
  }));
}

/** Every indexed Change, archived ones included, newest `updatedAt` first. */
export function listChanges(index: IndexDb): ChangeRow[] {
  return selectChanges(index, "", []);
}

/** One indexed Change, or undefined. */
export function findChangeRow(index: IndexDb, changeId: string): ChangeRow | undefined {
  return selectChanges(index, "WHERE c.id = ?", [changeId])[0];
}

function selectChanges(index: IndexDb, where: string, params: string[]): ChangeRow[] {
  const rows = index.database
    .prepare(
      `SELECT c.*, COALESCE((SELECT max(at) FROM _entries e WHERE e.change_id = c.id), c.at) AS updated_at
       FROM changes c ${where} ORDER BY updated_at DESC, c.id`,
    )
    .all(...params) as Row[];
  return rows.map((row) => ({
    id: String(row.id),
    kind: String(row.kind),
    profile: String(row.profile),
    source: String(row.source),
    intent: String(row.intent),
    at: String(row.at),
    author: String(row.author),
    archived: row.archived === 1,
    dir: String(row.dir),
    updatedAt: String(row.updated_at),
  }));
}

export interface SelectResult {
  readonly columns: string[];
  readonly rows: unknown[][];
}

/**
 * Runs one statement with `PRAGMA query_only` on, so it cannot change the
 * index whatever its text. SQLite's own errors are thrown unchanged.
 */
export function selectReadOnly(index: IndexDb, sql: string): SelectResult {
  const { database } = index;
  database.exec("PRAGMA query_only = ON");
  try {
    const statement = database.prepare(sql);
    // Node 22.16 and later name every column, duplicates included; older
    // lines only give the keys of the row objects.
    if (typeof statement.columns === "function" && "setReturnArrays" in statement) {
      statement.setReturnArrays(true);
      const columns = statement.columns().map((column) => column.name);
      return { columns, rows: statement.all() as unknown as unknown[][] };
    }
    const objects = statement.all() as Row[];
    const columns = objects[0] === undefined ? [] : Object.keys(objects[0]);
    return { columns, rows: objects.map((row) => columns.map((column) => row[column])) };
  } finally {
    database.exec("PRAGMA query_only = OFF");
  }
}

function refsOf(index: IndexDb, changeId: string): Map<string, string[]> {
  const rows = index.database
    .prepare("SELECT entry_id, ref FROM refs WHERE change_id = ? ORDER BY entry_id, position")
    .all(changeId) as { entry_id: string; ref: string }[];
  const map = new Map<string, string[]>();
  for (const row of rows) {
    const list = map.get(row.entry_id) ?? [];
    list.push(row.ref);
    map.set(row.entry_id, list);
  }
  return map;
}

function toEntry(row: Row, refs: readonly string[]): EntryRow {
  const optional = (value: unknown): string | undefined =>
    typeof value === "string" || typeof value === "number" ? String(value) : undefined;
  const listOf = (value: unknown): string[] | undefined =>
    typeof value === "string" ? (JSON.parse(value) as string[]) : undefined;
  return omitUndefined<EntryRow>({
    changeId: String(row.change_id),
    id: String(row.id),
    type: String(row.type),
    summary: String(row.summary),
    status: String(row.status),
    source: String(row.source),
    author: String(row.author),
    at: String(row.at),
    ticket: optional(row.ticket),
    supersedes: optional(row.supersedes),
    supersededBy: optional(row.superseded_by),
    review: row.review === 1,
    severity: optional(row.severity),
    category: optional(row.category),
    fingerprint: optional(row.fingerprint),
    applies: listOf(row.applies),
    evidence: listOf(row.evidence),
    to: optional(row.to_stage),
    gate: optional(row.gate),
    inputHash: optional(row.input_hash),
    profile: optional(row.profile),
    park: row.park === 1 ? true : undefined,
    options: listOf(row.options),
    path: String(row.path),
    refs: [...refs],
  });
}

/** Drops keys whose value is undefined, so rows compare and serialise cleanly. */
function omitUndefined<T extends object>(value: { readonly [K in keyof T]: T[K] | undefined }): T {
  return Object.fromEntries(Object.entries(value).filter(([, field]) => field !== undefined)) as T;
}
