// The text mode of the evidence commands.
import type { CheckReport, CoverageReport, RecordReport } from "../domain/reports.ts";

export function renderRecord(report: RecordReport): string {
  const head = report.deduplicated
    ? `${report.evidence} already records this evidence: ${report.path}`
    : `recorded ${report.evidence}: ${report.path}`;
  const verdict = report.verdict === undefined ? [] : [`verdict: ${report.verdict}`];
  const files = report.files.map((file) => `  ${file.stored}: ${file.path}`);
  return [head, `tree: ${report.treeHash}`, ...verdict, "files:", ...files, ""].join("\n");
}

export function renderCheck(subject: string, report: CheckReport): string {
  const lines = report.evidence.map(
    (entry) =>
      `  ${entry.evidence} ${entry.kind}${entry.verdict === undefined ? "" : ` ${entry.verdict}`}: fresh`,
  );
  return [`evidence of ${subject} is fresh (tree ${report.treeHash})`, ...lines, ""].join("\n");
}

/** Why the evidence of `subject` is not fresh: the stale manifests and their changed paths. */
export function staleWhy(subject: string, report: CheckReport): string {
  if (report.evidence.length === 0) return `${subject} has no evidence`;
  const stale = report.evidence
    .filter((entry) => !entry.fresh)
    .map((entry) => `${entry.evidence} ${entry.kind} (changed: ${entry.changedSince.join(", ")})`);
  return `evidence of ${subject} is stale: ${stale.join("; ")}`;
}

export function renderCoverage(report: CoverageReport): string {
  const percent =
    report.percent === null ? "no instrumented added line" : `${String(report.percent)}%`;
  const min = report.min === null ? "" : ` (min ${String(report.min)}%)`;
  const unmeasured = report.unmeasured.map((path) => `  unmeasured: ${path}`);
  return [
    `${report.verdict} ${report.tool}: ${percent}${min}, ${String(report.covered)}/${String(report.total)} added lines covered`,
    `recorded ${report.evidence}`,
    ...unmeasured,
    "",
  ].join("\n");
}
