import type { SetReport } from "../domain/report.ts";

export function renderSet(report: SetReport, appliesFrom?: "next-session"): string {
  const previous = report.previous === undefined ? "" : ` (was ${JSON.stringify(report.previous)})`;
  const line = `${report.key} = ${JSON.stringify(report.value)}${previous} in the ${report.layer} layer (${report.path})\n`;
  return appliesFrom === "next-session"
    ? `${line}This setting applies from the next session start.\n`
    : line;
}
