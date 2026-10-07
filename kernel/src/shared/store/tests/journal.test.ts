// The run journal (`kernel-state`, Run journal): one line per kind, the value
// and line caps, the bound by halving under the lock, no journal without
// `.bdk/`, swallowed write errors and whole lines under parallel appends.
import { spawn } from "node:child_process";
import { mkdirSync, mkdtempSync, readFileSync, rmSync, statSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { build } from "esbuild";
import { afterEach, describe, expect, it } from "vitest";

import {
  appendJournal,
  JOURNAL_LIMIT_BYTES,
  JOURNAL_LINE_BYTES,
  journalLine,
  journalPath,
} from "../journal.ts";
import type { JournalLine } from "../journal.ts";
import type { LockWait } from "../lock.ts";
import { fileStore, memoryStore } from "../store.ts";
import type { Store } from "../store.ts";

const ROOT = "/repo";
const PATH = journalPath(ROOT);
const AT = "2026-10-05T14:02:11.004Z";

/** A wait that never sleeps and gives up at once on a live holder. */
const NO_WAIT: LockWait = {
  waitMs: 0,
  pollMs: 1,
  pid: 7,
  now: () => 0,
  sleep: () => Promise.resolve(),
  alive: () => true,
};

type CommandLine = Extract<JournalLine, { kind: "command" }>;

function command(overrides: Partial<CommandLine> = {}): CommandLine {
  return {
    v: 1,
    kind: "command",
    at: AT,
    command: "part-list",
    args: ["--json"],
    exit: 0,
    rule: null,
    ticket: null,
    change: null,
    ms: 12,
    ...overrides,
  };
}

function projectStore(): Store {
  return memoryStore({ [`${ROOT}/.bdk/settings.json`]: "{}\n" });
}

function lines(store: Store): unknown[] {
  return (store.read(PATH) ?? "")
    .split("\n")
    .filter((line) => line !== "")
    .map((line) => JSON.parse(line) as unknown);
}

describe("appendJournal", () => {
  it("appends one valid line per kind", async () => {
    const store = projectStore();
    const all: JournalLine[] = [
      command(),
      {
        ...command({ exit: 2, rule: "guard/subagent-kernel-command" }),
        kind: "guard",
        agent: "a3f9",
      },
      {
        v: 1,
        kind: "session",
        at: AT,
        session: "s-1",
        transcript: "/home/u/.claude/projects/p/s-1.jsonl",
        source: "startup",
        bdk: "3.0.0",
        commit: null,
        host: null,
      },
      {
        v: 1,
        kind: "agent-start",
        at: AT,
        agent: "a3f9",
        type: "bdk:worker",
        parent: null,
        ticket: "A-k2m4",
        session: "s-1",
      },
      {
        v: 1,
        kind: "agent-stop",
        at: AT,
        agent: "a3f9",
        transcript: null,
        by: "task-stop",
        session: "s-1",
      },
      { v: 1, kind: "question", at: AT, agent: "main", count: 2, session: "s-1" },
    ];
    for (const line of all) await appendJournal(store, ROOT, line);
    const written = lines(store);
    expect(written).toStrictEqual(all);
    for (const line of written) expect(journalLine.safeParse(line).success).toBe(true);
  });

  it("cuts each argument to 200 characters and drops trailing arguments past 4 KiB", async () => {
    const store = projectStore();
    await appendJournal(store, ROOT, command({ args: ["x".repeat(500), "--json"] }));
    await appendJournal(
      store,
      ROOT,
      command({ args: Array.from({ length: 60 }, () => "y".repeat(200)) }),
    );
    const [cut, long] = lines(store) as { args: string[] }[];
    expect(cut?.args).toStrictEqual(["x".repeat(200), "--json"]);
    const text = (store.read(PATH) ?? "").split("\n")[1] ?? "";
    expect(Buffer.byteLength(text) + 1).toBeLessThanOrEqual(JOURNAL_LINE_BYTES);
    expect(long?.args.length).toBeLessThan(60);
    expect(long?.args.at(-1)).toBe("...");
  });

  it("drops the oldest half at the limit, under the lock", async () => {
    const store = projectStore();
    const limit = 2_000;
    for (let i = 0; i < 20; i += 1) {
      await appendJournal(store, ROOT, command({ ms: i }), { limit, wait: NO_WAIT });
    }
    const written = lines(store) as { ms: number }[];
    expect(store.stat(PATH)?.size).toBeLessThan(limit);
    expect(written.at(-1)?.ms).toBe(19);
    expect(written[0]?.ms).toBeGreaterThan(0);
    expect(store.exists(`${ROOT}/.bdk/.machine/journal.lock`)).toBe(false);
  });

  it("leaves the file whole when another process holds the lock", async () => {
    const lock = `${ROOT}/.bdk/.machine/journal.lock`;
    const store = memoryStore({
      [`${ROOT}/.bdk/settings.json`]: "{}\n",
      [lock]: JSON.stringify({ pid: 1, owner: "journal", at: AT }),
    });
    for (let i = 0; i < 10; i += 1) {
      await appendJournal(store, ROOT, command({ ms: i }), { limit: 500, wait: NO_WAIT });
    }
    expect(lines(store)).toHaveLength(10);
  });

  // 20 000 appends under coverage take about 5 s on a CI runner, past the 5 s default.
  it("stays below 1 MiB over 20 000 lines of about 250 bytes, the newest line last", async () => {
    const store = projectStore();
    const args = ["01-1", "x".repeat(150), "--json"];
    for (let i = 0; i < 20_000; i += 1) {
      await appendJournal(store, ROOT, command({ args, ms: i }), { wait: NO_WAIT });
      expect(store.stat(PATH)?.size ?? 0).toBeLessThan(JOURNAL_LIMIT_BYTES);
    }
    const written = lines(store) as { ms: number }[];
    expect(written.at(-1)?.ms).toBe(19_999);
  }, 30_000);

  it("writes nothing and creates no .bdk/ in a project without one", async () => {
    const store = memoryStore();
    await appendJournal(store, ROOT, command());
    expect(store.exists(PATH)).toBe(false);
    expect(store.isDirectory(`${ROOT}/.bdk`)).toBe(false);
  });

  it("swallows a write error", async () => {
    const base = projectStore();
    const store: Store = {
      ...base,
      append: () => {
        throw new Error("EACCES: permission denied");
      },
    };
    await expect(appendJournal(store, ROOT, command())).resolves.toBeUndefined();
  });
});

describe("appendJournal across processes", () => {
  let dir: string | undefined;
  afterEach(() => {
    if (dir !== undefined) rmSync(dir, { recursive: true, force: true });
  });

  /** Eight processes appending 500 lines each to a journal of `limit` bytes; returns its lines. */
  async function appendInParallel(limit: number): Promise<string[]> {
    dir = mkdtempSync(join(tmpdir(), "bdk-journal-"));
    mkdirSync(join(dir, ".bdk"));
    // Bundled first: Node before 22.18 does not strip types without a flag, so
    // a child cannot import the .ts sources (the CI runs 22.13).
    const entry = join(dir, "writer.ts");
    writeFileSync(
      entry,
      `import { appendJournal } from ${JSON.stringify(fileURLToPath(new URL("../journal.ts", import.meta.url)))};
      import { fileStore } from ${JSON.stringify(fileURLToPath(new URL("../store.ts", import.meta.url)))};
      const store = fileStore();
      for (let i = 0; i < 500; i += 1) {
        await appendJournal(store, process.argv[2], {
          v: 1, kind: "command", at: new Date().toISOString(), command: "part-list",
          args: [process.argv[4], String(i), "x".repeat(50)], exit: 0, rule: null,
          ticket: null, change: null, ms: i,
        }, { limit: Number(process.argv[3]) });
      }\n`,
    );
    const writer = join(dir, "writer.mjs");
    await build({
      entryPoints: [entry],
      outfile: writer,
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
    const root = dir;
    await Promise.all(
      Array.from(
        { length: 8 },
        (_, n) =>
          new Promise<void>((done, fail) => {
            const child = spawn(process.execPath, [writer, root, String(limit), `p${n}`], {
              stdio: ["ignore", "ignore", "inherit"],
            });
            child.on("error", fail);
            child.on("exit", (code) => {
              if (code === 0) done();
              else fail(new Error(`writer ${n} exited ${String(code)}`));
            });
          }),
      ),
    );
    expect(readFileSync(journalPath(root), "utf8").endsWith("\n")).toBe(true);
    expect(fileStore().exists(join(root, ".bdk", ".machine", "journal.lock"))).toBe(false);
    const written = readFileSync(journalPath(root), "utf8")
      .split("\n")
      .filter((line) => line !== "");
    for (const line of written) expect(journalLine.safeParse(JSON.parse(line)).success).toBe(true);
    return written;
  }

  it("keeps every line whole when eight processes append 500 lines each", async () => {
    expect(await appendInParallel(JOURNAL_LIMIT_BYTES)).toHaveLength(4_000);
    expect(statSync(journalPath(dir ?? "")).size).toBeLessThan(JOURNAL_LIMIT_BYTES);
  }, 60_000);

  it("keeps every line whole while parallel appends halve the journal", async () => {
    const written = await appendInParallel(64 * 1024);
    expect(written.length).toBeGreaterThan(0);
    expect(statSync(journalPath(dir ?? "")).size).toBeLessThan(2 * 64 * 1024);
  }, 60_000);
});
