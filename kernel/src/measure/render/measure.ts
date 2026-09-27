import type { MeasureReport } from "../domain/measure.ts";

export function renderMeasure(report: MeasureReport): string {
  const modules = report.modules.length === 0 ? "" : `: ${report.modules.join(", ")}`;
  const files = report.files === 1 ? "file" : "files";
  const count = report.modules.length === 1 ? "module" : "modules";
  return (
    `${report.range}: ${report.files} ${files}, +${report.added} -${report.removed} ` +
    `(${report.lines} lines), ${report.modules.length} ${count}${modules}\n`
  );
}
