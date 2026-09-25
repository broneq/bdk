import type { CheckReport } from "../domain/report.ts";

export function renderCheck(report: CheckReport): string {
  const lines = report.problems.map(
    (problem) => `warn ${problem.code} ${problem.path}: ${problem.message}`,
  );
  if (lines.length === 0) lines.push("settings valid");
  if (report.snapshot !== undefined) lines.push(`snapshot: ${report.snapshot}`);
  if (report.overriddenKeys.length > 0) {
    lines.push(`overridden by global or local: ${report.overriddenKeys.join(", ")}`);
  }
  return `${lines.join("\n")}\n`;
}
