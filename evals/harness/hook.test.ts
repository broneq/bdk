import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";

import { BudgetReached, readLedger, record } from "./budget.ts";
import { afterRun, beforeRun, extensionHook, recordJudgement, runContext } from "./hook.ts";
import type { EvalResult, SuiteHooks } from "./hook.ts";
import { readRows } from "./results.ts";
import type { CellPlan, SeriesPlan } from "./series.ts";

const dirs: string[] = [];
afterEach(() => {
  for (const dir of dirs.splice(0)) rmSync(dir, { recursive: true, force: true });
});

const SHA = "f".repeat(40);
const CLEAN_LOG = "Loaded 1 directory-loaded plugins\n[claudeai-mcp] Disabled via env var\n";

function setup(cell: (dir: string) => Partial<CellPlan> = () => ({})): {
  dir: string;
  plan: SeriesPlan;
} {
  const dir = mkdtempSync(join(tmpdir(), "bdk-evals-hook-"));
  dirs.push(dir);
  const plan: SeriesPlan = {
    suite: "execute-ab",
    series: "s1",
    ledgerFile: join(dir, "budget.json"),
    budgetUsd: 10,
    runCapUsd: 3,
    resultsFile: join(dir, "results/s1.jsonl"),
    rawDir: join(dir, "raw"),
    cells: {
      a: {
        debugFile: join(dir, "a.log"),
        expectedPlugins: 1,
        workDir: null,
        fixtureBase: null,
        provenance: { fixtureCommit: SHA, bdkCommit: SHA, variantHash: null },
        settings: {},
        ...cell(dir),
      },
    },
  };
  return { dir, plan };
}

const VARS = { bdk_cell: "a", bdk_item: "task", bdk_run: "2" };

const RESULT: EvalResult = {
  response: {
    cost: 1.5,
    metadata: { modelUsage: { "claude-opus-5-5": { costUSD: 1.5 } }, toolCalls: [] },
  },
};

const MEASURE: SuiteHooks = {
  measure: () =>
    Promise.resolve({
      metrics: { acceptance: 1 },
      extraCost: 0.25,
      templateHashes: ["sha256:t"],
      models: ["claude-sonnet-5"],
    }),
};

describe("runContext", () => {
  it("reads cell, item and run from the test vars", () => {
    const { plan } = setup();
    expect(runContext(plan, VARS)).toMatchObject({ cellName: "a", item: "task", run: 2 });
  });

  it("gives the suite a var value unwrapped from its raw block", () => {
    const { plan } = setup();
    const diff = "{% raw %}+ <div x={{ a: 1 }} />{% endraw %}";
    expect(runContext(plan, { ...VARS, diff }).vars.diff).toBe("+ <div x={{ a: 1 }} />");
  });

  it("refuses a test of an unknown cell", () => {
    const { plan } = setup();
    expect(() => runContext(plan, { bdk_cell: "zz" })).toThrow(/zz/);
    expect(() => runContext(plan, {})).toThrow(/\(none\)/);
  });
});

describe("beforeRun", () => {
  it("resets the working copy from the fixture base, clears the old log and calls the suite", async () => {
    const { dir, plan } = setup((root) => ({
      workDir: join(root, "work"),
      fixtureBase: join(root, "base"),
    }));
    mkdirSync(join(dir, "base"));
    writeFileSync(join(dir, "base/f.txt"), "base");
    const workDir = join(dir, "work");
    mkdirSync(workDir);
    writeFileSync(join(workDir, "stale.txt"), "previous run");
    writeFileSync(join(dir, "a.log"), "old");
    const seen: string[] = [];
    await beforeRun(runContext(plan, VARS), {
      ...MEASURE,
      beforeRun: (context) => void seen.push(context.item),
    });
    expect(existsSync(join(workDir, "stale.txt"))).toBe(false);
    expect(readFileSync(join(workDir, "f.txt"), "utf8")).toBe("base");
    expect(existsSync(join(dir, "a.log"))).toBe(false);
    expect(seen).toEqual(["task"]);
  });

  it("stops at the budget", async () => {
    const { plan } = setup();
    record(plan.ledgerFile, { suite: "x", cell: "a", run: 1, cost: 10 });
    await expect(beforeRun(runContext(plan, VARS), MEASURE)).rejects.toThrow(BudgetReached);
  });
});

describe("afterRun", () => {
  it("measures an isolated run, charges session and judge cost, and appends the row", async () => {
    const { plan } = setup();
    writeFileSync(join(plan.rawDir, "..", "a.log"), CLEAN_LOG);
    const row = await afterRun(runContext(plan, VARS), RESULT, MEASURE);
    expect(row).toMatchObject({
      cell: "a",
      item: "task",
      run: 2,
      discarded: null,
      cost: 1.75,
      metrics: { acceptance: 1 },
      provenance: { models: ["claude-opus-5-5", "claude-sonnet-5"], templateHashes: ["sha256:t"] },
    });
    expect(readRows(plan.resultsFile)).toEqual([row]);
    expect(readLedger(plan.ledgerFile).entries.map((entry) => entry.cost)).toEqual([1.75]);
    expect(existsSync(join(plan.rawDir, "a/task.run-2/debug.log"))).toBe(true);
  });

  it("discards a leaking run without measuring it", async () => {
    const { plan } = setup();
    writeFileSync(join(plan.rawDir, "..", "a.log"), CLEAN_LOG.replace("Loaded 1", "Loaded 2"));
    let measured = false;
    const row = await afterRun(runContext(plan, VARS), RESULT, {
      measure: () => {
        measured = true;
        return MEASURE.measure(runContext(plan, VARS), RESULT);
      },
    });
    expect(measured).toBe(false);
    expect(row.discarded).toMatch(/2 directory-loaded plugins/);
    expect(row.cost).toBe(1.5);
  });

  it("discards a provider error and a failing measurement with their reasons", async () => {
    const { plan } = setup();
    writeFileSync(join(plan.rawDir, "..", "a.log"), CLEAN_LOG);
    const failed = await afterRun(
      runContext(plan, VARS),
      { ...RESULT, error: "max budget exceeded" },
      MEASURE,
    );
    expect(failed.discarded).toBe("provider error: max budget exceeded");
    const broken = await afterRun(runContext(plan, VARS), RESULT, {
      measure: () => Promise.reject(new Error("vitest crashed")),
    });
    expect(broken.discarded).toBe("harness error: vitest crashed");
  });

  it("counts a run whose assertion failed, since promptfoo reports that failure as its error", async () => {
    const { plan } = setup();
    writeFileSync(join(plan.rawDir, "..", "a.log"), CLEAN_LOG);
    const row = await afterRun(
      runContext(plan, VARS),
      { ...RESULT, error: "Custom function returned false", failureReason: 1 },
      MEASURE,
    );
    expect(row.discarded).toBeNull();
  });

  it("charges the run cap and discards a run without a reported cost", async () => {
    const { plan } = setup();
    writeFileSync(join(plan.rawDir, "..", "a.log"), CLEAN_LOG);
    const row = await afterRun(
      runContext(plan, VARS),
      { response: { metadata: {} }, error: "crash" },
      MEASURE,
    );
    expect(row.cost).toBe(3);
    expect(row.discarded).toBe("provider error: crash");
    const silent = await afterRun(runContext(plan, VARS), { response: { output: "x" } }, MEASURE);
    expect(silent.discarded).toMatch(/no reported cost/);
  });
});

describe("recordJudgement", () => {
  it("writes the judge's prompt and answer next to the run's raw records", () => {
    const { dir, plan } = setup();
    recordJudgement(
      runContext(plan, VARS),
      { system: "s", prompt: "p", schema: {} },
      { output: { accurate: false, reason: "r" }, cost: 0.01, models: [] },
    );
    const file = join(dir, "raw/a/task.run-2/judge.json");
    expect(JSON.parse(readFileSync(file, "utf8"))).toEqual({
      prompt: "p",
      answer: { accurate: false, reason: "r" },
    });
  });
});

describe("extensionHook", () => {
  it("passes other hooks through without a plan", async () => {
    const context = { test: { vars: {} } };
    await expect(extensionHook("beforeAll", context)).resolves.toBe(context);
  });
});
