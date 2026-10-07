// The deterministic report (`kernel-cli/diagnostics`, bdk diagnostics report;
// design D2, D5 and D7 of v3-t47-run-diagnostics) over a seeded journal and
// synthetic transcripts: session scope and --stage, attribution through the
// ticket and through the transcript, the counts, tokens and cost, the
// transcript states, and each detector with a hit and a near miss.
import { readdirSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

import { REPO_ROOT } from "../../../tests/support/run.ts";
import { invokes, shellCommands } from "../domain/attribution.ts";
import { buildReport } from "../domain/build.ts";
import type { ReportInput, ReportResult } from "../domain/build.ts";
import type { AgentFacts, AttemptFacts, NumberedLine } from "../domain/facts.ts";
import type { DiagnosticsReport, ModelTokens } from "../domain/report.ts";
import { defaultSession, STAGES, transcriptPaths } from "../domain/scope.ts";
import type { AgentTranscript, TranscriptEvent } from "../domain/transcript.ts";

const S = "5d1c9e0a-2b7f-4c3e-9a61-0f2d8b7c4e11";
const OTHER = "7e2a0000-0000-4000-8000-000000000002";
const CHANGE = "2026-10-05-italian";
const T0 = Date.parse("2026-10-05T14:00:00.000Z");
const MODEL = "claude-sonnet-5";

/** The ISO time `seconds` after T0. */
function t(seconds: number): string {
  return new Date(T0 + seconds * 1000).toISOString();
}

/** `Omit` over each member of a union. */
type Without<T, K extends PropertyKey> = T extends unknown ? Omit<T, K> : never;

type Line = Without<NumberedLine, "n" | "v">;

/** The single simple command of a Bash command. */
function words(command: string): string[] {
  return shellCommands(command)[0] ?? [];
}

function journal(...lines: Line[]): NumberedLine[] {
  return lines.map((line, index) => ({ ...line, v: 1, n: index + 1 }));
}

function sessionLine(at: number, session = S): Line {
  return {
    kind: "session",
    at: t(at),
    session,
    transcript: `/home/user/.claude/projects/p/${session}.jsonl`,
    source: "startup",
    bdk: "3.0.0",
    commit: null,
    host: "2.1.289",
  };
}

function command(
  at: number,
  id: string,
  args: string[] = [],
  extra: { rule?: string; exit?: number; ticket?: string; ms?: number } = {},
): Line {
  return {
    kind: "command",
    at: t(at),
    command: id,
    args,
    exit: extra.exit ?? (extra.rule === undefined ? 0 : 2),
    rule: extra.rule ?? null,
    ticket: extra.ticket ?? null,
    change: CHANGE,
    ms: extra.ms ?? 40,
  };
}

const TOKENS: ModelTokens = { input: 100, output: 50, cacheRead: 1000, cacheWrite: 10 };

let line = 0;
function event(at: number, body: Without<TranscriptEvent, "at" | "line">): TranscriptEvent {
  line += 1;
  return { ...body, at: t(at), line };
}
function bash(at: number, command: string, id = `toolu_${String(line)}`): TranscriptEvent {
  return event(at, { kind: "tool-use", id, name: "Bash", input: { command } });
}
function tool(at: number, name: string, input: unknown): TranscriptEvent {
  return event(at, { kind: "tool-use", id: `toolu_${String(line)}`, name, input });
}
function usage(at: number, requestId: string, tokens = TOKENS): TranscriptEvent {
  return event(at, { kind: "usage", requestId, model: MODEL, tokens });
}
function skill(at: number, name: string): TranscriptEvent {
  return event(at, {
    kind: "skill",
    name,
    text: `Base directory for this skill: /plugin/skills/${name}`,
  });
}

function transcript(agent: string, events: TranscriptEvent[]): AgentTranscript {
  return {
    agent,
    type: agent === "main" ? null : "bdk:worker",
    toolUseId: null,
    path: `/t/${agent}.jsonl`,
    events,
  };
}

function agent(id: string, fields: Partial<AgentFacts> = {}): AgentFacts {
  return {
    id,
    type: "bdk:worker",
    session: S,
    parent: "main",
    ticket: null,
    role: "implementer",
    startedAt: t(10),
    endedAt: t(70),
    endedBy: "subagent-stop",
    ...fields,
  };
}

function attempt(
  ticket: string,
  target: string,
  at: number,
  fields: Partial<AttemptFacts> = {},
): AttemptFacts {
  return {
    ticket,
    loop: "part",
    target,
    attempt: 1,
    escalation: false,
    openedAt: t(at),
    closedAt: t(at + 30),
    reason: "",
    ...fields,
  };
}

const VERBS: Record<string, string[]> = {
  "ctx-skill": ["ctx", "skill"],
  "attempt-close": ["attempt", "close"],
  "attempt-open": ["attempt", "open"],
  "attempt-show": ["attempt", "show"],
  "evidence-record": ["evidence", "record"],
  "dispatch-build": ["dispatch", "build"],
  "log-add": ["log", "add"],
  next: ["next"],
};

function input(fields: Partial<ReportInput> = {}): ReportInput {
  return {
    session: S,
    stage: null,
    journal: journal(sessionLine(0)),
    agents: [],
    attempts: [],
    parks: [],
    transcripts: { state: "ok", unknownLines: 0, agents: [transcript("main", [])], cost: null },
    thresholds: { repeatRefusal: 3, repeatRead: 3, outlierFactor: 3 },
    suites: [],
    partOf: new Map(),
    verbOf: (id) => VERBS[id],
    ...fields,
  };
}

function report(fields: Partial<ReportInput> = {}): DiagnosticsReport {
  const result: ReportResult = buildReport(input(fields));
  if ("missing" in result) throw new Error(`missing ${result.missing}`);
  return result.report;
}

function detectors(result: DiagnosticsReport, id: string) {
  return result.findings.filter((finding) => finding.detector === id);
}

describe("session scope", () => {
  it("counts refusals by rule from the journal, with or without transcripts", () => {
    const lines = journal(
      sessionLine(0),
      ...[1, 2, 3].map((at) =>
        command(at, "evidence-record", [], { rule: "policy/missing-evidence" }),
      ),
      ...[4, 5].map((at) =>
        command(at, "log-add", [], { rule: "input/invalid-envelope", exit: 3 }),
      ),
      command(6, "next"),
    );
    for (const state of ["ok", "missing", "unavailable"] as const) {
      const result = report({
        journal: lines,
        transcripts: { state, unknownLines: 0, agents: [], cost: null },
      });
      expect(result.refusals.byRule).toStrictEqual({
        "policy/missing-evidence": 3,
        "input/invalid-envelope": 2,
      });
      expect(result.refusals.total).toBe(5);
      expect(result.transcript).toBe(state);
    }
  });

  it("keeps only the session's window and names the Change", () => {
    const lines = journal(
      sessionLine(0, OTHER),
      command(1, "next", [], { rule: "policy/no-active-change" }),
      sessionLine(2),
      command(3, "next", [], { rule: "policy/gate-not-ready" }),
      sessionLine(4, OTHER),
      command(5, "next", [], { rule: "policy/no-active-change" }),
    );
    const result = report({ journal: lines });
    expect(result.refusals.byRule).toStrictEqual({ "policy/gate-not-ready": 1 });
    expect(result).toMatchObject({ from: t(2), to: t(3), change: CHANGE, truncated: false });
  });

  it("adds a line outside the window whose tool use sits in the session's transcript", () => {
    const lines = journal(
      sessionLine(0),
      sessionLine(10, OTHER),
      command(12, "next", [], { rule: "policy/gate-not-ready" }),
    );
    const main = transcript("main", [bash(11, "node /plugin/dist/bdk.mjs next")]);
    const result = report({
      journal: lines,
      transcripts: { state: "ok", unknownLines: 0, agents: [main], cost: null },
    });
    expect(result.refusals.byRule).toStrictEqual({ "policy/gate-not-ready": 1 });
    expect(result.refusals.byRole).toStrictEqual({ main: 1 });
  });

  it("is missing for an unknown session and for a stage the session never loaded", () => {
    expect(buildReport(input({ session: OTHER }))).toStrictEqual({ missing: "session" });
    expect(buildReport(input({ stage: "execute" }))).toStrictEqual({ missing: "stage" });
  });

  it("narrows --stage to the latest load of the stage until the next stage", () => {
    const lines = journal(
      sessionLine(0),
      command(1, "ctx-skill", ["plan"]),
      command(2, "next", [], { rule: "policy/gate-not-ready" }),
      command(3, "ctx-skill", ["execute"]),
      command(4, "ctx-skill", ["bdk-cli"]),
      command(5, "evidence-record", [], { rule: "policy/missing-evidence" }),
      command(6, "ctx-skill", ["verify-plan"]),
      command(7, "next", [], { rule: "policy/not-ready" }),
    );
    const result = report({ journal: lines, stage: "execute" });
    expect(result.refusals.byRule).toStrictEqual({ "policy/missing-evidence": 1 });
    expect(result).toMatchObject({ stage: "execute", from: t(3), to: t(5) });
  });

  it("is truncated when the session line was halved away and still counts the rest", () => {
    const lines = journal(command(1, "next", [], { rule: "policy/gate-not-ready" }), {
      kind: "question",
      at: t(2),
      agent: "main",
      count: 2,
      session: S,
    });
    const result = report({ journal: lines });
    expect(result.truncated).toBe(true);
    expect(result.questions).toBe(2);
    expect(result.refusals.total).toBe(1);
  });

  it("picks the latest session of the active Change, else the latest session", () => {
    const lines = journal(sessionLine(0), command(1, "next"), sessionLine(2, OTHER), {
      ...command(3, "next"),
      change: null,
    } as Line);
    expect(defaultSession(lines, CHANGE)).toBe(S);
    expect(defaultSession(lines, null)).toBe(OTHER);
    expect(defaultSession(lines, "2026-01-01-other")).toBe(OTHER);
    expect(defaultSession([], null)).toBeNull();
  });

  it("finds the main transcript from the session line or next to an agent's file", () => {
    const stop: Line = {
      kind: "agent-stop",
      at: t(5),
      agent: "a1",
      transcript: `/h/p/${S}/subagents/agent-a1.jsonl`,
      by: "subagent-stop",
      session: S,
    };
    expect(transcriptPaths(journal(sessionLine(0), stop), S)).toStrictEqual({
      main: `/home/user/.claude/projects/p/${S}.jsonl`,
      agents: [`/h/p/${S}/subagents/agent-a1.jsonl`],
    });
    expect(transcriptPaths(journal(stop), S).main).toBe(`/h/p/${S}.jsonl`);
    expect(transcriptPaths(journal(), S).main).toBeNull();
  });

  it("names every stage skill directory", () => {
    const stages = readdirSync(join(REPO_ROOT, "skills/stages"), { withFileTypes: true })
      .filter((entry) => entry.isDirectory())
      .map((entry) => entry.name)
      .sort();
    expect([...STAGES]).toStrictEqual(stages);
  });
});

describe("attribution", () => {
  it("joins a ticket to the registry row that holds it, counting the package role", () => {
    const lines = journal(
      sessionLine(0),
      command(20, "attempt-close", ["A-k2m4", "ok"], {
        rule: "policy/missing-evidence",
        ticket: "A-k2m4",
      }),
    );
    const result = report({ journal: lines, agents: [agent("a3f9", { ticket: "A-k2m4" })] });
    expect(result.refusals.byRole).toStrictEqual({ implementer: 1 });
  });

  it("joins a line without a ticket to the Bash use within 5 seconds before it", () => {
    const lines = journal(
      sessionLine(0),
      command(20, "dispatch-build", ["01-1", "--role", "lead"], { rule: "policy/ticket-open" }),
      command(40, "dispatch-build", ["01-1", "--role", "lead"], { rule: "policy/ticket-open" }),
    );
    const worker = transcript("a1", [
      bash(18, "cd /w && bdk dispatch build 01-1 --role lead 2>&1 | head"),
      bash(30, "bdk dispatch build 01-1 --role lead"),
    ]);
    const result = report({
      journal: lines,
      agents: [agent("a1", { role: "lead" })],
      transcripts: {
        state: "ok",
        unknownLines: 0,
        agents: [transcript("main", []), worker],
        cost: null,
      },
    });
    expect(result.refusals.byRole).toStrictEqual({ lead: 1, unknown: 1 });
  });

  it("joins two kernel calls of one Bash use to their own lines, through a variable", () => {
    const lines = journal(
      sessionLine(0),
      command(20, "attempt-open", ["part", "01"], { rule: "policy/ticket-open" }),
      command(21, "attempt-show", ["A-s189"]),
    );
    const lead = transcript("a1", [
      bash(19, "B=/p/bdk.mjs; node $B attempt open part 01 | head; node $B attempt show A-s189"),
    ]);
    const result = report({
      journal: lines,
      agents: [agent("a1", { role: "lead" })],
      transcripts: {
        state: "ok",
        unknownLines: 0,
        agents: [transcript("main", []), lead],
        cost: null,
      },
    });
    expect(result.refusals.byRole).toStrictEqual({ lead: 1 });
  });

  it("matches cut arguments, quotes and the journal's dropped-arguments marker", () => {
    const long = "x".repeat(250);
    expect(
      invokes(
        words(`bdk log add --body "${long}"`),
        ["log", "add"],
        ["--body", long.slice(0, 200)],
      ),
    ).toBe(true);
    expect(
      invokes(words("node a/bdk.mjs log add 'two words' z"), ["log", "add"], ["two words", "..."]),
    ).toBe(true);
    expect(invokes(words("bdk log add other"), ["log", "add"], ["two words"])).toBe(false);
    expect(shellCommands("echo bdk; bdk next 2>&1 | head")).toStrictEqual([
      ["echo", "bdk"],
      ["bdk", "next", "2>&1"],
      ["head"],
    ]);
  });

  it("expands a variable the same command assigned earlier, as agents call the kernel through one", () => {
    expect(
      shellCommands(
        'B=/p/dist/bdk.mjs; node $B part done 02 --json; export K="/p/bdk"; node "${K}.mjs" next; echo $OTHER',
      ),
    ).toStrictEqual([
      ["B=/p/dist/bdk.mjs"],
      ["node", "/p/dist/bdk.mjs", "part", "done", "02", "--json"],
      ["export", "K=/p/bdk"],
      ["node", "/p/bdk.mjs", "next"],
      ["echo", "$OTHER"],
    ]);
    expect(
      invokes(
        shellCommands("B=/p/dist/bdk.mjs; node $B attempt open part 01")[1] ?? [],
        ["attempt", "open"],
        ["part", "01"],
      ),
    ).toBe(true);
  });

  it("attributes hook lines to the host and guard lines to their agent", () => {
    const lines = journal(
      sessionLine(0),
      command(1, "hooks-session-start", [], { rule: "config/invalid-settings", exit: 0 }),
      {
        kind: "guard",
        at: t(2),
        command: "hooks-pre-tool",
        args: [],
        exit: 2,
        rule: "guard/subagent-git",
        ticket: null,
        change: null,
        ms: 3,
        agent: "a1",
      },
    );
    const result = report({ journal: lines, agents: [agent("a1", { role: "implementer" })] });
    expect(result.refusals.byRole).toStrictEqual({ host: 1 });
    expect(result.guardBlocks).toBe(1);
  });
});

describe("tokens and cost", () => {
  const lines = journal(sessionLine(0), command(100, "next"));
  const transcripts = (state: "ok" | "missing" = "ok") => ({
    state,
    unknownLines: 0,
    agents: [
      transcript("main", [usage(1, "req_1"), usage(80, "req_2")]),
      transcript("a1", [usage(20, "req_3")]),
      transcript("a2", [usage(30, "req_4")]),
    ],
    cost: { totalUSD: 0.086, byModel: { [MODEL]: 0.086 } },
  });

  it("sums per agent and per task, and leaves an agent without SubagentStop unknown", () => {
    const result = report({
      journal: lines,
      agents: [
        agent("a1", { ticket: "A-1" }),
        agent("a2", { ticket: "A-2", endedBy: "task-stop" }),
      ],
      attempts: [attempt("A-1", "01-1", 10), attempt("A-2", "01-2", 20)],
      partOf: new Map([
        ["01-1", "01"],
        ["01-2", "01"],
      ]),
      transcripts: transcripts(),
    });
    const double = { input: 200, output: 100, cacheRead: 2000, cacheWrite: 20 };
    expect(result.agents).toStrictEqual([
      { agent: "main", type: "main", role: null, wallMs: 100_000, tokens: { [MODEL]: double } },
      {
        agent: "a1",
        type: "bdk:worker",
        role: "implementer",
        wallMs: 60_000,
        tokens: { [MODEL]: TOKENS },
      },
      { agent: "a2", type: "bdk:worker", role: "implementer", wallMs: 60_000, tokens: null },
    ]);
    expect(result.tokensUnknownAgents).toBe(1);
    expect(result.tasks).toStrictEqual([
      { task: "01-1", part: "01", tickets: 1, wallMs: 30_000, tokens: { [MODEL]: TOKENS } },
      { task: "01-2", part: "01", tickets: 1, wallMs: 30_000, tokens: null },
    ]);
    expect(result.parts).toStrictEqual([{ part: "01", wallMs: 40_000, tokens: null }]);
    expect(result.cost).toStrictEqual({ totalUSD: 0.086, byModel: { [MODEL]: 0.086 } });
  });

  it("nulls every token field when the transcripts are not ok, cost included", () => {
    const missing = { ...transcripts("missing"), cost: null };
    const result = report({ journal: lines, agents: [agent("a1")], transcripts: missing });
    expect(result.agents.map((each) => each.tokens)).toStrictEqual([null, null]);
    expect(result.tokensUnknownAgents).toBe(2);
    expect(result.cost).toBeNull();
  });

  it("keeps the whole session's cost under --stage", () => {
    const staged = journal(
      sessionLine(0),
      command(50, "ctx-skill", ["execute"]),
      command(90, "next"),
    );
    const result = report({ journal: staged, stage: "execute", transcripts: transcripts() });
    expect(result.cost?.totalUSD).toBe(0.086);
    expect(result.agents[0]?.tokens).toStrictEqual({ [MODEL]: TOKENS });
  });
});

describe("detectors", () => {
  const window = journal(sessionLine(0), command(500, "next"));
  const withMain = (events: TranscriptEvent[], extra: AgentTranscript[] = []) => ({
    journal: window,
    transcripts: {
      state: "ok" as const,
      unknownLines: 0,
      agents: [transcript("main", events), ...extra],
      cost: null,
    },
  });

  it("D1: the same Bash command again with no edit between", () => {
    const hit = report(
      withMain([bash(1, "pnpm lint"), tool(2, "Read", { file_path: "a" }), bash(3, "pnpm lint")]),
    );
    const [found, ...more] = detectors(hit, "D1");
    expect(more).toStrictEqual([]);
    expect(found?.agent).toBe("main");
    expect(found?.cite).toMatch(/^main:\d+$/);
    expect(found?.summary).toContain("pnpm lint");
    const miss = report(
      withMain([bash(1, "pnpm lint"), tool(2, "Edit", { file_path: "a" }), bash(3, "pnpm lint")]),
    );
    expect(detectors(miss, "D1")).toStrictEqual([]);
  });

  it("D1 leaves a repeated kernel call to D2 and D3: agents wait polls by design", () => {
    const wait = "B=/p/bdk.mjs; node $B agents wait a1";
    const polled = report(withMain([bash(1, wait), bash(2, wait), bash(3, "bdk next")]));
    expect(detectors(polled, "D1")).toStrictEqual([]);
    const polledAgain = report(withMain([bash(1, "bdk next"), bash(2, "bdk next")]));
    expect(detectors(polledAgain, "D1")).toStrictEqual([]);
  });

  it("D2: a refused command repeated with the same arguments by the same agent", () => {
    const refused = (at: number, args: string[]) =>
      command(at, "attempt-close", args, { rule: "policy/missing-evidence", ticket: "A-1" });
    const rows = [agent("a1", { ticket: "A-1" })];
    const hit = report({
      journal: journal(sessionLine(0), refused(1, ["A-1", "ok"]), refused(2, ["A-1", "ok"])),
      agents: rows,
    });
    expect(detectors(hit, "D2")).toStrictEqual([
      expect.objectContaining({ agent: "a1", cite: "journal:3" }),
    ]);
    const miss = report({
      journal: journal(sessionLine(0), refused(1, ["A-1", "ok"]), refused(2, ["A-1", "fail"])),
      agents: rows,
    });
    expect(detectors(miss, "D2")).toStrictEqual([]);
  });

  it("D3: one rule refused at least diagnostics.repeat-refusal times", () => {
    const lines = (count: number) =>
      journal(
        sessionLine(0),
        ...Array.from({ length: count }, (_, at) =>
          command(at + 1, "log-add", [String(at)], { rule: "input/invalid-envelope", exit: 3 }),
        ),
      );
    const hit = report({ journal: lines(3) });
    expect(detectors(hit, "D3")).toStrictEqual([
      expect.objectContaining({
        cite: "journal:4",
        summary: "input/invalid-envelope refused 3 times",
      }),
    ]);
    expect(hit.anomalies).toBeGreaterThanOrEqual(1);
    expect(detectors(report({ journal: lines(2) }), "D3")).toStrictEqual([]);
    expect(
      detectors(
        report({
          journal: lines(3),
          thresholds: { repeatRefusal: 4, repeatRead: 3, outlierFactor: 3 },
        }),
        "D3",
      ),
    ).toStrictEqual([]);
  });

  it("D4: a whole-suite test command run under a task package", () => {
    const worker = (command: string) => transcript("a1", [bash(20, command)]);
    const base = {
      journal: window,
      agents: [agent("a1", { ticket: "A-1" })],
      attempts: [attempt("A-1", "01-1", 10)],
      suites: ["pnpm test:unit"],
    };
    const run = (command: string) =>
      report({
        ...base,
        transcripts: {
          state: "ok",
          unknownLines: 0,
          agents: [transcript("main", []), worker(command)],
          cost: null,
        },
      });
    expect(detectors(run("pnpm test:unit"), "D4")).toStrictEqual([
      expect.objectContaining({ agent: "a1" }),
    ]);
    expect(detectors(run("pnpm test:unit kernel/src/a.test.ts"), "D4")).toStrictEqual([]);
  });

  it("D5: one file read at least diagnostics.repeat-read times with no write between", () => {
    const read = (at: number) => tool(at, "Read", { file_path: "/w/src/a.ts" });
    expect(detectors(report(withMain([read(1), read(2), read(3)])), "D5")).toHaveLength(1);
    const written = [read(1), read(2), tool(3, "Write", { file_path: "/w/src/a.ts" }), read(4)];
    expect(detectors(report(withMain(written)), "D5")).toStrictEqual([]);
  });

  it("D6: a second ticket with the previous close reason, an escalation and a park", () => {
    const attempts = [
      attempt("A-1", "01", 10, { reason: "tests failed in the parser" }),
      attempt("A-2", "01", 50, { attempt: 2 }),
      attempt("A-3", "01", 90, { attempt: 2, escalation: true }),
    ];
    const result = report({ journal: window, attempts, parks: [{ id: "L-park0001", at: t(200) }] });
    expect(detectors(result, "D6")).toStrictEqual([
      expect.objectContaining({
        ticket: "A-2",
        summary: "ticket 2 on part 01: tests failed in the parser",
      }),
      expect.objectContaining({ ticket: "A-3", summary: "escalation on part 01" }),
      expect.objectContaining({ ticket: null, cite: "L-park0001" }),
    ]);
    expect(result).toMatchObject({ retries: 1, escalations: 1, parks: 1 });
    expect(
      detectors(report({ journal: window, attempts: attempts.slice(0, 1) }), "D6"),
    ).toStrictEqual([]);
  });

  it("D7: the same skill loaded twice in one agent", () => {
    const worker = transcript("a1", [skill(3, "bdk:execute")]);
    expect(
      detectors(report(withMain([skill(1, "bdk:execute"), skill(2, "bdk:execute")])), "D7"),
    ).toHaveLength(1);
    expect(detectors(report(withMain([skill(1, "bdk:execute")], [worker])), "D7")).toStrictEqual(
      [],
    );
  });

  it("D8: a task over k times the median, and a command over its budget", () => {
    const tasks = (last: number) => [
      attempt("A-1", "01-1", 10, { closedAt: t(20) }),
      attempt("A-2", "01-2", 30, { closedAt: t(40) }),
      attempt("A-3", "01-3", 50, { closedAt: t(50 + last) }),
    ];
    const hit = report({ journal: window, attempts: tasks(31) });
    expect(detectors(hit, "D8")).toStrictEqual([
      expect.objectContaining({
        ticket: "A-3",
        summary: "task 01-3 wall time over 3 times the session median",
      }),
    ]);
    expect(detectors(report({ journal: window, attempts: tasks(30) }), "D8")).toStrictEqual([]);
    const slow = journal(
      sessionLine(0),
      command(1, "next", [], { ms: 151 }),
      command(2, "next", [], { ms: 150 }),
    );
    expect(detectors(report({ journal: slow }), "D8")).toStrictEqual([
      expect.objectContaining({ cite: "journal:2" }),
    ]);
  });

  it("never quotes tool output in a summary", () => {
    const output = "SECRET-OUTPUT-LINE";
    const events = [
      bash(1, "pnpm lint"),
      event(2, { kind: "tool-result", id: "x", text: output, error: true }),
      bash(3, "pnpm lint"),
    ];
    const result = report(withMain(events));
    expect(JSON.stringify(result.findings)).not.toContain(output);
  });
});
