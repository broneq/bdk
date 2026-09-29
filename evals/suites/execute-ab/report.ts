// The execute A/B tables (design D-7): per-cell medians and ranges, the four
// comparisons under the difference rule, and the pre-registered criterion
// applied mechanically to the counted rows.
import type { ResultRow } from "../../harness/results.ts";
import { compare, median, range } from "../../harness/stats.ts";
import type { Comparison } from "../../harness/stats.ts";

/** The metrics the T41 criterion decides on. */
const PRIMARY = ["acceptance", "completeness"] as const;
const SECONDARY = [
  "cost",
  "turns",
  "wall_s",
  "kernel_calls",
  "exit3",
  "exit2",
  "envelope_bytes",
  "rubric",
] as const;
const METRICS = [...PRIMARY, ...SECONDARY];

const CELL_ORDER = ["v2", "v3-long", "v3-long-prime", "v3-thin"] as const;

/** [a, b, what the comparison measures] */
const COMPARISONS = [
  ["v3-long", "v3-long-prime", "A/A noise floor"],
  ["v3-thin", "v3-long", "T41 gate"],
  ["v3-long", "v2", "kernel effect"],
  ["v3-thin", "v2", "total effect"],
] as const;

function valuesOf(rows: readonly ResultRow[], cell: string, metric: string): number[] {
  return rows
    .filter((row) => row.cell === cell)
    .map((row) => (metric === "cost" ? row.cost : (row.metrics[metric] ?? null)))
    .filter((value): value is number => value !== null);
}

function number(value: number): string {
  return Number.isInteger(value) ? String(value) : value.toFixed(2);
}

function summary(values: readonly number[]): string {
  if (values.length === 0) return "n/a";
  const low = Math.min(...values);
  return `${number(median(values))} [${number(low)}..${number(low + range(values))}]`;
}

function verdictText(result: Comparison, a: string, b: string): string {
  const detail = `gap ${number(result.gap)}, noise ${number(result.noise)}`;
  if (result.verdict === "no-difference") return `no difference (${detail})`;
  return `${result.verdict === "a" ? a : b} higher (${detail})`;
}

function comparison(
  rows: readonly ResultRow[],
  metric: string,
  a: string,
  b: string,
): Comparison | null {
  const left = valuesOf(rows, a, metric);
  const right = valuesOf(rows, b, metric);
  return left.length < 2 || right.length < 2 ? null : compare(left, right);
}

/** Thin is "no worse" when, on both primary metrics, the gate shows no difference or favours thin. */
function criterion(rows: readonly ResultRow[]): string {
  const results = PRIMARY.map(
    (metric) => [metric, comparison(rows, metric, "v3-thin", "v3-long")] as const,
  );
  const missing = results.filter(([, result]) => result === null).map(([metric]) => metric);
  if (missing.length > 0)
    return `undecided: fewer than 2 counted runs per cell on ${missing.join(", ")}`;
  const worse = results.filter(([, result]) => result?.verdict === "b").map(([metric]) => metric);
  return worse.length === 0
    ? "thin is no worse: T41 writes thin stage skills"
    : `thin is worse on ${worse.join(", ")}: T41 falls back to approach B`;
}

export function executeReport(allRows: readonly ResultRow[]): string[] {
  const rows = allRows.filter((row) => row.discarded === null);
  const discarded = allRows.filter((row) => row.discarded !== null);
  const series = [...new Set(allRows.map((row) => row.series))];
  const lines = [
    "# execute A/B results",
    "",
    `Series: ${series.length === 0 ? "none" : series.join(", ")}. Counted runs: ${CELL_ORDER.map(
      (cell) => `${cell} ${String(rows.filter((row) => row.cell === cell).length)}`,
    ).join(", ")}. Discarded: ${String(discarded.length)}.`,
    "",
    "## Per cell: median [min..max]",
    "",
    `| metric | ${CELL_ORDER.join(" | ")} |`,
    `| --- | ${CELL_ORDER.map(() => "---").join(" | ")} |`,
    ...METRICS.map(
      (metric) =>
        `| ${metric} | ${CELL_ORDER.map((cell) => summary(valuesOf(rows, cell, metric))).join(" | ")} |`,
    ),
    "",
    "## Comparisons (difference rule: a gap counts when it exceeds the larger within-cell range)",
    "",
    `| metric | ${COMPARISONS.map(([a, b, what]) => `${what}: ${a} vs ${b}`).join(" | ")} |`,
    `| --- | ${COMPARISONS.map(() => "---").join(" | ")} |`,
    ...METRICS.map((metric) => {
      const cells = COMPARISONS.map(([a, b]) => {
        const result = comparison(rows, metric, a, b);
        return result === null ? "n/a" : verdictText(result, a, b);
      });
      return `| ${metric} | ${cells.join(" | ")} |`;
    }),
    "",
    "## Criterion",
    "",
    criterion(rows),
  ];
  if (discarded.length > 0) {
    lines.push(
      "",
      "## Discarded runs",
      "",
      ...discarded.map(
        (row) => `- ${row.series} ${row.cell} run ${String(row.run)}: ${row.discarded ?? ""}`,
      ),
    );
  }
  return lines;
}
