// The text mode of the `bdk diagnostics` commands
// (`kernel-cli/diagnostics`).
import type { DiagnosticsReport, LogReport, SliceReport, WriteReport } from "../domain/report.ts";
import { reportText } from "../domain/text.ts";

export function renderReport(report: DiagnosticsReport): string {
  return reportText(report);
}

export function renderLogPath(report: LogReport): string {
  return `${report.path}\n`;
}

export function renderSlice(report: SliceReport): string {
  const omitted = report.omitted > 0 ? [`... ${String(report.omitted)} lines left out`] : [];
  return `${[...report.events, ...omitted].join("\n")}\n`;
}

export function renderWritePath(report: WriteReport): string {
  return `${report.path}\n`;
}
