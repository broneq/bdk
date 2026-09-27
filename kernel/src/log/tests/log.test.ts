// The four T20 log commands through the registry on a memory store with the
// in-memory index (`kernel-cli/log`; `kernel-state`, Ledger deduplication).
import { describe, expect, it } from "vitest";

import type { Store } from "../../shared/store/index.ts";
import { writeDocument } from "../../shared/store/index.ts";
import { allowedMoves, withResolution } from "../domain/entry.ts";
import { logRegistrations } from "../index.ts";
import { logAddOutput, logListOutput, logResolveOutput, logShowOutput } from "../schema/outputs.ts";
import {
  AT,
  AUTHOR,
  CHANGE,
  DIR,
  fakeGit,
  logDeps,
  repository,
  ROOT,
  runBdk,
  writeChangeDoc,
} from "./support.ts";
import type { FakeGit } from "./support.ts";

interface Harness {
  readonly store: Store;
  readonly git: FakeGit;
  readonly run: (argv: readonly string[], stdin?: string) => ReturnType<typeof runBdk>;
}

function harness(store = repository()): Harness {
  const git = fakeGit();
  const deps = logDeps(store, git);
  return {
    store,
    git,
    run: (argv, stdin) => runBdk(logRegistrations(deps), store, git, argv, stdin),
  };
}

function logFiles(store: Store): string[] {
  return store.list(`${DIR}/log`);
}

function addAttempt(store: Store, ticket: string, role: string | undefined, closed = false): void {
  writeDocument(store, `${DIR}/attempts/task-redispatch-02-3-${ticket}.md`, {
    data: {
      schema: 1,
      ticket,
      loop: "task-redispatch",
      target: "02-3",
      attempt: 1,
      of: 3,
      scope: "full",
      "opened-at": "2026-09-25T10:00:00Z",
      author: AUTHOR,
      ...(closed ? { "closed-at": "2026-09-25T10:30:00Z", outcome: "ok" } : {}),
    },
    body: "",
  });
  if (role === undefined) return;
  writeDocument(store, `${DIR}/dispatch/02-3-${role}-${ticket}.md`, {
    data: {
      schema: 1,
      ticket,
      target: "02-3",
      role,
      attempt: 1,
      of: 3,
      scope: "full",
      at: "2026-09-25T10:00:01Z",
      "kernel-version": "3.0.0-dev",
      "template-hash": `sha256:${"a".repeat(64)}`,
      report: `.bdk/changes/${CHANGE}/reports/02-3-${role}-${ticket}.md`,
    },
    body: "",
  });
}

describe("log add", () => {
  it("stamps id, at, author and source kernel, and writes log/<ts>-<type>-<id>.md", async () => {
    const { run, store } = harness();
    const result = await run([
      "log",
      "add",
      "decision",
      "magic links first",
      "--ref",
      "design.md",
      "--json",
    ]);
    expect(result.code).toBe(0);
    const output = logAddOutput.parse(result.json);
    expect(output).toEqual({
      entry: {
        id: "L-00000001",
        type: "decision",
        summary: "magic links first",
        status: "proposed",
        source: "kernel",
        author: AUTHOR,
        at: AT,
        refs: ["design.md"],
        review: false,
      },
      path: `.bdk/changes/${CHANGE}/log/20250925T101502Z-decision-L-00000001.md`.replace(
        "2025",
        "2026",
      ),
      deduplicated: false,
    });
    expect(logFiles(store)).toEqual(["20260925T101502Z-decision-L-00000001.md"]);
  });

  it("stamps agent:<role> and the ticket for an open ticket with a dispatch package", async () => {
    const { run, store } = harness();
    addAttempt(store, "A-7f3kx2p9", "implementer");
    const result = await run([
      "log",
      "add",
      "finding",
      "expired link accepted",
      "--ref",
      "src/auth/login.ts",
      "--ref",
      "02-3",
      "--ticket",
      "A-7f3kx2p9",
      "--review",
      "--json",
    ]);
    expect(logAddOutput.parse(result.json).entry).toMatchObject({
      source: "agent:implementer",
      ticket: "A-7f3kx2p9",
      refs: ["src/auth/login.ts", "02-3"],
      review: true,
    });
  });

  it.each([
    ["an unknown ticket", undefined, false],
    ["a ticket without a dispatch package", undefined, true],
    ["a closed ticket", "implementer", true],
  ])("refuses %s with policy/no-open-ticket", async (_, role, seeded) => {
    const { run, store } = harness();
    if (seeded) addAttempt(store, "A-7f3kx2p9", role, role !== undefined);
    const result = await run([
      "log",
      "add",
      "finding",
      "x",
      "--ref",
      "a.ts",
      "--ticket",
      "A-7f3kx2p9",
      "--json",
    ]);
    expect(result.code).toBe(2);
    expect(result.json).toMatchObject({ rule: "policy/no-open-ticket" });
    expect(logFiles(store)).toEqual([]);
  });

  it.each([
    [["--source", "user"]],
    [["--source=user"]],
    [["--author", "x"]],
    [["--id", "L-aaaaaaaa"]],
    [["--at", AT]],
    [["--fingerprint", "sha256:x"]],
  ])(
    "refuses the stamped field %j with input/forbidden-field and writes nothing",
    async (extra) => {
      const { run, store } = harness();
      const result = await run([
        "log",
        "add",
        "decision",
        "approved",
        "--ref",
        "design.md",
        ...extra,
        "--json",
      ]);
      expect(result.code).toBe(3);
      expect(result.json).toMatchObject({ rule: "input/forbidden-field" });
      expect(logFiles(store)).toEqual([]);
    },
  );

  it.each([
    [["--status", "superseded"], "input/invalid-argument", 3],
    [["--status", "routed"], "input/invalid-argument", 3],
    [["--supersedes", "L-zzzzzzzz"], "input/not-found", 3],
    [["--supersedes", "2026-01-01-gone/L-zzzzzzzz"], "input/not-found", 3],
    [["--supersedes", "nonsense"], "input/invalid-argument", 3],
  ])("refuses %j with %s", async (extra, rule, code) => {
    const { run, store } = harness();
    const result = await run(["log", "add", "decision", "x", "--ref", "a.ts", ...extra, "--json"]);
    expect(result).toMatchObject({ code, json: { rule } });
    expect(logFiles(store)).toEqual([]);
  });

  it("refuses a summary over 120 characters and a missing ref", async () => {
    const { run } = harness();
    expect(
      (await run(["log", "add", "risk", "x".repeat(121), "--ref", "a", "--json"])).json,
    ).toMatchObject({
      rule: "input/invalid-argument",
    });
    expect((await run(["log", "add", "risk", "short", "--json"])).json).toMatchObject({
      rule: "input/missing-argument",
    });
  });

  it("accepts --status accepted and --supersedes of an existing entry", async () => {
    const { run } = harness();
    await run(["log", "add", "decision", "first", "--ref", "a", "--json"]);
    const result = await run([
      "log",
      "add",
      "decision",
      "second",
      "--ref",
      "a",
      "--status",
      "accepted",
      "--supersedes",
      "L-00000001",
      "--json",
    ]);
    expect(logAddOutput.parse(result.json).entry).toMatchObject({
      status: "accepted",
      supersedes: "L-00000001",
    });
  });

  it("stamps a learning's fingerprint and deduplicates by it across wording and refs", async () => {
    const { run, store } = harness();
    const first = logAddOutput.parse(
      (
        await run([
          "log",
          "add",
          "learning",
          "Validate tokens on line 12!",
          "--ref",
          "a.ts",
          "--json",
        ])
      ).json,
    );
    expect(first.entry.fingerprint).toMatch(/^sha256:[0-9a-f]{64}$/);
    const second = logAddOutput.parse(
      (
        await run([
          "log",
          "add",
          "learning",
          "validate TOKENS on line 40",
          "--ref",
          "b.ts",
          "--json",
        ])
      ).json,
    );
    expect(second).toMatchObject({ deduplicated: true, entry: { id: first.entry.id } });
    expect(logFiles(store)).toHaveLength(1);
  });

  it("deduplicates a live entry by type, normalised summary and refs, not a resolved one", async () => {
    const { run, store } = harness();
    await run([
      "log",
      "add",
      "finding",
      "Expired link accepted",
      "--ref",
      "b",
      "--ref",
      "a",
      "--json",
    ]);
    const again = await run([
      "log",
      "add",
      "finding",
      "expired link, accepted.",
      "--ref",
      "a",
      "--ref",
      "b",
      "--json",
    ]);
    expect(logAddOutput.parse(again.json)).toMatchObject({
      deduplicated: true,
      entry: { id: "L-00000001" },
    });
    const other = await run([
      "log",
      "add",
      "risk",
      "Expired link accepted",
      "--ref",
      "a",
      "--ref",
      "b",
      "--json",
    ]);
    expect(logAddOutput.parse(other.json).deduplicated).toBe(false);
    await run(["log", "resolve", "L-00000001", "resolved", "--json"]);
    const back = await run([
      "log",
      "add",
      "finding",
      "Expired link accepted",
      "--ref",
      "a",
      "--ref",
      "b",
      "--json",
    ]);
    expect(logAddOutput.parse(back.json).deduplicated).toBe(false);
    expect(logFiles(store)).toHaveLength(3);
  });

  it("reads the body from stdin with --body -", async () => {
    const { run, store } = harness();
    await run(
      ["log", "add", "assumption", "x", "--ref", "a", "--body", "-", "--json"],
      "From stdin.\n",
    );
    const [name] = logFiles(store);
    expect(store.read(`${DIR}/log/${name ?? ""}`)).toMatch(/---\nFrom stdin\.\n$/);
  });

  it("stamps author unknown when git has no identity", async () => {
    const { run, git } = harness();
    git.ident = { code: 128, stdout: "", stderr: "fatal: empty ident" };
    const result = await run(["log", "add", "risk", "x", "--ref", "a", "--json"]);
    expect(logAddOutput.parse(result.json).entry.author).toBe("unknown");
  });

  it("renders one line with the path in text mode", async () => {
    const { run } = harness();
    const result = await run(["log", "add", "risk", "tokens leak", "--ref", "a"]);
    expect(result.stdout).toBe(
      `added L-00000001 (risk, proposed): tokens leak\n.bdk/changes/${CHANGE}/log/20260925T101502Z-risk-L-00000001.md\n`,
    );
  });

  it("refuses without an active Change and on a detached HEAD", async () => {
    const { run, git } = harness();
    git.branch = "other";
    expect((await run(["log", "add", "risk", "x", "--ref", "a", "--json"])).json).toMatchObject({
      rule: "policy/no-active-change",
    });
    git.branch = undefined;
    expect((await run(["log", "list", "--json"])).json).toMatchObject({
      rule: "policy/no-active-change",
    });
  });
});

describe("log list", () => {
  async function seeded(): Promise<Harness> {
    const h = harness();
    await h.run(["log", "add", "decision", "use links", "--ref", "design.md", "--json"]);
    await h.run([
      "log",
      "add",
      "finding",
      "bad expiry",
      "--ref",
      "src/a.ts#verify",
      "--review",
      "--json",
    ]);
    await h.run(["log", "add", "risk", "mail delay", "--ref", "02-3", "--json"]);
    await h.run([
      "log",
      "add",
      "decision",
      "use short links",
      "--ref",
      "design.md",
      "--supersedes",
      "L-00000001",
      "--json",
    ]);
    return h;
  }

  it("lists summaries ordered by at then id, with the derived status", async () => {
    const { run } = await seeded();
    const page = logListOutput.parse((await run(["log", "list", "--json"])).json);
    expect(page.items.map((item) => [item.id, item.status])).toEqual([
      ["L-00000001", "superseded"],
      ["L-00000002", "proposed"],
      ["L-00000003", "proposed"],
      ["L-00000004", "proposed"],
    ]);
    expect(page.items[0]).toMatchObject({ supersededBy: "L-00000004" });
    expect(page).toMatchObject({ total: 4, truncated: false });
  });

  it("filters by type, status, review and --for", async () => {
    const { run } = await seeded();
    const ids = async (...flags: string[]): Promise<string[]> =>
      logListOutput
        .parse((await run(["log", "list", ...flags, "--json"])).json)
        .items.map((item) => item.id);
    expect(await ids("--type", "decision")).toEqual(["L-00000001", "L-00000004"]);
    expect(await ids("--status", "superseded")).toEqual(["L-00000001"]);
    expect(await ids("--review")).toEqual(["L-00000002"]);
    expect(await ids("--for", "02")).toEqual(["L-00000003"]);
    expect(await ids("--for", "src/a.ts")).toEqual(["L-00000002"]);
    const page = logListOutput.parse((await run(["log", "list", "--for", "02", "--json"])).json);
    expect(page.for).toBe("02");
  });

  it("caps the page at 100 items unless --all", async () => {
    const store = repository();
    for (let i = 0; i < 105; i++) {
      const id = `L-${String(i).padStart(8, "0")}`;
      writeDocument(store, `${DIR}/log/20260925T100000Z-risk-${id}.md`, {
        data: {
          schema: 1,
          id,
          type: "risk",
          summary: `risk ${i}`,
          status: "proposed",
          source: "kernel",
          author: AUTHOR,
          at: "2026-09-25T10:00:00Z",
          refs: ["a"],
        },
        body: "",
      });
    }
    const { run } = harness(store);
    const page = logListOutput.parse((await run(["log", "list", "--json"])).json);
    expect(page).toMatchObject({ total: 105, truncated: true });
    expect(page.items).toHaveLength(100);
    expect(
      logListOutput.parse((await run(["log", "list", "--all", "--json"])).json).items,
    ).toHaveLength(105);
    const text = (await run(["log", "list"])).stdout.trimEnd().split("\n");
    expect(text).toHaveLength(100);
    expect(text.at(-1)).toMatch(/more lines \(--all prints everything\)$/);
  });

  it("prints one line per entry and says so when there are none", async () => {
    expect((await harness().run(["log", "list"])).stdout).toBe("no entries\n");
    const { run } = await seeded();
    const lines = (await run(["log", "list"])).stdout.split("\n");
    expect(lines[0]).toBe("L-00000001 decision superseded: use links [design.md] (by L-00000004)");
    expect(lines[1]).toBe("L-00000002 finding proposed: bad expiry [src/a.ts#verify] (review)");
  });

  it("appends one telemetry line per run and keeps the file under its limit", async () => {
    const { run, store } = await seeded();
    const path = `${ROOT}/.bdk/.machine/telemetry/log-list.jsonl`;
    await run(["log", "list", "--json"]);
    await run(["log", "list", "--json"]);
    const lines = (store.read(path) ?? "")
      .trim()
      .split("\n")
      .map((line) => JSON.parse(line) as Record<string, unknown>);
    expect(lines).toHaveLength(2);
    expect(lines[0]).toMatchObject({ at: AT, entries: 4 });
    expect(typeof lines[0]?.ms).toBe("number");
    expect(typeof lines[0]?.refreshed).toBe("boolean");
    store.write(path, `${JSON.stringify({ filler: "x".repeat(1000) })}\n`.repeat(300));
    await run(["log", "list", "--json"]);
    const size = store.stat(path)?.size ?? 0;
    expect(size).toBeLessThan(256 * 1024);
    const kept = (store.read(path) ?? "").trim().split("\n");
    expect(kept).toHaveLength(150);
    expect(JSON.parse(kept.at(-1) ?? "{}")).toMatchObject({ at: AT, entries: 4 });
  });
});

describe("log show", () => {
  it("shows one entry in full with its body and supersededBy", async () => {
    const { run } = harness();
    await run([
      "log",
      "add",
      "decision",
      "use links",
      "--ref",
      "design.md",
      "--body",
      "Because.",
      "--json",
    ]);
    await run([
      "log",
      "add",
      "decision",
      "short links",
      "--ref",
      "design.md",
      "--supersedes",
      "L-00000001",
      "--json",
    ]);
    const shown = logShowOutput.parse((await run(["log", "show", "L-00000001", "--json"])).json);
    expect(shown).toMatchObject({
      entry: { id: "L-00000001", status: "superseded", body: "Because.", author: AUTHOR },
      supersededBy: "L-00000002",
    });
    const text = (await run(["log", "show", "L-00000001"])).stdout;
    expect(text).toContain("L-00000001 decision superseded: use links\n");
    expect(text).toContain("superseded by: L-00000002\n");
    expect(text).toMatch(/\n\nBecause\.\n$/);
  });

  it("reads a qualified id of another Change, archived ones included", async () => {
    const store = repository();
    const archived = `${ROOT}/.bdk/changes/archive/2026-09-01-old`;
    writeChangeDoc(store, "2026-09-01-old", archived);
    writeDocument(store, `${archived}/log/20260901T100000Z-learning-L-0ld00001.md`, {
      data: {
        schema: 1,
        id: "L-0ld00001",
        type: "learning",
        summary: "old lesson",
        status: "accepted",
        source: "kernel",
        author: AUTHOR,
        at: "2026-09-01T10:00:00Z",
        refs: ["a"],
        fingerprint: `sha256:${"b".repeat(64)}`,
      },
      body: "",
    });
    const { run } = harness(store);
    const shown = logShowOutput.parse(
      (await run(["log", "show", "2026-09-01-old/L-0ld00001", "--json"])).json,
    );
    expect(shown.entry).toMatchObject({
      summary: "old lesson",
      path: ".bdk/changes/archive/2026-09-01-old/log/20260901T100000Z-learning-L-0ld00001.md",
    });
  });

  it.each([
    ["L-zzzzzzzz", "input/not-found"],
    ["2026-01-01-gone/L-zzzzzzzz", "input/not-found"],
    ["L-short", "input/invalid-argument"],
    ["A-7f3kx2p9", "input/invalid-argument"],
  ])("answers %s with %s", async (id, rule) => {
    expect((await harness().run(["log", "show", id, "--json"])).json).toMatchObject({ rule });
  });
});

describe("log resolve", () => {
  async function withEntries(): Promise<Harness> {
    const h = harness();
    await h.run([
      "log",
      "add",
      "finding",
      "bad expiry",
      "--ref",
      "a",
      "--body",
      "Seen in tests.",
      "--json",
    ]);
    await h.run(["log", "add", "finding", "better check", "--ref", "a", "--json"]);
    return h;
  }

  it("rewrites the status in place and appends the reason", async () => {
    const { run, store } = await withEntries();
    const result = await run([
      "log",
      "resolve",
      "L-00000001",
      "resolved",
      "--reason",
      "fixed in retry",
      "--json",
    ]);
    expect(logResolveOutput.parse(result.json)).toEqual({
      entry: "L-00000001",
      status: "resolved",
      record: "L-00000001",
      reason: "fixed in retry",
    });
    const text = store.read(`${DIR}/log/20260925T101502Z-finding-L-00000001.md`) ?? "";
    expect(text).toContain("status: resolved\n");
    expect(text).toMatch(
      /Seen in tests\.\n\nResolved as resolved at 2026-09-25T10:15:02Z: fixed in retry\n$/,
    );
  });

  it("derives superseded: the --by entry gains supersedes, the old file is unchanged", async () => {
    const { run, store } = await withEntries();
    const before = store.read(`${DIR}/log/20260925T101502Z-finding-L-00000001.md`);
    const result = await run([
      "log",
      "resolve",
      "L-00000001",
      "superseded",
      "--by",
      "L-00000002",
      "--json",
    ]);
    expect(logResolveOutput.parse(result.json)).toMatchObject({
      record: "L-00000002",
      by: "L-00000002",
    });
    expect(store.read(`${DIR}/log/20260925T101502Z-finding-L-00000001.md`)).toBe(before);
    expect(store.read(`${DIR}/log/20260925T101502Z-finding-L-00000002.md`)).toContain(
      "supersedes: L-00000001\n",
    );
    const page = logListOutput.parse((await run(["log", "list", "--json"])).json);
    expect(page.items[0]?.status).toBe("superseded");
    expect((await run(["log", "resolve", "L-00000001", "resolved"])).code).toBe(2);
  });

  it.each([
    [["L-00000001", "accepted"], ["L-00000001", "accepted"], "policy/invalid-transition"],
    [["L-00000001", "resolved"], ["L-00000001", "accepted"], "policy/invalid-transition"],
    [
      ["L-00000001", "resolved"],
      ["L-00000001", "superseded", "--by", "L-00000002"],
      "policy/invalid-transition",
    ],
  ])("refuses %j then %j with %s", async (first, second, rule) => {
    const { run } = await withEntries();
    expect((await run(["log", "resolve", ...first, "--json"])).code).toBe(0);
    expect((await run(["log", "resolve", ...second, "--json"])).json).toMatchObject({ rule });
  });

  it("refuses superseded without --by, with a missing --by, by itself and by an entry already superseding", async () => {
    const { run } = await withEntries();
    await run([
      "log",
      "add",
      "risk",
      "third",
      "--ref",
      "a",
      "--supersedes",
      "L-00000002",
      "--json",
    ]);
    const rule = async (...argv: string[]): Promise<unknown> =>
      ((await run(["log", "resolve", ...argv, "--json"])).json as { rule: string }).rule;
    expect(await rule("L-00000001", "superseded")).toBe("input/missing-argument");
    expect(await rule("L-00000001", "superseded", "--by", "L-zzzzzzzz")).toBe("input/not-found");
    expect(await rule("L-00000001", "superseded", "--by", "L-00000001")).toBe(
      "policy/invalid-transition",
    );
    expect(await rule("L-00000001", "superseded", "--by", "L-00000003")).toBe(
      "policy/invalid-transition",
    );
    expect(await rule("L-zzzzzzzz", "resolved")).toBe("input/not-found");
  });

  it("never changes a transition", async () => {
    const store = repository();
    writeDocument(store, `${DIR}/log/20260925T090000Z-transition-L-tr000001.md`, {
      data: {
        schema: 1,
        id: "L-tr000001",
        type: "transition",
        summary: "to design",
        status: "accepted",
        source: "kernel",
        author: AUTHOR,
        at: "2026-09-25T09:00:00Z",
        refs: ["change.md"],
        to: "design",
      },
      body: "",
    });
    const result = await harness(store).run(["log", "resolve", "L-tr000001", "resolved", "--json"]);
    expect(result.json).toMatchObject({ rule: "policy/invalid-transition" });
  });

  it("accepts an id qualified with the active Change and renders one line", async () => {
    const { run } = await withEntries();
    const result = await run([
      "log",
      "resolve",
      `${CHANGE}/L-00000001`,
      "accepted",
      "--reason",
      "agreed",
    ]);
    expect(result.stdout).toBe(`${CHANGE}/L-00000001 accepted: agreed (rewrote L-00000001)\n`);
  });
});

describe("domain", () => {
  it("allows proposed -> accepted|resolved|superseded, accepted -> resolved|superseded, nothing else", () => {
    expect(allowedMoves("finding", "proposed")).toEqual(["accepted", "resolved", "superseded"]);
    expect(allowedMoves("finding", "accepted")).toEqual(["resolved", "superseded"]);
    for (const status of ["resolved", "routed", "superseded"])
      expect(allowedMoves("finding", status)).toEqual([]);
    expect(allowedMoves("transition", "proposed")).toEqual([]);
  });

  it("appends the resolution line to an empty or a filled body", () => {
    expect(withResolution("", "accepted", AT, undefined)).toBe(`Resolved as accepted at ${AT}\n`);
    expect(withResolution("Body.\n\n", "resolved", AT, "done")).toBe(
      `Body.\n\nResolved as resolved at ${AT}: done\n`,
    );
  });
});
