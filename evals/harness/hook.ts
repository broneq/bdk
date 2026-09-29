// The promptfoo extension hook of every suite (design D-3, D-10, D-11).
// `beforeEach` stops the series at the budget and resets the run's working
// copy; `afterEach` checks isolation, measures the run, charges the ledger
// and appends the result row. promptfoo writes its own output only when a
// series ends, so the row is the durable record of a run.
import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";

import { assertCanStart, costOf, readLedger, record } from "./budget.ts";
import { freshCopy } from "./fixture.ts";
import { checkIsolation } from "./isolation.ts";
import type { JudgeRequest, Judgement } from "./judge.ts";
import { appendRow, modelsOf } from "./results.ts";
import type { ResultRow } from "./results.ts";
import { RUN_VARS, SERIES_ENV, readPlan, varValue } from "./series.ts";
import type { CellPlan, SeriesPlan } from "./series.ts";

export interface ToolCall {
  readonly id?: string;
  readonly name: string;
  readonly input?: unknown;
  readonly output?: unknown;
  /** The `Agent` call a subagent's tool call belongs to; absent in the orchestrator. */
  readonly parentToolUseId?: string | null;
}

/** The part of a promptfoo result row the harness reads. */
export interface EvalResult {
  /** A provider error, or the reason an assertion failed (`failureReason` tells them apart). */
  readonly error?: string | null;
  /** promptfoo's `ResultFailureReason`: 0 none, 1 an assertion failed, 2 an error. */
  readonly failureReason?: number;
  /** The test's assertions; absent or null when the test has none. */
  readonly gradingResult?: { readonly pass: boolean; readonly score: number } | null;
  /** The whole call, background subagents included: the session's wall time. */
  readonly latencyMs?: number;
  readonly response?: {
    readonly output?: unknown;
    readonly error?: string;
    readonly cost?: number;
    readonly metadata?: {
      readonly modelUsage?: Record<string, { readonly costUSD?: number }>;
      readonly toolCalls?: readonly ToolCall[];
      readonly numTurns?: number;
    };
  };
}

export interface RunContext {
  readonly plan: SeriesPlan;
  readonly cellName: string;
  readonly cell: CellPlan;
  readonly item: string;
  readonly run: number;
  readonly vars: Readonly<Record<string, string>>;
}

export interface Measurement {
  readonly metrics: Readonly<Record<string, number | null>>;
  /** Spent by the measurement itself, for example judge calls. */
  readonly extraCost: number;
  readonly templateHashes: readonly string[];
  /** Models the measurement called, added to the row's provenance. */
  readonly models?: readonly string[];
}

export interface SuiteHooks {
  /** Prepares the reset working copy, for example seeds a Change. */
  readonly beforeRun?: (context: RunContext) => void | Promise<void>;
  readonly measure: (context: RunContext, result: EvalResult) => Promise<Measurement>;
}

export function runContext(plan: SeriesPlan, vars: Readonly<Record<string, string>>): RunContext {
  const cellName = vars[RUN_VARS.cell] ?? "";
  const cell = plan.cells[cellName];
  if (cell === undefined)
    throw new Error(`the test names no cell of the series plan: ${cellName || "(none)"}`);
  return {
    plan,
    cellName,
    cell,
    item: vars[RUN_VARS.item] ?? "",
    run: Number(vars[RUN_VARS.run]),
    vars: Object.fromEntries(Object.entries(vars).map(([key, value]) => [key, varValue(value)])),
  };
}

export async function beforeRun(context: RunContext, hooks: SuiteHooks): Promise<void> {
  assertCanStart(readLedger(context.plan.ledgerFile), context.plan.budgetUsd);
  rmSync(context.cell.debugFile, { force: true });
  if (context.cell.workDir !== null && context.cell.fixtureBase !== null) {
    freshCopy(context.cell.fixtureBase, context.cell.workDir);
  }
  await hooks.beforeRun?.(context);
}

function message(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

function readText(file: string): string | undefined {
  return existsSync(file) ? readFileSync(file, "utf8") : undefined;
}

/** Where a run's raw records go: the session result, its debug log, the judge's answers. */
export function rawDirOf(context: RunContext): string {
  return join(context.plan.rawDir, context.cellName, `${context.item}.run-${String(context.run)}`);
}

/** Keeps a judge's request and answer with the run's raw records, for the spot-check. */
export function recordJudgement(
  context: RunContext,
  request: JudgeRequest,
  judgement: Judgement,
): void {
  const dir = rawDirOf(context);
  mkdirSync(dir, { recursive: true });
  writeFileSync(
    join(dir, "judge.json"),
    `${JSON.stringify({ prompt: request.prompt, answer: judgement.output }, null, 2)}\n`,
  );
}

const ASSERTION_FAILED = 1;

export async function afterRun(
  context: RunContext,
  result: EvalResult,
  hooks: SuiteHooks,
): Promise<ResultRow> {
  const { plan, cell } = context;
  const raw = rawDirOf(context);
  mkdirSync(raw, { recursive: true });
  writeFileSync(join(raw, "result.json"), `${JSON.stringify(result, null, 2)}\n`);

  let sessionCost: number | null = null;
  try {
    sessionCost = costOf(result);
  } catch {
    // Charged at the run cap below: the most the session could have spent.
  }
  const providerError =
    result.response?.error ??
    (result.failureReason === ASSERTION_FAILED ? null : (result.error ?? null));
  let discarded: string | null =
    providerError !== null
      ? `provider error: ${providerError}`
      : checkIsolation({
          debugLog: readText(cell.debugFile),
          toolCalls: result.response?.metadata?.toolCalls ?? [],
          expectedPlugins: cell.expectedPlugins,
        });
  let measurement: Measurement | null = null;
  if (discarded === null) {
    try {
      measurement = await hooks.measure(context, result);
    } catch (error) {
      discarded = `harness error: ${message(error)}`;
    }
  }
  // Cost is a reported metric: a run without it is not counted.
  if (sessionCost === null) discarded ??= "no reported cost; the ledger charged the run cap";

  const cost = (sessionCost ?? plan.runCapUsd) + (measurement?.extraCost ?? 0);
  const models = [...new Set([...modelsOf(result), ...(measurement?.models ?? [])])].sort();
  const row: ResultRow = {
    suite: plan.suite,
    series: plan.series,
    cell: context.cellName,
    item: context.item,
    run: context.run,
    discarded,
    cost,
    metrics: measurement?.metrics ?? {},
    provenance: {
      models,
      fixtureCommit: cell.provenance.fixtureCommit,
      bdkCommit: cell.provenance.bdkCommit,
      variantHash: cell.provenance.variantHash,
      templateHashes: measurement?.templateHashes ?? [],
    },
  };
  record(plan.ledgerFile, { suite: plan.suite, cell: context.cellName, run: context.run, cost });
  appendRow(plan.resultsFile, row);
  if (cell.debugFile !== "" && existsSync(cell.debugFile)) {
    writeFileSync(join(raw, "debug.log"), readFileSync(cell.debugFile));
  }
  return row;
}

async function loadSuiteHooks(suite: string): Promise<SuiteHooks> {
  const module = (await import(new URL(`../suites/${suite}/hooks.ts`, import.meta.url).href)) as {
    readonly hooks: SuiteHooks;
  };
  return module.hooks;
}

interface HookContext {
  readonly test?: { readonly vars?: Readonly<Record<string, string>> };
  readonly result?: EvalResult;
}

/** The entry point promptfoo calls (`extensions: [file://.../hook.ts:extensionHook]`). */
export async function extensionHook(hookName: string, context: HookContext): Promise<HookContext> {
  if (hookName !== "beforeEach" && hookName !== "afterEach") return context;
  const plan = readPlan(process.env[SERIES_ENV]);
  const hooks = await loadSuiteHooks(plan.suite);
  const run = runContext(plan, context.test?.vars ?? {});
  if (hookName === "beforeEach") {
    // A throw here aborts the series (probe 8): the budget stop.
    await beforeRun(run, hooks);
  } else {
    await afterRun(run, context.result ?? {}, hooks);
  }
  return context;
}
