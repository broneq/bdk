// The text mode of the spec commands.
import type { CheckReport, DiffReport, MergeReport } from "../domain/reports.ts";

export function renderCheck(report: CheckReport): string {
  if (report.deltas.length === 0) return "the Change has no spec delta\n";
  return [...report.deltas.map((delta) => `valid: ${delta.path}`), ""].join("\n");
}

export function renderMerge(report: MergeReport, dryRun: boolean): string {
  const verb = dryRun ? "would merge" : "merged";
  const merged = report.merged.map(
    (item) =>
      `${verb} ${item.capability}: ${item.path} (+${item.added} ~${item.modified} -${item.removed})`,
  );
  const conflicts = report.conflicts.flatMap((conflict) => [
    `conflict ${conflict.capability} / ${conflict.requirement}`,
    "  ours:",
    ...conflict.ours.split("\n").map((line) => `    ${line}`),
    "  theirs:",
    ...conflict.theirs.split("\n").map((line) => `    ${line}`),
  ]);
  const lines = [...merged, ...conflicts];
  return lines.length === 0 ? "the Change has no spec delta\n" : [...lines, ""].join("\n");
}

export function renderDiff(report: DiffReport): string {
  if (report.capabilities.length === 0) return "the Change has no spec delta\n";
  return [
    ...report.capabilities.flatMap((item) => [
      item.capability,
      ...item.requirements.map(
        (requirement) =>
          `  ${requirement.change} ${requirement.name} (scenarios +${requirement.scenarios.added} -${requirement.scenarios.removed})`,
      ),
    ]),
    "",
  ].join("\n");
}
