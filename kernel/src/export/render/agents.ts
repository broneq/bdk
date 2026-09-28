// The text form of `bdk export agents`.
import type { AgentsReport } from "../domain/report.ts";

export function renderAgents(report: AgentsReport): string {
  const lines = report.files.map(
    (file) => `${file.changed ? "written  " : "unchanged"}  ${file.path}`,
  );
  const changed = report.files.filter((file) => file.changed).length;
  lines.push(`${report.host}: ${changed} of ${report.files.length} adapter files changed`);
  return `${lines.join("\n")}\n`;
}
