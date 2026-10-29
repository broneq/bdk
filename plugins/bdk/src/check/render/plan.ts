// The text of `bdk check plan`, written for a model about to run the lines: what to do first,
// each check with its Bash timeout and the line to run indented under it, the skipped entries,
// then the `bdk check record` call to make after the lines (ADR-0011).

import type { CheckPlan } from "../schema/plan.ts";
import { skipReason } from "./skip.ts";

export function renderPlan(plan: CheckPlan, runDir: string, planFile: string): string {
  const lines: string[] = [];
  const count = plan.checks.length;
  lines.push(
    count === 0
      ? `check ${plan.id}: nothing to run, ${String(plan.skipped.length)} skipped`
      : `check ${plan.id}: ${String(count)} to run, ${String(plan.skipped.length)} skipped; run each line below as its own Bash call from the project root, one after another, with its timeout`,
  );
  const at = plan.at === null ? [] : [`at ${plan.at}`];
  const changed = plan.changed === null ? [] : [`changed against ${plan.changed}`];
  if (at.length + changed.length > 0) lines.push([...at, ...changed].join(", "));
  const named = [...plan.checks, ...plan.skipped];
  const name = Math.max(0, ...named.map((entry) => `${entry.kind} ${entry.tool}`.length));
  plan.checks.forEach((check, index) => {
    const scope = check.scoped ? "scoped" : "full  ";
    lines.push(
      `${String(index + 1)}. ${`${check.kind} ${check.tool}`.padEnd(name)}  ${scope}  in ${plan.cwd}  timeout ${String(check["bash-timeout"])}`,
    );
    lines.push(`    ${check.line}`);
    for (const note of check.notes) lines.push(`    note: ${note}`);
  });
  for (const entry of plan.skipped) {
    lines.push(`skip  ${`${entry.kind} ${entry.tool}`.padEnd(name)}  ${skipReason(entry)}`);
  }
  if (named.length === 0) lines.push("no check configured for this run");
  const exits = plan.checks.map((check) => ` --exit ${check.kind}-${check.tool}=<code>`).join("");
  lines.push(
    count === 0
      ? `then: bdk check record ${runDir} ${plan.id}`
      : `then: bdk check record ${runDir} ${plan.id}${exits} (--timed-out <kind>-<tool> for a call the Bash tool ended at its timeout)`,
  );
  lines.push(`plan: ${planFile}`);
  return `${lines.join("\n")}\n`;
}
