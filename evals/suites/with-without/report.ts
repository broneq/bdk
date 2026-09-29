// The with / without tables (design D-9): per task and per metric, both
// cells' median and range and whether the gap is measurable under the
// difference rule.
import type { ResultRow } from "../../harness/results.ts";
import { compare, median, range } from "../../harness/stats.ts";

const METRICS = ["assert_pass", "assert_score", "cost", "turns", "wall_s"] as const;
const CELLS = ["with", "without"] as const;

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

function verdict(a: readonly number[], b: readonly number[]): string {
  if (a.length < 2 || b.length < 2) return "fewer than 2 counted runs";
  const result = compare(a, b);
  const detail = `gap ${number(result.gap)}, noise ${number(result.noise)}`;
  if (result.verdict === "no-difference") return `no measurable difference (${detail})`;
  return `${result.verdict === "a" ? "with" : "without"} higher (${detail})`;
}

export function withWithoutReport(allRows: readonly ResultRow[]): string[] {
  const rows = allRows.filter((row) => row.discarded === null);
  const discarded = allRows.filter((row) => row.discarded !== null);
  const items = [...new Set(allRows.map((row) => row.item))].sort();
  const series = [...new Set(allRows.map((row) => row.series))];
  const lines = [
    "# with / without results",
    "",
    `Series: ${series.length === 0 ? "none" : series.join(", ")}. Counted runs: ${String(rows.length)}. Discarded: ${String(discarded.length)}.`,
  ];
  for (const item of items) {
    const itemRows = rows.filter((row) => row.item === item);
    lines.push(
      "",
      `## ${item}`,
      "",
      "| metric | with | without | with vs without |",
      "| --- | --- | --- | --- |",
      ...METRICS.map((metric) => {
        const [withRules, without] = CELLS.map((cell) => valuesOf(itemRows, cell, metric)) as [
          number[],
          number[],
        ];
        return `| ${metric} | ${summary(withRules)} | ${summary(without)} | ${verdict(withRules, without)} |`;
      }),
    );
  }
  if (discarded.length > 0) {
    lines.push(
      "",
      "## Discarded runs",
      "",
      ...discarded.map(
        (row) =>
          `- ${row.series} ${row.cell} ${row.item} run ${String(row.run)}: ${row.discarded ?? ""}`,
      ),
    );
  }
  return lines;
}
