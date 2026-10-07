// The subagent-git guard's rule (spec `bdk-cli/hooks`, "Subagent git guard"; design D6): who is
// a worker, and the reason a denial gives.

import type { HookPayload } from "./payload.ts";

/** The one agent type that commits and merges besides the main thread. */
export const LEAD = "bdk:lead";

/** A `Bash` call of a subagent other than the lead: the calls the guard looks at. */
export function workerBash(payload: HookPayload): boolean {
  return payload.tool === "Bash" && payload.agentId !== undefined && payload.agentType !== LEAD;
}

export function denyReason(command: string): string {
  return (
    `BDK hooks.subagent-git: a subagent other than ${LEAD} may not change git history ` +
    `(${command}). Leave your changes in the working tree and report them; ` +
    `the lead or the main thread commits.`
  );
}
