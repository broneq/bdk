import type { CommitReport } from "../domain/report.ts";

export function renderCommit(report: CommitReport): string {
  const count = report.files.length;
  return [
    `${report.task} committed as ${report.commit} (${String(count)} file${count === 1 ? "" : "s"})`,
    ...(report.undeclared === undefined
      ? []
      : [`undeclared: ${report.undeclared.join(", ")} (${report.finding ?? "no finding"})`]),
    "",
  ].join("\n");
}
