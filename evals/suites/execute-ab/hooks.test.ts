import { execFileSync } from "node:child_process";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";

import type { EvalResult, RunContext } from "../../harness/hook.ts";
import type { JudgeRequest } from "../../harness/judge.ts";
import { createHooks } from "./hooks.ts";

const dirs: string[] = [];
afterEach(() => {
  for (const dir of dirs.splice(0)) rmSync(dir, { recursive: true, force: true });
});

const GIT_ENV = { ...process.env, GIT_CONFIG_GLOBAL: "/dev/null", GIT_CONFIG_NOSYSTEM: "1" };

function workDir(): string {
  const dir = mkdtempSync(join(tmpdir(), "bdk-evals-hooks-"));
  dirs.push(dir);
  const git = (...args: string[]): void => {
    execFileSync("git", ["-c", "user.name=t", "-c", "user.email=t@x", ...args], {
      cwd: dir,
      env: GIT_ENV,
    });
  };
  git("init", "-q", "-b", "main");
  git("commit", "-q", "--allow-empty", "-m", "base");
  return dir;
}

function context(arm: string, dir: string): RunContext {
  const cell = {
    debugFile: "",
    expectedPlugins: 1,
    workDir: dir,
    fixtureBase: null,
    provenance: { fixtureCommit: null, bdkCommit: "b".repeat(40), variantHash: null },
    settings: { arm },
  };
  return {
    plan: {
      suite: "execute-ab",
      series: "s",
      ledgerFile: "",
      budgetUsd: 100,
      runCapUsd: 15,
      resultsFile: "",
      rawDir: "",
      cells: { [arm]: cell },
    },
    cellName: arm,
    cell,
    item: "audit-csv",
    run: 1,
    vars: {},
  };
}

function result(output: string): EvalResult {
  return {
    response: {
      output,
      metadata: {
        numTurns: 12,
        durationMs: 3000,
        toolCalls: [
          { name: "Bash", input: { command: 'node "/p/dist/bdk.mjs" next --json' }, output: "{}" },
          {
            name: "Agent",
            input: { subagent_type: "bdk:worker", prompt: "/pkg.md" },
            output: "The report follows:\n  status: done\nagentId: a",
          },
        ],
      },
    },
  };
}

function deps(): { judged: JudgeRequest[]; hooks: ReturnType<typeof createHooks> } {
  const judged: JudgeRequest[] = [];
  const hooks = createHooks({
    judge: (request) => {
      judged.push(request);
      return Promise.resolve({
        output: { accurate: true, reason: "ok" },
        cost: 0.01,
        models: ["claude-sonnet-5"],
      });
    },
    exec: () => 0,
  });
  return { judged, hooks };
}

describe("execute-ab measure", () => {
  it("measures a v3 run: acceptance, completeness, kernel metrics, envelope and the rubric", async () => {
    const { judged, hooks } = deps();
    const measured = await hooks.measure(
      context("v3-thin", workDir()),
      result("Parts 01 and 02 done."),
    );
    expect(measured.metrics).toEqual({
      acceptance: 1,
      completeness: 0,
      turns: 12,
      wall_s: 3,
      kernel_calls: 1,
      exit3: 0,
      exit2: 0,
      envelope_bytes: Buffer.byteLength("status: done"),
      rubric: 1,
    });
    expect(measured.extraCost).toBe(0.01);
    expect(measured.models).toEqual(["claude-sonnet-5"]);
    expect(judged[0]?.prompt).toMatch(/"tasksCommitted": \[\]/);
    expect(judged[0]?.prompt).toMatch(/Final message:\nParts 01 and 02 done\.$/);
  });

  it("marks the kernel metrics of the v2 arm as not applicable", async () => {
    const { judged, hooks } = deps();
    const measured = await hooks.measure(context("v2", workDir()), result("Done."));
    expect(measured.metrics).toMatchObject({
      kernel_calls: null,
      exit3: null,
      exit2: null,
      envelope_bytes: null,
    });
    expect(measured.templateHashes).toEqual([]);
    expect(judged[0]?.prompt).toMatch(/"groupsExpected": 4/);
  });

  it("scores the rubric 0 without calling the judge when the session ends without a message", async () => {
    const { judged, hooks } = deps();
    const measured = await hooks.measure(context("v3-long", workDir()), result(""));
    expect(measured.metrics.rubric).toBe(0);
    expect(judged).toEqual([]);
  });
});
