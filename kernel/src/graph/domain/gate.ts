// The gate rule (`kernel-pipeline`, Gate; design D-5): a gate is done when a
// `transition` naming it, written by the user (or by policy under `auto`), is
// not earlier than the gate's ready time. Provenance and timing only (T1).
// Both times are compared to the second, so a hand-written transition without
// milliseconds still counts in the second the gate became ready.
import { live } from "./kinds/index.ts";
import type { GraphEntry } from "./kinds/index.ts";

export type GatePolicy = "manual" | "auto";

export interface GateInput {
  readonly id: string;
  /** The latest `at` of the done entries behind the requirements; undefined when one never was done. */
  readonly readyAt: string | undefined;
  /** True when some requirement has never been done, so the gate has no ready time at all. */
  readonly incomplete: boolean;
  /** Every requirement is done or skipped now. */
  readonly satisfied: boolean;
  readonly policy: GatePolicy;
  readonly command: string | undefined;
  readonly entries: readonly GraphEntry[];
}

export interface GateStatus {
  readonly gate: string;
  readonly ready: boolean;
  readonly done: boolean;
  readonly passedBy?: "user" | "policy";
  readonly command?: string;
  /** Live `review: true` entries, newest first. */
  readonly pending: readonly GraphEntry[];
  readonly readyAt?: string;
  /** The transition that passes the gate. */
  readonly passedIn?: GraphEntry;
  /** Why no entry counts, or what passed it. */
  readonly why: string;
}

export function gateStatus(input: GateInput): GateStatus {
  const naming = input.entries.filter(
    (entry) => entry.type === "transition" && entry.gate === input.id,
  );
  const accepted = (entry: GraphEntry): boolean =>
    entry.source === "user" || (entry.source === "policy" && input.policy === "auto");
  const timely = (entry: GraphEntry): boolean =>
    input.readyAt === undefined || toSecond(entry.at) >= toSecond(input.readyAt);
  const passing = input.incomplete
    ? undefined
    : naming.filter((entry) => accepted(entry) && timely(entry)).at(-1);
  const done = passing !== undefined;
  const pending = input.entries.filter((entry) => entry.review && live(entry)).reverse();
  return {
    gate: input.id,
    ready: done || input.satisfied,
    done,
    ...(passing === undefined ? {} : { passedBy: passing.source === "user" ? "user" : "policy" }),
    ...(input.command === undefined ? {} : { command: input.command }),
    pending,
    ...(input.readyAt === undefined ? {} : { readyAt: input.readyAt }),
    ...(passing === undefined ? {} : { passedIn: passing }),
    why: explain(input, naming, passing, accepted, timely),
  };
}

function toSecond(at: string): string {
  return at.slice(0, 19);
}

function explain(
  input: GateInput,
  naming: readonly GraphEntry[],
  passing: GraphEntry | undefined,
  accepted: (entry: GraphEntry) => boolean,
  timely: (entry: GraphEntry) => boolean,
): string {
  const since = input.readyAt === undefined ? "" : `ready since ${input.readyAt}; `;
  if (passing !== undefined) {
    return `${since}passed by ${passing.source} in ${passing.id} at ${passing.at}`;
  }
  if (input.incomplete || !input.satisfied) return "a requirement is not done";
  if (naming.length === 0) {
    return `${since}no transition names ${input.id}; the user passes it with ${input.command ?? "the next stage command"}`;
  }
  const reasons = naming.map((entry) =>
    !accepted(entry)
      ? `${entry.id} has source ${entry.source}${entry.source === "policy" ? ` and policy.gates is ${input.policy}` : ""}`
      : !timely(entry)
        ? `${entry.id} is older than the ready time`
        : `${entry.id} does not count`,
  );
  return `${since}${reasons.join("; ")}`;
}
