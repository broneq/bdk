import type { SetReport } from "../domain/report.ts";

export function renderSet(report: SetReport): string {
  const previous = report.previous === undefined ? "" : ` (was ${JSON.stringify(report.previous)})`;
  return `${report.key} = ${JSON.stringify(report.value)}${previous} in the ${report.layer} layer (${report.path})\n`;
}
