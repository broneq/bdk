// The ledger of a review round (`kernel-cli/log`; T42-A1, B1, T): entries
// and reports under `<ticket>@<group>`, the orchestrator's merged report under
// the reserved group `merge` with the reviewed `head`, and `bdk log triage`.
import { describe, expect, it } from "vitest";

import { readDocument, writeDocument } from "../../shared/store/index.ts";
import type { Store } from "../../shared/store/index.ts";
import { logRegistrations } from "../index.ts";
import { logAddOutput, logIngestOutput, logTriageOutput } from "../schema/outputs.ts";
import {
  AUTHOR,
  CHANGE,
  DIR,
  fakeGit,
  logDeps,
  repository,
  ROOT,
  runBdk,
  writePackage,
} from "./support.ts";

const ROUND = "A-r1v2w3x4";
const TASK = "A-7f3k9m2q";
const HEAD = "4f1c2d9a7b3e5f60718293a4b5c6d7e8f9a0b1c2";
const REPORTS = `.bdk/changes/${CHANGE}/reports`;
const ENVELOPE = (entries: readonly string[]) =>
  `---\nstatus: done\nfiles: []\nentries: [${entries.join(", ")}]\nevidence: []\n---\n# Review\n`;

function record(store: Store, ticket: string, loop: string, target: string): void {
  writeDocument(store, `${DIR}/attempts/${loop}-${target}-${ticket}.md`, {
    data: {
      schema: 1,
      ticket,
      loop,
      target,
      attempt: 1,
      of: 2,
      scope: "full",
      "opened-at": "2026-09-25T10:00:00.000Z",
      author: AUTHOR,
    },
    body: "",
  });
}

/** What `dispatch build --group` leaves: the group's package, not stamped as active. */
function groupPackage(store: Store, group: string, role = "reviewer"): void {
  const name = `${CHANGE}-${role}-${ROUND}-${group}.md`;
  writeDocument(store, `${DIR}/dispatch/${name}`, {
    data: {
      schema: 1,
      ticket: ROUND,
      target: CHANGE,
      role,
      adapter: "reviewer",
      attempt: 1,
      of: 2,
      scope: "full",
      at: "2026-09-25T10:00:01.000Z",
      "kernel-version": "3.0.0-dev",
      "template-hash": `sha256:${"a".repeat(64)}`,
      report: `${REPORTS}/${name}`,
      rules: [],
      group,
      files: [],
    },
    body: "",
  });
}

/** A round with the packages of groups p01 and p02, and a task ticket with its package. */
function harness() {
  const store = repository();
  const base = fakeGit();
  const git = {
    ...base,
    run: (args: readonly string[], cwd: string) =>
      args[0] === "rev-parse"
        ? Promise.resolve({ code: 0, stdout: `${HEAD}\n`, stderr: "" })
        : base.run(args, cwd),
  };
  const deps = logDeps(store, git);
  record(store, ROUND, "review-fix", CHANGE);
  groupPackage(store, "p01");
  groupPackage(store, "p02");
  record(store, TASK, "task-redispatch", "02-3");
  writePackage(store, TASK, "implementer");
  const run = (argv: readonly string[], stdin?: string) =>
    runBdk(logRegistrations(deps), store, git, [...argv, "--json"], stdin);
  return {
    store,
    run,
    add: async (ticket: string, summary = "token compared with ==", type = "finding") => {
      const result = await run([
        "log",
        "add",
        type,
        summary,
        "--ref",
        "src/auth/login.ts",
        "--ticket",
        ticket,
      ]);
      expect(result.code, result.stdout).toBe(0);
      return logAddOutput.parse(result.json).entry;
    },
    ingest: (ticket: string, entries: readonly string[]) =>
      run(["log", "ingest", "--ticket", ticket], ENVELOPE(entries)),
  };
}

function data(store: Store, path: string): Record<string, unknown> {
  const document = readDocument(store, `${ROOT}/${path}`);
  return document !== undefined && "data" in document ? document.data : {};
}

function rule(result: { json: unknown }): string {
  return (result.json as { rule: string }).rule;
}

describe("log add under a group reference", () => {
  it("stamps the ticket id, the group and the group package's role", async () => {
    const h = harness();
    const entry = await h.add(`${ROUND}@p02`);
    expect(entry).toMatchObject({ ticket: ROUND, group: "p02", source: "agent:reviewer" });
  });

  it("writes the same finding of two groups as two entries", async () => {
    const h = harness();
    const first = await h.add(`${ROUND}@p01`);
    const second = await h.add(`${ROUND}@p02`);
    expect(second.id).not.toBe(first.id);
  });

  it("refuses a group without a package with policy/no-open-ticket", async () => {
    const result = await harness().run([
      "log",
      "add",
      "finding",
      "x",
      "--ref",
      "a.ts",
      "--ticket",
      `${ROUND}@p09`,
    ]);
    expect(result.code).toBe(2);
    expect(rule(result)).toBe("policy/no-open-ticket");
  });

  it("refuses a group on a task ticket with input/invalid-argument", async () => {
    const result = await harness().run([
      "log",
      "add",
      "finding",
      "x",
      "--ref",
      "a.ts",
      "--ticket",
      `${TASK}@p01`,
    ]);
    expect(result.code).toBe(3);
    expect(rule(result)).toBe("input/invalid-argument");
  });

  it("refuses any type but report under merge with input/invalid-argument", async () => {
    const result = await harness().run([
      "log",
      "add",
      "finding",
      "x",
      "--ref",
      "a.ts",
      "--ticket",
      `${ROUND}@merge`,
    ]);
    expect(result.code).toBe(3);
    expect(rule(result)).toBe("input/invalid-argument");
  });
});

describe("log ingest under a group reference", () => {
  it("stores each group's report at its package's report path with its group", async () => {
    const h = harness();
    const one = await h.add(`${ROUND}@p01`);
    const two = await h.add(`${ROUND}@p02`, "token leaks to the log");
    for (const [group, id] of [
      ["p01", one.id],
      ["p02", two.id],
    ] as const) {
      const result = await h.ingest(`${ROUND}@${group}`, [id]);
      expect(result.code, result.stdout).toBe(0);
      const path = `${REPORTS}/${CHANGE}-reviewer-${ROUND}-${group}.md`;
      expect(logIngestOutput.parse(result.json)).toMatchObject({
        ticket: ROUND,
        role: "reviewer",
        path,
      });
      expect(data(h.store, path)).toMatchObject({ ticket: ROUND, role: "reviewer", group });
    }
  });

  it("refuses a group report naming another group's entry with policy/entries-missing", async () => {
    const h = harness();
    const other = await h.add(`${ROUND}@p02`);
    const result = await h.ingest(`${ROUND}@p01`, [other.id]);
    expect(result.code).toBe(2);
    expect(rule(result)).toBe("policy/entries-missing");
    expect((result.json as { why: string }).why).toContain(other.id);
    expect(h.store.list(`${DIR}/reports`)).toStrictEqual([]);
  });

  it("stores the merged review under merge, without a package, as the orchestrator's", async () => {
    const h = harness();
    const one = await h.add(`${ROUND}@p01`);
    const two = await h.add(`${ROUND}@p02`, "token leaks to the log");
    const result = await h.ingest(`${ROUND}@merge`, [one.id, two.id]);
    expect(result.code, result.stdout).toBe(0);
    const path = `${REPORTS}/${CHANGE}-orchestrator-${ROUND}-merge.md`;
    expect(logIngestOutput.parse(result.json)).toMatchObject({ role: "orchestrator", path });
    expect(data(h.store, path)).toMatchObject({
      ticket: ROUND,
      role: "orchestrator",
      group: "merge",
    });
  });

  it("refuses a merged review naming an entry of no round, and says where it belongs", async () => {
    const h = harness();
    const earlier = await h.run([
      "log",
      "add",
      "finding",
      "an earlier round's blocker",
      "--ref",
      "review",
    ]);
    expect(earlier.code, earlier.stdout).toBe(0);
    const id = (earlier.json as { entry: { id: string } }).entry.id;
    const result = await h.ingest(`${ROUND}@merge`, [id]);
    expect(rule(result)).toBe("policy/entries-missing");
    expect((result.json as { instead: string[] }).instead[0]).toContain("report body");
  });
});

describe("log add report under merge", () => {
  it("records the merged review with head, source kernel and the review refs", async () => {
    const h = harness();
    expect((await h.ingest(`${ROUND}@merge`, [])).code).toBe(0);
    const result = await h.run([
      "log",
      "add",
      "report",
      "2 blockers, 3 should-fix",
      "--ref",
      "review",
      "--ticket",
      `${ROUND}@merge`,
    ]);
    expect(result.code, result.stdout).toBe(0);
    const entry = logAddOutput.parse(result.json).entry;
    expect(entry).toMatchObject({ ticket: ROUND, group: "merge", source: "kernel", head: HEAD });
    expect(entry.refs).toStrictEqual(["review", CHANGE]);
    expect(data(h.store, logAddOutput.parse(result.json).path)).toMatchObject({
      report: `reports/${CHANGE}-orchestrator-${ROUND}-merge.md`,
    });
  });

  it("refuses the merge report before it is ingested with input/not-found", async () => {
    const result = await harness().run([
      "log",
      "add",
      "report",
      "done",
      "--ref",
      "review",
      "--ticket",
      `${ROUND}@merge`,
    ]);
    expect(result.code).toBe(3);
    expect(rule(result)).toBe("input/not-found");
  });
});

describe("log triage", () => {
  const triage = (h: ReturnType<typeof harness>, ...args: string[]) =>
    h.run(["log", "triage", ...args]);

  async function triaged(h: ReturnType<typeof harness>, id: string, ...args: string[]) {
    const result = await triage(h, id, ...args);
    expect(result.code, result.stdout).toBe(0);
    return logTriageOutput.parse(result.json);
  }

  function entryFile(h: ReturnType<typeof harness>, id: string) {
    const name = h.store.list(`${DIR}/log`).find((file) => file.endsWith(`-${id}.md`));
    const document = name === undefined ? undefined : readDocument(h.store, `${DIR}/log/${name}`);
    if (document === undefined || !("data" in document)) throw new Error(`no entry ${id}`);
    return document;
  }

  it("sets the level and keeps the status, appending the triage line", async () => {
    const h = harness();
    const { id } = await h.add(`${ROUND}@p01`);
    expect(
      await triaged(h, id, "should-fix", "--reason", "real but outside the auth path"),
    ).toStrictEqual({
      record: id,
      level: "should-fix",
      status: "proposed",
    });
    const document = entryFile(h, id);
    expect(document.data).toMatchObject({ level: "should-fix", status: "proposed", group: "p01" });
    expect(document.body.trimEnd()).toMatch(
      /Triaged as should-fix at \S+Z: real but outside the auth path$/,
    );
  });

  it("resolves the entry for not-a-problem", async () => {
    const h = harness();
    const { id } = await h.add(`${ROUND}@p01`);
    expect(
      await triaged(h, id, "not-a-problem", "--reason", "validated by the caller"),
    ).toMatchObject({
      level: "not-a-problem",
      status: "resolved",
    });
    expect(entryFile(h, id).data).toMatchObject({
      level: "not-a-problem",
      status: "resolved",
    });
  });

  it("requires --reason for not-a-problem", async () => {
    const h = harness();
    const { id } = await h.add(`${ROUND}@p01`);
    const result = await triage(h, id, "not-a-problem");
    expect(result.code).toBe(3);
    expect(rule(result)).toBe("input/missing-argument");
  });

  it("appends a line per triage and keeps the last level", async () => {
    const h = harness();
    const { id } = await h.add(`${ROUND}@p01`);
    await triaged(h, id, "nice-to-have");
    await triaged(h, id, "blocker", "--reason", "breaks the login of every user");
    const document = entryFile(h, id);
    expect(document.data.level).toBe("blocker");
    const lines = document.body.split("\n").filter((line) => line.startsWith("Triaged as"));
    expect(lines.map((line) => line.split(" ")[2])).toStrictEqual(["nice-to-have", "blocker"]);
  });

  it("triages a blocker and an observation", async () => {
    const h = harness();
    const blocker = await h.add(`${ROUND}@p01`, "login loops", "blocker");
    const observation = await h.add(`${ROUND}@p01`, "naming drifts", "observation");
    await triaged(h, blocker.id, "should-fix");
    await triaged(h, observation.id, "nice-to-have");
  });

  it("refuses a decision with input/invalid-argument", async () => {
    const h = harness();
    const added = await h.run([
      "log",
      "add",
      "decision",
      "links expire after 15 min",
      "--ref",
      "design.md",
    ]);
    const id = logAddOutput.parse(added.json).entry.id;
    const result = await triage(h, id, "blocker");
    expect(result.code).toBe(3);
    expect(rule(result)).toBe("input/invalid-argument");
  });

  it("refuses a resolved entry with policy/invalid-transition naming its status", async () => {
    const h = harness();
    const { id } = await h.add(`${ROUND}@p01`);
    await h.run(["log", "resolve", id, "resolved", "--reason", "fixed"]);
    const result = await triage(h, id, "blocker");
    expect(result.code).toBe(2);
    expect(rule(result)).toBe("policy/invalid-transition");
    expect((result.json as { why: string }).why).toContain("resolved");
  });

  it("refuses an unknown id with input/not-found", async () => {
    const result = await triage(harness(), "L-00000099", "blocker");
    expect(result.code).toBe(3);
    expect(rule(result)).toBe("input/not-found");
  });
});
