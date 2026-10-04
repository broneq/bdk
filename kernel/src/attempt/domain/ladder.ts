// The escalation ladder as pure functions over the committed attempt records
// and ledger entries of one loop and target (`kernel-loops`; T22 design
// D-1 to D-5): rounds, counts, scopes, oscillation, the escalation rung and
// the instruction `attempt close` returns. Nothing here is stored: every
// count is derived again on each read.
import { TICKET_SCOPES } from "../../shared/vocabulary/index.ts";

export type Scope = (typeof TICKET_SCOPES)[number];
export type Outcome = "ok" | "fail" | "not-run";

/** The fields of an attempt record the ladder reads. */
export interface LadderRecord {
  readonly ticket: string;
  readonly attempt: number;
  readonly scope: Scope;
  readonly escalation?: boolean | undefined;
  readonly openedAt: string;
  readonly outcome?: Outcome | undefined;
  readonly fingerprints: readonly string[];
  /** The `ok` ticket that ended the previous round; absent in the first round. */
  readonly after?: string | undefined;
}

/** The fields of a ledger entry the ladder reads. */
export interface LadderEntry {
  readonly id: string;
  readonly type: string;
  readonly source: string;
  readonly refs: readonly string[];
  readonly park?: boolean | undefined;
}

export interface LadderPolicy {
  /** `policy.budgets.<loop>`. */
  readonly budget: number;
  /** `policy.budgets.not-run`. */
  readonly notRunBudget: number;
  /** `policy.oscillation.threshold`. */
  readonly threshold: number;
  readonly escalation: {
    readonly enabled: boolean;
    readonly model: string;
    readonly perChange: number;
  };
}

export interface Rounds<T> {
  /** The records the next open counts against; empty when an `ok` ended the latest round. */
  readonly current: T[];
  /** The latest round's records, ended or not: what `attempt list` shows. */
  readonly latest: T[];
  /** The `after` the next open stamps. */
  readonly after: string | undefined;
}

/**
 * The rounds of one loop and target (`kernel-loops`, Loops, targets and
 * rounds). An `ok` ends its round: every record opened after it carries
 * `after: <ok ticket>`, so the records sharing one `after` form a round and the
 * `ok` that closes it names the next. A ladder question ends a round too: its
 * `refs` name the round's tickets and a `decision` naming it answers it.
 * Naming tickets, not comparing times, keeps the rounds apart even when a
 * close, the answer and the next open share one `at`.
 */
export function rounds<T extends LadderRecord>(
  records: readonly T[],
  entries: readonly LadderEntry[],
): Rounds<T> {
  const byAfter = new Map<string | undefined, T[]>();
  for (const record of records) {
    byAfter.set(record.after, [...(byAfter.get(record.after) ?? []), record]);
  }
  let after: string | undefined;
  for (;;) {
    // Records an answered ladder question names belong to an earlier round of the same `after`.
    const round = inSequence(withoutAnswered(byAfter.get(after) ?? [], entries));
    const last = round.at(-1);
    const ended = last?.outcome === "ok";
    if (ended && byAfter.has(last.ticket)) {
      after = last.ticket;
      continue;
    }
    return ended
      ? { current: [], latest: round, after: last.ticket }
      : { current: round, latest: round, after };
  }
}

/** The current round of one loop and target: what the next open counts against. */
export function currentRound<T extends LadderRecord>(
  records: readonly T[],
  entries: readonly LadderEntry[],
): T[] {
  return rounds(records, entries).current;
}

/** The records of a round that no answered ladder question names. */
function withoutAnswered<T extends LadderRecord>(
  records: readonly T[],
  entries: readonly LadderEntry[],
): T[] {
  const tickets = new Set(records.map((record) => record.ticket));
  const answered = new Set(
    entries.filter((entry) => entry.type === "decision").flatMap((entry) => entry.refs),
  );
  const closed = new Set<string>();
  for (const entry of entries) {
    if (!isLadderQuestion(entry) || !answered.has(entry.id)) continue;
    const named = entry.refs.filter((ref) => tickets.has(ref));
    for (const ticket of named) closed.add(ticket);
  }
  return records.filter((record) => !closed.has(record.ticket));
}

function isLadderQuestion(entry: LadderEntry): boolean {
  return entry.type === "question" && entry.source === "kernel" && entry.park === true;
}

/**
 * The records of one round in the order they ran. Within a round tickets run
 * one at a time, and `attempt` only grows: the `not-run` records of attempt N
 * come before its `ok` or `fail`, and the escalation ticket comes last.
 * Times break the remaining ties only, since several records can share a second.
 */
function inSequence<T extends LadderRecord>(records: readonly T[]): T[] {
  const rank = (record: T): number =>
    (record.escalation === true ? 2 : 0) + (record.outcome === "not-run" ? 0 : 1);
  return [...records].sort(
    (a, b) =>
      a.attempt - b.attempt ||
      rank(a) - rank(b) ||
      compare(a.openedAt, b.openedAt) ||
      compare(a.ticket, b.ticket),
  );
}

export interface RoundState {
  /** Plain `ok` and `fail` records: what counts against the budget. */
  readonly used: number;
  readonly of: number;
  /** The number the next plain ticket gets. */
  readonly attempt: number;
  /** Consecutive `not-run` records since the latest `ok` or `fail`. */
  readonly notRun: number;
  /** The scope of the latest plain ticket, undefined in a fresh round. */
  readonly scope: Scope | undefined;
  /** The round's escalation ticket that is open or closed `ok` or `fail`. */
  readonly escalated: boolean;
  /** A fingerprint in `threshold` `fail` records, or undefined. */
  readonly oscillating: string | undefined;
  /** The latest `fail` record, whose open findings a narrower scope may drop. */
  readonly lastFail: string | undefined;
}

export function roundState(round: readonly LadderRecord[], policy: LadderPolicy): RoundState {
  const records = inSequence(round);
  let used = 0;
  let notRun = 0;
  let scope: Scope | undefined;
  let escalated = false;
  let lastFail: string | undefined;
  const failures = new Map<string, number>();
  for (const record of records) {
    if (record.escalation === true) {
      if (record.outcome !== "not-run") escalated = true;
    } else {
      scope = record.scope;
      if (record.outcome === "ok" || record.outcome === "fail") used++;
    }
    if (record.outcome === "not-run") notRun++;
    else if (record.outcome !== undefined) notRun = 0;
    if (record.outcome === "fail") {
      lastFail = record.ticket;
      for (const print of new Set(record.fingerprints)) {
        failures.set(print, (failures.get(print) ?? 0) + 1);
      }
    }
  }
  const oscillating = [...failures].find(([, count]) => count >= policy.threshold)?.[0];
  return {
    used,
    of: policy.budget,
    attempt: used + 1,
    notRun,
    scope,
    escalated,
    oscillating,
    lastFail,
  };
}

/** Attempt 1 runs `full`, attempt 2 `high+`, attempt 3 and later `blockers`. */
export function scopeFor(attempt: number): Scope {
  return TICKET_SCOPES[Math.min(attempt, TICKET_SCOPES.length) - 1] ?? "full";
}

/** Whether a `finding` or `blocker` stays in a scope; everything else stays in `full` only. */
export function inScope(
  scope: Scope,
  entry: { readonly type: string; readonly severity?: string | undefined },
): boolean {
  if (scope === "full" || entry.type === "blocker") return true;
  if (entry.type !== "finding") return false;
  const kept = scope === "high+" ? ["critical", "high"] : ["critical"];
  return entry.severity !== undefined && kept.includes(entry.severity);
}

export function budgetUsed(state: RoundState): boolean {
  return state.used >= state.of;
}

/** Undefined when the escalation ticket may open, otherwise why not. */
export function escalationBlocked(
  state: RoundState,
  policy: LadderPolicy,
  changeEscalations: number,
): string | undefined {
  if (!policy.escalation.enabled) return "policy.escalation.enabled is false";
  if (state.escalated) return "this round already used its escalation ticket";
  if (changeEscalations >= policy.escalation.perChange) {
    return `the Change opened ${String(changeEscalations)} escalation tickets, the policy.escalation.per-change limit`;
  }
  return undefined;
}

export type NextAction =
  "commit" | "part-done" | "review-done" | "retry" | "narrow" | "escalate" | "parked";

/** What an `ok` close leaves to the orchestrator, by the loop of the ticket. */
export type OkAction = Extract<NextAction, "commit" | "part-done" | "review-done">;

export interface Next {
  readonly action: NextAction;
  readonly scope?: Scope;
  readonly why?: string;
}

/**
 * The rung after a close (`kernel-loops`, Escalation ladder). `after` is the
 * round with the closed record counted; `escalation` whether it was the
 * escalation ticket; `blocked` why no escalation may open, if so.
 */
export function nextRung(
  outcome: Outcome,
  escalation: boolean,
  after: RoundState,
  policy: LadderPolicy,
  blocked: string | undefined,
  ok: OkAction = "commit",
): Next {
  // The step evidence was checked before the close (T23-D41): what remains is the commit.
  // A lead committed its part's tasks itself (T41-D11): what remains is `part done`.
  // A review round committed its fix under the open ticket (T42): what remains is `done review`.
  if (outcome === "ok") return { action: ok };
  if (outcome === "not-run") {
    if (after.notRun >= policy.notRunBudget) {
      return {
        action: "parked",
        why: `${String(after.notRun)} consecutive not-run closes use up policy.budgets.not-run (${String(policy.notRunBudget)})`,
      };
    }
    return { action: "retry", ...(after.scope === undefined ? {} : { scope: after.scope }) };
  }
  if (escalation) return { action: "parked", why: "the escalation ticket failed" };
  const reason =
    after.oscillating !== undefined
      ? `fingerprint ${after.oscillating} recurs in ${String(policy.threshold)} failed attempts of the round`
      : budgetUsed(after)
        ? `${String(after.used)} of ${String(after.of)} attempts used`
        : undefined;
  if (reason === undefined) return { action: "narrow", scope: scopeFor(after.attempt) };
  if (blocked === undefined) return { action: "escalate", why: reason };
  return { action: "parked", why: `${reason}; ${blocked}` };
}

/** The options of the ladder question (`kernel-loops`, End of the ladder). */
export function ladderOptions(target: string, part: string | undefined): string[] {
  return [
    `retry ${target} with a fresh budget`,
    `accept ${target} as debt`,
    ...(part === undefined ? [] : [`split part ${part}`]),
  ];
}

/**
 * The location of an entry: its first ref of the form `<path>` or
 * `<path>#<symbol>`, skipping entry, ticket, task, part and rule ids.
 */
export function refLocation(
  refs: readonly string[],
): { readonly file: string; readonly symbol?: string } | undefined {
  for (const ref of refs) {
    if (!isPathRef(ref)) continue;
    const at = ref.indexOf("#");
    if (at === -1) return { file: ref };
    const file = ref.slice(0, at);
    const symbol = ref.slice(at + 1);
    return symbol === "" ? { file } : { file, symbol };
  }
  return undefined;
}

const NOT_A_PATH = [
  /^(?:[^/]+\/)?[LAE]-[0-9a-z]{8}$/, // entry, ticket or evidence id, bare or qualified
  /^\d{2}-[1-9]\d*$/, // task id
  /^\d{2}$/, // part id
  /^(?:input|policy|state|runtime|kernel)\/[a-z0-9-]+$/, // rule id
];

function isPathRef(ref: string): boolean {
  return ref !== "" && !ref.startsWith("#") && !NOT_A_PATH.some((pattern) => pattern.test(ref));
}

function compare(a: string, b: string): number {
  return a < b ? -1 : a > b ? 1 : 0;
}
