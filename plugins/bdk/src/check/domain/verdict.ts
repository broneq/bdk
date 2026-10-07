// The result of a check from its command's outcome (spec `bdk-cli/check`, "Result file",
// "Output files", "Red checks as findings").

import type { Kind } from "./plan.ts";

/** How a command ended; a signal exit already counts as 128 plus its number. */
export type Outcome =
  { readonly kind: "exit"; readonly code: number } | { readonly kind: "timeout" };

export const STATUSES = ["pass", "fail", "timeout"] as const;
export type Status = (typeof STATUSES)[number];

export const VERDICTS = ["pass", "fail", "none"] as const;
export type Verdict = (typeof VERDICTS)[number];

/** Lines of a red check's output that the result carries. */
export const TAIL_LINES = 20;

export function statusOf(outcome: Outcome): Status {
  if (outcome.kind === "timeout") return "timeout";
  return outcome.code === 0 ? "pass" : "fail";
}

export function verdictOf(statuses: readonly Status[]): Verdict {
  if (statuses.length === 0) return "none";
  return statuses.every((status) => status === "pass") ? "pass" : "fail";
}

/** The text appended to an output file so its last line says how the command ended. */
export function trailer(output: string, outcome: Outcome, timeout: number): string {
  const line =
    outcome.kind === "timeout" ? `timeout ${String(timeout)}` : `exit ${String(outcome.code)}`;
  return `${output === "" || output.endsWith("\n") ? "" : "\n"}${line}\n`;
}

/** The last lines of a command's output, before the trailer was appended. */
export function tailOf(output: string): readonly string[] {
  const body = output.endsWith("\n") ? output.slice(0, -1) : output;
  return body === "" ? [] : body.split(/\r?\n/).slice(-TAIL_LINES);
}

export interface RedCheck {
  readonly kind: Kind;
  readonly tool: string;
  readonly status: Status;
  readonly exit: number | null;
  readonly timeout: number;
}

/** The `finding` fields of a red check; the rule keeps its id stable across reruns. */
export function finding(
  check: RedCheck,
  output: string,
): { source: string; rule: string; summary: string; evidence: string } {
  const what = `${check.kind} ${check.tool}`;
  return {
    source: "check-run",
    rule: `check/${check.kind}/${check.tool}`,
    summary:
      check.status === "timeout"
        ? `${what} timed out after ${String(check.timeout)} s`
        : `${what} failed with exit ${String(check.exit)}`,
    evidence: output,
  };
}
