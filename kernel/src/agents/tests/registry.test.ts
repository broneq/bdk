// The agent registry (`kernel-state`, Agent registry; T41-D6): rows written in
// either order, states derived from the signals and the heartbeat, the stale
// session end, replacement of a registry of another version, and its
// independence from the rebuildable index.
import { mkdtempSync, rmSync, utimesSync, writeFileSync, mkdirSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { DatabaseSync } from "node:sqlite";
import { afterEach, describe, expect, it } from "vitest";

import {
  AGENTS_SCHEMA_VERSION,
  agentsRegistryPath,
  fileStore,
  heartbeatPath,
  indexPath,
  openAgentRegistry,
  openIndex,
} from "../../shared/store/index.ts";
import type { AgentRegistry, Heartbeat } from "../../shared/store/index.ts";
import { deriveState } from "../domain/state.ts";
import type { Lease } from "../domain/state.ts";
import {
  endStaleSessions,
  findView,
  recordEnd,
  recordLink,
  recordStart,
} from "../use-cases/registry.ts";

const LEASE: Lease = { ttl: 300, openCallLimit: 720 };
const T0 = Date.parse("2026-09-30T10:00:00.000Z");
const at = (seconds: number): string => new Date(T0 + seconds * 1000).toISOString();

let opened: AgentRegistry[] = [];
let dirs: string[] = [];
afterEach(() => {
  for (const registry of opened) registry.close();
  for (const dir of dirs) rmSync(dir, { recursive: true, force: true });
  opened = [];
  dirs = [];
});

async function memory(beats: Record<string, Heartbeat> = {}): Promise<AgentRegistry> {
  const registry = await openAgentRegistry("/repo", {
    memory: true,
    heartbeat: (id) => beats[id],
  });
  opened.push(registry);
  return registry;
}

function scratch(): string {
  const dir = mkdtempSync(join(tmpdir(), "bdk-agents-"));
  dirs.push(dir);
  return dir;
}

describe("rows", () => {
  it("links before the start, as a background spawn does", async () => {
    const registry = await memory();
    recordLink(registry, {
      id: "a1",
      parent: "lead",
      session: "s1",
      type: "bdk:worker",
      package: ".bdk/changes/c/dispatch/02-3-implementer-A-1.md",
      ticket: "A-1",
      target: "02-3",
      at: at(0),
    });
    expect(findView(registry, "a1", T0 + 1000, LEASE)?.state).toBe("starting");
    recordStart(registry, { id: "a1", type: "bdk:worker", session: "s1", at: at(1) });
    const view = findView(registry, "a1", T0 + 2000, LEASE);
    expect(view).toMatchObject({ state: "running", parent: "lead", ticket: "A-1", target: "02-3" });
    recordEnd(registry, "a1", "subagent-stop", at(5));
    expect(findView(registry, "a1", T0 + 6000, LEASE)).toMatchObject({
      state: "ended",
      endedBy: "subagent-stop",
    });
  });

  it("starts before the link, as a foreground spawn does", async () => {
    const registry = await memory();
    recordStart(registry, { id: "a2", type: "bdk:runner", session: "s1", at: at(0) });
    expect(findView(registry, "a2", T0, LEASE)).toMatchObject({ state: "running", parent: null });
    recordLink(registry, { id: "a2", parent: "main", session: "s2", type: "other", at: at(3) });
    recordEnd(registry, "a2", "agent-result", at(3));
    expect(findView(registry, "a2", T0 + 4000, LEASE)).toMatchObject({
      state: "ended",
      parent: "main",
      session: "s1",
      type: "bdk:runner",
      endedBy: "agent-result",
    });
  });
});

describe("derived state", () => {
  const started = { startedMs: T0 };

  it("is suspect without a heartbeat once ttl passes", () => {
    expect(deriveState(started, T0 + 299_000, LEASE)).toBe("running");
    expect(deriveState(started, T0 + 301_000, LEASE)).toBe("suspect");
  });

  it("is suspect when the heartbeat is idle and older than ttl", () => {
    const signals = { ...started, heartbeat: { open: false, atMs: T0 + 60_000 } };
    expect(deriveState(signals, T0 + 350_000, LEASE)).toBe("running");
    expect(deriveState(signals, T0 + 361_000, LEASE)).toBe("suspect");
  });

  it("keeps a long open call running up to the open-call limit", () => {
    const signals = { ...started, heartbeat: { open: true, atMs: T0 } };
    expect(deriveState(signals, T0 + 8 * 60_000, LEASE)).toBe("running");
    expect(deriveState(signals, T0 + 13 * 60_000, LEASE)).toBe("suspect");
  });

  it("is starting when only linked, and suspect when the start never comes", () => {
    expect(deriveState({ linkedMs: T0 }, T0 + 1000, LEASE)).toBe("starting");
    expect(deriveState({ linkedMs: T0 }, T0 + 301_000, LEASE)).toBe("suspect");
  });

  it("is ended by a signal, and running again after a newer heartbeat", () => {
    const ended = { ...started, endedMs: T0 + 10_000 };
    expect(deriveState(ended, T0 + 11_000, LEASE)).toBe("ended");
    const revived = { ...ended, heartbeat: { open: false, atMs: T0 + 20_000 } };
    expect(deriveState(revived, T0 + 21_000, LEASE)).toBe("running");
  });

  it("turns a suspect agent running with the next heartbeat, with no write", async () => {
    const beats: Record<string, Heartbeat> = {};
    const registry = await memory(beats);
    recordStart(registry, { id: "a3", type: "bdk:worker", session: "s1", at: at(0) });
    expect(findView(registry, "a3", T0 + 400_000, LEASE)?.state).toBe("suspect");
    beats.a3 = { open: true, atMs: T0 + 399_000 };
    expect(findView(registry, "a3", T0 + 400_000, LEASE)?.state).toBe("running");
  });
});

describe("stale sessions", () => {
  it("ends silent agents of other sessions and keeps a live neighbour", async () => {
    const now = T0 + 3_600_000;
    const registry = await memory({
      old: { open: false, atMs: T0 },
      live: { open: false, atMs: now - 10_000 },
    });
    for (const id of ["old", "live"]) {
      recordStart(registry, { id, type: "bdk:worker", session: "other", at: at(0) });
    }
    recordStart(registry, { id: "mine", type: "bdk:worker", session: "this", at: at(0) });
    expect(endStaleSessions(registry, "this", now, LEASE, new Date(now).toISOString())).toEqual([
      "old",
    ]);
    expect(findView(registry, "old", now, LEASE)).toMatchObject({
      state: "ended",
      endedBy: "stale",
    });
    expect(findView(registry, "live", now, LEASE)?.state).toBe("running");
    expect(findView(registry, "mine", now, LEASE)?.endedBy).toBeNull();
  });
});

describe("file", () => {
  it("reads the heartbeat file: content and mtime", async () => {
    const root = scratch();
    const registry = await openAgentRegistry(root);
    opened.push(registry);
    const path = heartbeatPath(root, "a4");
    mkdirSync(join(root, ".bdk", ".machine", "agents"), { recursive: true });
    writeFileSync(path, "open");
    utimesSync(path, new Date(T0), new Date(T0));
    expect(registry.heartbeat("a4")).toEqual({ open: true, atMs: T0 });
    writeFileSync(path, "idle");
    expect(registry.heartbeat("a4")?.open).toBe(false);
    expect(registry.heartbeat("../a4")).toBeUndefined();
  });

  it("replaces a registry of another schema version with an empty one", async () => {
    const root = scratch();
    const first = await openAgentRegistry(root);
    recordStart(first, { id: "a5", type: "bdk:worker", session: "s1", at: at(0) });
    first.close();
    const database = new DatabaseSync(agentsRegistryPath(root));
    database
      .prepare("UPDATE _meta SET value = ? WHERE key = 'schema_version'")
      .run(String(AGENTS_SCHEMA_VERSION + 1));
    database.close();
    const second = await openAgentRegistry(root);
    opened.push(second);
    expect(second.schemaVersion()).toBe(AGENTS_SCHEMA_VERSION);
    expect(second.all()).toEqual([]);
  });

  it("replaces a file SQLite cannot open", async () => {
    const root = scratch();
    mkdirSync(join(root, ".bdk", ".machine"), { recursive: true });
    writeFileSync(
      agentsRegistryPath(root),
      "not a database, but long enough to be read as one".repeat(20),
    );
    const registry = await openAgentRegistry(root);
    opened.push(registry);
    expect(registry.all()).toEqual([]);
  });

  it("is not the index: deleting the index keeps every row, and the index has no agents table", async () => {
    const root = scratch();
    mkdirSync(join(root, ".bdk", "changes"), { recursive: true });
    const registry = await openAgentRegistry(root);
    opened.push(registry);
    recordStart(registry, { id: "a6", type: "bdk:worker", session: "s1", at: at(0) });
    const index = await openIndex(fileStore(), root);
    const tables = index.database
      .prepare("SELECT name FROM sqlite_master WHERE type IN ('table', 'view')")
      .all()
      .map((row) => row.name);
    index.close();
    expect(tables).not.toContain("agents");
    rmSync(indexPath(root));
    expect(registry.get("a6")?.type).toBe("bdk:worker");
  });
});
