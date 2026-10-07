import type { CheckRunReport } from "../domain/report.ts";

/** One line per check, the tail of each failing one, the commit command last. */
export function renderCheckRun(report: CheckRunReport): string {
  const lines = [`${report.target} under ${report.ticket}: ${report.verdict}`];
  for (const check of report.checks) {
    const end =
      check.skipped !== undefined
        ? `skipped: ${check.skipped}`
        : check.timeout !== undefined
          ? `timeout ${String(check.timeout)} s`
          : `exit ${String(check.exit)}`;
    lines.push(`${check.kind} ${check.tool}: ${check.verdict} (${end}) ${check.file}`);
    for (const line of check.tail ?? []) lines.push(`  | ${line}`);
  }
  if (report.diff.undeclared.length > 0) {
    lines.push(`undeclared: ${report.diff.undeclared.join(", ")}`);
  }
  if (report.commit !== undefined) lines.push(`commit: ${report.commit.command}`);
  return `${lines.join("\n")}\n`;
}
