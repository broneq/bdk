import { execFileSync } from "node:child_process";
import { existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { afterEach, describe, expect, it } from "vitest";

import { emptyBase } from "../../harness/fixture.ts";
import type { CellPlan, SeriesPlan } from "../../harness/series.ts";
import { answerHookOutput } from "./answer.ts";
import { CASE_VAR, hooks, kernelIn, measure, prepareRun } from "./hooks.ts";

const BUNDLE = join(import.meta.dirname, "..", "..", "..", "dist", "bdk.mjs");

let root: string | undefined;
afterEach(() => {
  if (root !== undefined) rmSync(root, { recursive: true, force: true });
});

function repo(): { workDir: string; configHome: string; emptyBase: string } {
  root = mkdtempSync(join(tmpdir(), "bdk-stages-"));
  const workDir = join(root, "work");
  execFileSync("git", ["init", "--quiet", workDir]);
  writeFileSync(join(workDir, "fixture.txt"), "fixture\n");
  return {
    workDir,
    configHome: join(root, "config-home"),
    emptyBase: emptyBase(join(root, "empty")),
  };
}

describe("prepareRun", () => {
  it("installs the answer hook, hides it from git and runs the preparation with $BDK", () => {
    const { workDir, configHome, emptyBase: empty } = repo();
    const settings = { bundle: BUNDLE, configHome, emptyBase: empty };
    prepareRun(
      workDir,
      {
        id: "seeded",
        base: "fixture",
        command: "/bdk:setup",
        prepare: ['node "$BDK" config set languages "[typescript]" >/dev/null'],
        answers: { branch: "stay" },
        expect: [{ reply: "x" }],
      },
      settings,
    );
    expect(readFileSync(join(workDir, ".claude", "settings.json"), "utf8")).toContain(
      "answer-hook.ts",
    );
    expect(readFileSync(join(workDir, "..", "answers-seeded.json"), "utf8")).toBe(
      '{"branch":"stay"}\n',
    );
    expect(
      execFileSync("git", ["status", "--porcelain", "--untracked-files=all"], {
        cwd: workDir,
        encoding: "utf8",
      }),
    ).not.toContain(".claude/settings.json");
    expect(existsSync(join(workDir, ".bdk", "settings.yaml"))).toBe(true);

    const call = kernelIn(workDir, settings)("config show languages");
    expect(call).toMatchObject({ code: 0, json: { value: ["typescript"] } });
  });

  it("starts a case on the empty base from the empty repository", () => {
    const { workDir, configHome, emptyBase: empty } = repo();
    prepareRun(
      workDir,
      { id: "bare", base: "empty", command: "/bdk:setup", prepare: [], answers: {}, expect: [] },
      { bundle: BUNDLE, configHome, emptyBase: empty },
    );
    expect(existsSync(join(workDir, "fixture.txt"))).toBe(false);
    expect(
      execFileSync("git", ["log", "--format=%s"], { cwd: workDir, encoding: "utf8" }).trim(),
    ).toBe("empty eval base");
  });
});

// The hook runs as `node answer-hook.ts`, like `pnpm eval` itself: it needs
// a Node that strips types (>= 22.18), which the kernel's 22.13 floor lacks.
const stripsTypes = Boolean((process.features as { typescript?: unknown }).typescript);

describe("the answer hook command", () => {
  it.skipIf(!stripsTypes)("prints the hook output for the payload on stdin", () => {
    root = mkdtempSync(join(tmpdir(), "bdk-stages-"));
    const answers = join(root, "answers.json");
    writeFileSync(answers, '{"branch":"stay"}');
    const toolInput = {
      questions: [
        { question: "Branch?", header: "Branch", options: [{ label: "New" }, { label: "Stay" }] },
      ],
    };
    const output = execFileSync(
      process.execPath,
      [join(import.meta.dirname, "answer-hook.ts"), answers],
      { input: JSON.stringify({ tool_name: "AskUserQuestion", tool_input: toolInput }) },
    ).toString();
    expect(JSON.parse(output)).toEqual(answerHookOutput(toolInput, { branch: "stay" }));
  });
});

describe("hooks", () => {
  function context(workDir: string | null, settings: Record<string, unknown>, stage?: object) {
    const cell: CellPlan = {
      debugFile: "",
      expectedPlugins: 1,
      workDir,
      fixtureBase: null,
      provenance: { fixtureCommit: null, bdkCommit: "c", variantHash: null },
      settings,
    };
    const plan: SeriesPlan = {
      suite: "stages",
      series: "s",
      ledgerFile: "",
      budgetUsd: 1,
      runCapUsd: 1,
      resultsFile: "",
      rawDir: join(root ?? "", "raw"),
      cells: { bdk: cell },
    };
    return {
      plan,
      cellName: "bdk",
      cell,
      item: "change/x",
      run: 1,
      vars: stage === undefined ? {} : { [CASE_VAR]: JSON.stringify(stage) },
    };
  }

  it("prepares the run and checks the case against the kernel state it left", async () => {
    const { workDir, configHome, emptyBase: empty } = repo();
    const settings = { bundle: BUNDLE, configHome, emptyBase: empty };
    const stage = {
      id: "seeded",
      base: "fixture",
      command: "/bdk:setup",
      prepare: ['node "$BDK" config set languages "[go]" >/dev/null'],
      answers: {},
      expect: [{ run: "config show languages", json: { value: ["go"] } }, { reply: "^done" }],
    };
    const run = context(workDir, settings, stage);
    await hooks.beforeRun?.(run);
    const measured = await hooks.measure(run, {
      response: { output: "done", metadata: { numTurns: 3, toolCalls: [] } },
    });
    expect(measured.metrics.expect_pass).toBe(1);
    const checks = readFileSync(
      join(root ?? "", "raw", "bdk", "change/x.run-1", "checks.json"),
      "utf8",
    );
    expect(JSON.parse(checks)).toEqual({ pass: true, failures: [] });
  });

  it("reads a structured reply as JSON text", async () => {
    const { workDir, configHome, emptyBase: empty } = repo();
    const stage = {
      id: "x",
      base: "fixture",
      command: "/bdk:setup",
      prepare: [],
      answers: {},
      expect: [{ reply: "next" }],
    };
    const run = context(workDir, { bundle: BUNDLE, configHome, emptyBase: empty }, stage);
    const measured = await hooks.measure(run, { response: { output: { next: "/bdk:design" } } });
    expect(measured.metrics).toMatchObject({
      expect_pass: 1,
      turns: null,
      wall_s: null,
      questions: 0,
    });
  });

  it("refuses a run without a working copy or a case", () => {
    root = mkdtempSync(join(tmpdir(), "bdk-stages-"));
    expect(() => hooks.beforeRun?.(context(null, {}))).toThrow(/working copy/);
    expect(() => hooks.measure(context(null, {}), {})).toThrow(/working copy/);
    expect(() => hooks.beforeRun?.(context(root ?? "", {}))).toThrow(/bdk_case/);
  });

  it("answers an unparsable kernel output with no JSON", () => {
    const { workDir, configHome, emptyBase: empty } = repo();
    const call = kernelIn(workDir, {
      bundle: join(root ?? "", "missing.mjs"),
      configHome,
      emptyBase: empty,
    })("doctor");
    expect(call.json).toBeUndefined();
    expect(call.code).not.toBe(0);
  });
});

describe("measure", () => {
  it("counts the questions and records the checks", () => {
    const result = {
      latencyMs: 2000,
      response: {
        metadata: {
          numTurns: 7,
          toolCalls: [
            { name: "AskUserQuestion" },
            { name: "Bash", output: "Exit code 2\nrefused: policy/missing-citation\nwhy: x" },
            { name: "AskUserQuestion" },
          ],
        },
      },
    };
    expect(measure(result, { pass: false, failures: ["x"] }).metrics).toEqual({
      expect_pass: 0,
      questions: 2,
      turns: 7,
      wall_s: 2,
      refusals: 1,
      "refusal:policy/missing-citation": 1,
    });
  });
});
