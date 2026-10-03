// The kernel refusals a stage run's agents met (T46, `skill-evals`): counted
// from the Bash tool results of the run, per rule, so two probes compare by
// number. A refusal prints as `refused: <rule>` in text mode and as a
// `"rule"` field with `--json`.
import type { ResultRow } from "../../harness/results.ts";

const TEXT = /^refused: ((?:input|policy|runtime)\/[a-z-]+)/m;
const JSON_FIELD = /"rule":\s*"((?:input|policy|runtime)\/[a-z-]+)"/;

/** The acceptance signal of #109: rules that must not appear, and the total to stay below (T41 probe 2). */
export const ACCEPTANCE = {
  skill: "execute",
  fixed: [
    "policy/missing-citation",
    "input/invalid-envelope",
    "policy/no-open-ticket",
    "input/unknown-command",
    "input/unknown-flag",
  ],
  total: 21,
} as const;

interface CountedCall {
  readonly name: string;
  readonly output?: unknown;
}

/** The refusals per rule: one per Bash result that holds one. */
export function countRefusals(calls: readonly CountedCall[]): Record<string, number> {
  const counts: Record<string, number> = {};
  for (const call of calls) {
    if (call.name !== "Bash" || typeof call.output !== "string") continue;
    const rule = (TEXT.exec(call.output) ?? JSON_FIELD.exec(call.output))?.[1];
    if (rule !== undefined) counts[rule] = (counts[rule] ?? 0) + 1;
  }
  return counts;
}

/** The run's metrics: the total, and `refusal:<rule>` for each rule seen. */
export function refusalMetrics(counts: Readonly<Record<string, number>>): Record<string, number> {
  const metrics: Record<string, number> = {
    refusals: Object.values(counts).reduce((sum, count) => sum + count, 0),
  };
  for (const [rule, count] of Object.entries(counts)) metrics[`refusal:${rule}`] = count;
  return metrics;
}

/** What keeps the `execute` rows from meeting the acceptance signal; empty when they meet it. */
export function acceptanceFailures(rows: readonly ResultRow[]): string[] {
  const own = rows.filter(
    (row) => row.discarded === null && row.item.startsWith(`${ACCEPTANCE.skill}/`),
  );
  if (own.length === 0) return [];
  const failures: string[] = [];
  for (const row of own) {
    for (const rule of ACCEPTANCE.fixed) {
      const count = row.metrics[`refusal:${rule}`];
      if (typeof count === "number" && count > 0) {
        failures.push(
          `${row.item} run ${String(row.run)}: ${rule} refused ${String(count)} time(s)`,
        );
      }
    }
  }
  const total = own.reduce((sum, row) => sum + (row.metrics.refusals ?? 0), 0);
  if (total >= ACCEPTANCE.total) {
    failures.push(
      `${ACCEPTANCE.skill} total ${String(total)} refusals; it must be below ${String(ACCEPTANCE.total)}`,
    );
  }
  return failures;
}
