import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";

import { record } from "./budget.ts";
import { oneTurnProvider } from "./providers.ts";
import type { ResultRow } from "./results.ts";
import { probeSummary, renderSeries, runSeries } from "./runner.ts";
import type { SeriesSetup } from "./runner.ts";
import { readPlan } from "./series.ts";

const dirs: string[] = [];
afterEach(() => {
  for (const dir of dirs.splice(0)) rmSync(dir, { recursive: true, force: true });
});

const SHA = "e".repeat(40);

function series(): { dir: string; setup: SeriesSetup } {
  const dir = mkdtempSync(join(tmpdir(), "bdk-evals-runner-"));
  dirs.push(dir);
  const cell = (label: string) => ({
    provider: oneTurnProvider({
      label,
      model: "claude-haiku-4-5-20251001",
      systemPrompt: "Answer.",
      workDir: dir,
      debugFile: join(dir, `${label}.log`),
      maxBudgetUsd: 1,
    }),
    plan: {
      debugFile: join(dir, `${label}.log`),
      expectedPlugins: 0,
      workDir: null,
      fixtureBase: null,
      provenance: { fixtureCommit: null, bdkCommit: SHA, variantHash: null },
      settings: {},
    },
  });
  return {
    dir,
    setup: {
      plan: {
        suite: "rules-noop",
        series: "m1",
        ledgerFile: join(dir, "budget.json"),
        budgetUsd: 5,
        runCapUsd: 1,
        resultsFile: join(dir, "m1.jsonl"),
        rawDir: join(dir, "raw"),
      },
      description: "rules M1",
      prompt: "{{question}}",
      cells: { haiku: cell("haiku"), sonnet: cell("sonnet") },
      items: [{ id: "b1", vars: { question: "Why?" } }],
      runs: 2,
    },
  };
}

describe("renderSeries", () => {
  it("writes a sequential config with the hook, one provider per cell and a plan with the cells", () => {
    const { dir, setup } = series();
    const rendered = renderSeries(setup, join(dir, "render"));
    const config = JSON.parse(readFileSync(rendered.configFile, "utf8")) as Record<string, unknown>;
    expect(config).toMatchObject({
      description: "rules M1",
      prompts: ["{{question}}"],
      evaluateOptions: { maxConcurrency: 1, repeat: 1 },
    });
    expect((config.providers as { label: string }[]).map((provider) => provider.label)).toEqual([
      "haiku",
      "sonnet",
    ]);
    expect(config.extensions).toEqual([
      expect.stringMatching(/^file:\/\/.*\/harness\/hook\.ts:extensionHook$/),
    ]);
    expect(config.tests).toHaveLength(4);
    expect(Object.keys(readPlan(rendered.planFile).cells)).toEqual(["haiku", "sonnet"]);
  });
});

describe("runSeries", () => {
  const io = (code: number, calls: string[] = []) => ({
    evaluate: (_config: string, _output: string, env: Readonly<Record<string, string>>) => {
      calls.push(env.BDK_EVAL_SERIES ?? "");
      return Promise.resolve(code);
    },
    print: () => undefined,
    printError: (line: string) => calls.push(line),
  });

  it("points promptfoo at the plan and treats failed assertions as a finished series", async () => {
    const { dir, setup } = series();
    const rendered = renderSeries(setup, join(dir, "render"));
    const calls: string[] = [];
    await expect(runSeries(setup, rendered, io(100, calls))).resolves.toBe(0);
    expect(calls).toEqual([rendered.planFile]);
  });

  it("reports the budget stop and other promptfoo failures", async () => {
    const { dir, setup } = series();
    const rendered = renderSeries(setup, join(dir, "render"));
    const crash: string[] = [];
    await expect(runSeries(setup, rendered, io(2, crash))).resolves.toBe(2);
    expect(crash[1]).toMatch(/promptfoo exited with 2/);
    record(setup.plan.ledgerFile, { suite: "rules-noop", cell: "haiku", run: 1, cost: 5 });
    const stop: string[] = [];
    await expect(runSeries(setup, rendered, io(1, stop))).resolves.toBe(1);
    expect(stop[1]).toMatch(/budget reached: 5.00 USD spent of 5 USD/);
  });
});

describe("probeSummary", () => {
  it("projects the per-cell probe cost to the series and lists discarded runs", () => {
    const row = (cell: string, cost: number, discarded: string | null = null): ResultRow => ({
      suite: "execute-ab",
      series: "probe",
      cell,
      item: "task",
      run: 1,
      discarded,
      cost,
      metrics: {},
      provenance: {
        models: ["m"],
        fixtureCommit: null,
        bdkCommit: SHA,
        variantHash: null,
        templateHashes: [],
      },
    });
    const lines = probeSummary(
      [row("v2", 4), row("v3-thin", 2, "MCP tool call mcp__x")],
      5,
      100,
      6,
    );
    expect(lines).toContain("  v2: 4.00 USD per run, 20.00 USD for 5 runs");
    expect(lines).toContain("projected series: 30.00 USD; budget left: 94.00 USD of 100 USD");
    expect(lines).toContain("  discarded v3-thin task: MCP tool call mcp__x");
  });

  it("scales the cost of a probe over a sample of the items to all items", () => {
    const row: ResultRow = {
      suite: "rules-noop",
      series: "probe-m1",
      cell: "haiku",
      item: "security.01.aaaaaaaa",
      run: 1,
      discarded: null,
      cost: 0.5,
      metrics: {},
      provenance: {
        models: ["m"],
        fixtureCommit: null,
        bdkCommit: SHA,
        variantHash: null,
        templateHashes: [],
      },
    };
    const lines = probeSummary([row, { ...row, item: "security.02.bbbbbbbb" }], 5, 100, 0, {
      probed: 2,
      total: 8,
    });
    expect(lines).toContain("  (the probe ran 2 of 8 items; costs are scaled to all items)");
    expect(lines).toContain("  haiku: 4.00 USD per run, 20.00 USD for 5 runs");
  });
});
