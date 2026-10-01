// Text renderings of the dispatch commands (`kernel-cli`, Output modes).
import type { BuildReport, ShowReport } from "../domain/report.ts";

export function renderBuild(report: BuildReport): string {
  const model = report.model === undefined ? "" : `, model ${report.model}`;
  return `package for ${report.ticket} (${report.role} on ${report.adapter}${model}, ${report.target}): ${String(report.bytes)} bytes\n${report.path}\n`;
}

/** The file verbatim, so an agent reads exactly what was built. */
export function renderShow(report: ShowReport): string {
  return report.content;
}
