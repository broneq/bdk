// The text of `bdk check run`, written for a model reading a Bash result: one line per check,
// the point and revision first, the tail of each red one indented under it, one line per skipped entry, then the verdict and
// where the result is.

import type { RunResult } from "../schema/run.ts";

export function renderRun(result: RunResult, resultFile: string): string {
  const lines: string[] = [];
  const at = result.at === null ? [] : [`at ${result.at}`];
  const changed = result.changed === null ? [] : [`changed against ${result.changed}`];
  if (at.length + changed.length > 0) lines.push([...at, ...changed].join(", "));
  const named = [...result.checks, ...result.skipped];
  const status = Math.max(0, ...result.checks.map((check) => check.status.length));
  const name = Math.max(0, ...named.map((entry) => `${entry.kind} ${entry.tool}`.length));
  for (const check of result.checks) {
    const scope = check.scoped ? "scoped" : "full  ";
    lines.push(
      `${check.status.padEnd(status)}  ${`${check.kind} ${check.tool}`.padEnd(name)}  ${scope}  ${check.output}`,
    );
    for (const line of check.tail ?? []) lines.push(`    | ${line}`);
  }
  for (const entry of result.skipped) {
    const why =
      entry.reason === "paths"
        ? "no changed file matches its paths"
        : "no changed file for its {files}";
    lines.push(`${"skip".padEnd(status)}  ${`${entry.kind} ${entry.tool}`.padEnd(name)}  ${why}`);
  }
  if (named.length === 0) lines.push("no check configured for this run");
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
