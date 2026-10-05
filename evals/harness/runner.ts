// Rendering and running a series (design D-1, D-10): a suite describes its
// cells and items; this module writes the promptfoo config and the plan file,
// runs promptfoo, and turns the rows into what the user reads.
import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

import { projection } from "./cost.ts";
import type { ProviderEntry } from "./providers.ts";
import type { ResultRow } from "./results.ts";
import { SERIES_ENV, expandTests, writePlan } from "./series.ts";
import type { CellPlan, EvalItem, SeriesPlan } from "./series.ts";

const HOOK = fileURLToPath(new URL("./hook.ts", import.meta.url));

export interface CellSetup {
  readonly provider: ProviderEntry;
  readonly plan: CellPlan;
  /** Test vars of this cell only, over the item's. */
  readonly vars?: Readonly<Record<string, string>>;
}

export interface SeriesSetup {
  readonly plan: Omit<SeriesPlan, "cells">;
  readonly description: string;
  /** The prompt template; the items' vars fill it. */
  readonly prompt: string;
  /** In run order within one run of an item. */
  readonly cells: Readonly<Record<string, CellSetup>>;
  readonly items: readonly EvalItem[];
  readonly runs: number;
}

export interface RenderedSeries {
  readonly configFile: string;
  readonly planFile: string;
  readonly outputFile: string;
}

export function renderSeries(setup: SeriesSetup, dir: string): RenderedSeries {
  mkdirSync(dir, { recursive: true });
  const cells = Object.entries(setup.cells);
  const cellNames = cells.map(([name]) => name);
  const plan: SeriesPlan = {
    ...setup.plan,
    cells: Object.fromEntries(cells.map(([name, cell]) => [name, cell.plan])),
  };
  const config = {
    description: setup.description,
    prompts: [setup.prompt],
    providers: cells.map(([, cell]) => cell.provider),
    extensions: [`file://${HOOK}:extensionHook`],
    // Sequential: every cell resets one fixed working copy per run (design D-3).
    evaluateOptions: { maxConcurrency: 1, repeat: 1 },
    tests: expandTests(
      cellNames,
      setup.items,
      setup.runs,
      Object.fromEntries(cells.map(([name, cell]) => [name, cell.vars ?? {}])),
    ),
  };
  const rendered = {
    configFile: join(dir, "promptfooconfig.json"),
    planFile: join(dir, "plan.json"),
    outputFile: join(dir, "output.json"),
  };
  writeFileSync(rendered.configFile, `${JSON.stringify(config, null, 2)}\n`);
  writePlan(rendered.planFile, plan);
  return rendered;
}

type Evaluate = (
  config: string,
  output: string,
  env: Readonly<Record<string, string>>,
) => Promise<number>;

export interface SeriesIo {
  readonly evaluate: Evaluate;
  readonly print: (line: string) => void;
  readonly printError: (line: string) => void;
}

/** Runs a rendered series; resolves to the exit code of `pnpm eval`. */
export async function runSeries(
  setup: SeriesSetup,
  rendered: RenderedSeries,
  io: SeriesIo,
): Promise<number> {
  io.print(`series ${setup.plan.series}: rows in ${setup.plan.resultsFile}`);
  const code = await io.evaluate(rendered.configFile, rendered.outputFile, {
    [SERIES_ENV]: rendered.planFile,
  });
  if (code !== 0 && code !== 100) {
    io.printError(`promptfoo exited with ${String(code)}; raw output in ${rendered.outputFile}`);
    return code;
  }
  return 0;
}

/** Which of a suite's items a probe ran, when it runs a sample of them. */
export interface ProbeSample {
  readonly probed: number;
  readonly total: number;
}

/**
 * The probe's report: the cost of one run of every cell and the series it
 * projects to; a probe over a sample of the items scales its cost to all of them.
 */
export function probeSummary(
  rows: readonly ResultRow[],
  runsPerCell: number,
  sample?: ProbeSample,
): string[] {
  const scale = sample === undefined ? 1 : sample.total / sample.probed;
  const perCell: Record<string, number> = {};
  for (const row of rows) perCell[row.cell] = (perCell[row.cell] ?? 0) + row.cost * scale;
  const projected = projection(perCell, runsPerCell);
  const lines = Object.entries(perCell).map(
    ([cell, cost]) =>
      `  ${cell}: ${cost.toFixed(2)} USD per run, ${(projected.perCell[cell] ?? 0).toFixed(2)} USD for ${String(runsPerCell)} runs`,
  );
  const discarded = rows.filter((row) => row.discarded !== null);
  return [
    "probe: cost of one run per cell",
    ...(sample === undefined
      ? []
      : [
          `  (the probe ran ${String(sample.probed)} of ${String(sample.total)} items; costs are scaled to all items)`,
        ]),
    ...lines,
    `projected series: ${projected.total.toFixed(2)} USD`,
    ...discarded.map((row) => `  discarded ${row.cell} ${row.item}: ${row.discarded ?? ""}`),
    "the full series starts only after the user approves this projection",
  ];
}
