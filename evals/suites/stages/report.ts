// The stages table: per case, how many counted runs met every expectation,
// and the median questions, turns, kernel refusals and cost. A failed expectation is named in
// the run's `checks.json` among its raw records.
import type { ResultRow } from "../../harness/results.ts";
import { median } from "../../harness/stats.ts";
import { acceptanceFailures } from "./refusals.ts";

function number(value: number): string {
  return Number.isInteger(value) ? String(value) : value.toFixed(2);
}

function medianOf(values: readonly (number | null | undefined)[]): string {
  const counted = values.filter((value): value is number => typeof value === "number");
  return counted.length === 0 ? "n/a" : number(median(counted));
}

export function stagesReport(allRows: readonly ResultRow[]): string[] {
  const rows = allRows.filter((row) => row.discarded === null);
  const discarded = allRows.filter((row) => row.discarded !== null);
  const items = [...new Set(allRows.map((row) => row.item))].sort();
  const series = [...new Set(allRows.map((row) => row.series))];
  const lines = [
    "# Stage skill cases",
    "",
    `Series: ${series.join(", ") || "none"}. A case passes a run when every expectation holds.`,
    "",
    "| case | passed | questions | turns | refusals | cost (USD) |",
    "|---|---|---|---|---|---|",
  ];
  for (const item of items) {
    const runs = rows.filter((row) => row.item === item);
    const passed = runs.filter((row) => row.metrics.expect_pass === 1).length;
    lines.push(
      `| ${item} | ${String(passed)}/${String(runs.length)} | ${medianOf(runs.map((row) => row.metrics.questions))} | ${medianOf(runs.map((row) => row.metrics.turns))} | ${medianOf(runs.map((row) => row.metrics.refusals))} | ${medianOf(runs.map((row) => row.cost))} |`,
    );
  }
  const unmet = acceptanceFailures(rows);
  if (unmet.length > 0) {
    lines.push("", "Refusal acceptance not met (#109):", "");
    for (const failure of unmet) lines.push(`- ${failure}`);
  }
  if (discarded.length > 0) {
    lines.push("", "Discarded runs:", "");
    for (const row of discarded) {
      lines.push(`- ${row.item} run ${String(row.run)}: ${row.discarded ?? ""}`);
    }
  }
  return lines;
}
