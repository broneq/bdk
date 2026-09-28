// The `shared/store` cores of T22 on a real repository holding the state
// fixture: trailer progress and its mismatches, the checkpoint and rebuild.
import { execFileSync } from "node:child_process";
import {
  cpSync,
  mkdtempSync,
  readFileSync,
  realpathSync,
  rmSync,
  unlinkSync,
  writeFileSync,
  chmodSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import * as z from "zod";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { systemGit } from "../../git/index.ts";
import { KernelRefusal, refuse } from "../../refusal/index.ts";
import {
  checkpointChange,
  fileStore,
  generatePlanIndex,
  listEntries,
  openAttempts,
  openIndex,
  readAttempts,
  readPlanParts,
  rebuildChanges,
  taskProgress,
} from "../index.ts";
import type { ChangeLocation, IndexDb } from "../index.ts";

const FIXTURE = fileURLToPath(new URL("../../../../tests/fixtures/state", import.meta.url));
const ID = "2026-09-25-passwordless-login";

let root: string;
let dir: string;
let location: ChangeLocation;
const store = fileStore();
const opened: IndexDb[] = [];

beforeEach(() => {
  root = realpathSync(mkdtempSync(join(tmpdir(), "bdk-cores-")));
  cpSync(join(FIXTURE, ".bdk"), join(root, ".bdk"), { recursive: true });
  dir = join(root, ".bdk/changes", ID);
  location = { id: ID, dir, archived: false };
  sh("init", "--quiet");
  sh("config", "user.name", "BDK Test");
  sh("config", "user.email", "test@example.com");
  writeFileSync(join(root, "README.md"), "# app\n");
  sh("add", "-A");
  sh("commit", "--quiet", "-m", "initial");
});
afterEach(() => {
  for (const index of opened.splice(0)) index.close();
  rmSync(root, { recursive: true, force: true });
});

function sh(...args: string[]): string {
  return execFileSync("git", args, { cwd: root, encoding: "utf8" });
}

function commit(message: string, file = `f-${String(Math.random()).slice(2)}.txt`): string {
  writeFileSync(join(root, file), message);
  sh("add", file);
  sh("commit", "--quiet", "-m", message);
  return sh("rev-parse", "--short=7", "HEAD").trim();
}

async function index(): Promise<IndexDb> {
  const opened_ = await openIndex(store, root, { memory: true });
  opened.push(opened_);
  return opened_;
}

function closeOpenTicket(): void {
  const path = join(dir, "attempts/task-redispatch-02-3-A-4m8rt2wx.md");
  const text = readFileSync(path, "utf8").replace(
    "author: Jan Kowalski <jan@example.com>\n",
    "author: Jan Kowalski <jan@example.com>\nclosed-at: 2026-09-25T12:10:00Z\noutcome: ok\n",
  );
  writeFileSync(path, text);
}

const ENABLED = {};

describe("taskProgress", () => {
  it("maps each task to its newest trailer commit", async () => {
    commit("feat: store\n\nBDK-Change: " + ID + "\nBDK-Part: 01\nBDK-Task: 01-1");
    const parts = readPlanParts(store, dir);
    const progress = await taskProgress(systemGit, root, ID, parts, readAttempts(store, dir));
    expect(progress.mismatches).toStrictEqual([]);
    expect([...progress.committed.keys()]).toStrictEqual(["01-1"]);
    expect(progress.commits).toHaveLength(1);
  });

  it("names both sides of each trailer mismatch", async () => {
    const missing = commit(`feat: x\n\nBDK-Change: ${ID}\nBDK-Part: 02\nBDK-Task: 02-9`);
    const wrong = commit(`feat: y\n\nBDK-Change: ${ID}\nBDK-Part: 01\nBDK-Task: 02-3`);
    const partial = commit(`feat: z\n\nBDK-Change: ${ID}\nBDK-Part: 01`);
    const attempts = readAttempts(store, dir).map((record) =>
      record.data.ticket === "A-7f3kx2p9"
        ? { ...record, data: { ...record.data, target: "02-8" } }
        : record,
    );
    const progress = await taskProgress(systemGit, root, ID, readPlanParts(store, dir), attempts);
    expect(progress.mismatches).toStrictEqual([
      `commit ${partial} carries BDK-Change: ${ID} without BDK-Task`,
      `commit ${wrong} carries BDK-Part: 01 for BDK-Task: 02-3, but plan/parts/02-login.md holds 02-3`,
      `commit ${missing} carries BDK-Task: 02-9, but no plan part holds 02-9`,
      "attempt record A-7f3kx2p9 targets task 02-8, but no plan part holds 02-8",
    ]);
    expect(progress.committed.size).toBe(0);
  });
});

describe("checkpointChange", () => {
  const input = () => ({
    store,
    git: systemGit,
    projectRoot: root,
    change: { id: ID, dir },
    settings: ENABLED,
  });

  it("commits only the Change directory and leaves the user's staged file staged", async () => {
    closeOpenTicket();
    writeFileSync(join(root, "README.md"), "user edit\n");
    sh("add", "README.md");
    const result = await checkpointChange(input());
    expect(result).toStrictEqual({ done: true, commit: sh("rev-parse", "HEAD").trim() });
    expect(sh("log", "-1", "--format=%s").trim()).toBe(`chore(bdk): checkpoint ${ID}`);
    const files = sh("show", "--name-only", "--format=", "HEAD").trim().split("\n");
    expect(files.every((file) => file.startsWith(`.bdk/changes/${ID}/`))).toBe(true);
    expect(sh("diff", "--cached", "--name-only").trim()).toBe("README.md");
  });

  it("skips when disabled by policy", async () => {
    const result = await checkpointChange({
      ...input(),
      settings: { policy: { checkpoint: { enabled: false } } },
    });
    expect(result).toStrictEqual({ done: false, skipped: "policy.checkpoint.enabled is false" });
  });

  it("skips when nothing under the Change directory changed", async () => {
    closeOpenTicket();
    sh("add", "-A");
    sh("commit", "--quiet", "-m", "everything");
    const result = await checkpointChange(input());
    expect(result).toMatchObject({
      done: false,
      skipped: expect.stringMatching(/^nothing under/) as unknown,
    });
    expect(result).not.toHaveProperty("refusal");
  });

  it("skips with a refusal while a merge is in progress", async () => {
    writeFileSync(join(root, ".git/MERGE_HEAD"), sh("rev-parse", "HEAD"));
    const result = await checkpointChange(input());
    expect(result).toMatchObject({ done: false, refusal: { rule: "policy/git-in-progress" } });
  });

  it("skips with a refusal while a ticket is open", async () => {
    const result = await checkpointChange(input());
    expect(result).toMatchObject({
      done: false,
      skipped: expect.stringContaining("A-4m8rt2wx") as unknown,
      refusal: { rule: "policy/ticket-open" },
    });
  });

  it("skips with a refusal when a hook fails, never sweeping a staged file", async () => {
    closeOpenTicket();
    writeFileSync(join(root, "README.md"), "user edit\n");
    sh("add", "README.md");
    const head = sh("rev-parse", "HEAD");
    const hook = join(root, ".git/hooks/pre-commit");
    writeFileSync(hook, "#!/bin/sh\necho 'no checkpoints here'\nexit 1\n");
    chmodSync(hook, 0o755);
    const result = await checkpointChange(input());
    expect(result).toMatchObject({
      done: false,
      skipped: "a git hook rejected the checkpoint commit: no checkpoints here",
      refusal: { rule: "policy/git-hook-failed" },
    });
    expect(sh("rev-parse", "HEAD")).toBe(head);
    expect(sh("diff", "--cached", "--name-only")).toContain("README.md");
  });
});

describe("rebuildChanges", () => {
  it("rebuilds the index and counts entries, attempts and commits", async () => {
    commit(`feat: store\n\nBDK-Change: ${ID}\nBDK-Part: 01\nBDK-Task: 01-1`);
    const db = await index();
    const result = await rebuildChanges({ index: db, git: systemGit, locations: [location] });
    expect(result).toMatchObject({
      changes: 1,
      entries: store.list(join(dir, "log")).length,
      attempts: 4,
      commits: 1,
      migrated: [],
      warnings: [],
      mismatches: [],
    });
    expect(listEntries(db, ID)).toHaveLength(store.list(join(dir, "log")).length);
    expect(openAttempts(db, ID).map((attempt) => attempt.ticket)).toStrictEqual(["A-4m8rt2wx"]);
  });

  it("lets runtime/git-missing through instead of a warning", async () => {
    const missing = {
      ...systemGit,
      run: () => Promise.reject(new KernelRefusal(refuse("runtime/git-missing", "no git", ["x"]))),
    };
    await expect(
      rebuildChanges({ index: await index(), git: missing, locations: [location] }),
    ).rejects.toThrow(KernelRefusal);
  });

  it("regenerates both part indexes byte-identically", async () => {
    const plan = readFileSync(join(dir, "plan/index.md"), "utf8");
    const design = readFileSync(join(dir, "design/index.md"), "utf8");
    unlinkSync(join(dir, "plan/index.md"));
    writeFileSync(join(dir, "design/index.md"), "stale\n");
    const result = await rebuildChanges({
      index: await index(),
      git: systemGit,
      locations: [location],
    });
    expect(result.warnings).toStrictEqual([]);
    expect(readFileSync(join(dir, "plan/index.md"), "utf8")).toBe(plan);
    expect(readFileSync(join(dir, "design/index.md"), "utf8")).toBe(design);
    expect(plan).toBe(
      generatePlanIndex(
        readPlanParts(store, dir).map((part) => ({
          id: part.id,
          title: part.data.title,
          "depends-on": part.data["depends-on"],
        })),
      ),
    );
  });

  it("migrates an older document through a registered migration", async () => {
    const design = {
      name: "design",
      version: 2,
      schema: z.strictObject({
        schema: z.literal(2),
        title: z.string(),
        architecture: z.boolean().optional(),
        since: z.string(),
      }),
      migrations: [(data: Record<string, unknown>) => ({ ...data, schema: 2, since: "v1" })],
    };
    const result = await rebuildChanges({
      index: await index(),
      git: systemGit,
      locations: [location],
      kinds: { design },
    });
    expect(result.migrated).toStrictEqual([
      `.bdk/changes/${ID}/architecture.md`,
      `.bdk/changes/${ID}/design.md`,
    ]);
    expect(readFileSync(join(dir, "design.md"), "utf8")).toContain("since: v1");
  });

  it("lists a newer document in warnings, leaves it and indexes the rest", async () => {
    const path = join(dir, "log/20260925T094830Z-risk-L-2k6mz8ua.md");
    const newer = readFileSync(path, "utf8").replace(/^schema: 1$/m, "schema: 2");
    writeFileSync(path, newer);
    const db = await index();
    const result = await rebuildChanges({ index: db, git: systemGit, locations: [location] });
    expect(result.warnings).toStrictEqual([
      `.bdk/changes/${ID}/log/20260925T094830Z-risk-L-2k6mz8ua.md was written by a newer BDK`,
    ]);
    expect(readFileSync(path, "utf8")).toBe(newer);
    expect(listEntries(db, ID).map((entry) => entry.id)).not.toContain("L-2k6mz8ua");
    expect(result.entries).toBe(store.list(join(dir, "log")).length - 1);
  });

  it("reports trailer mismatches after writing the index", async () => {
    const bad = commit(`feat: x\n\nBDK-Change: ${ID}\nBDK-Part: 02\nBDK-Task: 02-9`);
    const db = await index();
    const result = await rebuildChanges({ index: db, git: systemGit, locations: [location] });
    expect(result.mismatches).toStrictEqual([
      `commit ${bad} carries BDK-Task: 02-9, but no plan part holds 02-9`,
    ]);
    expect(listEntries(db, ID).length).toBeGreaterThan(0);
  });
});
