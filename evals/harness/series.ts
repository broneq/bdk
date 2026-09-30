// A measured series (design D-10, D-11): the rendered promptfoo config plus a
// plan file the extension hook reads. Tests are expanded per run and cell,
// runs outermost, so cells interleave and a drift over time hits every cell.
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname } from "node:path";

/** The environment variable that points the extension hook at the plan file. */
export const SERIES_ENV = "BDK_EVAL_SERIES";

interface CellProvenance {
  readonly fixtureCommit: string | null;
  readonly bdkCommit: string;
  readonly variantHash: string | null;
}

export interface CellPlan {
  readonly debugFile: string;
  /** 1 for a session with its plugin copy, 0 for a one-turn call. */
  readonly expectedPlugins: number;
  /** The fixed working copy the hook resets before every run; null without a fixture. */
  readonly workDir: string | null;
  /** The prepared fixture base the working copy is copied from; null without a fixture. */
  readonly fixtureBase: string | null;
  readonly provenance: CellProvenance;
  /** Suite-specific settings of the cell, read by the suite's hooks. */
  readonly settings: Readonly<Record<string, unknown>>;
}

export interface SeriesPlan {
  readonly suite: string;
  readonly series: string;
  readonly ledgerFile: string;
  readonly budgetUsd: number;
  /** Charged when a run reports no cost, the most it could have spent. */
  readonly runCapUsd: number;
  readonly resultsFile: string;
  /** Raw per-run outputs, kept out of the tree. */
  readonly rawDir: string;
  readonly cells: Readonly<Record<string, CellPlan>>;
}

export function writePlan(file: string, plan: SeriesPlan): void {
  mkdirSync(dirname(file), { recursive: true });
  writeFileSync(file, `${JSON.stringify(plan, null, 2)}\n`);
}

export function readPlan(file: string | undefined): SeriesPlan {
  if (file === undefined || !existsSync(file)) {
    throw new Error(
      `${SERIES_ENV} does not name a series plan (${file ?? "unset"}); run the suite with pnpm eval`,
    );
  }
  return JSON.parse(readFileSync(file, "utf8")) as SeriesPlan;
}

export interface EvalItem {
  /** Unique within the suite: a task id, a bullet id, a patch id. */
  readonly id: string;
  readonly vars: Readonly<Record<string, string>>;
  /** promptfoo assertions of the item, if any. */
  readonly assert?: readonly unknown[];
}

export interface TestCase {
  readonly description: string;
  readonly vars: Readonly<Record<string, string>>;
  readonly providers: readonly string[];
  readonly assert?: readonly unknown[];
  readonly options: { readonly disableVarExpansion: true };
}

/** The vars the hook reads to find the run's cell, item and run number. */
export const RUN_VARS = { cell: "bdk_cell", item: "bdk_item", run: "bdk_run" } as const;

const RAW_OPEN = "{% raw %}";
const RAW_CLOSE = "{% endraw %}";
const TEMPLATE_SYNTAX = /\{\{|\{%|\{#/;

/**
 * A var value promptfoo passes on unchanged. promptfoo renders every string
 * var as a Nunjucks template before it fills the prompt, so a diff with JSX
 * such as `{{ __html: x }}` fails to render, and a valid `{{ x }}` silently
 * turns empty. A value with template syntax is wrapped in a raw block.
 */
export function literalVar(value: string): string {
  if (!TEMPLATE_SYNTAX.test(value)) return value;
  if (/\{%-?\s*endraw/.test(value)) {
    throw new Error("a var value contains a Nunjucks endraw tag and cannot be passed literally");
  }
  return `${RAW_OPEN}${value}${RAW_CLOSE}`;
}

/** The value `literalVar` wrapped, as the hook reads it back from the test's vars. */
export function varValue(value: string): string {
  return value.startsWith(RAW_OPEN) && value.endsWith(RAW_CLOSE)
    ? value.slice(RAW_OPEN.length, -RAW_CLOSE.length)
    : value;
}

function literalVars(vars: Readonly<Record<string, string>> = {}): Record<string, string> {
  return Object.fromEntries(Object.entries(vars).map(([key, value]) => [key, literalVar(value)]));
}

export function expandTests(
  cells: readonly string[],
  items: readonly EvalItem[],
  runs: number,
  /** Vars of one cell, over the item's: a cell's own prompt, for example. */
  cellVars: Readonly<Record<string, Readonly<Record<string, string>>>> = {},
): TestCase[] {
  const tests: TestCase[] = [];
  for (let run = 1; run <= runs; run++) {
    for (const item of items) {
      for (const cell of cells) {
        tests.push({
          description: `${cell} ${item.id} run ${run}`,
          vars: {
            ...literalVars(item.vars),
            ...literalVars(cellVars[cell]),
            [RUN_VARS.cell]: cell,
            [RUN_VARS.item]: item.id,
            [RUN_VARS.run]: String(run),
          },
          providers: [cell],
          ...(item.assert === undefined ? {} : { assert: item.assert }),
          options: { disableVarExpansion: true },
        });
      }
    }
  }
  return tests;
}

/** `base`, or `base-2`, `base-3`, ... when a series of that name already has rows. */
export function freshSeriesName(base: string, exists: (series: string) => boolean): string {
  if (!exists(base)) return base;
  for (let n = 2; ; n++) {
    const name = `${base}-${n}`;
    if (!exists(name)) return name;
  }
}
