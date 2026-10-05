// The closed value lists of `kernel-state` (and the role names of
// `role-contracts`) that the state schemas and the
// slices' `domain/` and `schema/` layers all name. Plain constants with no
// import, so the pure layers may read them (`kernel-architecture`, Slice
// anatomy); the import scan keeps this module free of imports.

export const ENTRY_TYPES = [
  "decision",
  "finding",
  "observation",
  "blocker",
  "question",
  "assumption",
  "risk",
  "learning",
  "report",
  "transition",
] as const;

export type EntryType = (typeof ENTRY_TYPES)[number];

/** The statuses an entry file stores; `superseded` is derived, never stored. */
export const STORED_STATUSES = ["proposed", "accepted", "resolved"] as const;

/** The orchestrator's triage levels of a finding, observation or blocker (T42-T). */
export const LEVELS = ["blocker", "should-fix", "nice-to-have", "not-a-problem"] as const;

/** The human's dispositions of an entry the review left open (T42-H), set by `log decide`. */
export const DISPOSITIONS = ["fix", "defer", "reject", "track"] as const;

export type Disposition = (typeof DISPOSITIONS)[number];

/** The statuses the kernel reports: the stored ones plus the derived `superseded`. */
export const ENTRY_STATUSES = ["proposed", "accepted", "superseded", "resolved"] as const;

/** Smallest first: a profile only ever rises. */
export const PROFILES = ["tiny", "small", "large"] as const;

export type Profile = (typeof PROFILES)[number];

/** `review` reviews work already on the branch (T42); its graph holds no design, plan or execute. */
export const CHANGE_KINDS = ["feature", "bug", "review"] as const;

export type ChangeKind = (typeof CHANGE_KINDS)[number];

/** The tool groups the pipeline runs through step kinds (`kernel-settings`, Tool entries; T49). */
export const TOOL_GROUPS = ["test", "lint"] as const;
export type ToolGroupName = (typeof TOOL_GROUPS)[number];

/** `configured` (one or more entries), `none` (declared not used) or `unset` (no layer sets it). */
export const TOOL_GROUP_STATES = ["configured", "none", "unset"] as const;
export type ToolGroupState = (typeof TOOL_GROUP_STATES)[number];

/** The tool groups declared none, sorted: the groups a Change does not use. */
export function groupsNotUsed(
  states: Readonly<Record<ToolGroupName, ToolGroupState>>,
): ToolGroupName[] {
  return TOOL_GROUPS.filter((group) => states[group] === "none").sort();
}

/** Who may open a Change: the user, or a skill on the user's behalf. */
export const CHANGE_SOURCES = ["user", "inferred"] as const;

/** The fixed provenance values (P1); every other source is `agent:<role>`. */
export const FIXED_SOURCES = ["user", "policy", "inferred", "kernel"] as const;

const AGENT = "agent:[a-z][a-z0-9-]*";

export const AGENT_SOURCE_PATTERN = new RegExp(`^${AGENT}$`);

/** A fixed provenance value or `agent:<role>`. */
export const SOURCE_PATTERN = new RegExp(`^(${FIXED_SOURCES.join("|")}|${AGENT})$`);

/** A rule id: `CQ-4`, `BDK-SEC-2`; the number never reuses a tombstone's. */
export const RULE_ID = /^[A-Z][A-Z0-9]*(?:-[A-Z][A-Z0-9]*)*-[1-9][0-9]*$/;

/** The loops a ticket counts against; `not-run` is a counter of each loop, not a loop. */
export const LOOPS = [
  "task-redispatch",
  "verify-fix",
  "review-fix",
  "verifier",
  "part-lead",
] as const;

export type Loop = (typeof LOOPS)[number];

/** How much of a review a retry reruns. */
export const TICKET_SCOPES = ["full", "high+", "blockers"] as const;

/** The states of an artifact graph node (`kernel-pipeline`, Node states). */
export const NODE_STATES = ["blocked", "ready", "done", "stale", "skipped"] as const;

export type NodeState = (typeof NODE_STATES)[number];

/** The sources of a transition that passes a gate (`kernel-pipeline`, Gate). */
export const GATE_PASSERS = ["user", "policy"] as const;

/** The role skills under `skills/roles/` (`role-contracts`, Role skills). */
export const ROLES = [
  "implementer",
  "simplifier",
  "verifier",
  "design-verifier",
  "reviewer",
  "integration-reviewer",
  "pr-reviewer",
  "runner",
  "scout",
  "lead",
] as const;

export type Role = (typeof ROLES)[number];

/** The fields of a ledger entry the blocking predicate reads. */
export interface BlockingFacts {
  readonly type: string;
  readonly status: string;
  readonly refs: readonly string[];
  readonly level?: string | undefined;
}

/**
 * Whether a live entry blocks the verdict of `node`: a `blocker` naming the
 * node, or, when the verdict counts triage (`review`, T42), any entry triaged
 * `blocker`. The `review` verdict and the review-fix package of `dispatch
 * build` share it, so the two never disagree (T42-D3).
 */
export function isBlocking(
  entry: BlockingFacts,
  node: string,
  options: { readonly triaged: boolean },
): boolean {
  if (entry.status !== "proposed" && entry.status !== "accepted") return false;
  if (entry.type === "blocker" && entry.refs.includes(node)) return true;
  return options.triaged && entry.level === "blocker";
}

/** Each command argument a run journal line keeps is cut to this many characters (`kernel-state`, Run journal). */
export const JOURNAL_VALUE_CHARS = 200;
