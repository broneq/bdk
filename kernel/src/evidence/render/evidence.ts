// The text mode of the evidence commands.
import type { RecordReport } from "../domain/reports.ts";

export function renderRecord(report: RecordReport): string {
  const head = report.deduplicated
    ? `${report.evidence} already records this evidence: ${report.path}`
    : `recorded ${report.evidence}: ${report.path}`;
  const verdict = report.verdict === undefined ? [] : [`verdict: ${report.verdict}`];
  const files = report.files.map((file) => `  ${file.stored}: ${file.path}`);
  return [head, `tree: ${report.treeHash}`, ...verdict, "files:", ...files, ""].join("\n");
}
