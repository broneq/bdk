import type {
  AttemptCloseReport,
  AttemptItem,
  AttemptListReport,
  AttemptOpenReport,
  AttemptShowReport,
} from "../domain/reports.ts";

export function renderOpen(report: AttemptOpenReport): string {
  const escalation =
    report.escalation === undefined ? "" : `, escalation: ${report.escalation.model}`;
  const narrowed =
    report.narrowedFrom === undefined ? "" : `, narrowed from ${report.narrowedFrom}`;
  return [
    `${report.ticket} opened: ${report.loop} ${report.target}, attempt ${String(report.attempt)} of ${String(report.of)}, scope ${report.scope}${narrowed}${escalation}`,
    ...(report.dropped ?? []).map((dropped) => `  dropped ${dropped.id}: ${dropped.summary}`),
    ...(report.entry === undefined ? [] : [`dropped findings recorded in ${report.entry}`]),
    "",
  ].join("\n");
}

export function renderClose(report: AttemptCloseReport): string {
  const next = report.next;
  const scope = next.scope === undefined ? "" : ` (scope ${next.scope})`;
  const why = next.why === undefined ? "" : `: ${next.why}`;
  return [
    `${report.ticket} closed ${report.outcome}; not-run count ${String(report.notRunCount)}`,
    ...(report.diff === undefined || report.diff.undeclared.length === 0
      ? []
      : [`undeclared: ${report.diff.undeclared.join(", ")}`]),
    ...(report.findings === undefined ? [] : [`findings: ${report.findings.join(", ")}`]),
    `next: ${next.action}${scope}${why}`,
    ...(next.entry === undefined ? [] : [`question: ${next.entry}`]),
    ...(next.resume === undefined ? [] : [`resume: ${next.resume}`]),
    "",
  ].join("\n");
}

export function renderList(report: AttemptListReport): string {
  const budgets = Object.entries(report.budgets ?? {}).map(
    ([loop, budget]) => `${loop}: ${String(budget.used)}/${String(budget.of)}`,
  );
  if (report.items.length === 0) return "No attempts.\n";
  return [
    ...report.items.map(line),
    ...(budgets.length === 0 ? [] : [`budgets: ${budgets.join(", ")}`]),
    "",
  ].join("\n");
}

function line(item: AttemptItem): string {
  const state = item.outcome ?? "open";
  const escalation = item.escalation === true ? ", escalation" : "";
  const entries = item.entries === undefined ? "" : `, ${String(item.entries)} entries`;
  return `${item.ticket} ${state}: ${item.loop} ${item.target}, attempt ${String(item.attempt)}/${String(item.of)}, ${item.scope}${escalation}${entries}`;
}

export function renderShow(report: AttemptShowReport): string {
  return [
    line(report),
    ...(report.steps === undefined || report.steps.length === 0
      ? []
      : [
          `steps: ${report.steps.map((step) => `${step.kind} (${"role" in step ? step.role : step.command})`).join(", ")}`,
        ]),
    "",
  ].join("\n");
}
