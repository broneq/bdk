import type {
  PartDoneReport,
  PartListReport,
  PartSplitReport,
  PartStartReport,
} from "../domain/reports.ts";

export function renderList(report: PartListReport): string {
  if (report.items.length === 0) return "No plan parts.\n";
  return `${report.items
    .map((item) => {
      const wave = item.wave === undefined ? "" : `, wave ${String(item.wave)}`;
      const after = item.dependsOn === undefined ? "" : `, after ${item.dependsOn.join(", ")}`;
      return (
        `${item.part} ${item.state}: ${item.title} (${String(item.done)}/${String(item.tasks)} tasks, ` +
        `${String(item.bytes)} bytes${wave}${after}, spec ${item.specImpact})`
      );
    })
    .join("\n")}\n`;
}

export function renderStart(report: PartStartReport): string {
  const tasks = report.tasks.map((task) => {
    const extra = [
      task.verification === undefined ? "" : "verification: none",
      task.stopRule === undefined ? "" : `stop rule: ${task.stopRule}`,
    ].filter((text) => text !== "");
    const suffix = extra.length === 0 ? "" : ` (${extra.join("; ")})`;
    return `  ${task.task}: ${task.files.join(", ")}${suffix}`;
  });
  const forbidden = report.doNotTouch.length === 0 ? "none" : report.doNotTouch.join(", ");
  return [
    `part ${report.part} started (${report.entry})`,
    ...tasks,
    `do-not-touch: ${forbidden}`,
    `success measure: ${report.successMeasure}`,
    "",
  ].join("\n");
}

export function renderDone(report: PartDoneReport): string {
  return [
    `part ${report.part} done (${report.entry})`,
    ...report.commits.map((commit) => `  ${commit.task}: ${commit.commit}`),
    ...(report.openFindings.length === 0
      ? []
      : [`open findings: ${report.openFindings.join(", ")}`]),
    `next: ${report.next ?? "nothing"}`,
    "",
  ].join("\n");
}

export function renderSplit(report: PartSplitReport): string {
  return `part ${report.part} split: ${report.moved.join(", ")} moved to part ${report.newPart} (${report.entry})\n`;
}
