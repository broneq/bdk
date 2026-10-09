import { describe, expect, it } from "vitest";

import { run } from "../../shared/cli/index.ts";
import { findingId } from "../domain/id.ts";
import { findingsGroup } from "../index.ts";
import { addResult } from "../schema/add.ts";
import { decideResult } from "../schema/decide.ts";
import { levelResult } from "../schema/level.ts";
import { listResult } from "../schema/list.ts";
import { reportResult } from "../schema/report.ts";
import { MemoryFiles } from "./memory-files.ts";

// Spec `bdk-cli/findings`, the commands through the CLI frame against an in-memory `Files`.

const DIR = "/p/.bdk/runs/c/review/round-1";
const LOG = `${DIR}/findings.jsonl`;

interface Outcome {
  readonly code: number;
  readonly stdout: string;
  readonly stderr: string;
}

async function bdk(files: MemoryFiles, ...argv: string[]): Promise<Outcome> {
  let stdout = "";
  let stderr = "";
  const code = await run({
    argv,
    version: "0.0.0",
    nodeVersion: "24.0.0",
    groups: [findingsGroup({ files })],
    stdout: (text) => (stdout += text),
    stderr: (text) => (stderr += text),
  });
  return { code, stdout, stderr };
}

async function json(files: MemoryFiles, ...argv: string[]): Promise<unknown> {
  const { code, stdout, stderr } = await bdk(files, ...argv, "--json");
  expect(stderr).toBe("");
  expect(code).toBe(0);
  return JSON.parse(stdout) as unknown;
}

async function error(
  files: MemoryFiles,
  ...argv: string[]
): Promise<{ code: number; error: string }> {
  const { code, stdout } = await bdk(files, ...argv, "--json");
  return { code, error: (JSON.parse(stdout) as { error: { code: string } }).error.code };
}

const lines = (files: MemoryFiles): unknown[] =>
  (files.readText(LOG) ?? "")
    .split("\n")
    .filter((line) => line !== "")
    .map((line) => JSON.parse(line) as unknown);

const A = [
  "--source",
  "review-group",
  "--summary",
  "a is wrong",
  "--file",
  "src/a.ts",
  "--line",
  "3",
];
const idA = findingId({ file: "src/a.ts", line: 3, summary: "a is wrong" });

describe("bdk findings add", () => {
  it("creates the round directory and the log and prints the id", async () => {
    const files = new MemoryFiles();
    expect(await bdk(files, "findings", "add", LOG, ...A)).toEqual({
      code: 0,
      stdout: `${idA}\n`,
      stderr: "",
    });
    expect(files.readText(LOG)).toBe(
      `{"type":"finding","id":"${idA}","source":"review-group","summary":"a is wrong","file":"src/a.ts","line":3}\n`,
    );
  });

  it("prints {id} under --json and writes every optional field", async () => {
    const files = new MemoryFiles();
    const result = addResult.parse(
      await json(
        files,
        "findings",
        "add",
        LOG,
        "--source",
        "check",
        "--summary",
        "red",
        "--file",
        "a.ts",
        "--rule",
        "lint",
        "--evidence",
        "line 1:\nerror",
      ),
    );
    expect(result.id).toBe(findingId({ file: "a.ts", rule: "lint", summary: "red" }));
    expect(lines(files)).toEqual([
      {
        type: "finding",
        id: result.id,
        source: "check",
        summary: "red",
        file: "a.ts",
        rule: "lint",
        evidence: "line 1:\nerror",
      },
    ]);
    expect(files.readText(LOG)?.split("\n")).toHaveLength(2);
  });

  it("appends a duplicate as its own line with the same id", async () => {
    const files = new MemoryFiles();
    await bdk(files, "findings", "add", LOG, ...A);
    const second = await bdk(
      files,
      "findings",
      "add",
      LOG,
      "--source",
      "e2e-check",
      "--summary",
      "A is wrong!",
      "--file",
      "src/a.ts",
      "--line",
      "3",
    );
    expect(second.stdout).toBe(`${idA}\n`);
    expect(lines(files)).toHaveLength(2);
  });

  it.each([
    [["--summary", "x"], "usage/missing-argument"],
    [["--source", "s"], "usage/missing-argument"],
    [["--source", "s", "--summary", "x", "--line", "3"], "usage/invalid-argument"],
    [
      ["--source", "s", "--summary", "x", "--file", "a.ts", "--line", "0"],
      "usage/invalid-argument",
    ],
    [
      ["--source", "s", "--summary", "x", "--file", "a.ts", "--line", "3.5"],
      "usage/invalid-argument",
    ],
    [["--source", "s", "--summary", ""], "usage/invalid-argument"],
    [["--source", "s", "--summary", "x", "--file", ""], "usage/invalid-argument"],
  ])("refuses %j with %s and writes nothing", async (flags, code) => {
    const files = new MemoryFiles();
    expect(await error(files, "findings", "add", LOG, ...flags)).toEqual({ code: 2, error: code });
    expect(files.readText(LOG)).toBeUndefined();
  });
});

describe("bdk findings level", () => {
  it("appends a level event and confirms it", async () => {
    const files = new MemoryFiles();
    await bdk(files, "findings", "add", LOG, ...A);
    expect(
      await bdk(files, "findings", "level", LOG, idA, "blocker", "--reason", "crashes"),
    ).toEqual({
      code: 0,
      stdout: `${idA} level blocker\n`,
      stderr: "",
    });
    expect(
      levelResult.parse(await json(files, "findings", "level", LOG, idA, "nice-to-have")),
    ).toEqual({
      id: idA,
      level: "nice-to-have",
    });
    expect(lines(files).slice(1)).toEqual([
      { type: "level", id: idA, level: "blocker", reason: "crashes" },
      { type: "level", id: idA, level: "nice-to-have" },
    ]);
  });

  it("refuses an unknown id and an unknown level and writes nothing", async () => {
    const files = new MemoryFiles();
    await bdk(files, "findings", "add", LOG, ...A);
    const before = files.readText(LOG);
    expect(await error(files, "findings", "level", LOG, "f-000000000000", "blocker")).toEqual({
      code: 2,
      error: "usage/unknown-finding",
    });
    expect(await error(files, "findings", "level", LOG, idA, "urgent")).toEqual({
      code: 2,
      error: "usage/invalid-argument",
    });
    expect(files.readText(LOG)).toBe(before);
  });

  it("refuses any id on a missing log and creates nothing", async () => {
    const files = new MemoryFiles();
    expect(await error(files, "findings", "level", LOG, idA, "blocker")).toEqual({
      code: 2,
      error: "usage/unknown-finding",
    });
    expect(files.readText(LOG)).toBeUndefined();
  });
});

describe("bdk findings decide", () => {
  it("appends decisions with an issue and a reason", async () => {
    const files = new MemoryFiles();
    await bdk(files, "findings", "add", LOG, ...A);
    expect(
      (await bdk(files, "findings", "decide", LOG, idA, "defer", "--issue", "#9")).stdout,
    ).toBe(`${idA} decision defer #9\n`);
    expect(
      decideResult.parse(
        await json(files, "findings", "decide", LOG, idA, "fix", "--reason", "cheap"),
      ),
    ).toEqual({ id: idA, decision: "fix" });
    expect(lines(files).slice(1)).toEqual([
      { type: "decision", id: idA, decision: "defer", issue: "#9" },
      { type: "decision", id: idA, decision: "fix", reason: "cheap" },
    ]);
  });

  it("defers without an issue", async () => {
    const files = new MemoryFiles();
    await bdk(files, "findings", "add", LOG, ...A);
    expect(
      decideResult.parse(
        await json(files, "findings", "decide", LOG, idA, "defer", "--reason", "nice-to-have"),
      ),
    ).toEqual({ id: idA, decision: "defer" });
    expect(lines(files).slice(1)).toEqual([
      { type: "decision", id: idA, decision: "defer", reason: "nice-to-have" },
    ]);
    expect((await bdk(files, "findings", "list", LOG)).stdout).toContain(`${idA}  -  defer  `);
  });

  it.each([
    [["fix", "--issue", "#9"], "usage/invalid-argument"],
    [["accept", "--issue", "#9"], "usage/invalid-argument"],
    [["later"], "usage/invalid-argument"],
  ])("refuses %j with %s", async (rest, code) => {
    const files = new MemoryFiles();
    await bdk(files, "findings", "add", LOG, ...A);
    const before = files.readText(LOG);
    expect(await error(files, "findings", "decide", LOG, idA, ...rest)).toEqual({
      code: 2,
      error: code,
    });
    expect(files.readText(LOG)).toBe(before);
  });

  it("refuses an unknown id", async () => {
    const files = new MemoryFiles([DIR]);
    expect(await error(files, "findings", "decide", LOG, idA, "fix")).toEqual({
      code: 2,
      error: "usage/unknown-finding",
    });
  });
});

describe("bdk findings list", () => {
  async function round(): Promise<MemoryFiles> {
    const files = new MemoryFiles();
    await bdk(files, "findings", "add", LOG, ...A);
    await bdk(
      files,
      "findings",
      "add",
      LOG,
      "--source",
      "e2e-check",
      "--summary",
      "login fails",
      "--evidence",
      "500 on POST /login",
    );
    await bdk(
      files,
      "findings",
      "add",
      LOG,
      "--source",
      "review-integration",
      "--summary",
      "a is broken",
      "--file",
      "src/a.ts",
      "--line",
      "3",
    );
    await bdk(
      files,
      "findings",
      "add",
      LOG,
      "--source",
      "review-integration",
      "--summary",
      "A is wrong.",
      "--file",
      "src/a.ts",
      "--line",
      "3",
    );
    const idB = findingId({ summary: "login fails" });
    await bdk(files, "findings", "level", LOG, idA, "should-fix");
    await bdk(files, "findings", "level", LOG, idA, "blocker", "--reason", "crash");
    await bdk(files, "findings", "level", LOG, idB, "nice-to-have");
    await bdk(files, "findings", "decide", LOG, idA, "defer", "--issue", "#9");
    await bdk(files, "findings", "decide", LOG, idA, "fix");
    await bdk(files, "findings", "decide", LOG, idB, "accept");
    return files;
  }

  it("folds the log with the latest level and decision", async () => {
    const result = listResult.parse(await json(await round(), "findings", "list", LOG));
    expect(result.counts).toEqual({
      findings: 3,
      level: { blocker: 1, "should-fix": 0, "nice-to-have": 1, "not-a-problem": 0, unleveled: 1 },
      decision: { fix: 1, accept: 1, defer: 0, undecided: 1 },
    });
    expect(result.findings[0]).toEqual({
      id: idA,
      source: "review-group",
      sources: ["review-group", "review-integration"],
      reports: 2,
      summary: "a is wrong",
      file: "src/a.ts",
      line: 3,
      level: "blocker",
      levelReason: "crash",
      decision: "fix",
    });
    expect(result.findings).toHaveLength(3);
    expect(result.skipped).toEqual([]);
  });

  it("lists what to fix and keeps the counts of the whole log", async () => {
    const files = await round();
    const fix = listResult.parse(await json(files, "findings", "list", LOG, "--decision", "fix"));
    expect(fix.findings.map((f) => f.id)).toEqual([idA]);
    expect(fix.counts.findings).toBe(3);
    const open = listResult.parse(
      await json(files, "findings", "list", LOG, "--decision", "undecided", "--level", "unleveled"),
    );
    expect(open.findings.map((f) => f.summary)).toEqual(["a is broken"]);
    const none = listResult.parse(
      await json(files, "findings", "list", LOG, "--level", "blocker", "--decision", "accept"),
    );
    expect(none.findings).toEqual([]);
  });

  it("renders text for a model to read", async () => {
    const files = await round();
    files.appendText(LOG, '{"type":\n');
    const { code, stdout, stderr } = await bdk(files, "findings", "list", LOG);
    expect({ code, stderr }).toEqual({ code: 0, stderr: "" });
    const idB = findingId({ summary: "login fails" });
    const idC = findingId({ file: "src/a.ts", line: 3, summary: "a is broken" });
    expect(stdout).toBe(
      [
        "3 findings. Level: 1 blocker, 0 should-fix, 1 nice-to-have, 0 not-a-problem, 1 unleveled. Decision: 1 fix, 1 accept, 0 defer, 1 undecided.",
        "",
        `${idA}  blocker  fix  src/a.ts:3  a is wrong  (review-group, review-integration)`,
        "  level reason: crash",
        `${idB}  nice-to-have  accept  -  login fails  (e2e-check)`,
        "  evidence: 500 on POST /login",
        `${idC}  -  -  src/a.ts:3  a is broken  (review-integration)`,
        "",
        "Skipped line 11: not valid JSON",
        "",
      ].join("\n"),
    );
  });

  it("renders a filtered list with how many it shows", async () => {
    const { stdout } = await bdk(await round(), "findings", "list", LOG, "--decision", "fix");
    expect(stdout.split("\n").slice(0, 4)).toEqual([
      "3 findings. Level: 1 blocker, 0 should-fix, 1 nice-to-have, 0 not-a-problem, 1 unleveled. Decision: 1 fix, 1 accept, 0 defer, 1 undecided.",
      "1 listed (--decision fix).",
      "",
      `${idA}  blocker  fix  src/a.ts:3  a is wrong  (review-group, review-integration)`,
    ]);
  });

  it("renders a rule, an issue and a decision reason", async () => {
    const files = new MemoryFiles();
    const id = (
      await bdk(
        files,
        "findings",
        "add",
        LOG,
        "--source",
        "check",
        "--summary",
        "red",
        "--file",
        "a.ts",
        "--rule",
        "lint",
      )
    ).stdout.trim();
    await bdk(files, "findings", "decide", LOG, id, "defer", "--issue", "#4", "--reason", "big");
    expect((await bdk(files, "findings", "list", LOG)).stdout.split("\n").slice(2, 4)).toEqual([
      `${id}  -  defer #4  a.ts [lint]  red  (check)`,
      "  decision reason: big",
    ]);
  });

  it("folds a missing log in an existing directory to zero findings", async () => {
    const files = new MemoryFiles([DIR]);
    const result = listResult.parse(await json(files, "findings", "list", LOG));
    expect(result.counts.findings).toBe(0);
    expect((await bdk(files, "findings", "list", LOG)).stdout).toBe(
      "0 findings. Level: 0 blocker, 0 should-fix, 0 nice-to-have, 0 not-a-problem, 0 unleveled. Decision: 0 fix, 0 accept, 0 defer, 0 undecided.\n",
    );
  });

  it("reports a missing directory as an environment error", async () => {
    expect(await error(new MemoryFiles(), "findings", "list", LOG)).toEqual({
      code: 3,
      error: "env/log-dir-missing",
    });
  });

  it.each([
    ["--level", "urgent"],
    ["--decision", "later"],
  ])("refuses %s %s", async (flag, value) => {
    expect(await error(new MemoryFiles([DIR]), "findings", "list", LOG, flag, value)).toEqual({
      code: 2,
      error: "usage/invalid-argument",
    });
  });
});

describe("bdk findings help", () => {
  it("lists the five commands", async () => {
    const { stdout } = await bdk(new MemoryFiles(), "findings", "--help");
    for (const verb of ["add", "level", "decide", "list", "report"])
      expect(stdout).toMatch(new RegExp(`^  ${verb} `, "m"));
  });
});

describe("bdk findings report", () => {
  const REPORT = `${DIR}/review.md`;

  async function judged(): Promise<{ files: MemoryFiles; idB: string }> {
    const files = new MemoryFiles();
    await bdk(files, "findings", "add", LOG, ...A, "--evidence", "a(1) gives 2\nnot 1");
    const idB = (
      await bdk(
        files,
        "findings",
        "add",
        LOG,
        "--source",
        "review-group",
        "--summary",
        "short name",
        "--file",
        "src/b.ts",
        "--rule",
        "BDK-CQ-1",
      )
    ).stdout.trim();
    await bdk(files, "findings", "level", LOG, idA, "blocker", "--reason", "breaks a scenario");
    await bdk(files, "findings", "level", LOG, idB, "not-a-problem", "--reason", "idiomatic");
    await bdk(files, "findings", "decide", LOG, idB, "defer", "--issue", "#4", "--reason", "big");
    return { files, idB };
  }

  it("writes review.md next to the log with every section", async () => {
    const { files, idB } = await judged();
    expect(await bdk(files, "findings", "report", LOG)).toEqual({
      code: 0,
      stdout: `${REPORT}\n2 findings. Level: 1 blocker, 0 should-fix, 0 nice-to-have, 1 not-a-problem, 0 unleveled. Decision: 0 fix, 0 accept, 1 defer, 1 undecided.\n`,
      stderr: "",
    });
    expect(files.readText(REPORT)).toBe(
      [
        "# Review round report",
        "",
        "2 findings. Level: 1 blocker, 0 should-fix, 0 nice-to-have, 1 not-a-problem, 0 unleveled. Decision: 0 fix, 0 accept, 1 defer, 1 undecided.",
        "",
        "## blocker",
        "",
        `- ${idA} \`src/a.ts:3\` a is wrong (review-group)`,
        "  - Evidence: a(1) gives 2",
        "    not 1",
        "  - Level reason: breaks a scenario",
        "",
        "## should-fix",
        "",
        "None.",
        "",
        "## nice-to-have",
        "",
        "None.",
        "",
        "## not-a-problem",
        "",
        `- ${idB} \`src/b.ts\` [BDK-CQ-1] short name (review-group)`,
        "  - Level reason: idiomatic",
        "  - Decision: defer #4",
        "  - Decision reason: big",
        "",
        "## unleveled",
        "",
        "None.",
        "",
      ].join("\n"),
    );
  });

  it("prints the path and the counts under --json", async () => {
    const { files } = await judged();
    const result = reportResult.parse(await json(files, "findings", "report", LOG));
    expect(result.report).toBe(REPORT);
    expect(result.counts.level.blocker).toBe(1);
  });

  it("writes the same report for the same log", async () => {
    const { files } = await judged();
    await bdk(files, "findings", "report", LOG);
    const first = files.readText(REPORT);
    await bdk(files, "findings", "report", LOG);
    expect(files.readText(REPORT)).toBe(first);
  });

  it("replaces an earlier report", async () => {
    const files = new MemoryFiles();
    await bdk(files, "findings", "add", LOG, ...A);
    files.writeText(REPORT, "stale\n");
    await bdk(files, "findings", "report", LOG);
    expect(files.readText(REPORT)).toContain(`## unleveled\n\n- ${idA} `);
    await bdk(files, "findings", "level", LOG, idA, "should-fix");
    await bdk(files, "findings", "report", LOG);
    const text = files.readText(REPORT) ?? "";
    expect(text).toContain(`## should-fix\n\n- ${idA} `);
    expect(text).toContain("## unleveled\n\nNone.\n");
    expect(text).not.toContain("stale");
  });

  it("lists skipped lines only when there are some", async () => {
    const files = new MemoryFiles();
    await bdk(files, "findings", "add", LOG, ...A);
    await bdk(files, "findings", "report", LOG);
    expect(files.readText(REPORT)).not.toContain("## Skipped lines");
    files.appendText(LOG, "{oops\n");
    await bdk(files, "findings", "report", LOG);
    expect(files.readText(REPORT)).toMatch(/## Skipped lines\n\n- Line 2: not valid JSON\n$/);
  });

  it("reports a round without findings", async () => {
    const files = new MemoryFiles([DIR]);
    const result = reportResult.parse(await json(files, "findings", "report", LOG));
    expect(result.counts.findings).toBe(0);
    const text = files.readText(REPORT) ?? "";
    expect(text.match(/^None\.$/gm)).toHaveLength(5);
  });

  it("reports a missing directory and writes nothing", async () => {
    const files = new MemoryFiles();
    expect(await error(files, "findings", "report", LOG)).toEqual({
      code: 3,
      error: "env/log-dir-missing",
    });
    expect(files.texts.size).toBe(0);
  });
});
