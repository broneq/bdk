// The review-models tables (design D10 of v3-t42-review-skills): per-cell
// medians and ranges, sonnet against its A/A pair as the noise floor, and
// sonnet against opus by the difference rule. The reviewer adapter moves to
// opus only when the report shows opus measurably ahead on recall.
import type { ResultRow } from "../../harness/results.ts";
import { compare, median, range } from "../../harness/stats.ts";
import type { Comparison } from "../../harness/stats.ts";

const CELL_ORDER = ["sonnet", "sonnet-prime", "opus"] as const;

/** [a, b, what the comparison measures] */
const COMPARISONS = [
  ["sonnet", "sonnet-prime", "A/A noise floor"],
  ["opus", "sonnet", "reviewer model"],
] as const;

const RECALL = ["recall_logic", "recall_test-gap", "recall_integration"] as const;
const METRICS = [
  ...RECALL,
  "false_alarms",
  "alarms",
  "review_done",
  "cost",
  "wall_s",
  "turns",
  "uncertain",
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

function verdictText(result: Comparison, a: string, b: string): string {
  const detail = `gap ${number(result.gap)}, noise ${number(result.noise)}`;
  if (result.verdict === "no-difference") return `no difference (${detail})`;
  return `${result.verdict === "a" ? a : b} higher (${detail})`;
}

/** Opus wins when it is measurably ahead on a recall class and behind on none. */
export function criterion(rows: readonly ResultRow[]): string {
  const results = RECALL.map(
    (metric) => [metric, comparison(rows, metric, "opus", "sonnet")] as const,
  );
  const missing = results.filter(([, result]) => result === null).map(([metric]) => metric);
  if (missing.length > 0) {
    return `undecided: fewer than 2 counted runs per cell on ${missing.join(", ")}`;
  }
  const ahead = results.filter(([, result]) => result?.verdict === "a").map(([metric]) => metric);
  const behind = results.filter(([, result]) => result?.verdict === "b").map(([metric]) => metric);
  if (ahead.length > 0 && behind.length === 0) {
    return `opus finds more on ${ahead.join(", ")}: the reviewer adapter moves to opus`;
  }
  return "no measurable recall gain for opus: the reviewer adapter stays on sonnet";
}

export function reviewModelsReport(allRows: readonly ResultRow[]): string[] {
  const rows = allRows.filter((row) => row.discarded === null);
  const discarded = allRows.filter((row) => row.discarded !== null);
  const series = [...new Set(allRows.map((row) => row.series))];
  const lines = [
    "# review-models results",
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
