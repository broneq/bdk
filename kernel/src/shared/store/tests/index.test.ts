// The rebuildable index (`kernel-state`, Rebuildable index; design D-3 to D-5
// and D-12 of T20): schema, refresh with its fast path and racy-time guard,
// refusals, typed queries and the read-only select. Logic runs on a memory
// store with an in-memory database; corruption and the warning run on disk.
import { spawnSync } from "node:child_process";
import { cpSync, mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { DatabaseSync } from "node:sqlite";
import { build } from "esbuild";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { KernelRefusal } from "../../refusal/index.ts";
import type { Refusal } from "../../refusal/index.ts";
import {
  fileStore,
  findEntry,
  INDEX_SCHEMA_VERSION,
  listChanges,
  listEntries,
  memoryStore,
  openIndex,
  openAttempts,
  refreshAll,
  refreshChange,
  selectReadOnly,
  ticketDispatch,
  writeDocument,
} from "../index.ts";
import type { ChangeLocation, IndexDb, Store } from "../index.ts";
import { entryPath } from "../state/ledger.ts";

const ROOT = "/repo";
const CHANGE = "2026-09-25-login";
const DIR = `${ROOT}/.bdk/changes/${CHANGE}`;
const LIVE: ChangeLocation = { id: CHANGE, dir: DIR, archived: false };
const FIXTURE = fileURLToPath(new URL("../../../../tests/fixtures/state", import.meta.url));
const AUTHOR = "Ada <ada@example.com>";

let opened: IndexDb[] = [];
afterEach(() => {
  for (const index of opened) index.close();
  opened = [];
});

async function open(store: Store, options: { now?: () => number } = {}): Promise<IndexDb> {
  const index = await openIndex(store, ROOT, { memory: true, ...options });
  opened.push(index);
  return index;
}

function writeChange(store: Store, dir = DIR, id = CHANGE, at = "2026-09-25T09:00:00.000Z"): void {
  writeDocument(store, `${dir}/change.md`, {
    data: {
      schema: 1,
      id,
      kind: "feature",
      profile: "small",
      intent: "Log in with a link.",
      source: "user",
      at,
      author: AUTHOR,
      overridden: [],
    },
    body: "",
  });
}

function writeEntryFile(
  store: Store,
  fields: Record<string, unknown> & { id: string; at: string },
  dir = DIR,
): string {
  const data = {
    schema: 1,
    type: "decision",
    summary: `summary of ${fields.id}`,
    status: "proposed",
    source: "kernel",
    author: AUTHOR,
    refs: ["change.md"],
    ...fields,
  };
  const path = entryPath(dir, data);
  writeDocument(store, path, { data, body: "" });
  return path;
}

function writeAttempt(store: Store, ticket: string, closed: boolean): void {
  writeDocument(store, `${DIR}/attempts/task-redispatch-02-3-${ticket}.md`, {
    data: {
      schema: 1,
      ticket,
      loop: "task-redispatch",
      target: "02-3",
      attempt: 1,
      of: 3,
      scope: "full",
      "opened-at": "2026-09-25T10:00:00.000Z",
      author: AUTHOR,
      ...(closed ? { "closed-at": "2026-09-25T10:30:00.000Z", outcome: "ok" } : {}),
    },
    body: "",
  });
}

function writeDispatch(store: Store, ticket: string, role: string): void {
  writeDocument(store, `${DIR}/dispatch/02-3-${role}-${ticket}.md`, {
    data: {
      schema: 1,
      ticket,
      target: "02-3",
      role,
      adapter: "worker",
      attempt: 1,
      of: 3,
      scope: "full",
      at: "2026-09-25T10:00:01.000Z",
      "kernel-version": "3.0.0-dev",
      "template-hash": `sha256:${"a".repeat(64)}`,
      report: `.bdk/changes/${CHANGE}/reports/02-3-${role}-${ticket}.md`,
    },
    body: "",
  });
}

function refusalOf(action: () => unknown): Refusal {
  try {
    action();
  } catch (error) {
    if (error instanceof KernelRefusal) return error.refusal;
    throw error;
  }
  throw new Error("expected a refusal");
}

/** Counts reads, so a test can prove the fast path reads nothing. */
function counting(store: Store): { store: Store; reads: () => number } {
  let reads = 0;
  return {
    store: {
      ...store,
      read(path) {
        reads++;
        return store.read(path);
      },
    },
    reads: () => reads,
  };
}

function seeded(): Store {
  const store = memoryStore();
  writeChange(store);
  writeEntryFile(store, {
    id: "L-aaaaaaa1",
    at: "2026-09-25T09:01:00.000Z",
    refs: ["02-3", "src/a.ts#login"],
  });
  writeEntryFile(store, {
    id: "L-aaaaaaa2",
    type: "finding",
    at: "2026-09-25T09:02:00.000Z",
    review: true,
    severity: "high",
    refs: ["src/a.ts"],
  });
  writeEntryFile(store, {
    id: "L-aaaaaaa3",
    type: "question",
    at: "2026-09-25T09:03:00.000Z",
    options: ["yes", "no"],
    park: true,
  });
  return store;
}

describe("schema", () => {
  it("creates schema version 4 with the public tables and the entries view", async () => {
    const index = await open(memoryStore());
    expect(INDEX_SCHEMA_VERSION).toBe(4);
    expect(index.schemaVersion()).toBe(4);
    const names = selectReadOnly(
      index,
      "SELECT name FROM sqlite_master WHERE type IN ('table', 'view') AND name NOT LIKE '\\_%' ESCAPE '\\' ORDER BY name",
    ).rows.flat();
    expect(names).toEqual(["attempts", "changes", "dispatches", "entries", "refs"]);
  });
});

describe("refresh", () => {
  it("indexes change.md, entries with their refs, attempts and dispatch packages", async () => {
    const store = seeded();
    writeAttempt(store, "A-bbbbbbb1", false);
    writeDispatch(store, "A-bbbbbbb1", "implementer");
    const index = await open(store);
    expect(refreshChange(index, LIVE)).toBe(true);

    expect(listChanges(index)).toEqual([
      expect.objectContaining({
        id: CHANGE,
        profile: "small",
        archived: false,
        dir: `.bdk/changes/${CHANGE}`,
      }),
    ]);
    const entries = listEntries(index, CHANGE);
    expect(entries.map((entry) => entry.id)).toEqual(["L-aaaaaaa1", "L-aaaaaaa2", "L-aaaaaaa3"]);
    expect(entries[0]).toEqual({
      changeId: CHANGE,
      id: "L-aaaaaaa1",
      type: "decision",
      summary: "summary of L-aaaaaaa1",
      status: "proposed",
      source: "kernel",
      author: AUTHOR,
      at: "2026-09-25T09:01:00.000Z",
      review: false,
      path: `.bdk/changes/${CHANGE}/log/20260925T090100Z-decision-L-aaaaaaa1.md`,
      refs: ["02-3", "src/a.ts#login"],
    });
    expect(entries[2]).toMatchObject({ park: true, options: ["yes", "no"] });
    expect(openAttempts(index, CHANGE)).toEqual([
      {
        ticket: "A-bbbbbbb1",
        loop: "task-redispatch",
        target: "02-3",
        attempt: 1,
        of: 3,
        scope: "full",
        openedAt: "2026-09-25T10:00:00.000Z",
      },
    ]);
    expect(ticketDispatch(index, CHANGE, "A-bbbbbbb1")).toStrictEqual({
      role: "implementer",
      path: `.bdk/changes/${CHANGE}/dispatch/02-3-implementer-A-bbbbbbb1.md`,
    });
  });

  it("indexes the input hash of a transition", async () => {
    const store = seeded();
    const hash = `sha256:${"b".repeat(64)}`;
    writeEntryFile(store, {
      id: "L-aaaaaaa4",
      type: "transition",
      at: "2026-09-25T09:04:00.000Z",
      refs: ["design", "design.md"],
      to: "design",
      "input-hash": hash,
    });
    const index = await open(store);
    refreshChange(index, LIVE);
    expect(listEntries(index, CHANGE, { type: "transition" })).toEqual([
      expect.objectContaining({ id: "L-aaaaaaa4", to: "design", inputHash: hash }),
    ]);
    expect(
      selectReadOnly(index, "SELECT input_hash FROM entries WHERE id = 'L-aaaaaaa4'").rows,
    ).toEqual([[hash]]);
  });

  it("indexes the state fixture on disk", async () => {
    const root = mkdtempSync(join(tmpdir(), "bdk-index-"));
    try {
      cpSync(FIXTURE, root, { recursive: true });
      const index = await openIndex(fileStore(), root);
      opened.push(index);
      expect(refreshAll(index)).toBe(true);
      const id = "2026-09-25-passwordless-login";
      const count = (sql: string): unknown => selectReadOnly(index, sql).rows[0]?.[0];
      expect(count("SELECT count(*) FROM changes")).toBe(2);
      expect(count("SELECT count(*) FROM attempts")).toBe(4);
      expect(count("SELECT count(*) FROM dispatches")).toBe(3);
      expect(listEntries(index, id).length).toBeGreaterThan(3);
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  it("derives superseded status and superseded_by, bare and qualified", async () => {
    const store = seeded();
    writeEntryFile(store, {
      id: "L-ccccccc1",
      at: "2026-09-25T09:05:00.000Z",
      supersedes: "L-aaaaaaa1",
    });
    writeEntryFile(store, {
      id: "L-ccccccc2",
      at: "2026-09-25T09:06:00.000Z",
      supersedes: `${CHANGE}/L-aaaaaaa2`,
    });
    const index = await open(store);
    refreshChange(index, LIVE);
    expect(findEntry(index, CHANGE, "L-aaaaaaa1")).toMatchObject({
      status: "superseded",
      supersededBy: "L-ccccccc1",
    });
    expect(findEntry(index, CHANGE, "L-aaaaaaa2")?.supersededBy).toBe("L-ccccccc2");
    expect(listEntries(index, CHANGE, { status: "superseded" }).map((entry) => entry.id)).toEqual([
      "L-aaaaaaa1",
      "L-aaaaaaa2",
    ]);
  });

  it("reads no file when nothing changed", async () => {
    const { store, reads } = counting(seeded());
    const index = await open(store);
    expect(refreshChange(index, LIVE)).toBe(true);
    const before = reads();
    expect(refreshChange(index, LIVE)).toBe(false);
    expect(reads()).toBe(before);
  });

  it("re-reads only the changed file on the slow path", async () => {
    const { store, reads } = counting(seeded());
    const index = await open(store);
    refreshChange(index, LIVE);
    const before = reads();
    writeEntryFile(store, { id: "L-ddddddd1", at: "2026-09-25T09:07:00.000Z" });
    expect(refreshChange(index, LIVE)).toBe(true);
    expect(reads() - before).toBe(1);
  });

  it("picks up an in-place rewrite and a removed file", async () => {
    const store = seeded();
    const index = await open(store);
    refreshChange(index, LIVE);
    writeEntryFile(store, { id: "L-aaaaaaa1", at: "2026-09-25T09:01:00.000Z", status: "accepted" });
    const removed = listEntries(index, CHANGE)[1]?.path ?? "";
    store.remove(`${ROOT}/${removed}`);
    refreshChange(index, LIVE);
    expect(listEntries(index, CHANGE).map((entry) => [entry.id, entry.status])).toEqual([
      ["L-aaaaaaa1", "accepted"],
      ["L-aaaaaaa3", "proposed"],
    ]);
  });

  it("does not trust a state recorded within two seconds of its mtime", async () => {
    const store = seeded();
    let now = 0;
    const index = await open(store, { now: () => now });
    refreshChange(index, LIVE);
    expect(refreshChange(index, LIVE)).toBe(true);
    now = 1e12;
    expect(refreshChange(index, LIVE)).toBe(true);
    expect(refreshChange(index, LIVE)).toBe(false);
  });

  it("refuses an invalid file with state/ledger-invalid and leaves the index unchanged", async () => {
    const store = seeded();
    const index = await open(store);
    refreshChange(index, LIVE);
    store.write(`${DIR}/log/20260925T091000Z-decision-L-eeeeeee1.md`, "---\nschema: 1\n---\n");
    writeEntryFile(store, { id: "L-eeeeeee2", at: "2026-09-25T09:11:00.000Z" });
    const refusal = refusalOf(() => refreshChange(index, LIVE));
    expect(refusal.rule).toBe("state/ledger-invalid");
    expect(refusal.why).toContain("20260925T091000Z-decision-L-eeeeeee1.md");
    expect(listEntries(index, CHANGE)).toHaveLength(3);
  });

  it("refuses two files carrying one id, naming both", async () => {
    const store = seeded();
    const index = await open(store);
    refreshChange(index, LIVE);
    writeEntryFile(store, { id: "L-aaaaaaa1", at: "2026-09-25T09:30:00.000Z", type: "risk" });
    const refusal = refusalOf(() => refreshChange(index, LIVE));
    expect(refusal.rule).toBe("state/ledger-invalid");
    expect(refusal.why).toContain("20260925T090100Z-decision-L-aaaaaaa1.md");
    expect(refusal.why).toContain("20260925T093000Z-risk-L-aaaaaaa1.md");
    expect(listEntries(index, CHANGE)).toHaveLength(3);
  });

  it("follows an archived Change and drops a removed one", async () => {
    const store = seeded();
    const other = `${ROOT}/.bdk/changes/archive/2026-09-20-old`;
    writeChange(store, other, "2026-09-20-old", "2026-09-20T09:00:00.000Z");
    const index = await open(store);
    refreshAll(index);
    expect(listChanges(index).map((change) => [change.id, change.archived])).toEqual([
      [CHANGE, false],
      ["2026-09-20-old", true],
    ]);
    store.remove(`${other}/change.md`);
    expect(refreshAll(index)).toBe(true);
    expect(listChanges(index).map((change) => change.id)).toEqual([CHANGE]);
  });

  it("re-reads a Change that moved to the archive", async () => {
    const store = seeded();
    const index = await open(store);
    refreshChange(index, LIVE);
    const archived = `${ROOT}/.bdk/changes/archive/${CHANGE}`;
    writeChange(store, archived);
    refreshChange(index, { id: CHANGE, dir: archived, archived: true });
    expect(listChanges(index)[0]).toMatchObject({
      archived: true,
      dir: `.bdk/changes/archive/${CHANGE}`,
    });
    expect(listEntries(index, CHANGE)).toEqual([]);
  });

  it("refuses one Change id both live and archived", async () => {
    const store = seeded();
    writeChange(store, `${ROOT}/.bdk/changes/archive/${CHANGE}`);
    const index = await open(store);
    expect(refusalOf(() => refreshAll(index)).rule).toBe("state/ledger-invalid");
  });
});

describe("typed queries", () => {
  it("filters entries by type, status, review and --for", async () => {
    const store = seeded();
    const index = await open(store);
    refreshChange(index, LIVE);
    const ids = (filter: Parameters<typeof listEntries>[2]): string[] =>
      listEntries(index, CHANGE, filter).map((entry) => entry.id);
    expect(ids({ type: "finding" })).toEqual(["L-aaaaaaa2"]);
    expect(ids({ review: true })).toEqual(["L-aaaaaaa2"]);
    expect(ids({ status: "accepted" })).toEqual([]);
    expect(ids({ for: "02" })).toEqual(["L-aaaaaaa1"]);
    expect(ids({ for: "02-3" })).toEqual(["L-aaaaaaa1"]);
    expect(ids({ for: "src/a.ts" })).toEqual(["L-aaaaaaa1", "L-aaaaaaa2"]);
    expect(ids({ for: "src/a" })).toEqual([]);
    expect(findEntry(index, CHANGE, "L-zzzzzzzz")).toBeUndefined();
  });

  it("answers a ticket's role only while its attempt is open and it has a package", async () => {
    const store = seeded();
    writeAttempt(store, "A-bbbbbbb1", true);
    writeDispatch(store, "A-bbbbbbb1", "implementer");
    writeAttempt(store, "A-bbbbbbb2", false);
    const index = await open(store);
    refreshChange(index, LIVE);
    expect(openAttempts(index, CHANGE).map((attempt) => attempt.ticket)).toEqual(["A-bbbbbbb2"]);
    expect(ticketDispatch(index, CHANGE, "A-bbbbbbb1")).toBeUndefined();
    expect(ticketDispatch(index, CHANGE, "A-bbbbbbb2")).toBeUndefined();
  });

  it("lists Changes by their latest entry, newest first", async () => {
    const store = seeded();
    const other = `${ROOT}/.bdk/changes/2026-09-26-other`;
    writeChange(store, other, "2026-09-26-other", "2026-09-26T08:00:00.000Z");
    const index = await open(store);
    refreshAll(index);
    expect(listChanges(index).map((change) => [change.id, change.updatedAt])).toEqual([
      ["2026-09-26-other", "2026-09-26T08:00:00.000Z"],
      [CHANGE, "2026-09-25T09:03:00.000Z"],
    ]);
  });
});

describe("selectReadOnly", () => {
  it("returns columns and rows in column order, duplicates included", async () => {
    const store = seeded();
    const index = await open(store);
    refreshChange(index, LIVE);
    const result = selectReadOnly(
      index,
      "SELECT type, count(*) FROM entries GROUP BY type ORDER BY type",
    );
    expect(result.columns).toEqual(["type", "count(*)"]);
    expect(result.rows).toEqual([
      ["decision", 1],
      ["finding", 1],
      ["question", 1],
    ]);
  });

  it("rejects a write whatever the statement text, and the index stays usable", async () => {
    const store = seeded();
    const index = await open(store);
    refreshChange(index, LIVE);
    expect(() => selectReadOnly(index, "DELETE FROM _entries")).toThrow();
    expect(() => selectReadOnly(index, "WITH x AS (SELECT 1) DELETE FROM _entries")).toThrow();
    expect(listEntries(index, CHANGE)).toHaveLength(3);
    writeEntryFile(store, { id: "L-fffffff1", at: "2026-09-25T09:40:00.000Z" });
    refreshChange(index, LIVE);
    expect(listEntries(index, CHANGE)).toHaveLength(4);
  });
});

describe("on disk", () => {
  let root: string;
  beforeEach(() => {
    root = mkdtempSync(join(tmpdir(), "bdk-index-"));
  });
  afterEach(() => {
    rmSync(root, { recursive: true, force: true });
  });
  const path = (): string => join(root, ".bdk/.machine/index.sqlite");

  it("creates the database with a busy timeout", async () => {
    const index = await openIndex(fileStore(), root);
    opened.push(index);
    expect(index.path).toBe(path());
    expect(index.database.prepare("PRAGMA busy_timeout").get()).toEqual({ timeout: 5000 });
  });

  it("rebuilds an index of another schema version", async () => {
    mkdirSync(join(root, ".bdk/.machine"), { recursive: true });
    const old = new DatabaseSync(path());
    old.exec("CREATE TABLE meta (key TEXT PRIMARY KEY, value TEXT NOT NULL)");
    old.exec("INSERT INTO meta VALUES ('schema_version', '1')");
    old.close();
    const index = await openIndex(fileStore(), root);
    opened.push(index);
    expect(index.schemaVersion()).toBe(4);
    expect(
      selectReadOnly(index, "SELECT count(*) FROM sqlite_master WHERE name = 'meta'").rows,
    ).toEqual([[0]]);
  });

  it("drops an index of version 3, which holds times to the second, and rebuilds it with milliseconds", async () => {
    const store = fileStore();
    const dir = join(root, ".bdk/changes", CHANGE);
    const location: ChangeLocation = { id: CHANGE, dir, archived: false };
    writeChange(store, dir);
    writeEntryFile(store, { id: "L-aaaaaaa1", at: "2026-09-25T09:01:00.000Z" }, dir);
    const first = await openIndex(store, root);
    refreshChange(first, location);
    first.database.exec("UPDATE _entries SET at = '2026-09-25T09:01:00Z'");
    first.database.exec("UPDATE _meta SET value = '3' WHERE key = 'schema_version'");
    first.close();

    const index = await openIndex(store, root);
    opened.push(index);
    expect(index.schemaVersion()).toBe(4);
    expect(refreshChange(index, location)).toBe(true);
    expect(listEntries(index, CHANGE).map((entry) => entry.at)).toEqual([
      "2026-09-25T09:01:00.000Z",
    ]);
  });

  it("rebuilds a file that is not a SQLite database", async () => {
    mkdirSync(join(root, ".bdk/.machine"), { recursive: true });
    writeFileSync(path(), "not a database, just bytes ".repeat(100));
    const index = await openIndex(fileStore(), root);
    opened.push(index);
    expect(index.schemaVersion()).toBe(4);
  });

  it("refuses state/corrupted-index when the index path is a directory", async () => {
    mkdirSync(path(), { recursive: true });
    const refusal = await openIndex(fileStore(), root).then(
      () => undefined,
      (error: unknown) => (error instanceof KernelRefusal ? error.refusal : undefined),
    );
    expect(refusal?.rule).toBe("state/corrupted-index");
    expect(refusal?.instead).toContain("bdk rebuild");
  });

  it("prints nothing on stderr, not even node:sqlite's ExperimentalWarning", async () => {
    const entry = join(root, "entry.ts");
    const store = fileURLToPath(new URL("../index.ts", import.meta.url));
    writeFileSync(
      entry,
      `import { fileStore, openIndex } from ${JSON.stringify(store)};\n` +
        `const index = await openIndex(fileStore(), ${JSON.stringify(root)});\n` +
        `process.stdout.write(String(index.schemaVersion()));\nindex.close();\n`,
    );
    const outfile = join(root, "entry.mjs");
    await build({
      entryPoints: [entry],
      outfile,
      bundle: true,
      platform: "node",
      format: "esm",
      // The same banner as kernel/build.mjs: the store carries `yaml`, whose
      // CommonJS code calls `require`.
      banner: {
        js: 'import { createRequire } from "node:module"; const require = createRequire(import.meta.url);',
      },
      logLevel: "silent",
    });
    const result = spawnSync(process.execPath, [outfile], { encoding: "utf8" });
    expect(result.stdout).toBe(String(INDEX_SCHEMA_VERSION));
    expect(result.stderr).toBe("");
  });
});
