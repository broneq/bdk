// The stages table: per case, how many counted runs met every expectation,
// and the median questions, turns, kernel refusals and cost, then the runs
// whose journal and transcript refusal totals differ. A failed expectation is
// named in the run's `checks.json` among its raw records.
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";

import type { ResultRow } from "../../harness/results.ts";
import type { CheckResult } from "./checks.ts";
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
  lines.push(...refusalDifferences(rows));
  if (discarded.length > 0) {
    lines.push("", "Discarded runs:", "");
    for (const row of discarded) {
      lines.push(`- ${row.item} run ${String(row.run)}: ${row.discarded ?? ""}`);
    }
  }
  return lines;
}

/** The runs whose journal and transcript refusal totals differ, and those without a report. */
function refusalDifferences(rows: readonly ResultRow[]): string[] {
  const label = (row: ResultRow) => `${row.item} run ${String(row.run)}`;
  const missing = rows.filter((row) => row.metrics["journal-missing"] === 1);
  const differ = rows.filter((row) => {
    const { refusals } = row.metrics;
    const transcript = row.metrics["refusals-transcript"];
    return (
      row.metrics["journal-missing"] !== 1 &&
      typeof refusals === "number" &&
      typeof transcript === "number" &&
      refusals !== transcript
    );
  });
  const lines: string[] = [];
  if (differ.length > 0) {
    lines.push("", "Refusal totals differ (journal, transcript):", "");
    for (const row of differ) {
      lines.push(
        `- ${label(row)}: journal ${String(row.metrics.refusals)}, transcript ${String(row.metrics["refusals-transcript"])}`,
      );
    }
  }
  if (missing.length > 0) {
    lines.push(
      "",
      `Runs without a journal report (transcript counts): ${missing.map(label).join(", ")}.`,
    );
  }
  return lines;
}

/**
 * One line per counted run of a series: whether it met every expectation,
 * and the failed ones from its `checks.json`. promptfoo's own pass count
 * carries no stage expectation, so the series prints these after it.
 */
export function expectationLines(rows: readonly ResultRow[], rawDir: string): string[] {
  return rows
    .filter((row) => row.discarded === null)
    .map((row) => {
      const label = `${row.item} run ${String(row.run)}`;
      if (row.metrics.expect_pass === 1) return `expectations: ${label} met every expectation`;
      const file = join(rawDir, row.cell, `${row.item}.run-${String(row.run)}`, "checks.json");
      const failures = existsSync(file)
        ? (JSON.parse(readFileSync(file, "utf8")) as CheckResult).failures
        : [];
      return `expectations: ${label} FAILED: ${failures.join("; ") || "see its checks.json"} (${file})`;
    });
}
