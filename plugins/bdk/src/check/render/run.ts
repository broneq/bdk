// The text of `bdk check run`, written for a model reading a Bash result: one line per check,
// the tail of each red one indented under it, then the verdict and where the result is.

import type { RunResult } from "../schema/run.ts";

export function renderRun(result: RunResult, resultFile: string): string {
  const lines: string[] = [];
  const width = (pick: (check: RunResult["checks"][number]) => string): number =>
    Math.max(0, ...result.checks.map((check) => pick(check).length));
  const status = width((check) => check.status);
  const name = width((check) => `${check.kind} ${check.tool}`);
  for (const check of result.checks) {
    const scope = check.scoped ? "scoped" : "full  ";
    lines.push(
      `${check.status.padEnd(status)}  ${`${check.kind} ${check.tool}`.padEnd(name)}  ${scope}  ${check.output}`,
    );
    for (const line of check.tail ?? []) lines.push(`    | ${line}`);
  }
  if (result.checks.length === 0) lines.push("no check configured for this run");
  const red = result.checks.filter((check) => check.status !== "pass").length;
  const count = result.checks.length;
  lines.push(
    result.verdict === "fail"
      ? `verdict: fail (${String(red)} of ${String(count)} red)`
      : `verdict: ${result.verdict}`,
  );
  lines.push(`result: ${resultFile}`);
  if (result.findings !== null) {
    lines.push(
      `findings: ${String(result.findings.ids.length)} appended to ${result.findings.log}`,
    );
  }
  return `${lines.join("\n")}\n`;
}
