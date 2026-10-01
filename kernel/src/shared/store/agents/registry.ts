// The agent registry (`kernel-state`, Agent registry; T41-D6): live machine
// state in `.bdk/.machine/agents.sqlite`, never a table of the rebuildable
// index, since no committed file can rebuild it. A file of another schema
// version, or one SQLite cannot open, is replaced by an empty registry. The
// heartbeat files under `.bdk/.machine/agents/` are written by the guard
// scripts and read here.
import { mkdirSync, readFileSync, rmSync, statSync } from "node:fs";
import { dirname, join } from "node:path";
import type { DatabaseSync, SQLInputValue } from "node:sqlite";

import { loadSqlite } from "../sqlite.ts";

export const AGENTS_SCHEMA_VERSION = 1;

const BUSY_TIMEOUT_MS = 5000;

export type EndedBy = "subagent-stop" | "task-stop" | "agent-result" | "stale";

export interface AgentRow {
  readonly id: string;
  readonly type: string | null;
  readonly session: string | null;
  /** An agent id, `main`, or null before the parent linked it. */
  readonly parent: string | null;
  /** Relative to the project root. */
  readonly package: string | null;
  readonly ticket: string | null;
  readonly target: string | null;
  readonly startedAt: string | null;
  readonly linkedAt: string | null;
  readonly endedAt: string | null;
  readonly endedBy: EndedBy | null;
  readonly continuations: number;
  /** What the continuation check saw at its last block; progress resets `continuations`. */
  readonly progress: string | null;
}

/** The fields a write sets; an absent field keeps its stored value. */
export type AgentFields = Partial<Omit<AgentRow, "id">>;

export interface SessionRow {
  readonly session: string;
  readonly continuations: number;
  readonly progress: string | null;
}

export interface MessageRow {
  readonly seq: number;
  readonly from: string;
  readonly to: string;
  readonly entry: string;
  readonly at: string;
}

/** The last tool call of an agent: `open` between PreToolUse and PostToolUse. */
export interface Heartbeat {
  readonly open: boolean;
  readonly atMs: number;
}

export type HeartbeatReader = (id: string) => Heartbeat | undefined;

export interface AgentRegistry {
  readonly path: string;
  get(id: string): AgentRow | undefined;
  /** Every row, oldest first by the earlier of start and link. */
  all(): AgentRow[];
  /** Inserts the row or sets the given fields of the stored one. */
  put(id: string, fields: AgentFields): void;
  session(session: string): SessionRow | undefined;
  putSession(row: SessionRow): void;
  addMessage(message: Omit<MessageRow, "seq">): void;
  /** Messages to `to` that no `wait` returned yet, oldest first. */
  undelivered(to: string): MessageRow[];
  markDelivered(seqs: readonly number[]): void;
  /** The event keys a `wait` of `agent` already returned. */
  seen(agent: string): Set<string>;
  markSeen(agent: string, keys: readonly string[]): void;
  heartbeat: HeartbeatReader;
  /** Runs `work` in one `BEGIN IMMEDIATE` transaction. */
  transaction<T>(work: () => T): T;
  schemaVersion(): number;
  close(): void;
}

export interface RegistryOptions {
  /** An in-memory database, for unit tests. */
  readonly memory?: boolean;
  /** Replaces the heartbeat files, for unit tests. */
  readonly heartbeat?: HeartbeatReader;
}

export function agentsRegistryPath(projectRoot: string): string {
  return join(projectRoot, ".bdk", ".machine", "agents.sqlite");
}

export function heartbeatPath(projectRoot: string, id: string): string {
  return join(projectRoot, ".bdk", ".machine", "agents", id);
}

/** How a command opens the registry: `main.ts` binds `fileRegistry`, unit tests `memoryRegistry`. */
export type RegistryOpener = (projectRoot: string) => Promise<AgentRegistry>;

export const fileRegistry: RegistryOpener = (projectRoot) => openAgentRegistry(projectRoot);

/** Opens the registry, runs `work` and always closes it. */
export async function withRegistry<T>(
  opener: RegistryOpener,
  projectRoot: string,
  work: (registry: AgentRegistry) => T | Promise<T>,
): Promise<T> {
  const registry = await opener(projectRoot);
  try {
    return await work(registry);
  } finally {
    registry.close();
  }
}

const TABLES = `
CREATE TABLE _meta (key TEXT PRIMARY KEY, value TEXT NOT NULL);
CREATE TABLE agents (
  id TEXT PRIMARY KEY, type TEXT, session TEXT, parent TEXT, package TEXT, ticket TEXT,
  target TEXT, started_at TEXT, linked_at TEXT, ended_at TEXT, ended_by TEXT,
  continuations INTEGER NOT NULL DEFAULT 0, progress TEXT
);
CREATE INDEX agents_parent ON agents (parent);
CREATE TABLE sessions (
  session TEXT PRIMARY KEY, continuations INTEGER NOT NULL, progress TEXT
);
CREATE TABLE messages (
  seq INTEGER PRIMARY KEY AUTOINCREMENT, sender TEXT NOT NULL, recipient TEXT NOT NULL,
  entry TEXT NOT NULL, at TEXT NOT NULL, delivered INTEGER NOT NULL DEFAULT 0
);
CREATE INDEX messages_recipient ON messages (recipient, delivered);
CREATE TABLE seen (agent TEXT NOT NULL, key TEXT NOT NULL, PRIMARY KEY (agent, key));
`;

const COLUMNS: Readonly<Record<keyof AgentFields, string>> = {
  type: "type",
  session: "session",
  parent: "parent",
  package: "package",
  ticket: "ticket",
  target: "target",
  startedAt: "started_at",
  linkedAt: "linked_at",
  endedAt: "ended_at",
  endedBy: "ended_by",
  continuations: "continuations",
  progress: "progress",
};

export async function openAgentRegistry(
  projectRoot: string,
  options: RegistryOptions = {},
): Promise<AgentRegistry> {
  const { DatabaseSync } = await loadSqlite();
  const path = options.memory === true ? ":memory:" : agentsRegistryPath(projectRoot);
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
    // Live state only: losing it loses the view of the agents running now.
    for (const suffix of ["", "-wal", "-shm"]) rmSync(`${path}${suffix}`, { force: true });
    database = connect();
  }

  const heartbeat = options.heartbeat ?? fileHeartbeat(projectRoot);
  let depth = 0;
  // Nested calls join the outer transaction, so a use case can group writes.
  const transaction = <T>(work: () => T): T => {
    if (depth > 0) return work();
    database.exec("BEGIN IMMEDIATE");
    depth += 1;
    try {
      const result = work();
      database.exec("COMMIT");
      return result;
    } catch (error) {
      database.exec("ROLLBACK");
      throw error;
    } finally {
      depth -= 1;
    }
  };

  return {
    path,
    get: (id) => {
      const row = database.prepare("SELECT * FROM agents WHERE id = ?").get(id);
      return row === undefined ? undefined : agentRow(row);
    },
    all: () =>
      database
        .prepare(
          "SELECT * FROM agents ORDER BY coalesce(min(started_at, linked_at), started_at, linked_at, ''), id",
        )
        .all()
        .map(agentRow),
    put: (id, fields) => {
      const entries = (
        Object.entries(fields) as [keyof AgentFields, SQLInputValue | undefined][]
      ).filter((entry): entry is [keyof AgentFields, SQLInputValue] => entry[1] !== undefined);
      transaction(() => {
        database.prepare("INSERT OR IGNORE INTO agents (id) VALUES (?)").run(id);
        if (entries.length === 0) return;
        const sets = entries.map(([key]) => `${COLUMNS[key]} = ?`).join(", ");
        database
          .prepare(`UPDATE agents SET ${sets} WHERE id = ?`)
          .run(...entries.map(([, value]) => value), id);
      });
    },
    session: (session) => {
      const row = database.prepare("SELECT * FROM sessions WHERE session = ?").get(session);
      if (row === undefined) return undefined;
      return {
        session: String(row.session),
        continuations: Number(row.continuations),
        progress: nullable(row.progress),
      };
    },
    putSession: (row) => {
      transaction(() =>
        database
          .prepare(
            "INSERT INTO sessions (session, continuations, progress) VALUES (?, ?, ?) ON CONFLICT (session) DO UPDATE SET continuations = excluded.continuations, progress = excluded.progress",
          )
          .run(row.session, row.continuations, row.progress),
      );
    },
    addMessage: (message) => {
      transaction(() =>
        database
          .prepare("INSERT INTO messages (sender, recipient, entry, at) VALUES (?, ?, ?, ?)")
          .run(message.from, message.to, message.entry, message.at),
      );
    },
    undelivered: (to) =>
      database
        .prepare(
          "SELECT seq, sender, recipient, entry, at FROM messages WHERE recipient = ? AND delivered = 0 ORDER BY seq",
        )
        .all(to)
        .map((row) => ({
          seq: Number(row.seq),
          from: String(row.sender),
          to: String(row.recipient),
          entry: String(row.entry),
          at: String(row.at),
        })),
    markDelivered: (seqs) => {
      if (seqs.length === 0) return;
      transaction(() => {
        const statement = database.prepare("UPDATE messages SET delivered = 1 WHERE seq = ?");
        for (const seq of seqs) statement.run(seq);
      });
    },
    seen: (agent) =>
      new Set(
        database
          .prepare("SELECT key FROM seen WHERE agent = ?")
          .all(agent)
          .map((row) => String(row.key)),
      ),
    markSeen: (agent, keys) => {
      if (keys.length === 0) return;
      transaction(() => {
        const statement = database.prepare("INSERT OR IGNORE INTO seen (agent, key) VALUES (?, ?)");
        for (const key of keys) statement.run(agent, key);
      });
    },
    heartbeat,
    transaction,
    schemaVersion: () => currentVersion(database) ?? 0,
    close: () => {
      database.close();
    },
  };
}

/**
 * An opener for tests: one in-memory registry per project root, kept across
 * opens as the file would be, so a hook's write is visible to the next command.
 */
export const memoryRegistry = (heartbeat?: HeartbeatReader): RegistryOpener => {
  const opened = new Map<string, Promise<AgentRegistry>>();
  return async (projectRoot) => {
    let registry = opened.get(projectRoot);
    if (registry === undefined) {
      registry = openAgentRegistry(projectRoot, {
        memory: true,
        ...(heartbeat === undefined ? {} : { heartbeat }),
      });
      opened.set(projectRoot, registry);
    }
    return { ...(await registry), close: () => undefined };
  };
};

/** Reads `.bdk/.machine/agents/<id>`: its content is `open` or `idle`, its mtime the time. */
export function fileHeartbeat(projectRoot: string): HeartbeatReader {
  return (id) => {
    if (!/^[A-Za-z0-9_-]+$/.test(id)) return undefined;
    const path = heartbeatPath(projectRoot, id);
    const stats = statSync(path, { throwIfNoEntry: false });
    if (stats === undefined) return undefined;
    try {
      return { open: readFileSync(path, "utf8").trim() === "open", atMs: stats.mtimeMs };
    } catch {
      return undefined;
    }
  };
}

function ensureSchema(database: DatabaseSync): void {
  if (currentVersion(database) === AGENTS_SCHEMA_VERSION) return;
  database.exec("BEGIN IMMEDIATE");
  try {
    if (currentVersion(database) !== AGENTS_SCHEMA_VERSION) {
      const tables = database
        .prepare("SELECT name FROM sqlite_master WHERE type = 'table' AND name NOT LIKE 'sqlite_%'")
        .all() as { name: string }[];
      for (const { name } of tables) database.exec(`DROP TABLE IF EXISTS "${name}"`);
      database.exec(TABLES);
      database
        .prepare("INSERT INTO _meta (key, value) VALUES ('schema_version', ?)")
        .run(String(AGENTS_SCHEMA_VERSION));
    }
    database.exec("COMMIT");
  } catch (error) {
    database.exec("ROLLBACK");
    throw error;
  }
}

function currentVersion(database: DatabaseSync): number | undefined {
  const table = database
    .prepare("SELECT 1 FROM sqlite_master WHERE type = 'table' AND name = '_meta'")
    .get();
  if (table === undefined) return undefined;
  const row = database.prepare("SELECT value FROM _meta WHERE key = 'schema_version'").get();
  return row === undefined ? undefined : Number(row.value);
}

function nullable(value: unknown): string | null {
  if (typeof value === "string") return value;
  return typeof value === "number" || typeof value === "bigint" ? String(value) : null;
}

function agentRow(row: Record<string, unknown>): AgentRow {
  return {
    id: String(row.id),
    type: nullable(row.type),
    session: nullable(row.session),
    parent: nullable(row.parent),
    package: nullable(row.package),
    ticket: nullable(row.ticket),
    target: nullable(row.target),
    startedAt: nullable(row.started_at),
    linkedAt: nullable(row.linked_at),
    endedAt: nullable(row.ended_at),
    endedBy: nullable(row.ended_by) as EndedBy | null,
    continuations: Number(row.continuations),
    progress: nullable(row.progress),
  };
}
