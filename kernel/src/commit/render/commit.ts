import type { CommitReport } from "../domain/report.ts";

export function renderCommit(report: CommitReport): string {
  const count = report.files.length;
  return `review fix of ${report.ticket} committed as ${report.commit} (${String(count)} file${count === 1 ? "" : "s"})\n`;
}
