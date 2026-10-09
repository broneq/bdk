import { describe, expect, it } from "vitest";

import { detect } from "../domain/detectors.ts";
import type { AgentTranscript } from "../domain/detectors.ts";
import { namesChange, projectKey, transcriptsDir } from "../domain/location.ts";
import { buildSession, units } from "../domain/session.ts";
import type { SessionFiles } from "../domain/session.ts";
import { parseTranscript } from "../domain/transcript.ts";
import type { Transcript } from "../domain/transcript.ts";
import { assistant, bash, costState, jsonl, prompt, result, toolUse } from "./lines.ts";

const T = (s: number): string => new Date(Date.UTC(2026, 9, 9, 12, 0, s)).toISOString();

describe("parseTranscript", () => {
  it("counts a request once, with the usage of its last line", () => {
    const parsed = parseTranscript(
      jsonl([
        assistant(T(0), [], { input_tokens: 2, output_tokens: 20 }, { requestId: "r1" }),
        assistant(T(1), [], { input_tokens: 2, output_tokens: 280 }, { requestId: "r1" }),
      ]),
    );
    const usages = parsed.events.filter((event) => event.kind === "usage");
    expect(usages).toHaveLength(1);
    expect(usages[0]?.kind === "usage" && usages[0].tokens.output).toBe(280);
  });

  it("splits cache writes into 5 minute and 1 hour", () => {
    const parsed = parseTranscript(
      jsonl([
        assistant(T(0), [], {
          cache_creation_input_tokens: 100,
          cache_creation: { ephemeral_1h_input_tokens: 70, ephemeral_5m_input_tokens: 30 },
        }),
      ]),
    );
    const [usage] = parsed.events;
    expect(usage?.kind === "usage" && usage.tokens).toMatchObject({
      cacheWrite5m: 30,
      cacheWrite1h: 70,
    });
  });

  it("counts lines it does not know and keeps the rest", () => {
    const parsed = parseTranscript(
      jsonl(["not json", JSON.stringify({ type: "mystery", timestamp: T(0) }), prompt(T(1), "hi")]),
    );
    expect(parsed).toMatchObject({ lines: 3, unknown: 2, first: T(0), last: T(1), cost: null });
  });

  it("takes the host cost from the last cost-state line", () => {
    const parsed = parseTranscript(
      jsonl([costState(1, { a: 1 }), costState(3.5, { "claude-opus-5-5[1m]": 3.5 })]),
    );
    expect(parsed.cost).toEqual({ totalUSD: 3.5, byModel: { "claude-opus-5-5[1m]": 3.5 } });
  });
});

function session(
  main: string[],
  subagents: { id: string; lines: string[] | null; type: string; toolUseId: string }[] = [],
): SessionFiles {
  return {
    id: "s1",
    file: "s1.jsonl",
    main: parseTranscript(jsonl(main)),
    subagents: subagents.map((sub) => ({
      id: sub.id,
      file: `s1/subagents/agent-${sub.id}.jsonl`,
      transcript: sub.lines === null ? null : parseTranscript(jsonl(sub.lines)),
      meta: { agentType: sub.type, description: `run ${sub.id}`, toolUseId: sub.toolUseId },
    })),
  };
}

describe("buildSession", () => {
  const usage = { input_tokens: 100, output_tokens: 10 };
  const files = session(
    [
      prompt(T(0), "/bdk:debug"),
      assistant(T(1), [toolUse("s-1", "Skill", { skill: "bdk:diagnose-bug" })], usage),
      assistant(T(10), [toolUse("s-2", "Skill", { skill: "bdk:execute" })], usage),
      assistant(
        T(11),
        [toolUse("t-1", "Agent", { subagent_type: "bdk:lead", description: "Execute" })],
        usage,
      ),
      assistant(
        T(12),
        [toolUse("t-2", "Agent", { subagent_type: "bdk:lead", description: "Review" })],
        usage,
      ),
      costState(2, { "claude-sonnet-5-5": 2 }),
    ],
    [
      {
        id: "a1",
        type: "bdk:lead",
        toolUseId: "t-1",
        lines: [
          assistant(T(12), [toolUse("t-3", "Agent", { subagent_type: "bdk:implementer" })], usage),
          assistant(T(40), [], usage),
        ],
      },
      { id: "a2", type: "bdk:implementer", toolUseId: "t-3", lines: [assistant(T(13), [], usage)] },
      { id: "a3", type: "bdk:lead", toolUseId: "t-2", lines: null },
    ],
  );
  const built = buildSession(files);
  const agent = (id: string) => built.agents.find((a) => a.id === id);

  it("makes a stage of every Skill call of the main thread, until the next one", () => {
    expect(built.stages.map((s) => [s.n, s.skill, s.wallMs, s.cite])).toEqual([
      [1, "bdk:diagnose-bug", 9000, "s1.jsonl:2"],
      [2, "bdk:execute", 30000, "s1.jsonl:3"],
    ]);
    expect(built.stages[1]?.agents).toEqual(["a1", "a2", "a3"]);
  });

  it("links each subagent to the agent whose Agent call started it", () => {
    expect(agent("a1")).toMatchObject({
      parent: "main",
      startedBy: "s1.jsonl:4",
      wallMs: 28000,
      turns: 2,
    });
    expect(agent("a2")).toMatchObject({ parent: "a1", startedBy: "s1/subagents/agent-a1.jsonl:1" });
  });

  it("reports a missing transcript for that agent alone (#157)", () => {
    expect(agent("a3")).toMatchObject({
      state: "missing",
      type: "bdk:lead",
      costUSD: null,
      startedBy: "s1.jsonl:5",
    });
    expect(agent("a1")?.state).toBe("ok");
    expect(agent("main")?.costUSD).not.toBeNull();
    expect(built.stages[1]?.costUSD).not.toBeNull();
  });

  it("shares the host cost of a model by weighted tokens", () => {
    const shares = built.agents.map((a) => a.costUSD ?? 0);
    expect(shares.reduce((sum, cost) => sum + cost, 0)).toBeCloseTo(2, 10);
    // main has 4 requests, a1 2, a2 1: the same tokens each.
    expect(agent("main")?.costUSD).toBeCloseTo((2 * 4) / 7, 10);
    expect(units({ input: 1, output: 1, cacheRead: 10, cacheWrite5m: 4, cacheWrite1h: 1 })).toBe(
      14,
    );
  });

  it("leaves the cost unknown without a cost-state line, and still counts tokens", () => {
    const live = buildSession(session([assistant(T(0), [], usage)]));
    expect(live.cost).toBeNull();
    expect(live.agents[0]).toMatchObject({ costUSD: null, turns: 1 });
    expect(live.models[0]).toMatchObject({ input: 100, costUSD: null });
  });

  it("reports an Agent call without any subagent file as missing", () => {
    const orphan = buildSession(
      session([assistant(T(0), [toolUse("t-9", "Agent", { subagent_type: "bdk:judge" })])]),
    );
    expect(orphan.agents[1]).toMatchObject({
      id: "missing-t-9",
      type: "bdk:judge",
      state: "missing",
    });
  });
});

function one(lines: string[], id = "main", type = "main"): AgentTranscript {
  const transcript: Transcript = parseTranscript(jsonl(lines));
  return {
    file: "s1.jsonl",
    transcript,
    agent: {
      id,
      type,
      description: null,
      parent: null,
      stage: null,
      file: "s1.jsonl",
      startedBy: null,
      state: "ok",
      start: transcript.first,
      end: transcript.last,
      wallMs: 0,
      turns: 0,
      toolCalls: 0,
      errors: 0,
      models: [],
      costUSD: null,
      unknownLines: 0,
    },
  };
}

describe("detect", () => {
  it("finds a Bash command run again with no edit in between", () => {
    const findings = detect(
      [
        one([
          assistant(T(0), [bash("b1", "pnpm test")]),
          assistant(T(1), [bash("b2", "pnpm test")]),
          assistant(T(2), [toolUse("e1", "Edit", { file_path: "a.ts" })]),
          assistant(T(3), [bash("b3", "pnpm test")]),
        ]),
      ],
      [],
    );
    expect(findings).toEqual([
      expect.objectContaining({ detector: "repeat-bash", count: 1, cites: ["s1.jsonl:2"] }),
    ]);
  });

  it("finds a file read three times with no write to it in between", () => {
    const read = (id: string, path: string) => toolUse(id, "Read", { file_path: path });
    const findings = detect(
      [
        one([
          assistant(T(0), [read("r1", "/p/a.ts")]),
          assistant(T(1), [read("r2", "/p/a.ts")]),
          assistant(T(2), [toolUse("w", "Write", { file_path: "/p/b.ts" })]),
          assistant(T(3), [read("r3", "/p/a.ts")]),
          assistant(T(4), [read("r4", "/p/c.ts")]),
          assistant(T(5), [toolUse("w2", "Edit", { file_path: "/p/c.ts" })]),
          assistant(T(6), [read("r5", "/p/c.ts")]),
        ]),
      ],
      [],
    );
    expect(findings.map((f) => [f.detector, f.count, f.cites])).toEqual([
      ["repeat-read", 3, ["s1.jsonl:1", "s1.jsonl:2", "s1.jsonl:4"]],
    ]);
  });

  it("finds a skill loaded twice by one agent", () => {
    const skill = (id: string) => toolUse(id, "Skill", { skill: "bdk:commit" });
    const findings = detect(
      [one([assistant(T(0), [skill("k1")]), assistant(T(1), [skill("k2")])])],
      [],
    );
    expect(findings).toEqual([
      expect.objectContaining({ detector: "repeat-skill", cites: ["s1.jsonl:2"] }),
    ]);
  });

  it("finds a retry after an error, a refusal and a timeout", () => {
    const findings = detect(
      [
        one([
          assistant(T(0), [bash("b1", "npm ci")]),
          result(T(1), "b1", "Exit code 1", true),
          assistant(T(2), [bash("b2", "npm ci")]),
          result(T(3), "b2", "ok"),
          assistant(T(4), [bash("b3", "rm -rf x")]),
          result(T(5), "b3", "Permission to use Bash with command rm -rf x has been denied.", true),
          assistant(T(6), [bash("b4", "sleep 999")]),
          result(T(7), "b4", "Command timed out after 2m 0s", true),
        ]),
      ],
      [],
    );
    expect(findings.map((f) => [f.detector, f.cites])).toEqual([
      ["repeat-bash", ["s1.jsonl:3"]],
      ["retry-after-error", ["s1.jsonl:3"]],
      ["refused", ["s1.jsonl:6"]],
      ["timeout", ["s1.jsonl:8"]],
    ]);
  });

  it("finds a call that held its agent two minutes or more, but not an Agent call", () => {
    const findings = detect(
      [
        one([
          assistant(T(0), [bash("b1", "for i in 1 2 3; do sleep 5; done")]),
          result(new Date(Date.UTC(2026, 9, 9, 12, 2, 0)).toISOString(), "b1", "0"),
          assistant(T(0), [toolUse("t1", "Agent", { subagent_type: "bdk:lead" })]),
          result(new Date(Date.UTC(2026, 9, 9, 12, 9, 0)).toISOString(), "t1", "done"),
        ]),
      ],
      [],
    );
    expect(findings.map((f) => [f.detector, f.cites])).toEqual([
      ["slow-call", ["s1.jsonl:1", "s1.jsonl:2"]],
    ]);
  });

  it("finds an agent three times slower than the median of its type", () => {
    const base = one([prompt(T(0), "x")]).agent;
    const agents = [10, 12, 11, 40].map((s, i) => ({
      ...base,
      id: `a${String(i)}`,
      type: "bdk:reviewer",
      file: `f${String(i)}.jsonl`,
      wallMs: s * 1000,
    }));
    expect(detect([], agents)).toEqual([
      expect.objectContaining({ detector: "outlier", agent: "a3", cites: ["f3.jsonl:1"] }),
    ]);
  });
});

describe("location", () => {
  it("names the project directory as the host does", () => {
    expect(projectKey("/Users/me/my_app.v2")).toBe("-Users-me-my-app-v2");
    expect(transcriptsDir({ cwd: "/p/app", home: "/h", configDir: undefined })).toBe(
      "/h/.claude/projects/-p-app",
    );
    expect(transcriptsDir({ cwd: "/p/app", home: "/h", configDir: "/c" })).toBe(
      "/c/projects/-p-app",
    );
  });

  it("matches a Change by its run or OpenSpec path, not by a longer name", () => {
    expect(namesChange("read .bdk/runs/add-total/state.json", "add-total")).toBe(true);
    expect(namesChange("openspec/changes/archive/2026-10-09-add-total/x", "add-total")).toBe(true);
    expect(namesChange("openspec/changes/add-total-2/x", "add-total")).toBe(false);
    expect(namesChange("add-total", "add-total")).toBe(false);
  });
});
