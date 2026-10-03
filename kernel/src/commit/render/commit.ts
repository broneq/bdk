import type { CommitReport } from "../domain/report.ts";

export function renderCommit(report: CommitReport): string {
  const count = report.files.length;
  const what = "ticket" in report ? `review fix of ${report.ticket}` : report.task;
  return [
    `${what} committed as ${report.commit} (${String(count)} file${count === 1 ? "" : "s"})`,
    ...("ticket" in report || report.undeclared === undefined
      ? []
      : [`undeclared: ${report.undeclared.join(", ")} (${report.finding ?? "no finding"})`]),
    "",
  ].join("\n");
}
