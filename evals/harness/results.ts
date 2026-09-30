// Result rows (design D-11): one JSON line per measured run, appended by the
// suite's `afterEach` hook so an aborted series keeps every finished run.
// Every row carries the provenance the `skill-evals` spec requires.
import { appendFileSync, existsSync, mkdirSync, readFileSync, readdirSync } from "node:fs";
import { dirname, join } from "node:path";

interface Provenance {
  /** Model ids the session reported, orchestrator and subagents. */
  readonly models: readonly string[];
  /** Null for a with / without run without a fixture. */
  readonly fixtureCommit: string | null;
  readonly bdkCommit: string;
  readonly variantHash: string | null;
  /** `template-hash` of every dispatch package built during the run (P10). */
  readonly templateHashes: readonly string[];
}

export interface ResultRow {
  readonly suite: string;
  readonly series: string;
  readonly cell: string;
  /** The task, question or patch of the run; the suite's single task id when it has one. */
  readonly item: string;
  readonly run: number;
  /** The isolation or harness reason a run is not counted; null when counted. */
  readonly discarded: string | null;
  readonly cost: number;
  /** Null marks a metric that does not apply to the cell (the v2 arm's kernel metrics). */
  readonly metrics: Readonly<Record<string, number | null>>;
  readonly provenance: Provenance;
}

const COMMIT = /^[0-9a-f]{40}$/;

function validate(row: ResultRow): void {
  const { provenance } = row;
  // A discarded run may have failed before the session reported a model.
  if (row.discarded === null && provenance.models.length === 0)
    throw new Error("counted result row without models");
  if (!COMMIT.test(provenance.bdkCommit))
    throw new Error(`result row bdkCommit is not a commit: ${provenance.bdkCommit}`);
  if (provenance.fixtureCommit !== null && !COMMIT.test(provenance.fixtureCommit)) {
    throw new Error(`result row fixtureCommit is not a commit: ${provenance.fixtureCommit}`);
  }
}

export function appendRow(file: string, row: ResultRow): void {
  validate(row);
  mkdirSync(dirname(file), { recursive: true });
  appendFileSync(file, `${JSON.stringify(row)}\n`);
}

export function readRows(file: string): ResultRow[] {
  if (!existsSync(file)) return [];
  return readFileSync(file, "utf8")
    .split("\n")
    .filter((line) => line.trim() !== "")
    .map((line) => JSON.parse(line) as ResultRow);
}

/**
 * The rows of every measured series of a suite. Probe series and other records
 * kept next to them, such as a judge spot-check, are left out.
 */
export function readSuiteRows(dir: string): ResultRow[] {
  if (!existsSync(dir)) return [];
  return readdirSync(dir)
    .filter((file) => file.endsWith(".jsonl") && file.startsWith("series-"))
    .map((file) => file.slice(0, -".jsonl".length))
    .sort()
    .flatMap((series) => readRows(join(dir, `${series}.jsonl`)));
}

interface ProviderResult {
  readonly response?: { readonly metadata?: { readonly modelUsage?: Record<string, unknown> } };
}

export function modelsOf(result: ProviderResult): string[] {
  return Object.keys(result.response?.metadata?.modelUsage ?? {}).sort();
}
