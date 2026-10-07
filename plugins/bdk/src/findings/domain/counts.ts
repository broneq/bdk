import { DECISIONS, LEVELS } from "./events.ts";
import type { Counts } from "./fold.ts";

/** The counts of a fold in one line, as `list` and the round report print it. */
export function countsLine(counts: Counts): string {
  const level = [...LEVELS, "unleveled" as const].map((key) => `${counts.level[key]} ${key}`);
  const decision = [...DECISIONS, "undecided" as const].map(
    (key) => `${counts.decision[key]} ${key}`,
  );
  return `${counts.findings} findings. Level: ${level.join(", ")}. Decision: ${decision.join(", ")}.`;
}
