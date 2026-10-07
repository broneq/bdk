// The `bdk diagnostics` commands through the registry on a memory repository
// (`kernel-cli/diagnostics`): the report, the render, the slice and the
// analysis write with their refusals, against the recorded transcript of
// HOST-FACTS `transcript-layout`. The bundle runs the same paths in the
// `*.e2e.ts` files.
import commands from "../../../../schema/cli/commands.json" with { type: "json" };
import { readdirSync, readFileSync } from "node:fs";
import { join, relative } from "node:path";
import { describe, expect, it } from "vitest";

import {
  CHANGE,
  DIR,
  fakeGit,
  repository,
  ROOT,
  runBdk,
  writePackage,
} from "../../log/tests/support.ts";
import { settingsRegistry } from "../../registrations.ts";
import { loadIndex } from "../../shared/registry/index.ts";
import {
  agentsRegistryPath,
  memoryRegistry,
  withRegistry,
  writeDocument,
} from "../../shared/store/index.ts";
import type { GitResult } from "../../shared/git/index.ts";
import { REPO_ROOT } from "../../../tests/support/run.ts";
import { liveLines } from "../domain/live.ts";
import { diagnosticsRegistrations } from "../index.ts";

const FIXTURE = join(REPO_ROOT, "tests/fixtures/host-transcripts/2.1.289/transcript-layout");
const HOME = "/home/dev/.claude/projects/-work-repo";
const SESSION = "00000000-0000-4000-8000-000000000001";
const MAIN = `${HOME}/${SESSION}.jsonl`;
const JOURNAL = `${ROOT}/.bdk/.machine/telemetry/journal.jsonl`;
const LEDGER_ID = "L-k2m4abcd";

type Fields = Readonly<Record<string, unknown>>;

const session = (at: string, transcript: string | null = MAIN): Fields => ({
  v: 1,
  kind: "session",
  at,
  session: SESSION,
  transcript,
  source: "startup",
  bdk: "3.0.0",
  commit: "abc1234",
  host: "2.1.289",
});

const command = (at: string, id: string, args: string[], rule: string | null = null): Fields => ({
  v: 1,
  kind: "command",
  at,
  command: id,
  args,
  exit: rule === null ? 0 : 2,
  rule,
  ticket: null,
  change: CHANGE,
  ms: 40,
});

/** The fixture's transcripts in the memory store, the journal, and one ledger entry. */
function harness(lines: readonly Fields[] = defaultJournal(), grep?: GitResult) {
  const store = repository();
  for (const name of readdirSync(FIXTURE, { recursive: true, encoding: "utf8" })) {
    const path = join(FIXTURE, name);
    if (!name.endsWith(".jsonl") && !name.endsWith(".json")) continue;
    store.write(join(HOME, relative(FIXTURE, path)), readFileSync(path, "utf8"));
  }
  store.write(JOURNAL, lines.map((line) => `${JSON.stringify(line)}\n`).join(""));
  writeDocument(store, `${DIR}/log/20261005T150450Z-observation-${LEDGER_ID}.md`, {
    data: {
      schema: 1,
      id: LEDGER_ID,
      type: "observation",
      summary: "slow parser",
      source: "user",
      author: "Ada Lovelace <ada@example.com>",
      at: "2026-10-05T15:04:50.000Z",
      refs: ["src/parser.ts"],
      status: "accepted",
    },
    body: "",
  });
  const git = fakeGit();
  const run = git.run.bind(git);
  git.run = (args, cwd) =>
    args[0] === "grep" && grep !== undefined ? Promise.resolve(grep) : run(args, cwd);
  const deps = {
    store,
    git,
    settings: settingsRegistry(),
    pluginRoot: "/plugins/bdk",
    commands: loadIndex(commands),
    openRegistry: memoryRegistry(),
  };
  const registrations = diagnosticsRegistrations(deps);
  return {
    store,
    deps,
    run: (argv: readonly string[], stdin = "") => runBdk(registrations, store, git, argv, stdin),
  };
}

function defaultJournal(): Fields[] {
  return [
    session("2026-10-05T15:04:39.000Z"),
    command("2026-10-05T15:04:40.000Z", "ctx-skill", ["execute"]),
    command("2026-10-05T15:04:45.200Z", "change-status", ["--json"], "policy/no-active-change"),
    command("2026-10-05T15:05:08.000Z", "next", []),
  ];
}

const json = (result: { json: unknown }) => result.json as Record<string, unknown>;

describe("diagnostics report", () => {
  it("reports the session with its transcript, in text and as JSON", async () => {
    const h = harness();
    const report = json(await h.run(["diagnostics", "report", "--json"]));
    expect(report).toMatchObject({ session: SESSION, change: CHANGE, transcript: "ok" });
    const text = await h.run(["diagnostics", "report"]);
    expect(text.code).toBe(0);
    expect(text.stdout).toContain("refusals 1  policy/no-active-change 1");
  });

  it("narrows to a stage and refuses an unknown stage or session", async () => {
    const h = harness();
    const staged = json(await h.run(["diagnostics", "report", "--stage", "execute", "--json"]));
    expect(staged).toMatchObject({ stage: "execute", from: "2026-10-05T15:04:40.000Z" });
    const stage = await h.run(["diagnostics", "report", "--stage", "close", "--json"]);
    expect(stage.code).toBe(3);
    expect(json(stage)).toMatchObject({ rule: "input/not-found" });
    const unknown = await h.run(["diagnostics", "report", "--session", "nope", "--json"]);
    expect(json(unknown)).toMatchObject({ rule: "input/not-found" });
  });

  it("refuses a journal with no session", async () => {
    const h = harness([]);
    expect(json(await h.run(["diagnostics", "report", "--json"]))).toMatchObject({
      rule: "input/not-found",
      why: "the run journal holds no session",
    });
  });

  it("states a missing transcript instead of failing", async () => {
    const h = harness([session("2026-10-05T15:04:39.000Z", `${HOME}/gone.jsonl`)]);
    const report = json(await h.run(["diagnostics", "report", "--json"]));
    expect(report).toMatchObject({ transcript: "missing", cost: null });
  });
});

describe("diagnostics report of a Change with agents, attempts and parks", () => {
  const WORKER = "a0000000000000001";
  const TICKET = "A-7f3k9m2q";

  it("reads the registry row with its package role, the attempt record and the park question", async () => {
    const h = harness();
    h.store.write(agentsRegistryPath(ROOT), "");
    writePackage(h.store, TICKET, "implementer");
    await withRegistry(h.deps.openRegistry, ROOT, (registry) => {
      registry.put(WORKER, {
        type: "bdk:worker",
        session: SESSION,
        parent: "main",
        package: `.bdk/changes/${CHANGE}/dispatch/02-implementer-${TICKET}.md`,
        ticket: TICKET,
        startedAt: "2026-10-05T15:04:41.000Z",
      });
      registry.put("a00000000000000ff", { type: "bdk:runner", package: "missing.md" });
    });
    writeDocument(h.store, `${DIR}/attempts/part-02-${TICKET}.md`, {
      data: {
        schema: 1,
        ticket: TICKET,
        loop: "part",
        target: "02",
        attempt: 2,
        of: 3,
        scope: "full",
        "opened-at": "2026-10-05T15:04:42.000Z",
        "closed-at": "2026-10-05T15:05:00.000Z",
        outcome: "fail",
        escalation: true,
        author: "Ada Lovelace <ada@example.com>",
      },
      body: "tests still fail\n",
    });
    writeDocument(h.store, `${DIR}/log/20261005T150451Z-question-L-p4rk0001.md`, {
      data: {
        schema: 1,
        id: "L-p4rk0001",
        type: "question",
        summary: "which store?",
        status: "proposed",
        source: "kernel",
        author: "Ada Lovelace <ada@example.com>",
        at: "2026-10-05T15:04:51.000Z",
        refs: ["change.md"],
        options: ["a", "b"],
        park: true,
      },
      body: "",
    });
    const report = json(await h.run(["diagnostics", "report", "--json"]));
    expect(report.agents).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ agent: WORKER, role: "implementer", type: "bdk:worker" }),
      ]),
    );
  });
});

describe("diagnostics log", () => {
  it("renders the session to its log file and prints the path", async () => {
    const h = harness();
    const result = await h.run(["diagnostics", "log"]);
    const path = `.bdk/.machine/logs/${CHANGE}-${SESSION}.log`;
    expect(result.stdout).toContain(path);
    const log = h.store.read(`${ROOT}/${path}`) ?? "";
    expect(log).toContain(`# BDK run log of session ${SESSION}`);
    expect(log).toContain("bdk: 3.0.0 abc1234");
    expect(log).toContain("journal:3 change-status --json exit 2 policy/no-active-change");
    const full = json(await h.run(["diagnostics", "log", "--full", "--json"]));
    expect(full).toMatchObject({ path, transcript: "ok" });
  });

  it("names why the transcript is not read", async () => {
    const h = harness([session("2026-10-05T15:04:39.000Z", null)]);
    await h.run(["diagnostics", "log"]);
    expect(h.store.read(`${ROOT}/.bdk/.machine/logs/${SESSION}.log`)).toContain(
      "transcript: unavailable (the host gave no transcript path; journal lines only)",
    );
  });
});

describe("diagnostics slice", () => {
  it("prints the events around a journal cite, an agent cite and a ledger id", async () => {
    const h = harness();
    const journal = json(await h.run(["diagnostics", "slice", "journal:3", "--json"]));
    expect(journal).toMatchObject({ agent: "main", omitted: 0 });
    const agent = await h.run(["diagnostics", "slice", "a0000000000000001:11", "--after", "0"]);
    expect(agent.stdout).toContain("a0000000000000001 Bash echo probe-worker");
    const ledger = json(await h.run(["diagnostics", "slice", LEDGER_ID, "--json"]));
    expect(ledger).toMatchObject({ agent: "main" });
  });

  it("refuses a bad cite, a bad count, a wide window and a point past the transcript", async () => {
    const h = harness();
    const rule = async (...argv: string[]) =>
      json(await h.run(["diagnostics", "slice", ...argv, "--json"])).rule;
    expect(await rule("nonsense")).toBe("input/invalid-argument");
    expect(await rule("main:1", "--before", "-1")).toBe("input/invalid-argument");
    expect(await rule("main:1", "--before", "60", "--after", "41")).toBe("input/invalid-argument");
    expect(await rule("journal:99")).toBe("input/not-found");
    expect(await rule("main:999999")).toBe("input/not-found");
    expect(await rule("a00000000000000ff:1")).toBe("input/not-found");
    expect(await rule("L-zzzzzzzz")).toBe("input/not-found");
  });
});

describe("diagnostics write", () => {
  const analysis = (issue: string) =>
    [
      "## Summary",
      "s",
      "## What went well",
      "w",
      "## What went wrong",
      "```ts\nconst x = 1;\n```",
      "## Where the fix belongs",
      "f",
      "## For a BDK issue",
      issue,
      "",
    ].join("\n");

  it("stores the analysis under the session's Change and prints the path", async () => {
    const h = harness();
    const result = await h.run(
      ["diagnostics", "write"],
      analysis("`bdk next` refused with `policy/no-active-change`."),
    );
    const path = `.bdk/.machine/diagnostics/${CHANGE}-${SESSION}.md`;
    expect(result.stdout).toBe(`${path}\n`);
    expect(h.store.read(`${ROOT}/${path}`)).toContain("## For a BDK issue");
  });

  it("refuses a missing heading, a fence, a foreign code span and a tracked line", async () => {
    const tracked = {
      code: 0,
      stdout: "src/parser.ts\u00003\u0000  export function parseAll(input) {\n",
      stderr: "",
    };
    const h = harness(defaultJournal(), tracked);
    const write = async (markdown: string) =>
      json(await h.run(["diagnostics", "write", "--json"], markdown));
    expect(await write("## Summary\n")).toMatchObject({ rule: "input/invalid-argument" });
    expect(await write(analysis("~~~\nx\n~~~"))).toMatchObject({ rule: "policy/project-code" });
    expect((await write(analysis("call `parseAll()` broke"))).why).toContain("code span");
    expect((await write(analysis("export function parseAll(input) {"))).why).toBe(
      "line 12 of section For a BDK issue equals line 3 of src/parser.ts",
    );
  });

  it("fails on a git grep error instead of passing the check", async () => {
    const h = harness(defaultJournal(), { code: 128, stdout: "", stderr: "fatal: bad" });
    await expect(
      h.run(
        ["diagnostics", "write", "--json"],
        analysis("a line that is long enough to be checked"),
      ),
    ).rejects.toThrow("git grep failed: fatal: bad");
  });
});

describe("live lines", () => {
  const entry = {
    at: "2026-10-05T15:04:45.000Z",
    agent: "a1",
    agentType: "bdk:worker",
    tool: "Read",
    input: { file_path: "/x" },
    response: {},
    failed: false,
    error: null,
  };

  it("names the agent type and reads each result shape", () => {
    expect(liveLines(entry)[0]).toMatch(/^\d\d:\d\d:\d\d a1 bdk:worker Read \/x ok$/);
    const content = (response: Record<string, unknown>) =>
      liveLines({ ...entry, response }).slice(1);
    expect(content({ content: "a\nb" })).toStrictEqual(["    a", "    b"]);
    expect(content({ content: [{ type: "text", text: "t" }, { type: "image" }] })).toStrictEqual([
      "    t",
    ]);
    expect(content({ type: "text", file: { numLines: 2 } })).toStrictEqual([
      '    {"type":"text","file":{"numLines":2}}',
    ]);
  });

  it("marks a failure and a time it cannot read", () => {
    const failed = liveLines({ ...entry, at: "x", failed: true, error: null });
    expect(failed).toStrictEqual(["--:--:-- a1 bdk:worker Read /x failed"]);
    const long = liveLines({ ...entry, agentType: null, input: { command: "y".repeat(300) } });
    expect(long[0]).toMatch(/^\d\d:\d\d:\d\d a1 Read y+\.\.\. ok$/);
    expect((long[0] ?? "").length).toBeLessThan(230);
  });
});
