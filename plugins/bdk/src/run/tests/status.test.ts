import { describe, expect, it } from "vitest";

import { run } from "../../shared/cli/index.ts";
import { runGroup } from "../index.ts";
import { statusResult } from "../schema/status.ts";
import type { StatusResult } from "../schema/status.ts";
import { memoryFiles, ROOT } from "./files.ts";

// `bdk run status` through the frame, on in-memory project trees (spec `bdk-cli/run`): every row
// of the resume table from real file names, the state file schemas, and both output forms.

type Tree = Record<string, string>;

const RUN = ".bdk/runs";

function runJson(changes: readonly string[], current = changes[0], extra = {}): Tree {
  return {
    [`${RUN}/run.json`]: JSON.stringify({
      version: 1,
      mode: "non-interactive",
      queue: changes.map((change, i) => ({ change, issue: 10 + i })),
      current,
      ...extra,
    }),
  };
}

/** The files of a Change that went through every stage, archived and with a PR. */
function finished(change: string): Tree {
  const spec = `openspec/changes/archive/2026-10-07-${change}`;
  const dir = `${RUN}/${change}`;
  const finding = (id: string): string =>
    JSON.stringify({ type: "finding", id, source: "r", summary: "x" });
  return {
    [`${spec}/proposal.md`]: "# Proposal",
    [`${spec}/design.md`]: "# Design",
    [`${spec}/plan/parts/01.md`]: "part",
    [`${spec}/plan/parts/02.md`]: "part",
    [`${dir}/design/verify-1.md`]: "Verdict: FAIL",
    [`${dir}/design/verify-2.md`]: "**Verdict:** PASS",
    [`${dir}/plan/verify-1.md`]: "Verdict: PASS",
    [`${dir}/state.json`]: JSON.stringify({
      version: 1,
      parts: { "01": { status: "done", attempts: 1 }, "02": { status: "done", attempts: 2 } },
    }),
    [`${dir}/review/round-1/report.md`]: "report",
    [`${dir}/review/round-1/findings.jsonl`]: [
      finding("f-000000000001"),
      JSON.stringify({ type: "level", id: "f-000000000001", level: "blocker" }),
      JSON.stringify({ type: "decision", id: "f-000000000001", decision: "fix" }),
    ].join("\n"),
    [`${dir}/review/round-2/report.md`]: "report",
    [`${dir}/review/round-2/findings.jsonl`]: finding("f-000000000002"),
    [`${dir}/close/spec-conformance.md`]: "Verdict: PASS",
    [`${dir}/close/pr.md`]: "https://github.com/o/r/pull/1",
  };
}

/** `finished(change)` without the given files, plus the given overrides. */
function tree(change: string, without: readonly string[], add: Tree = {}): Tree {
  const files = { ...runJson([change]), ...finished(change), ...add };
  return Object.fromEntries(
    Object.entries(files).filter(([path]) => !without.some((gone) => path.includes(gone))),
  );
}

async function bdk(
  files: Tree,
  argv: readonly string[] = ["run", "status", "--json"],
): Promise<{ code: number; stdout: string; stderr: string }> {
  let [stdout, stderr] = ["", ""];
  const code = await run({
    argv,
    version: "0.0.0",
    nodeVersion: "24.0.0",
    groups: [runGroup({ files: memoryFiles(files), cwd: ROOT })],
    stdout: (text) => (stdout += text),
    stderr: (text) => (stderr += text),
  });
  return { code, stdout, stderr };
}

async function status(files: Tree): Promise<StatusResult> {
  const { code, stdout, stderr } = await bdk(files);
  expect({ code, stderr }).toEqual({ code: 0, stderr: "" });
  return statusResult.parse(JSON.parse(stdout));
}

async function stageOf(files: Tree): Promise<StatusResult["changes"][number]> {
  const result = await status(files);
  const [first] = result.changes;
  if (first === undefined) throw new Error("no change");
  return first;
}

const C = "v3-12-foo";
const SPEC = `openspec/changes/archive/2026-10-07-${C}`;
const DIR = `${RUN}/${C}`;

describe("bdk run status: the resume table from files", () => {
  it("row 1: no OpenSpec Change directory", async () => {
    expect(await stageOf(tree(C, [SPEC]))).toMatchObject({ stage: "propose", row: 1 });
  });

  it("row 1: no proposal.md", async () => {
    expect(await stageOf(tree(C, ["proposal.md"]))).toMatchObject({
      stage: "propose",
      row: 1,
      reason: "no proposal.md",
    });
  });

  it("row 2: no design.md", async () => {
    expect(await stageOf(tree(C, [`${SPEC}/design.md`]))).toMatchObject({
      stage: "design",
      row: 2,
    });
  });

  it("row 2: the last design report fails", async () => {
    expect(
      await stageOf(tree(C, [], { [`${DIR}/design/verify-10.md`]: "Verdict: FAIL" })),
    ).toMatchObject({ stage: "design", row: 2, reason: "design/verify-10.md does not pass" });
  });

  it("ignores report and round names with leading zeros", async () => {
    expect(
      await stageOf(
        tree(C, [], {
          [`${DIR}/design/verify-03.md`]: "Verdict: FAIL",
          [`${DIR}/review/round-03/notes.md`]: "x",
        }),
      ),
    ).toMatchObject({ stage: "done" });
  });

  it("row 3: no plan part", async () => {
    expect(await stageOf(tree(C, ["plan/parts"]))).toMatchObject({ stage: "plan", row: 3 });
  });

  it("row 3: the last plan report has no verdict", async () => {
    expect(await stageOf(tree(C, [], { [`${DIR}/plan/verify-2.md`]: "looks fine" }))).toMatchObject(
      { stage: "plan", row: 3, reason: "plan/verify-2.md does not pass" },
    );
  });

  it("row 4: a blocked part", async () => {
    const result = await status(
      tree(C, [], {
        [`${DIR}/state.json`]: JSON.stringify({
          version: 1,
          parts: {
            "01": { status: "done", attempts: 1 },
            "02": { status: "blocked", attempts: 3, reason: "API missing" },
          },
        }),
      }),
    );
    expect(result.changes[0]).toMatchObject({
      stage: "execute",
      row: 4,
      reason: "1 of 2 parts not done, 1 blocked",
    });
    expect(result.parts).toEqual([
      { id: "01", status: "done", attempts: 1, reason: null },
      { id: "02", status: "blocked", attempts: 3, reason: "API missing" },
    ]);
  });

  it("row 4: no state.json means every part is pending", async () => {
    const result = await status(tree(C, ["state.json"]));
    expect(result.changes[0]).toMatchObject({ stage: "execute", row: 4 });
    expect(result.parts).toEqual([
      { id: "01", status: "pending", attempts: 0, reason: null },
      { id: "02", status: "pending", attempts: 0, reason: null },
    ]);
  });

  it("row 5: no review round", async () => {
    expect(await stageOf(tree(C, ["review/"]))).toMatchObject({
      stage: "auto-review",
      step: "first-round",
      row: 5,
      round: 1,
    });
  });

  it("row 6: a round without report.md", async () => {
    expect(await stageOf(tree(C, ["round-2/report.md"]))).toMatchObject({
      stage: "auto-review",
      step: "repeat-round",
      row: 6,
      round: 2,
    });
  });

  it("row 7: a blocker without a decision in the last round", async () => {
    expect(
      await stageOf(
        tree(C, [], {
          [`${DIR}/review/round-2/findings.jsonl`]: [
            JSON.stringify({ type: "finding", id: "f-000000000002", source: "r", summary: "x" }),
            JSON.stringify({ type: "level", id: "f-000000000002", level: "blocker" }),
          ].join("\n"),
        }),
      ),
    ).toMatchObject({ stage: "auto-review", step: "triage", row: 7, round: 2 });
  });

  it("row 8: a fix decision in the last round", async () => {
    expect(
      await stageOf(
        tree(C, [], {
          [`${DIR}/review/round-2/findings.jsonl`]: [
            JSON.stringify({ type: "finding", id: "f-000000000002", source: "r", summary: "x" }),
            JSON.stringify({ type: "level", id: "f-000000000002", level: "blocker" }),
            JSON.stringify({ type: "decision", id: "f-000000000002", decision: "fix" }),
          ].join("\n"),
        }),
      ),
    ).toMatchObject({ stage: "auto-review", step: "fix", row: 8, round: 2 });
  });

  it("row 9: no spec-conformance report", async () => {
    expect(await stageOf(tree(C, ["spec-conformance.md"]))).toMatchObject({
      stage: "close",
      step: "spec-conformance",
      row: 9,
    });
  });

  it("row 9: not archived", async () => {
    const active = Object.fromEntries(
      Object.entries(finished(C))
        .filter(([path]) => path.startsWith(SPEC))
        .map(([path, text]) => [path.replace(SPEC, `openspec/changes/${C}`), text]),
    );
    expect(await stageOf({ ...tree(C, [SPEC]), ...active })).toMatchObject({
      stage: "close",
      step: "archive",
      row: 9,
    });
  });

  it("row 9: no pull request", async () => {
    expect(await stageOf(tree(C, ["close/pr.md"]))).toMatchObject({
      stage: "close",
      step: "pr",
      row: 9,
    });
  });

  it("done: archived with a PR", async () => {
    expect(await stageOf(tree(C, []))).toMatchObject({ stage: "done", row: null, step: null });
  });

  it("an earlier row wins: a pending part with review rounds is execute", async () => {
    expect(
      await stageOf(
        tree(C, [], {
          [`${DIR}/state.json`]: JSON.stringify({
            version: 1,
            parts: {
              "01": { status: "done", attempts: 1 },
              "02": { status: "pending", attempts: 0 },
            },
          }),
        }),
      ),
    ).toMatchObject({ stage: "execute", row: 4 });
  });

  it("uses the latest archived copy of a Change", async () => {
    expect(
      await stageOf(tree(C, [], { [`openspec/changes/archive/2026-10-08-${C}/notes.md`]: "x" })),
    ).toMatchObject({ stage: "propose", row: 1, reason: "no proposal.md" });
  });
});

describe("bdk run status: a queue", () => {
  const files = {
    ...finished("v3-11-bar"),
    ...tree(C, ["state.json"]),
    ...runJson(["v3-11-bar", C, "v3-13-baz"], C),
  };

  it("derives every Change in queue order and marks the current one", async () => {
    const result = await status(files);
    expect(result.mode).toBe("non-interactive");
    expect(result.current).toBe(C);
    expect(
      result.changes.map(({ change, issue, current, stage }) => [change, issue, current, stage]),
    ).toEqual([
      ["v3-11-bar", 10, false, "done"],
      [C, 11, true, "execute"],
      ["v3-13-baz", 12, false, "propose"],
    ]);
  });

  it("prints the text form", async () => {
    const { code, stdout, stderr } = await bdk(files, ["run", "status"]);
    expect({ code, stderr }).toEqual({ code: 0, stderr: "" });
    expect(stdout).toBe(
      [
        `run: non-interactive, current ${C} (2 of 3)`,
        "changes:",
        "  v3-11-bar #10  done: archived, PR opened",
        `* ${C} #11  execute (row 4): 2 of 2 parts not done`,
        "  v3-13-baz #12  propose (row 1): no OpenSpec Change directory",
        `parts of ${C}:`,
        "  01  pending  attempts 0",
        "  02  pending  attempts 0",
        "",
      ].join("\n"),
    );
  });

  it("prints byte-identical output for the same files", async () => {
    const [a, b] = [await bdk(files, ["run", "status"]), await bdk(files, ["run", "status"])];
    expect(a).toEqual(b);
  });

  it("reads nothing outside the project", async () => {
    const memory = memoryFiles(files);
    await run({
      argv: ["run", "status"],
      version: "0.0.0",
      nodeVersion: "24.0.0",
      groups: [runGroup({ files: memory, cwd: ROOT })],
      stdout: () => undefined,
      stderr: () => undefined,
    });
    expect(memory.reads.every((path) => path.startsWith(`${ROOT}/`))).toBe(true);
  });
});

describe("bdk run status: warnings", () => {
  it("lets the latest level win: a blocker lowered to should-fix is not open", async () => {
    expect(
      await stageOf(
        tree(C, [], {
          [`${DIR}/review/round-2/findings.jsonl`]: [
            JSON.stringify({ type: "finding", id: "f-000000000002", source: "r", summary: "x" }),
            JSON.stringify({ type: "level", id: "f-000000000002", level: "blocker" }),
            JSON.stringify({ type: "level", id: "f-000000000002", level: "should-fix" }),
          ].join("\n"),
        }),
      ),
    ).toMatchObject({ stage: "done" });
  });

  it("skips a level for an unknown finding and names it", async () => {
    const result = await status(
      tree(C, [], {
        [`${DIR}/review/round-2/findings.jsonl`]: JSON.stringify({
          type: "level",
          id: "f-000000000009",
          level: "blocker",
        }),
      }),
    );
    expect(result.changes[0]?.stage).toBe("done");
    expect(result.warnings).toEqual([
      `${DIR}/review/round-2/findings.jsonl line 1: no finding has the id f-000000000009, skipped`,
    ]);
  });

  it("skips a broken findings line and names it", async () => {
    const result = await status(
      tree(C, [], {
        [`${DIR}/review/round-2/findings.jsonl`]: [
          JSON.stringify({ type: "finding", id: "f-000000000002", source: "r", summary: "x" }),
          "{oops",
        ].join("\n"),
      }),
    );
    expect(result.changes[0]?.stage).toBe("done");
    expect(result.warnings).toEqual([
      `${DIR}/review/round-2/findings.jsonl line 2: not valid JSON, skipped`,
    ]);
    const { stdout } = await bdk(
      tree(C, [], { [`${DIR}/review/round-2/findings.jsonl`]: "{oops" }),
      ["run", "status"],
    );
    expect(stdout).toContain(
      `warnings:\n  ${DIR}/review/round-2/findings.jsonl line 1: not valid JSON, skipped\n`,
    );
  });
});

describe("bdk run status: errors", () => {
  async function error(files: Tree): Promise<{ code: number; error: unknown }> {
    const { code, stdout, stderr } = await bdk(files);
    expect(stderr).toBe("");
    return { code, error: (JSON.parse(stdout) as { error: unknown }).error };
  }

  it("env/no-run without run.json", async () => {
    expect(await error({})).toEqual({
      code: 3,
      error: {
        code: "env/no-run",
        message: "no run: .bdk/runs/run.json is missing",
        hint: "Start a run with /bdk:run.",
      },
    });
  });

  it("env/no-run in text mode", async () => {
    expect(await bdk({}, ["run", "status"])).toEqual({
      code: 3,
      stdout: "",
      stderr: "bdk: no run: .bdk/runs/run.json is missing\nhint: Start a run with /bdk:run.\n",
    });
  });

  it.each([
    ["invalid JSON", { [`${RUN}/run.json`]: "{" }, /^\.bdk\/runs\/run\.json is not valid JSON: /],
    [
      "a current that names no entry",
      runJson([C], "v3-99-x"),
      /^\.bdk\/runs\/run\.json: current: /,
    ],
    ["an unsafe name", runJson(["../x"], "../x"), /^\.bdk\/runs\/run\.json: queue\.0\.change: /],
    ["a capital in a name", runJson(["Foo"], "Foo"), /queue\.0\.change/],
    ["a name twice", runJson([C, C]), /queue\.1\.change: named twice/],
    ["an unknown mode", runJson([C], C, { mode: "auto" }), /run\.json: mode: /],
    ["a wrong version", runJson([C], C, { version: 2 }), /run\.json: version: /],
    [
      "an invalid part status",
      tree(C, [], {
        [`${DIR}/state.json`]: JSON.stringify({
          version: 1,
          parts: { "01": { status: "finished", attempts: 0 } },
        }),
      }),
      /^\.bdk\/runs\/v3-12-foo\/state\.json: parts\.01\.status: /,
    ],
    [
      "a negative attempt count",
      tree(C, [], {
        [`${DIR}/state.json`]: JSON.stringify({
          version: 1,
          parts: { "01": { status: "done", attempts: -1 } },
        }),
      }),
      /state\.json: parts\.01\.attempts: /,
    ],
  ])("env/invalid-run-state for %s", async (_, files, message) => {
    const { code, error: found } = await error(files);
    expect(code).toBe(3);
    expect(found).toMatchObject({ code: "env/invalid-run-state" });
    expect((found as { message: string }).message).toMatch(message);
  });

  it("reads no path built from an unsafe name", async () => {
    const memory = memoryFiles(runJson(["../x"], "../x"));
    await run({
      argv: ["run", "status"],
      version: "0.0.0",
      nodeVersion: "24.0.0",
      groups: [runGroup({ files: memory, cwd: ROOT })],
      stdout: () => undefined,
      stderr: () => undefined,
    });
    expect(memory.reads).toEqual([`${ROOT}/${RUN}/run.json`]);
  });

  it("ignores unknown keys", async () => {
    expect((await status(runJson([C], C, { started: "today" }))).current).toBe(C);
  });
});
