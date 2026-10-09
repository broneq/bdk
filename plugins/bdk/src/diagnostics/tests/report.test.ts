import { describe, expect, it } from "vitest";

import { CliError } from "../../shared/cli/index.ts";
import { renderReport } from "../render/report.ts";
import { reportResult } from "../schema/report.ts";
import { report } from "../use-cases/report.ts";
import { memoryFiles } from "./files.ts";
import { assistant, costState, jsonl, meta, prompt, toolUse } from "./lines.ts";

const DIR = "/h/.claude/projects/-p-app";
const S1 = "11111111-1111-4111-8111-111111111111";
const S2 = "22222222-2222-4222-8222-222222222222";

const tree = {
  [`${DIR}/${S1}.jsonl`]: jsonl([
    prompt("2026-10-09T12:00:00.000Z", "/bdk:execute add-total"),
    assistant("2026-10-09T12:00:01.000Z", [
      toolUse("t-1", "Agent", { subagent_type: "bdk:lead", description: "Execute add-total" }),
    ]),
    JSON.stringify({
      type: "user",
      timestamp: "2026-10-09T12:00:02.000Z",
      message: { content: "write .bdk/runs/add-total/state.json" },
    }),
    costState(1, { "claude-sonnet-5-5": 1 }),
  ]),
  [`${DIR}/${S1}/subagents/agent-a1.meta.json`]: meta("bdk:lead", "Execute add-total", "t-1"),
  [`${DIR}/${S2}.jsonl`]: jsonl([prompt("2026-10-09T13:00:00.000Z", "something else")]),
};

const deps = { files: memoryFiles(tree), cwd: "/p/app", home: "/h", env: {} };

describe("bdk diagnostics report", () => {
  it("counts the sessions that name the Change, and only those", () => {
    const result = report(deps, { change: "add-total", sessions: [], transcripts: undefined });
    expect(reportResult.parse(result)).toEqual(result);
    expect(result.sessions.map((s) => s.id)).toEqual([S1]);
    expect(result.transcripts).toBe(DIR);
  });

  it("still counts a session whose agent transcript is missing, and names the agent", () => {
    const result = report(deps, { change: "add-total", sessions: [], transcripts: undefined });
    const [session] = result.sessions;
    expect(session?.agents.map((a) => [a.id, a.state])).toEqual([
      ["main", "ok"],
      ["a1", "missing"],
    ]);
    expect(session?.findings).toEqual([
      expect.objectContaining({
        detector: "missing-transcript",
        agent: "a1",
        cites: [`${S1}.jsonl:2`],
      }),
    ]);
    expect(renderReport(result)).toContain(`MISSING, started at ${S1}.jsonl:2`);
    expect(result.warnings).toContain(
      `session ${S1}: 1 agent(s) without a transcript; their share of the host cost is spread over the agents counted`,
    );
  });

  it("adds sessions named with --session and warns about an unknown one", () => {
    const result = report(deps, {
      change: undefined,
      sessions: [S2, "nope"],
      transcripts: undefined,
    });
    expect(result.sessions.map((s) => s.id)).toEqual([S2]);
    expect(result.warnings).toEqual(
      expect.arrayContaining([`session nope: no transcript nope.jsonl in ${DIR}`]),
    );
  });

  it("reads a transcripts directory given relative to the project", () => {
    const moved = memoryFiles({ [`/p/app/copied/${S2}.jsonl`]: tree[`${DIR}/${S2}.jsonl`] });
    const result = report(
      { ...deps, files: moved },
      { change: undefined, sessions: [S2], transcripts: "copied" },
    );
    expect(result.transcripts).toBe("/p/app/copied");
    expect(result.sessions).toHaveLength(1);
  });

  it("fails as an environment error without a transcripts directory", () => {
    expect(() =>
      report(
        { ...deps, files: memoryFiles({}) },
        { change: "add-total", sessions: [], transcripts: undefined },
      ),
    ).toThrow(CliError);
  });

  it("fails as an environment error when the transcripts directory is not readable", () => {
    const denied = {
      ...memoryFiles({}),
      list(): never {
        throw Object.assign(new Error("EPERM: operation not permitted, scandir"), {
          code: "EPERM",
        });
      },
    };
    const run = () =>
      report(
        { ...deps, files: denied },
        { change: "add-total", sessions: [], transcripts: undefined },
      );
    expect(run).toThrow(/not readable \(EPERM\)/);
    try {
      run();
    } catch (error) {
      expect((error as CliError).code).toBe("env/transcripts-unreadable");
    }
  });

  it("asks for a Change or a session", () => {
    expect(() => report(deps, { change: undefined, sessions: [], transcripts: undefined })).toThrow(
      /name a Change or at least one --session/,
    );
  });
});
